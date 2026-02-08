# Raycast Relay

OpenAI-compatible proxy for Raycast AI, deployed as a Cloudflare Worker.

Languages: [English](README.md) | [中文](README.zh.md) | [日本語](README.ja.md)

**Features**
- OpenAI-compatible `v1/chat/completions` and `v1/models`
- Raycast model catalog with capability metadata and reroute logging
- Vision input via image uploads
- Remote tools for web and image generation
- `model:effort` shorthand for reasoning effort

**Setup**
1. Install and deploy.
   ```bash
   npm install
   npm run deploy
   ```
2. Configure secrets.
   ```bash
   wrangler secret put RAYCAST_TOKEN
   wrangler secret put IMAGE_TOKEN
   wrangler secret put API_KEY
   ```

**Config**
- `RAYCAST_TOKEN`: Required to access Advanced AI models. Extract from Raycast app requests.
- `IMAGE_TOKEN`: Token used only for image uploads. Advanced subscription not required.
- `API_KEY`: Optional. If set, requests must include `Authorization: Bearer <key>`.
- `DEVICE_ID`: Optional 64-char hex. If unset, the worker generates one and caches it.
- `SIG_SECRET`: Optional override for Raycast signature secret.
- `DEBUG`: Set to `1` or `true` for verbose logs.

**Usage**
Base URL:
`https://your-worker.your-subdomain.workers.dev/v1`

Basic chat:
```bash
curl https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{ "role": "user", "content": "Hello from Raycast Relay" }]
  }'
```

Remote tools require `tool_choice` and a matching tool name. Raycast runs them server-side.

Web search example:
```bash
curl https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{ "role": "user", "content": "@web search the web for Raycast founders" }],
    "tools": [
      { "type": "function", "function": { "name": "web_search", "description": "Search the web" } }
    ],
    "tool_choice": "required"
  }'
```

Image generation with Nano Banana using Gemini 3 Flash:
```bash
curl https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gemini-3-flash-preview",
    "messages": [
      { "role": "user", "content": "@nano_banana create a stylized poster of a nano banana on a plate" }
    ],
    "tools": [
      { "type": "function", "function": { "name": "nano_banana", "description": "Generate an image" } }
    ],
    "tool_choice": "required"
  }'
```

Image results are returned as markdown image URLs in the assistant `content`.

**Remote Tool Names**
- `web_search`, `search_images`, `read_page`
- `dalle`, `gpt_image`, `gemini_image`, `nano_banana`, `flux`, `flux-kontext`, `stable_diffusion`, `chart`

**Reasoning Effort**
You can set reasoning effort in two ways:
- Use `reasoning_effort` in the request body
- Append `:effort` to the model name, for example `gpt-4o-mini:low`

If both are provided, `reasoning_effort` wins.

**Models**
- `/v1/models` includes Advanced AI models only when `RAYCAST_TOKEN` is present.
- Each model includes `access` (`free` or `pro`) and `replacement_model_id` when applicable.
- If Raycast reroutes a request, it is logged.

**License**
MIT. See `LICENSE`.
