import { handleChatCompletions, handleModels, handleOptions } from "./openai";
import type { Env } from "./auth";
import { Logger } from "./logger";

function validateApiKey(req: Request, env: Env): boolean {
  if (!env.API_KEY) return true;
  const authHeader = req.headers.get("Authorization");
  const providedKey = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  return providedKey === env.API_KEY;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const logger = new Logger(env);

    if (request.method === "OPTIONS") {
      return handleOptions();
    }

    const url = new URL(request.url);

    const isModelsRequest = url.pathname === "/v1/models" && request.method === "GET";

    if (!isModelsRequest && !validateApiKey(request, env)) {
      return new Response(JSON.stringify({ error: { message: "Invalid API key", type: "authentication_error" } }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    try {
      if (url.pathname === "/v1/chat/completions" && request.method === "POST") {
        return await handleChatCompletions(request, env);
      }
      if (url.pathname === "/v1/models" && request.method === "GET") {
        return await handleModels(env);
      }
      if (url.pathname === "/health" && request.method === "GET") {
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
      return new Response(JSON.stringify({ error: { message: "Not Found", type: "invalid_request_error" } }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    } catch (error: any) {
      logger.error(`Unhandled error:`, error);
      return new Response(JSON.stringify({ error: { message: "Internal server error", type: "server_error" } }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  },
};
