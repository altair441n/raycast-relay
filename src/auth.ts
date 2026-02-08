import { createHash, createHmac } from "crypto";

export interface Env {
  API_KEY?: string;
  RAYCAST_TOKEN?: string;
  IMAGE_TOKEN?: string;
  SIG_SECRET?: string;
  DEVICE_ID?: string;
  R2A_ATTACHMENTS?: any;
  DEBUG?: string;
}

export const RAYCAST_API_URL = "https://backend.raycast.com/api/v1/ai/chat_completions";
export const RAYCAST_MODELS_URL = "https://backend.raycast.com/api/v1/ai/models";

export function obfuscatePart(input: string): string {
  let result = "";
  for (const char of input) {
    const charCode = char.charCodeAt(0);
    if (charCode >= 65 && charCode <= 90) {
      result += String.fromCharCode((charCode - 65 + 13) % 26 + 65);
    } else if (charCode >= 97 && charCode <= 122) {
      result += String.fromCharCode((charCode - 97 + 13) % 26 + 97);
    } else if (charCode >= 48 && charCode <= 57) {
      result += String.fromCharCode((charCode - 48 + 5) % 10 + 48);
    } else {
      result += char;
    }
  }
  return result;
}

export function generateSignature(
  part1: string,
  part2: string,
  dataToHash: string,
  sigSecret: string,
): string {
  const hexHash = createHash("sha256").update(dataToHash).digest("hex");
  const messageToSign = [obfuscatePart(part1), obfuscatePart(part2), obfuscatePart(hexHash)].join(".");
  const signature = createHmac("sha256", sigSecret).update(messageToSign).digest("hex");
  return signature;
}

export function getRaycastHeaders(
  env: Env,
  payload: string,
  deviceIdOverride?: string,
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const deviceId = deviceIdOverride || env.DEVICE_ID;
  if (!deviceId) {
    throw new Error("Missing device ID");
  }
  const sigSecret = env.SIG_SECRET || "6bc455473576ce2cd6f70426caff867aabbe3f7291c1a79681af5e8ce0ca1408";
  const raycastToken = env.RAYCAST_TOKEN;

  const signature = generateSignature(timestamp, deviceId, payload, sigSecret);

  return {
    Accept: "*/*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    "Content-Type": "application/json",
    "X-Raycast-Timestamp": timestamp,
    "X-Raycast-DeviceId": deviceId,
    "X-Raycast-Signature-v2": signature,
    "X-Raycast-Experimental": "autoModels, chatBranching, mcpHTTPServer",
    ...(raycastToken && raycastToken.length > 0 ? { "Authorization": `Bearer ${raycastToken}` } : {}),
    "User-Agent": "Raycast/1.104.5 (macOS Version 26.2 (Build 25C56))",
  };
}
