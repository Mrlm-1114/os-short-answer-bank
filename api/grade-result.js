const { sendJson } = require("./_common");

module.exports = function handler(req, res) {
  sendJson(res, 404, {
    error: "Vercel 版本直接在提交后返回批改结果，请重新提交。"
  });
};
