import { createStreamingChatCompletion, fetchModels } from "../src/raycast";
import type { Env } from "../src/auth";
import type { ModelInfo, RaycastChatRequest } from "../src/types";

const env: Env = {
  RAYCAST_TOKEN: process.env.RAYCAST_TOKEN,
  DEBUG: "true",
};

type CheckResult = {
  id: string;
  model: string;
  requires_better_ai: boolean;
  rerouted: boolean;
  error?: string;
};

async function checkModel(model: ModelInfo): Promise<CheckResult> {
  const request: RaycastChatRequest = {
    additional_system_instructions: "",
    debug: false,
    locale: "en-US",
    messages: [
      {
        author: "user",
        content: { text: "hi" },
      },
    ],
    model: model.model,
    provider: model.provider,
    source: "ai_chat",
    system_instruction: "markdown",
    temperature: 0.5,
    thread_id: `test-${Math.random().toString(36).slice(2)}`,
    tools: [],
  };

  try {
    const stream = await createStreamingChatCompletion(request, env);
    const reader = stream.getReader();
    let rerouted = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      const chunk = value as any;
      if (chunk?.notification_type === "model_updated") {
        rerouted = true;
        break;
      }
      if (chunk?.text || chunk?.reasoning || chunk?.finish_reason) {
        break;
      }
    }

    return { id: model.id, model: model.model, requires_better_ai: !!model.requires_better_ai, rerouted };
  } catch (error: any) {
    return { id: model.id, model: model.model, requires_better_ai: !!model.requires_better_ai, rerouted: false, error: error?.message || String(error) };
  }
}

async function main() {
  const modelsMap = await fetchModels(env);
  const models = Array.from(modelsMap.values());

  const results: CheckResult[] = [];
  for (const model of models) {
    results.push(await checkModel(model));
  }

  const freeAccess = results.filter((r) => !r.requires_better_ai && !r.rerouted && !r.error);
  const betterAiAccessible = results.filter((r) => r.requires_better_ai && !r.rerouted && !r.error);
  const rerouted = results.filter((r) => r.rerouted);
  const failed = results.filter((r) => r.error);

  console.log("\n--- Free-Accessible Models ---");
  freeAccess.forEach((r) => console.log(r.model));

  console.log("\n--- Requires Better AI But Accessible ---");
  betterAiAccessible.forEach((r) => console.log(r.model));

  console.log("\n--- Rerouted Models ---");
  rerouted.forEach((r) => console.log(r.model));

  if (failed.length) {
    console.log("\n--- Failed Models ---");
    failed.forEach((r) => console.log(`${r.model}: ${r.error}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
