const ROUND_SIZE = 5;
const LAST_ROUND_KEY = "os-short-answer-last-round-v1";
const SHARE_CODE_KEY = "os-short-answer-share-code-v1";

const state = {
  scope: "all",
  current: [],
  answers: {},
  grading: false,
  result: null
};

const els = {
  bankCount: document.querySelector("#bankCount"),
  scoreLabel: document.querySelector("#scoreLabel"),
  scoreText: document.querySelector("#scoreText"),
  questionList: document.querySelector("#questionList"),
  message: document.querySelector("#message"),
  newRoundBtn: document.querySelector("#newRoundBtn"),
  submitBtn: document.querySelector("#submitBtn"),
  segments: Array.from(document.querySelectorAll(".segment"))
};

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function poolForScope(scope) {
  if (scope === "chapter1") return QUESTION_BANK.filter((q) => q.chapter === "第 1 章");
  if (scope === "chapter2") return QUESTION_BANK.filter((q) => q.chapter === "第 2 章");
  if (scope === "chapter3") return QUESTION_BANK.filter((q) => q.chapter === "第 3 章");
  if (scope === "chapter4") return QUESTION_BANK.filter((q) => q.chapter === "第 4 章");
  if (scope === "chapter5") return QUESTION_BANK.filter((q) => q.chapter === "第 5 章");
  if (scope === "high") return QUESTION_BANK.filter((q) => q.level === "高频");
  if (scope === "pv") {
    return QUESTION_BANK.filter((q) =>
      q.tags.some((tag) => ["同步互斥", "PV", "死锁"].includes(tag))
    );
  }
  return QUESTION_BANK;
}

function getLastRoundIds() {
  try {
    return JSON.parse(localStorage.getItem(LAST_ROUND_KEY) || "[]");
  } catch {
    return [];
  }
}

function setLastRoundIds(ids) {
  try {
    localStorage.setItem(LAST_ROUND_KEY, JSON.stringify(ids));
  } catch {
    // file:// or restricted storage can fail; the current round still works.
  }
}

function pickQuestions() {
  const pool = poolForScope(state.scope);
  const lastIds = new Set(getLastRoundIds());
  const fresh = pool.filter((q) => !lastIds.has(q.id));
  const source = fresh.length >= ROUND_SIZE ? fresh : pool;
  return shuffle(source).slice(0, Math.min(ROUND_SIZE, source.length));
}

function startRound() {
  state.current = pickQuestions();
  state.answers = {};
  state.result = null;
  state.grading = false;
  setLastRoundIds(state.current.map((q) => q.id));
  els.scoreLabel.textContent = "本轮状态";
  els.scoreText.textContent = "未提交";
  hideMessage();
  if (!state.current.length) showMessage("当前范围没有题目。", true);
  render();
}

function showMessage(text, isError = false) {
  els.message.textContent = text;
  els.message.classList.toggle("error", isError);
  els.message.hidden = false;
}

function hideMessage() {
  els.message.hidden = true;
  els.message.textContent = "";
  els.message.classList.remove("error");
}

function answeredCount() {
  return state.current.filter((q) => String(state.answers[q.id] || "").trim()).length;
}

function render() {
  els.bankCount.textContent = `${QUESTION_BANK.length} 题`;
  els.submitBtn.disabled = state.grading || state.current.length === 0;
  els.newRoundBtn.disabled = state.grading;
  els.submitBtn.textContent = state.grading ? "批改中..." : "提交批改";

  els.questionList.innerHTML = "";
  state.current.forEach((question, index) => {
    els.questionList.appendChild(renderQuestion(question, index));
  });
}

