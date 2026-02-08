import {
    fetchModels,
    convertMessages,
    createStreamingChatCompletion,
    createNonStreamingChatCompletion,
} from "./raycast";
import type { Env } from "./auth";
import { Logger } from "./logger";
import type { RaycastChatRequest, OpenAIChatRequest, RaycastSSEData, ModelInfo } from "./types";

const uuidv4 = (): string => crypto.randomUUID();

const DEFAULT_MODEL_ID = "gpt-4o-mini";
const DEFAULT_PROVIDER = "openai";
const DEFAULT_INTERNAL_MODEL = "gpt-4o-mini";
const REMOTE_TOOL_NAMES = new Set([
    "web_search",
    "search_images",
    "read_page",
    "dalle",
    "gpt_image",
    "gemini_image",
    "nano_banana",
    "flux",
    "flux-kontext",
    "stable_diffusion",
    "chart",
]);

function extractImagesFromSSE(value: RaycastSSEData): string[] {
    const images: string[] = [];
    const directImage = (value as any).image || (value as any).content?.image;
    if (typeof directImage === "string" && directImage.length > 0) {
        images.push(directImage);
    }
    const imageList = (value as any).images || (value as any).content?.images;
    if (Array.isArray(imageList)) {
        for (const img of imageList) {
            if (typeof img === "string" && img.length > 0) images.push(img);
        }
    }
    return images;
}

function formatImagesMarkdown(urls: string[]): string {
    return urls.map((url) => `![image](${url})`).join("\n\n");
}

export function getProviderInfo(
    requestedId: string,
    models: Map<string, ModelInfo>,
): { id: string; info: ModelInfo } | undefined {
    const info = models.get(requestedId);
    if (info) return { id: requestedId, info };

    for (const [id, mInfo] of models.entries()) {
        if (mInfo.model === requestedId) {
            return { id, info: mInfo };
        }
    }

    if (requestedId === DEFAULT_MODEL_ID || requestedId === "openai-gpt-4o-mini") {
        return {
            id: "openai-gpt-4o-mini",
            info: { id: "openai-gpt-4o-mini", provider: DEFAULT_PROVIDER, model: DEFAULT_INTERNAL_MODEL, name: "GPT-4o Mini", capabilities: {} }
        };
    }

    return undefined;
}

function errorResponse(message: string, status: number = 500, type: string = "relay_error") {
    return new Response(JSON.stringify({ error: { message, type, code: null } }), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
    });
}

export async function handleChatCompletions(
    req: Request,
    env: Env,
): Promise<Response> {
    const logger = new Logger(env);
    try {
        const body = (await req.json()) as OpenAIChatRequest;

        let {
            messages,
            model = DEFAULT_MODEL_ID,
            temperature = 0.5,
            stream = false,
            reasoning_effort,
            tools: openaiTools,
            tool_choice,
            additional_system_instructions,
            locale,
        } = body;

        if (!messages?.length) {
            return errorResponse("Missing or invalid 'messages' field", 400, "invalid_request_error");
        }

        let modelEffort: string | undefined = undefined;
        if (model.includes(":")) {
            const parts = model.split(":");
            model = parts[0];
            modelEffort = parts[1];
            logger.debug(`Extracted effort "${modelEffort}" from model name "${model}"`);
        }

        const models = await fetchModels(env);
        if (models.size === 0) {
            return errorResponse("No models available", 500, "server_error");
        }

        const resolved = getProviderInfo(model, models);
        if (!resolved) {
            return errorResponse(`Model "${model}" not available`, 400, "invalid_request_error");
        }

        const { id: fullModelId, info: modelInfo } = resolved;
        const { provider, model: internalModelName, capabilities } = modelInfo;
        const threadId = uuidv4();
        const responseModelId = modelInfo.model;

        logger.debug(`Using model: ${fullModelId} (internal: ${internalModelName}, provider: ${provider})`);

        const { raycastMessages, systemInstruction } = await convertMessages(messages, env, threadId);
        let effort = reasoning_effort || modelEffort;
        if (!effort && capabilities.reasoning_effort?.supported) {
            effort = capabilities.reasoning_effort.default;
        }

        const remoteToolNames = new Set<string>();
        const raycastTools = openaiTools?.map((tool: any) => {
            if (tool.type === "function") {
                if (REMOTE_TOOL_NAMES.has(tool.function.name)) {
                    remoteToolNames.add(tool.function.name);
                    return {
                        name: tool.function.name,
                        type: "remote_tool",
                    };
                }
                return {
                    type: "local_tool",
                    function: tool.function,
                };
            }
            if (tool.type === "remote_tool" && tool.name) {
                remoteToolNames.add(tool.name);
            }
            return tool;
        }) || [];

        const raycastRequest: RaycastChatRequest = {
            model: internalModelName,
            provider,
            messages: raycastMessages,
            system_instruction: systemInstruction,
            temperature,
            additional_system_instructions: additional_system_instructions || "",
            debug: false,
            locale: locale || "en-US",
            source: "ai_chat",
            thread_id: threadId,
            tools: raycastTools,

            tool_choice: typeof tool_choice === "string" ? tool_choice : undefined,
            reasoning_effort: effort,
        };

        logger.debug(`Streaming: ${stream}, reasoning_effort: ${effort}`);
        if (stream) {
            return handleStreamingResponse(await createStreamingChatCompletion(raycastRequest, env), responseModelId, logger, remoteToolNames);
        } else {
            return handleNonStreamingResponse(await createNonStreamingChatCompletion(raycastRequest, env), responseModelId, logger, remoteToolNames);
        }
    } catch (error: any) {
        logger.error("Error in handleChatCompletions:", error);
        return errorResponse(`Chat completion failed: ${error.message}`, 500, "relay_error");
    }
}

