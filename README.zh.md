# Raycast Relay

面向 Raycast AI 的 OpenAI 兼容代理，部署在 Cloudflare Worker 上。

语言文件：`README.md`、`README.zh.md`、`README.ja.md`

**特性**
- OpenAI 兼容的 `v1/chat/completions` 与 `v1/models`
- Raycast 模型列表与能力元数据，支持改道日志
- 通过图片上传实现视觉输入
- 支持远程工具（网页与图像生成）
- `model:effort` 推理强度简写

**安装**
1. 安装与部署。
   ```bash
   npm install
   npm run deploy
   ```
2. 配置密钥。
   ```bash
   wrangler secret put RAYCAST_TOKEN
   wrangler secret put IMAGE_TOKEN
   wrangler secret put API_KEY
   ```

**配置**
- `RAYCAST_TOKEN`：访问高级 AI 模型所需，从 Raycast 应用请求中提取。
- `IMAGE_TOKEN`：仅用于图片上传，不要求高级订阅。
- `API_KEY`：可选。设置后请求必须包含 `Authorization: Bearer <key>`。
- `DEVICE_ID`：可选 64 位十六进制。不设置则自动生成并缓存。
- `SIG_SECRET`：可选，覆盖 Raycast 签名密钥。
- `DEBUG`：设置为 `1` 或 `true` 输出详细日志。

**使用**
Base URL：
`https://your-worker.your-subdomain.workers.dev/v1`

基本对话：
```bash
curl https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{ "role": "user", "content": "Hello from Raycast Relay" }]
  }'
```

远程工具需要 `tool_choice` 且名称匹配，Raycast 将在服务端执行。

网页搜索示例：
```bash
curl https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{ "role": "user", "content": "@web 搜索 Raycast 创始人" }],
    "tools": [
      { "type": "function", "function": { "name": "web_search", "description": "Search the web" } }
    ],
    "tool_choice": "required"
  }'
```

使用 Gemini 3 Flash + Nano Banana 生成图像：
```bash
curl https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gemini-3-flash-preview",
    "messages": [
      { "role": "user", "content": "@nano_banana 生成一张精致的纳米香蕉海报" }
    ],
    "tools": [
      { "type": "function", "function": { "name": "nano_banana", "description": "Generate an image" } }
    ],
    "tool_choice": "required"
  }'
```

图像结果会作为 markdown 图片链接返回在 assistant `content` 中。

**远程工具名称**
- `web_search`、`search_images`、`read_page`
- `dalle`、`gpt_image`、`gemini_image`、`nano_banana`、`flux`、`flux-kontext`、`stable_diffusion`、`chart`

**推理强度**
可通过以下方式设置：
- 请求体中的 `reasoning_effort`
- 模型名后追加 `:effort`，例如 `gpt-4o-mini:low`

两者同时提供时，以 `reasoning_effort` 为准。

**模型**
- 只有设置 `RAYCAST_TOKEN` 时，`/v1/models` 才包含高级模型。
- 每个模型包含 `access`（`free`/`pro`），并在适用时提供 `replacement_model_id`。
- Raycast 改道会被记录。

**许可**
MIT。详见 `LICENSE`。
