# Raycast Relay

Raycast AI 向けの OpenAI 互換プロキシ。Cloudflare Worker にデプロイします。

言語ファイル：`README.md`、`README.zh.md`、`README.ja.md`

**特徴**
- OpenAI 互換の `v1/chat/completions` と `v1/models`
- Raycast のモデル一覧と能力メタデータ、リルートのログ
- 画像アップロードによるビジョン入力
- Web と画像生成のリモートツール対応
- `model:effort` の推論強度ショートハンド

**セットアップ**
1. インストールとデプロイ。
   ```bash
   npm install
   npm run deploy
   ```
2. シークレットを設定。
   ```bash
   wrangler secret put RAYCAST_TOKEN
   wrangler secret put IMAGE_TOKEN
   wrangler secret put API_KEY
   ```

**設定**
- `RAYCAST_TOKEN`：Advanced AI モデルへのアクセスに必要。Raycast アプリのリクエストから取得。
- `IMAGE_TOKEN`：画像アップロード専用。Advanced サブスク不要。
- `API_KEY`：任意。設定時は `Authorization: Bearer <key>` が必要。
- `DEVICE_ID`：任意の 64 文字の 16 進。未設定時は自動生成してキャッシュ。
- `SIG_SECRET`：任意。Raycast 署名シークレットの上書き。
- `DEBUG`：`1` または `true` で詳細ログ。

**使い方**
Base URL：
`https://your-worker.your-subdomain.workers.dev/v1`

基本チャット：
```bash
curl https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{ "role": "user", "content": "Hello from Raycast Relay" }]
  }'
```

リモートツールは `tool_choice` とツール名の一致が必要です。Raycast 側で実行されます。

Web 検索例：
```bash
curl https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{ "role": "user", "content": "@web Raycast founders を検索" }],
    "tools": [
      { "type": "function", "function": { "name": "web_search", "description": "Search the web" } }
    ],
    "tool_choice": "required"
  }'
```

Gemini 3 Flash + Nano Banana で画像生成：
```bash
curl https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gemini-3-flash-preview",
    "messages": [
      { "role": "user", "content": "@nano_banana お皿に盛られたナノバナナのポスターを作成" }
    ],
    "tools": [
      { "type": "function", "function": { "name": "nano_banana", "description": "Generate an image" } }
    ],
    "tool_choice": "required"
  }'
```

画像結果は assistant `content` に markdown 画像 URL として返ります。

**リモートツール名**
- `web_search`、`search_images`、`read_page`
- `dalle`、`gpt_image`、`gemini_image`、`nano_banana`、`flux`、`flux-kontext`、`stable_diffusion`、`chart`

**推論強度**
次のどちらかで設定できます。
- リクエスト本文の `reasoning_effort`
- モデル名に `:effort` を追加（例：`gpt-4o-mini:low`）

両方ある場合は `reasoning_effort` が優先されます。

**モデル**
- `RAYCAST_TOKEN` を設定すると `/v1/models` に Advanced モデルが含まれます。
- 各モデルは `access`（`free`/`pro`）を持ち、該当する場合は `replacement_model_id` を含みます。
- Raycast のリルートはログされます。

**ライセンス**
MIT。`LICENSE` を参照。
