const {
  sendJson,
  readPayload,
  sanitizeItems,
  gradeWithDeepSeek,
  requireShareCode
} = require("./_common");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const shareCodeError = requireShareCode(req);
  if (shareCodeError) {
    sendJson(res, shareCodeError.status, { error: shareCodeError.message });
    return;
  }

  try {
    const payload = await readPayload(req);
    const items = sanitizeItems(payload.items);
    const result = await gradeWithDeepSeek(items);
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: error.message || "批改失败。"
    });
  }
};
