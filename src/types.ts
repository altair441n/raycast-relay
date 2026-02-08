export type ModelCapabilities = {
  reasoning_effort?: {
    supported: boolean;
    default: string;
    options: string[];
  };
  thinking?: {
    supported: boolean;
  };
  tools?: {
    supported: boolean;
  };
  vision?: boolean;
  [key: string]: any;
};

export type ModelInfo = {
  id: string;
  provider: string;
  model: string;
  name: string;
  requires_better_ai?: boolean;
  pro_plan_replacement_model_id?: string | null;
  capabilities: ModelCapabilities;
  context_window?: number;
};

export type OpenAIMessageContent =
  | string
  | (
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }
  )[];

export type OpenAIMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: OpenAIMessageContent | null;
  name?: string;
  tool_calls?: any[];
  tool_call_id?: string;
};

export type RaycastAttachment = {
  id: string;
  type: "file";
};

export type RaycastMessage = {
  author: "user" | "assistant";
  content: {
    text?: string;
    tool_call?: any;
    tool_result?: any;
    attachments?: RaycastAttachment[];
  };
};

export type RaycastChatRequest = {
  additional_system_instructions: string;
  debug: boolean;
  locale: string;
  messages: RaycastMessage[];
  model: string;
  provider: string;
  source: string;
  system_instruction: string;
  temperature: number;
  thread_id: string;
  tools: any[];
  reasoning_effort?: string;
  tool_choice?: string;
};
export type OpenAIChatRequest = {
  messages: OpenAIMessage[];
  model: string;
  temperature?: number;
  stream?: boolean;
  [key: string]: any;
};
export type OpenAIChatResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
      refusal: string | null;
      annotations: string[];
    };
    logprobs: string | null;
    finish_reason: string | null;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details: {
      cached_tokens: number;
      audio_tokens: number;
    };
    completion_tokens_details: {
      reasoning_tokens: number;
      audio_tokens: number;
      accepted_prediction_tokens: number;
      rejected_prediction_tokens: number;
    };
  };
  service_tier: string;
  system_fingerprint: string;
};
export type RaycastSSEData = {
  text?: string;
  reasoning?: string;
  finish_reason?: string | null;
  tool_call?: any;
  tool_calls?: any[];
  notification_type?: string;
  notification?: string;
  content?: any;
  image?: string;
  images?: string[];
  image_count?: number;
};

export type RaycastRawModelData = {
  id: string;
  model: string;
  name: string;
  provider: string;
  requires_better_ai: boolean;
  pro_plan_replacement_model_id?: string | null;
  availability: string;
  abilities: ModelCapabilities;
  context_window?: number;
  [key: string]: any;
};

export type RaycastFileUploadRequest = {
  chat_id: string;
  blob: {
    filename: string;
    byte_size: number;
    checksum: string;
    content_type: string;
  };
};

export type RaycastFileUploadResponse = {
  id: string;
  key: string;
  filename: string;
  content_type: string;
  metadata: Record<string, any>;
  service_name: string;
  byte_size: number;
  checksum: string;
  created_at: string;
  attachable_sgid: string;
  signed_id: string;
  direct_upload: {
    url: string;
    headers: Record<string, string>;
  };
};
