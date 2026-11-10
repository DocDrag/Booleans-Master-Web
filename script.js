import { getRandomInt, getRandomFloat } from "./random.js";

document.addEventListener("DOMContentLoaded", function () {
  const trueBtn = document.getElementById("true-btn");
  const falseBtn = document.getElementById("false-btn");
  const resetBtn = document.getElementById("reset-btn");
  const resultDiv = document.getElementById("result");
  const modeSelect = document.getElementById("mode-select");
  const totalQuestionsEl = document.getElementById("total-questions");
  const correctAnswersEl = document.getElementById("correct-answers");
  const incorrectAnswersEl = document.getElementById("incorrect-answers");

  // เมื่อหน้าเว็บโหลดขึ้นมา ให้ปุ่ม Reset มีชื่อว่า "Start"
  resetBtn.innerHTML = '<i class="fas fa-random"></i> Start';

  let totalQuestions = 0;
  let correctAnswers = 0;
  let incorrectAnswers = 0;

  resetBtn.addEventListener("click", () => {
    // เปลี่ยนชื่อปุ่มคืนเป็น Reset
    resetBtn.innerHTML = '<i class="fas fa-random"></i> Reset';
    // reset คะแนนกลับเป็นค่าเริ่มต้น
    resetGame();
    // สุ่มคำถามขึ้นมา
    generateQuestion();
    syncStateToRemote();
  });

  trueBtn.addEventListener("click", () => {
    if (totalQuestions > 0) {
      checkAnswer(true);
      generateQuestion();
      syncStateToRemote();
    }
  });

  falseBtn.addEventListener("click", () => {
    if (totalQuestions > 0) {
      checkAnswer(false);
      generateQuestion();
      syncStateToRemote();
    }
  });

  function resetGame() {
    totalQuestions = 0;
    correctAnswers = 0;
    incorrectAnswers = 0;
    updateScore();
  }

  function generateValue() {
    let value = getRandomInt(-100, 100);
    if (value < 0) {
      value = `(${value})`;
    }
    return value;
  }

  function generateBasic(basicQuestions) {
    let aValue = generateValue();
    let bValue = generateValue();

    const randomQuestion =
      basicQuestions[Math.floor(Math.random() * basicQuestions.length)];

    return `${aValue}${randomQuestion}${bValue}`;
  }

  function generateIntermediate(basicQuestions, intermediateQuestions) {
    const randomQuestion =
      intermediateQuestions[Math.floor(Math.random() * intermediateQuestions.length)];

    let text = "";

    if (randomQuestion === "!") {
      text = `!(${generateBasic(basicQuestions)})`;
    } else if (randomQuestion === "&&") {
      text = `(${generateBasic(basicQuestions)}) && (${generateBasic(basicQuestions)})`;
    } else if (randomQuestion === "||") {
      text = `(${generateBasic(basicQuestions)}) || (${generateBasic(basicQuestions)})`;
    } else {
      text = generateBasic(basicQuestions);
    }

    return text;
  }

  // ฟังก์ชันใส่สีให้กับวงเล็บ
  function colorizeBrackets(expression) {
    const colors = ["red", "blue", "green", "purple"];
    let colorIndex = 0;
    let depth = 0;

    return expression.replace(/[()]/g, (bracket) => {
      if (bracket === "(") {
        depth++;
        colorIndex = (depth - 1) % colors.length;
        return `<span style="color: ${colors[colorIndex]}">${bracket}</span>`;
      } else if (bracket === ")") {
        const coloredBracket = `<span style="color: ${colors[(depth - 1) % colors.length]}">${bracket}</span>`;
        depth--;
        return coloredBracket;
      }
    });
  }

  function generateQuestion() {
    const mode = modeSelect.value;

    const basicQuestions = [" == ", " != ", " > ", " < ", " >= ", " <= "];
    const intermediateQuestions = [...basicQuestions, "!", "&&", "||"];

    let question;
    if (mode === "basic") {
      question = generateBasic(basicQuestions);
    } else if (mode === "intermediate") {
      question = generateIntermediate(basicQuestions, intermediateQuestions);
    } else if (mode === "advanced") {
      let randomChoice = getRandomFloat(0, 1, 2);
      if (randomChoice <= 0.33) {
        question = generateIntermediate(basicQuestions, intermediateQuestions);
      } else if (randomChoice <= 0.66) {
        question = `!(${generateIntermediate(basicQuestions, intermediateQuestions)})`;
      } else {
        const advancedQuestions = ["&&", "||"];
        const randomQuestion = advancedQuestions[Math.floor(Math.random() * advancedQuestions.length)];
        question = `(${generateIntermediate(basicQuestions, intermediateQuestions)}) ${randomQuestion} (${generateBasic(basicQuestions)})`;
      }
    }

    resultDiv.innerHTML = colorizeBrackets(question);
    totalQuestions++;
    updateScore();
  }

  function checkAnswer(isTrueSelected) {
    const expression = resultDiv.innerText.replace(/<[^>]+>/g, ""); // ลบ tag HTML ออกก่อนประเมินผล
    let evaluatedResult;
    try {
      evaluatedResult = eval(expression);
    } catch (error) {
      evaluatedResult = false;
    }

    if (evaluatedResult === isTrueSelected) {
      correctAnswers++;
    } else {
      incorrectAnswers++;
    }

    updateScore();
  }

  function updateScore() {
    totalQuestionsEl.textContent = `Total: ${totalQuestions}`;
    correctAnswersEl.textContent = `Correct: ${correctAnswers}`;
    incorrectAnswersEl.textContent = `Incorrect: ${incorrectAnswers}`;
    updateProgressBar();
  }

  function updateProgressBar() {
    totalQuestions--;
    const correctPercentage =
      totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    const incorrectPercentage =
      totalQuestions > 0 ? (incorrectAnswers / totalQuestions) * 100 : 0;

    const correctProgressBar = document.getElementById("correct-progress-bar");
    const incorrectProgressBar = document.getElementById(
      "incorrect-progress-bar"
    );

    correctProgressBar.style.width = `${correctPercentage}%`;
    correctProgressBar.setAttribute("aria-valuenow", correctPercentage);
    correctProgressBar.textContent = `${Math.round(correctPercentage)}%`;

    incorrectProgressBar.style.width = `${incorrectPercentage}%`;
    incorrectProgressBar.setAttribute("aria-valuenow", incorrectPercentage);
    incorrectProgressBar.textContent = `${Math.round(incorrectPercentage)}%`;

    totalQuestions++;
  }

  function changeModeSelect() {
    resetGame();
    generateQuestion();
    syncStateToRemote();
  }

  modeSelect.addEventListener("change", changeModeSelect);

  // ==========================================
  // Remote Control & Live Teaching Sync
  // ==========================================
  let isTeachingMode = false;
  let eventSource = null;

  function syncStateToRemote() {
    if (!isTeachingMode || !window.location.protocol.startsWith("http")) return;

    const state = {
      questionText: resultDiv.innerText.trim(),
      totalQuestions: totalQuestions,
      correctAnswers: correctAnswers,
      incorrectAnswers: incorrectAnswers,
      resetBtnText: resetBtn.innerText.trim(),
      mode: modeSelect.value,
      buttons: [
        { id: "true-btn", index: 0, text: "True", className: "btn btn-success btn-lg" },
        { id: "false-btn", index: 1, text: "False", className: "btn btn-danger btn-lg" }
      ],
    };

    fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    }).catch(() => {});
  }

  function handleRemoteAction(data) {
    if (data.action === "request_state") {
      syncStateToRemote();
      return;
    }

    if (data.action === "click") {
      const el = document.getElementById(data.target);
      if (el) {
        el.classList.add("remote-click-active");
        setTimeout(() => el.classList.remove("remote-click-active"), 250);
        el.click();
      }
    } else if (data.action === "set_mode") {
      if (data.value && modeSelect.value !== data.value) {
        modeSelect.value = data.value;
        changeModeSelect();
      }
    }
  }

  function updateClientCountUI(count) {
    const remoteCountBadge = document.getElementById("remote-badge-count");
    const remotePillText = document.getElementById("remote-pill-text");
    const modalStatusText = document.getElementById("modal-status-text");
    const modalStatusDot = document.getElementById("modal-status-dot");

    const remoteDevices = Math.max(0, count - 1);

    if (remoteCountBadge) {
      remoteCountBadge.textContent = remoteDevices;
      remoteCountBadge.className = remoteDevices > 0 ? "badge bg-success ms-1" : "badge bg-secondary ms-1";
    }

    if (remotePillText) {
      remotePillText.textContent = remoteDevices > 0 ? `รีโมท: ${remoteDevices} เครื่อง 🟢` : "รีโมทมือถือ (Remote)";
    }

    if (modalStatusText) {
      if (remoteDevices > 0) {
        modalStatusText.textContent = `เชื่อมต่อแล้ว ${remoteDevices} เครื่อง (พร้อมควบคุมระยะไกล)`;
        if (modalStatusDot) modalStatusDot.className = "fas fa-circle text-success me-2 fs-6";
      } else {
        modalStatusText.textContent = "ยังไม่มีเครื่องเชื่อมต่อ (รอสแกน QR Code)";
        if (modalStatusDot) modalStatusDot.className = "fas fa-circle text-muted me-2 fs-6";
      }
    }
  }

  function initSSE() {
    if (!isTeachingMode || !window.location.protocol.startsWith("http")) return;
    if (eventSource) return;

    eventSource = new EventSource("/api/events");

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "action") {
          handleRemoteAction(data);
        } else if (data.type === "client_count") {
          updateClientCountUI(data.count);
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };
  }

  function populateServerInfo(info) {
    const urlTs = document.getElementById("url-tailscale");
    const urlWifi = document.getElementById("url-wifi");
    const qrTs = document.getElementById("qr-img-tailscale");
    const qrWifi = document.getElementById("qr-img-wifi");

    if (urlTs && info.tailscale_url) {
      urlTs.value = info.tailscale_url;
    } else if (urlTs) {
      urlTs.value = "ไม่พบ Tailscale IP (โปรดตรวจสอบการเปิด Tailscale)";
    }

    if (urlWifi && info.wifi_url) {
      urlWifi.value = info.wifi_url;
    } else if (urlWifi) {
      urlWifi.value = info.local_url + "/remote";
    }

    if (qrTs && info.tailscale_url) {
      qrTs.src = "/api/qrcode?target=tailscale";
      qrTs.style.display = "block";
    }
    if (qrWifi && info.wifi_url) {
      qrWifi.src = "/api/qrcode?target=wifi";
      qrWifi.style.display = "block";
    }

    setupCopyButtons();
  }

  function enableTeachingMode(info) {
    isTeachingMode = true;

    const teacherBar = document.getElementById("teacher-control-bar");
    if (teacherBar) {
      teacherBar.classList.remove("d-none");
      teacherBar.classList.add("d-flex");
    }

    populateServerInfo(info);
    initSSE();
    syncStateToRemote();
  }

  function setupCopyButtons() {
    const btnTs = document.getElementById("btn-copy-tailscale");
    const btnWifi = document.getElementById("btn-copy-wifi");

    if (btnTs) {
      btnTs.onclick = () => {
        const input = document.getElementById("url-tailscale");
        if (input && input.value) {
          navigator.clipboard.writeText(input.value);
          btnTs.innerHTML = '<i class="fas fa-check text-success"></i>';
          setTimeout(() => (btnTs.innerHTML = '<i class="fas fa-copy"></i>'), 1500);
        }
      };
    }

    if (btnWifi) {
      btnWifi.onclick = () => {
        const input = document.getElementById("url-wifi");
        if (input && input.value) {
          navigator.clipboard.writeText(input.value);
          btnWifi.innerHTML = '<i class="fas fa-check text-success"></i>';
          setTimeout(() => (btnWifi.innerHTML = '<i class="fas fa-copy"></i>'), 1500);
        }
      };
    }
  }

  // Fullscreen button toggle
  const btnFullscreen = document.getElementById("btn-fullscreen");
  if (btnFullscreen) {
    btnFullscreen.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        btnFullscreen.innerHTML = '<i class="fas fa-compress"></i>';
      } else {
        document.exitFullscreen().catch(() => {});
        btnFullscreen.innerHTML = '<i class="fas fa-expand"></i>';
      }
    });

    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) {
        btnFullscreen.innerHTML = '<i class="fas fa-expand"></i>';
      } else {
        btnFullscreen.innerHTML = '<i class="fas fa-compress"></i>';
      }
    });
  }

  // ==========================================
  // Auto-detect Python Server (run_server.py)
  // ถ้าไม่ได้กด run ผ่าน .py จะคงสถานะหน้าเว็บแบบเดิม
  // ==========================================
  function detectPythonServer() {
    const hostname = window.location.hostname;
    const isStaticHost =
      window.location.protocol === "file:" ||
      hostname.endsWith("github.io") ||
      hostname.includes("github.io");

    if (isStaticHost) {
      return;
    }

    fetch("/api/info", { cache: "no-store" })
      .then((res) => {
        if (res.ok && res.headers.get("content-type")?.includes("json")) {
          return res.json();
        }
        throw new Error("Not run_server.py");
      })
      .then((info) => {
        if (info && info.port) {
          enableTeachingMode(info);
        }
      })
      .catch(() => {});
  }

  detectPythonServer();
});