function renderQuestion(question, index) {
  const card = document.createElement("article");
  card.className = "question-card";
  const result = state.result?.items?.find((item) => item.id === question.id);
  const tagHTML = [
    `第 ${index + 1} 题`,
    question.chapter,
    question.section,
    question.topic,
    question.level
  ]
    .map((tag) => `<span class="tag ${tag === "高频" ? "hot" : ""}">${escapeHTML(tag)}</span>`)
    .join("");

  card.innerHTML = `
    <div class="question-head">
      <div class="question-meta">${tagHTML}</div>
      <span class="tag">${question.points} 分</span>
    </div>
    <p class="stem">${escapeHTML(question.prompt)}</p>
    <textarea
      class="answer-box"
      data-id="${escapeHTML(question.id)}"
      placeholder="按“定义 + 分点 + 特点/区别/例子”的方式作答。"
      ${state.grading ? "disabled" : ""}
    >${escapeHTML(state.answers[question.id] || "")}</textarea>
    <p class="hint-line">关键词方向：${escapeHTML(question.keyPoints.slice(0, 6).join("、"))}</p>
  `;

  const textarea = card.querySelector("textarea");
  textarea.addEventListener("input", () => {
    state.answers[question.id] = textarea.value;
    if (!state.result) {
      els.scoreLabel.textContent = "已作答";
      els.scoreText.textContent = `${answeredCount()} / ${state.current.length}`;
    }
  });

  if (result) {
    card.appendChild(renderGradeBlock(question, result));
  }

  return card;
}

function verdictClass(verdict, score, maxScore) {
  const normalized = String(verdict || "");
  const ratio = Number(score || 0) / Number(maxScore || 1);
  if (normalized.includes("正确") && !normalized.includes("部分")) return "good";
  if (ratio >= 0.72) return "good";
  if (ratio >= 0.38) return "mid";
  return "bad";
}

function renderList(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return `<ul class="feedback-list">${items.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`;
}

function renderGradeBlock(question, result) {
  const block = document.createElement("section");
  block.className = "grade-block";
  const score = Number(result.score ?? 0);
  const maxScore = Number(result.maxScore ?? question.points);
  const verdict = result.verdict || (score >= maxScore * 0.8 ? "基本正确" : "需要补充");

  block.innerHTML = `
    <div class="grade-head">
      <span class="pill ${verdictClass(verdict, score, maxScore)}">${escapeHTML(verdict)}</span>
      <span class="grade-score">${score} / ${maxScore} 分</span>
    </div>
    <div><strong>点评：</strong>${escapeHTML(result.feedback || "DeepSeek 没有返回点评。")}</div>
    ${
      Array.isArray(result.missing) && result.missing.length
        ? `<div><strong>缺漏点：</strong>${renderList(result.missing)}</div>`
        : ""
    }
    ${
      Array.isArray(result.strengths) && result.strengths.length
        ? `<div><strong>得分点：</strong>${renderList(result.strengths)}</div>`
        : ""
    }
    <details class="reference">
      <summary>查看参考答案和评分关键词</summary>
      <p>${escapeHTML(result.sampleAnswer || question.expectedAnswer)}</p>
      <p><strong>关键词：</strong>${escapeHTML(question.keyPoints.join("、"))}</p>
    </details>
  `;
  return block;
}

function normalizeGradeResponse(data) {
  const fallbackItems = state.current.map((q) => ({
    id: q.id,
    score: 0,
    maxScore: q.points,
    verdict: "未批改",
    feedback: "DeepSeek 返回格式异常，无法解析本题评分。",
    missing: q.keyPoints,
    strengths: [],
    sampleAnswer: q.expectedAnswer
  }));

  if (!data || !Array.isArray(data.items)) {
    return {
      totalScore: 0,
      maxScore: state.current.reduce((sum, q) => sum + q.points, 0),
      items: fallbackItems,
      overall: "返回格式异常。"
    };
  }

  const items = state.current.map((q) => {
    const item = data.items.find((entry) => entry.id === q.id) || {};
    const maxScore = Number(item.maxScore ?? q.points);
    const rawScore = Number(item.score ?? 0);
    return {
      id: q.id,
      score: Math.max(0, Math.min(maxScore, Number.isFinite(rawScore) ? rawScore : 0)),
      maxScore,
      verdict: item.verdict || "部分正确",
      feedback: item.feedback || "",
      missing: Array.isArray(item.missing) ? item.missing : [],
      strengths: Array.isArray(item.strengths) ? item.strengths : [],
      sampleAnswer: item.sampleAnswer || q.expectedAnswer
    };
  });

  const maxScore = items.reduce((sum, item) => sum + item.maxScore, 0);
  const totalScore = items.reduce((sum, item) => sum + item.score, 0);
  return {
    totalScore,
    maxScore,
    items,
    overall: data.overall || ""
  };
}

