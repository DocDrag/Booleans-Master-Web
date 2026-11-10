import os
import sys
import socket
import threading
import json
import time
import queue
import re
import subprocess
import webbrowser
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

# Make sure working directory is the script directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

# Global variables for SSE and State management
subscribers_lock = threading.Lock()
subscribers = set()
latest_state = {
    "questionText": "???",
    "totalQuestions": 0,
    "correctAnswers": 0,
    "incorrectAnswers": 0,
    "stopGame": False,
    "resetBtnText": "Start",
    "resetBtnClass": "btn btn-success btn-lg",
    "lang": "c",
    "mode": "basic",
    "buttons": []
}

def broadcast_message(message: dict):
    """Send JSON message to all active SSE subscribers."""
    raw = f"data: {json.dumps(message, ensure_ascii=False)}\n\n".encode("utf-8")
    with subscribers_lock:
        to_remove = []
        for q in list(subscribers):
            try:
                q.put_nowait(raw)
            except Exception:
                to_remove.append(q)
        for q in to_remove:
            subscribers.discard(q)

def is_port_in_use(port: int) -> bool:
    """Check if a port is already occupied using connections and exclusive binding."""
    # 1. Check if another process is actively listening on 127.0.0.1:port
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.15)
            if s.connect_ex(("127.0.0.1", port)) == 0:
                return True
    except Exception:
        pass

    # 2. Check binding to 0.0.0.0 with SO_EXCLUSIVEADDRUSE on Windows
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                try:
                    s.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
                except Exception:
                    pass
            s.bind(("0.0.0.0", port))
    except OSError:
        return True

    # 3. Check binding to 127.0.0.1
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                try:
                    s.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
                except Exception:
                    pass
            s.bind(("127.0.0.1", port))
    except OSError:
        return True

    return False

def find_free_port(start_port=8000, max_port=9000):
    """Find the first genuinely free port starting from start_port."""
    for port in range(start_port, max_port):
        if not is_port_in_use(port):
            return port
    raise RuntimeError(f"Could not find an available port between {start_port} and {max_port}")

def get_network_ips():
    """Detect Tailscale, Wi-Fi, and LAN IP addresses."""
    tailscale_ip = None
    wifi_ip = None
    other_ips = []

    # 1. Inspect socket hostbyname
    try:
        _, _, host_ips = socket.gethostbyname_ex(socket.gethostname())
    except Exception:
        host_ips = []

    # 2. Inspect Windows ipconfig if available
    adapters = {}
    try:
        out = subprocess.check_output("ipconfig", text=True, errors="ignore")
        current_adapter = "Unknown"
        for line in out.splitlines():
            stripped = line.strip()
            if not line.startswith(" ") and stripped.endswith(":"):
                current_adapter = stripped[:-1]
            elif "IPv4 Address" in stripped or "IPv4" in stripped:
                m = re.search(r"(\d+\.\d+\.\d+\.\d+)", stripped)
                if m:
                    ip = m.group(1)
                    adapters[ip] = current_adapter
                    if ip not in host_ips and not ip.startswith("127."):
                        host_ips.append(ip)
    except Exception:
        pass

    for ip in host_ips:
        if ip.startswith("127."):
            continue
        adapter_name = adapters.get(ip, "").lower()
        # Tailscale check: CGNAT range 100.64.0.0/10 or adapter has tailscale in name
        if ip.startswith("100.") or "tailscale" in adapter_name:
            if not tailscale_ip:
                tailscale_ip = ip
        elif "wi-fi" in adapter_name or "wireless" in adapter_name:
            if not wifi_ip:
                wifi_ip = ip
        else:
            other_ips.append(ip)

    # Fallback if wifi_ip is still empty
    if not wifi_ip and other_ips:
        # Prefer private networks
        for ip in other_ips:
            if ip.startswith(("192.168.", "10.", "172.", "11.")):
                wifi_ip = ip
                break
        if not wifi_ip:
            wifi_ip = other_ips[0]

    return tailscale_ip, wifi_ip, host_ips