function handleStreamingResponse(raycastStream: ReadableStream<RaycastSSEData>, modelId: string, logger: Logger, remoteToolNames: Set<string>): Response {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
        const reader = raycastStream.getReader();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                if (value) {
                    if (value.notification_type === "model_updated") {
                        const notification = (value as any).notification || (value as any).content?.notification;
                        logger.info(`Model rerouted: ${notification ?? "model_updated"}`);
                    }
                    const delta: any = {};
                    if (typeof value.text === "string") delta.content = value.text;
                    if (typeof value.reasoning === "string") delta.reasoning_content = value.reasoning;
                    const images = extractImagesFromSSE(value);
                    if (images.length > 0) {
                        const imageMarkdown = formatImagesMarkdown(images);
                        delta.content = delta.content ? `${delta.content}\n\n${imageMarkdown}` : imageMarkdown;
                    }

                    const rcToolCalls = (value.tool_calls || (value.tool_call ? [value.tool_call] : []))
                        .filter((tc: any) => tc.name && !remoteToolNames.has(tc.name));

                    if (rcToolCalls.length > 0) {
                        delta.tool_calls = rcToolCalls.map((tc: any, index: number) => ({
                            index,
                            id: tc.call_id || tc.id || `call_${uuidv4()}_${index}`,
                            type: "function",
                            function: {
                                name: tc.name,
                                arguments: typeof tc.arguments === "string"
                                    ? tc.arguments
                                    : JSON.stringify(tc.arguments)
                            }
                        }));
                    }

                    if (Object.keys(delta).length === 0 && !value.finish_reason) {
                        continue;
                    }

                    const chunk = {
                        id: `chatcmpl-${uuidv4()}`,
                        object: "chat.completion.chunk",
                        created: Math.floor(Date.now() / 1000),
                        model: modelId,
                        choices: [{
                            index: 0,
                            delta,
                            finish_reason: value.finish_reason || (rcToolCalls.length > 0 ? "tool_calls" : null)
                        }],
                    };
                    await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));

                    if (value.finish_reason != null) {
                        logger.debug(`Stream finished with reason: ${value.finish_reason}`);
                        await writer.write(encoder.encode("data: [DONE]\n\n"));
                        break;
                    }
                }
            }
        } catch (error) {
            logger.error("Streaming error:", error);
            await writer.abort(error);
        } finally {
            try {
                await writer.close();
            } catch {
            }
            reader.releaseLock();
        }
    })();

    return new Response(readable, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
        },
    });
}

function handleNonStreamingResponse(data: { text: string; reasoning: string; tool_calls: any[]; model_update?: string; images: string[] }, modelId: string, logger: Logger, remoteToolNames: Set<string>): Response {
    if (data.model_update) {
        logger.info(`Model rerouted: ${data.model_update}`);
    }
    const contentParts: string[] = [];
    if (data.text) contentParts.push(data.text);
    if (data.images?.length) contentParts.push(formatImagesMarkdown(data.images));
    const content = contentParts.length > 0 ? contentParts.join("\n\n") : null;
    const message: any = {
        role: "assistant",
        content,
        reasoning_content: data.reasoning || null,
    };

    const filteredToolCalls = (data.tool_calls || []).filter((tc) => tc.name && !remoteToolNames.has(tc.name));
    if (filteredToolCalls.length > 0) {
        message.tool_calls = filteredToolCalls.map((tc, index) => ({
            id: tc.call_id || tc.id || `call_${uuidv4()}_${index}`,
            type: "function",
            function: {
                name: tc.name,
                arguments: typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments)
            }
        }));
    }

    const response = {
        id: `chatcmpl-${uuidv4()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: modelId,
        choices: [{
            index: 0,
            message,
            logprobs: null,
            finish_reason: filteredToolCalls.length > 0 ? "tool_calls" : "stop",
        }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, prompt_tokens_details: { cached_tokens: 0, audio_tokens: 0 }, completion_tokens_details: { reasoning_tokens: 0, audio_tokens: 0, accepted_prediction_tokens: 0, rejected_prediction_tokens: 0 } },
        service_tier: "default",
        system_fingerprint: null,
    };

    return new Response(JSON.stringify(response) + "\n", {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
}

export async function handleModels(env: Env): Promise<Response> {
    const logger = new Logger(env);
    try {
        logger.debug("Fetching models...");
        const models = await fetchModels(env);
        const includeBetterAiModels = Boolean(env.RAYCAST_TOKEN);
        const filteredModels = includeBetterAiModels
            ? models
            : new Map(Array.from(models.entries()).filter(([, info]) => !info.requires_better_ai));
        const openaiModels = {
            object: "list",
            data: Array.from(filteredModels.entries()).map(([id, info]) => ({
                id: info.model,
                object: "model",
                created: Math.floor(Date.now() / 1000),
                owned_by: info.provider,
                name: info.name,
                context_window: info.context_window,
                capabilities: info.capabilities,
                access: info.requires_better_ai ? "pro" : "free",
                replacement_model_id: info.pro_plan_replacement_model_id ?? null,
            })),
        };
        logger.debug(`Returning ${filteredModels.size} models`);
        return new Response(JSON.stringify(openaiModels), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    } catch (error: any) {
        logger.error(`Failed to fetch models: ${error.message}`);
        return errorResponse(`Failed to fetch models: ${error.message}`, 500, "relay_error");
    }
}

export function handleOptions(): Response {
    return new Response(null, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
    });
}
