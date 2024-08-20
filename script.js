import { getRandomInt, getRandomFloat } from "./random.js";

// เมื่อหน้าเว็บโหลดขึ้นมา ให้ปุ่ม Reset มีชื่อว่า "Start"
document.addEventListener("DOMContentLoaded", function () {
  const resetBtn = document.getElementById("reset-btn");
  const resultDiv = document.getElementById("result");
  const modeSelect = document.getElementById("mode-select");
  const totalQuestionsEl = document.getElementById("total-questions");
  const correctAnswersEl = document.getElementById("correct-answers");
  const incorrectAnswersEl = document.getElementById("incorrect-answers");
  const skipAnswersEl = document.getElementById("skip-answers");

  let totalQuestions = 0;
  let correctAnswers = 0;
  let incorrectAnswers = 0;
  let skipAnswers = 0;

  resetBtn.innerHTML = '<i class="fas fa-random"></i> Start';

  resetBtn.addEventListener("click", () => {
    // เปลี่ยนชื่อปุ่มคืนเป็น Reset
    resetBtn.innerHTML = '<i class="fas fa-random"></i> Reset';

    // reset คะแนนกลับเป็นค่าเริ่มต้น
    resetGame();

    // สุ่มคำถามขึ้นมา
    generateQuestion();
  });

  function resetGame() {
    totalQuestions = 0;
    correctAnswers = 0;
    incorrectAnswers = 0;
    skipAnswers = 0;
    updateScore();
  }

  function generateQuestion() {
    const mode = modeSelect.value;

    const basicQuestions = [" == ", " != ", " > ", " < ", " >= ", " <= "];
    const advancedQuestions = [...basicQuestions, "!"];

    let aValue = getRandomInt(-1000, 1000);
    let bValue = getRandomInt(-1000, 1000);
    if (aValue < 0) {
      aValue = "(" + aValue + ")";
    }
    if (bValue < 0) {
      bValue = "(" + bValue + ")";
    }

    if (mode === "basic") {
      // สุ่มเลือกคำถามสำหรับ Basic Mode
      const randomQuestion =
        basicQuestions[Math.floor(Math.random() * basicQuestions.length)];

      resultDiv.innerText = aValue + randomQuestion + bValue;
    } else if (mode === "advanced") {
      // สุ่มเลือกคำถามสำหรับ Advanced Mode
      const randomQuestion =
        advancedQuestions[Math.floor(Math.random() * advancedQuestions.length)];

      if (randomQuestion === "!") {
        const randomOperator =
          basicQuestions[Math.floor(Math.random() * basicQuestions.length)];
        resultDiv.innerText =
          "!" + "(" + aValue + randomOperator + bValue + ")";
      } else {
        resultDiv.innerText = aValue + randomQuestion + bValue;
      }
    }

    totalQuestions++;
    updateScore();
  }

  function updateScore() {
    totalQuestionsEl.textContent = "Total: " + totalQuestions;
    correctAnswersEl.textContent = "Correct: " + correctAnswers;
    incorrectAnswersEl.textContent = "Incorrect: " + incorrectAnswers;
    skipAnswersEl.textContent = "Skip: " + skipAnswers;
    updateProgressBar();
  }

  function updateProgressBar() {
    const correctPercentage =
      totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    const incorrectPercentage =
      totalQuestions > 0 ? (incorrectAnswers / totalQuestions) * 100 : 0;
    const withoutPercentage =
      totalQuestions > 0 ? (skipAnswers / totalQuestions) * 100 : 0;

    const correctProgressBar = document.getElementById("correct-progress-bar");
    const incorrectProgressBar = document.getElementById(
      "incorrect-progress-bar"
    );
    const withoutProgressBar = document.getElementById("without-progress-bar");

    correctProgressBar.style.width = correctPercentage + "%";
    correctProgressBar.setAttribute("aria-valuenow", correctPercentage);
    correctProgressBar.textContent = Math.round(correctPercentage) + "%";

    incorrectProgressBar.style.width = incorrectPercentage + "%";
    incorrectProgressBar.setAttribute("aria-valuenow", incorrectPercentage);
    incorrectProgressBar.textContent = Math.round(incorrectPercentage) + "%";

    withoutProgressBar.style.width = withoutPercentage + "%";
    withoutProgressBar.setAttribute("aria-valuenow", withoutPercentage);
    withoutProgressBar.textContent = Math.round(withoutPercentage) + "%";
  }
});