SERVER_PORT = find_free_port(8000)
TAILSCALE_IP, WIFI_IP, ALL_IPS = get_network_ips()

class RemoteAppHandler(SimpleHTTPRequestHandler):
    # Set explicit extensions map to prevent Windows registry MIME bugs
    extensions_map = SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update({
        ".js": "application/javascript; charset=utf-8",
        ".mjs": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml; charset=utf-8",
    })

    def log_message(self, format, *args):
        # Keep terminal clean: ignore SSE and ping noise
        if len(args) > 0 and any(x in str(args[0]) for x in ["/api/events", "/api/qrcode", "ping"]):
            return
        super().log_message(format, *args)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Route /remote to remote.html
        if path in ("/remote", "/remote/"):
            self.path = "/remote.html"
            return super().do_GET()

        # SSE Endpoint: /api/events
        if path == "/api/events":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache, no-transform")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("X-Accel-Buffering", "no")
            self.end_headers()

            client_queue = queue.Queue(maxsize=50)
            with subscribers_lock:
                subscribers.add(client_queue)

            try:
                # Send initial state and connected client count
                init_msg = {
                    "type": "init",
                    "state": latest_state,
                    "client_count": len(subscribers)
                }
                self.wfile.write(f"data: {json.dumps(init_msg, ensure_ascii=False)}\n\n".encode("utf-8"))
                self.wfile.flush()

                # Notify all clients about updated connection count
                broadcast_message({"type": "client_count", "count": len(subscribers)})

                while True:
                    try:
                        msg_bytes = client_queue.get(timeout=10.0)
                        self.wfile.write(msg_bytes)
                        self.wfile.flush()
                    except queue.Empty:
                        # Send heartbeat ping comment to keep connection alive
                        self.wfile.write(b": ping\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass
            finally:
                with subscribers_lock:
                    subscribers.discard(client_queue)
                broadcast_message({"type": "client_count", "count": len(subscribers)})
            return

        # Server Info Endpoint: /api/info
        if path == "/api/info":
            info = {
                "port": SERVER_PORT,
                "tailscale_ip": TAILSCALE_IP,
                "wifi_ip": WIFI_IP,
                "local_url": f"http://localhost:{SERVER_PORT}",
                "tailscale_url": f"http://{TAILSCALE_IP}:{SERVER_PORT}/remote" if TAILSCALE_IP else None,
                "wifi_url": f"http://{WIFI_IP}:{SERVER_PORT}/remote" if WIFI_IP else None,
                "connected_clients": len(subscribers)
            }
            body = json.dumps(info, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # Game State Endpoint: /api/state
        if path == "/api/state":
            body = json.dumps(latest_state, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # SVG QR Code Endpoint: /api/qrcode
        if path == "/api/qrcode":
            target = query.get("target", ["tailscale"])[0]
            url = query.get("url", [None])[0]

            if not url:
                if target == "tailscale" and TAILSCALE_IP:
                    url = f"http://{TAILSCALE_IP}:{SERVER_PORT}/remote"
                elif WIFI_IP:
                    url = f"http://{WIFI_IP}:{SERVER_PORT}/remote"
                else:
                    url = f"http://localhost:{SERVER_PORT}/remote"

            svg_bytes = b""
            try:
                import qrcode
                import qrcode.image.svg
                factory = qrcode.image.svg.SvgImage
                img = qrcode.make(url, image_factory=factory, box_size=10, border=2)
                svg_bytes = img.to_string()
            except Exception as e:
                # Fallback minimal SVG text if qrcode fails
                svg_bytes = f'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40"><text x="10" y="25" fill="red">{url}</text></svg>'.encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(svg_bytes)))
            self.end_headers()
            self.wfile.write(svg_bytes)
            return

        # Default static file serving
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        data = {}
        try:
            if body:
                data = json.loads(body.decode("utf-8"))
        except Exception:
            pass

        # Mobile Action -> Broadcast to PC
        if path == "/api/action":
            broadcast_message({
                "type": "action",
                "action": data.get("action"),
                "target": data.get("target"),
                "value": data.get("value")
            })
            resp = json.dumps({"ok": True}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
            return

        # PC State Update -> Broadcast to Mobile
        if path == "/api/state":
            global latest_state
            latest_state = data
            broadcast_message({
                "type": "state",
                "state": latest_state
            })
            resp = json.dumps({"ok": True}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
            return

        self.send_error(404, "Not Found")

def print_banner(port, tailscale_ip, wifi_ip):
    local_url = f"http://localhost:{port}"
    ts_url = f"http://{tailscale_ip}:{port}/remote" if tailscale_ip else None
    wifi_url = f"http://{wifi_ip}:{port}/remote" if wifi_ip else None

    print("\n" + "=" * 65)
    print("   🎮 Booleans Master - Remote Teaching Server")
    print("=" * 65)
    print(f" [✓] เซิร์ฟเวอร์พร้อมทำงานที่ Port: {port}")
    print()
    print(" 🖥️  หน้าจอหลักสำหรับคอมพิวเตอร์ (จอโปรเจกเตอร์ / PC):")
    print(f"     URL: {local_url}")
    print("     (ระบบกำลังเปิดเบราว์เซอร์อัตโนมัติ...)")
    print()
    print(" 📱 หน้าจอรีโมทสำหรับมือถือ (สำหรับเดินสอนนักเรียน):")
    if ts_url:
        print(f"     [1] ผ่าน Tailscale (แนะนำสุด สะดวก ทุกที่):")
        print(f"         {ts_url}")
    if wifi_url:
        print(f"     [2] ผ่าน Wi-Fi วงเดียวกัน:")
        print(f"         {wifi_url}")
    print("=" * 65)

    # Print ASCII QR code in terminal for Tailscale (or Wi-Fi)
    target_qr_url = ts_url or wifi_url or f"{local_url}/remote"
    try:
        import qrcode
        qr = qrcode.QRCode(border=1)
        qr.add_data(target_qr_url)
        qr.make(fit=True)
        print("\n 📲 สแกน QR Code นี้ด้วยกล้องมือถือ เพื่อเปิดรีโมททันที:")
        qr.print_ascii(invert=True)
    except Exception:
        pass

    print(" กด Ctrl + C ในหน้านี้เพื่อปิดเซิร์ฟเวอร์\n" + "-" * 65)

class ExclusiveThreadingHTTPServer(ThreadingHTTPServer):
    """Threading HTTPServer that strictly forbids address reuse on Windows to avoid port collisions."""
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            try:
                self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            except Exception:
                pass
        super().server_bind()

def open_browser(url):
    time.sleep(0.5)
    print(f"\n [🌐] กำลังเปิดหน้าเว็บบนเบราว์เซอร์: {url} ...")
    opened = False

    # 1. Native Windows ShellExecute (most reliable across Windows 10/11)
    if hasattr(os, "startfile"):
        try:
            os.startfile(url)
            opened = True
        except Exception:
            pass

    # 2. Standard library webbrowser
    if not opened:
        try:
            opened = webbrowser.open(url, new=2)
        except Exception:
            pass

    # 3. Fallback to Windows 'start' shell command
    if not opened:
        try:
            subprocess.Popen(f'start "" "{url}"', shell=True)
            opened = True
        except Exception:
            pass

def main():
    server_address = ("0.0.0.0", SERVER_PORT)
    httpd = ExclusiveThreadingHTTPServer(server_address, RemoteAppHandler)

    print_banner(SERVER_PORT, TAILSCALE_IP, WIFI_IP)

    # Launch browser for PC main screen in background thread
    threading.Thread(target=open_browser, args=(f"http://localhost:{SERVER_PORT}",), daemon=True).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] กำลังปิดเซิร์ฟเวอร์...")
    finally:
        httpd.server_close()
        print("[✓] ปิดเซิร์ฟเวอร์เรียบร้อยแล้ว")

if __name__ == "__main__":
    main()

