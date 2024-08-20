import { getRandomInt, getRandomFloat } from "./random.js";

// เมื่อหน้าเว็บโหลดขึ้นมา ให้ปุ่ม Reset มีชื่อว่า "Start"
document.addEventListener("DOMContentLoaded", function () {
  const resetBtn = document.getElementById("reset-btn");
  resetBtn.innerHTML = '<i class="fas fa-random"></i> Start';
});

document.addEventListener("DOMContentLoaded", function () {
  const trueBtn = document.getElementById("true-btn");
  const falseBtn = document.getElementById("false-btn");
  const resetBtn = document.getElementById("reset-btn");
  const resultDiv = document.getElementById("result");
  const modeSelect = document.getElementById("mode-select");
  const totalQuestionsEl = document.getElementById("total-questions");
  const correctAnswersEl = document.getElementById("correct-answers");
  const incorrectAnswersEl = document.getElementById("incorrect-answers");

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
  });

  trueBtn.addEventListener("click", () => {
    if (totalQuestions > 0){
      checkAnswer(true);
      // สุ่มคำถามขึ้นมา
      generateQuestion();
    }
  });

  falseBtn.addEventListener("click", () => {
    if (totalQuestions > 0){
      checkAnswer(false);
      // สุ่มคำถามขึ้นมา
      generateQuestion();
    }
  });

  function resetGame() {
    totalQuestions = 0;
    correctAnswers = 0;
    incorrectAnswers = 0;
    updateScore();
  }

  function generateValue() {
    let value = getRandomInt(-1000, 1000);
    if (value < 0) {
      value = "(" + value + ")";
    }

    return value
  }

  function generateBasic(basicQuestions) {
    let aValue = generateValue();
    let bValue = generateValue();

    const randomQuestion =
      basicQuestions[Math.floor(Math.random() * basicQuestions.length)];

    return (aValue + randomQuestion + bValue)
  }

  function generateQuestion() {
    const mode = modeSelect.value;

    const basicQuestions = [" == ", " != ", " > ", " < ", " >= ", " <= "];
    const advancedQuestions = [...basicQuestions, "!", "&&", "||"];

    if (mode === "basic") {
      // สุ่มเลือกคำถามสำหรับ Basic Mode
      resultDiv.innerText = generateBasic(basicQuestions);
    } else if (mode === "advanced") {
      // สุ่มเลือกคำถามสำหรับ Advanced Mode
      const randomQuestion =
        advancedQuestions[Math.floor(Math.random() * advancedQuestions.length)];

      if (randomQuestion === "!") {
        resultDiv.innerText =
          "!" + "(" + generateBasic(basicQuestions) + ")";
      } else if (randomQuestion === "&&") {
        resultDiv.innerText = "(" + generateBasic(basicQuestions) + ")" + " && " + "(" + generateBasic(basicQuestions) + ")";
      } else if (randomQuestion === "||") {
        resultDiv.innerText = "(" + generateBasic(basicQuestions) + ")" + " || " + "(" + generateBasic(basicQuestions) + ")";
      } else {
        resultDiv.innerText = generateBasic(basicQuestions);
      }
    }

    totalQuestions++;
    updateScore();
  }

  function checkAnswer(isTrueSelected) {
    const expression = resultDiv.innerText;
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
    totalQuestionsEl.textContent = "Total: " + totalQuestions;
    correctAnswersEl.textContent = "Correct: " + correctAnswers;
    incorrectAnswersEl.textContent = "Incorrect: " + incorrectAnswers;
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

    correctProgressBar.style.width = correctPercentage + "%";
    correctProgressBar.setAttribute("aria-valuenow", correctPercentage);
    correctProgressBar.textContent = Math.round(correctPercentage) + "%";

    incorrectProgressBar.style.width = incorrectPercentage + "%";
    incorrectProgressBar.setAttribute("aria-valuenow", incorrectPercentage);
    incorrectProgressBar.textContent = Math.round(incorrectPercentage) + "%";

    totalQuestions++;
  }
});