async function submitForGrade() {
  if (state.grading || !state.current.length) return;

  const emptyCount = state.current.length - answeredCount();
  if (emptyCount > 0) {
    showMessage(`还有 ${emptyCount} 题没有作答。空白题也会提交，但通常会被判为 0 分。`);
  } else {
    hideMessage();
  }

  state.grading = true;
  state.result = null;
  render();

  try {
    const payload = {
      items: state.current.map((q) => ({
        id: q.id,
        chapter: q.chapter,
        section: q.section,
        topic: q.topic,
        prompt: q.prompt,
        points: q.points,
        expectedAnswer: q.expectedAnswer,
        keyPoints: q.keyPoints,
        answer: state.answers[q.id] || ""
      }))
    };

    const response = await postGrade(payload);

    let data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `批改接口错误：${response.status}`);
    }

    if (response.status === 202 && data.jobId) {
      showMessage("已提交，DeepSeek 正在批改。公网分享时可能需要等十几秒。");
      data = await pollGradeResult(data.jobId);
    }

    state.result = normalizeGradeResponse(data);
    els.scoreLabel.textContent = "DeepSeek 评分";
    els.scoreText.textContent = `${state.result.totalScore} / ${state.result.maxScore}`;
    showMessage(state.result.overall || "批改完成。重点看每题的缺漏点，把答案改成分点式会更稳。");
  } catch (error) {
    state.result = null;
    els.scoreLabel.textContent = "本轮状态";
    els.scoreText.textContent = `${answeredCount()} / ${state.current.length}`;
    showMessage(error.message || "批改失败，请检查服务端和 API key。", true);
  } finally {
    state.grading = false;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function getShareCode() {
  try {
    return localStorage.getItem(SHARE_CODE_KEY) || "";
  } catch {
    return "";
  }
}

function setShareCode(value) {
  try {
    localStorage.setItem(SHARE_CODE_KEY, value);
  } catch {
    // Restricted storage can fail; the code still works for the current submit.
  }
}

async function postGrade(payload, code = getShareCode()) {
  const headers = { "Content-Type": "application/json" };
  if (code) headers["X-Share-Code"] = code;

  const response = await fetch("/api/grade", {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (response.status !== 401) return response;

  const nextCode = window.prompt("请输入访问码后再批改：");
  if (!nextCode) return response;
  setShareCode(nextCode.trim());
  return postGrade(payload, nextCode.trim());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollGradeResult(jobId) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    await sleep(2200);
    const headers = {};
    const code = getShareCode();
    if (code) headers["X-Share-Code"] = code;

    const response = await fetch(`/api/grade-result?id=${encodeURIComponent(jobId)}`, {
      headers
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 202) continue;
    if (!response.ok) {
      throw new Error(data.error || `批改结果接口错误：${response.status}`);
    }
    return data;
  }

  throw new Error("批改等待超时，请稍后换一轮或重新提交。");
}

els.newRoundBtn.addEventListener("click", startRound);
els.submitBtn.addEventListener("click", submitForGrade);

els.segments.forEach((button) => {
  button.addEventListener("click", () => {
    state.scope = button.dataset.scope;
    els.segments.forEach((segment) => segment.classList.toggle("active", segment === button));
    startRound();
  });
});

startRound();
