const { DEEPSEEK_MODEL, SHARE_CODE, hasDeepSeekKey, sendJson } = require("./_common");

module.exports = function handler(req, res) {
  sendJson(res, 200, {
    ok: true,
    model: DEEPSEEK_MODEL,
    hasApiKey: hasDeepSeekKey(),
    requiresShareCode: Boolean(SHARE_CODE),
    runtime: "vercel"
  });
};
