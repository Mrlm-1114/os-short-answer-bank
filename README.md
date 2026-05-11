# 操作系统期末简答题库

本项目是一个操作系统期末概念简答题练习网站。每轮随机 5 道题，提交后由 DeepSeek 按真题概念简答风格批改、打分并给出参考答案。

## 本地运行

```bash
npm start
```

浏览器打开：

```text
http://localhost:4176
```

本地运行前建议设置环境变量：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_MODEL=deepseek-v4-flash
SHARE_CODE=os2026
PORT=4176
```

## Render 部署

1. 把本文件夹上传到一个 GitHub 仓库。
2. 打开 Render，新建 `Web Service`。
3. 连接这个 GitHub 仓库。
4. 设置：
   - Build Command: `npm install`
   - Start Command: `npm start`
5. 在 Environment 里添加：
   - `DEEPSEEK_API_KEY`: 你的 DeepSeek API Key
   - `DEEPSEEK_MODEL`: `deepseek-v4-flash`
   - `SHARE_CODE`: 你想给同学的访问码，例如 `os2026`
6. 部署完成后，把 Render 生成的网址发给别人。

## 注意

- 不要把真实 DeepSeek API Key 写进代码或上传到 GitHub。
- `SHARE_CODE` 只是简单访问码，适合小范围同学使用；不要发到大群里，避免消耗你的 API 额度。
- Render 免费服务可能冷启动，第一次打开会稍慢，但比临时隧道稳定得多。
