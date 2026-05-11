const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const SHARE_CODE = process.env.SHARE_CODE || "";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readPayload(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 250_000) {
      const error = new Error("请求内容过大。");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function stripJsonFence(text) {
  const value = String(text || "").trim();
  const match = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : value;
}

function sanitizeItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 5) {
    const error = new Error("每次必须提交 1 到 5 道题。");
    error.status = 400;
    throw error;
  }

  return items.map((item) => ({
    id: String(item.id || "").slice(0, 80),
    chapter: String(item.chapter || "").slice(0, 40),
    section: String(item.section || "").slice(0, 80),
    topic: String(item.topic || "").slice(0, 80),
    prompt: String(item.prompt || "").slice(0, 1000),
    points: Number(item.points || 6),
    expectedAnswer: String(item.expectedAnswer || "").slice(0, 2500),
    keyPoints: Array.isArray(item.keyPoints)
      ? item.keyPoints.map((point) => String(point).slice(0, 120)).slice(0, 12)
      : [],
    answer: String(item.answer || "").slice(0, 3000)
  }));
}

function buildMessages(items) {
  const gradingText = items
    .map((item, index) => {
      const studentAnswer = item.answer.trim() ? item.answer : "__BLANK_ANSWER__";
      return [
        `<question index="${index + 1}" id="${item.id}" max_score="${item.points}">`,
        `<chapter>${item.chapter} ${item.section}</chapter>`,
        `<topic>${item.topic}</topic>`,
        `<prompt>${item.prompt}</prompt>`,
        "<student_answer>",
        studentAnswer,
        "</student_answer>",
        "<reference_answer>",
        item.expectedAnswer,
        "</reference_answer>",
        `<grading_keywords>${item.keyPoints.join("、")}</grading_keywords>`,
        "</question>"
      ].join("\n");
    })
    .join("\n\n---\n\n");

  return [
    {
      role: "system",
      content:
        "你是操作系统期末概念简答题阅卷老师。请严格参考 reference_answer 和 grading_keywords 评分，但允许同义表达。只有 student_answer 完整等于 __BLANK_ANSWER__ 时才判为空白答案；只要有其他文字，就必须按内容给分。评分像真题简答：看定义是否准确、作用是否说清、关键特点是否完整、比较维度是否清楚、例子是否贴切。不要因为表述不完全一致就扣太重，但关键概念错要扣分。必须只返回 JSON。"
    },
    {
      role: "user",
      content: `请批改下面的操作系统概念简答题。每题分数必须在 0 到满分之间，可以给 0.5 分。student_answer 为 __BLANK_ANSWER__ 或明显无关时给 0 分；答出定义但缺少作用、特点、区别或例子，一般给 40%-70%；比较题要看比较维度是否完整，概念题要看关键词是否准确。feedback 用中文，短一点，直接指出如何补分。sampleAnswer 必须返回该题 reference_answer 的简明版。
请只返回如下 JSON，不要加 Markdown：
{
  "totalScore": number,
  "maxScore": number,
  "overall": "string",
  "items": [
    {
      "id": "string",
      "score": number,
      "maxScore": number,
      "verdict": "正确 | 基本正确 | 部分正确 | 错误",
      "strengths": ["string"],
      "missing": ["string"],
      "feedback": "string",
      "sampleAnswer": "string"
    }
  ]
}

待批改内容：

${gradingText}`
    }
  ];
}

async function gradeWithDeepSeek(items) {
  if (!DEEPSEEK_API_KEY) {
    const error = new Error("服务端没有设置 DEEPSEEK_API_KEY。");
    error.status = 500;
    throw error;
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: buildMessages(items),
      temperature: 0.2,
      max_tokens: 5000,
      response_format: { type: "json_object" }
    }),
    signal: AbortSignal.timeout(55_000)
  });

  const raw = await response.text();
  if (!response.ok) {
    const error = new Error(`DeepSeek API 返回 ${response.status}: ${raw.slice(0, 300)}`);
    error.status = 502;
    throw error;
  }

  let apiData;
  try {
    apiData = JSON.parse(raw);
  } catch {
    const error = new Error("DeepSeek API 返回了无法解析的响应。");
    error.status = 502;
    throw error;
  }

  const content = apiData?.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error("DeepSeek API 响应中没有批改内容。");
    error.status = 502;
    throw error;
  }

  try {
    return JSON.parse(stripJsonFence(content));
  } catch {
    const error = new Error(`DeepSeek 返回内容不是有效 JSON: ${content.slice(0, 300)}`);
    error.status = 502;
    throw error;
  }
}

function requireShareCode(req) {
  if (!SHARE_CODE) return null;
  const code = req.headers["x-share-code"];
  if (code === SHARE_CODE) return null;

  const error = new Error("访问码不正确，不能使用 DeepSeek 批改。");
  error.status = 401;
  return error;
}

module.exports = {
  DEEPSEEK_MODEL,
  SHARE_CODE,
  sendJson,
  readPayload,
  sanitizeItems,
  gradeWithDeepSeek,
  requireShareCode,
  hasDeepSeekKey: () => Boolean(DEEPSEEK_API_KEY)
};
