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
  }

  modeSelect.addEventListener("change", changeModeSelect);
});
