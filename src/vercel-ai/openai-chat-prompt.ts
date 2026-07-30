import { ReasoningDetail } from "../reasoning-details-schema"
import type { MessageProviderMetadata, PromptCacheBreakpoint } from "../schemas"

export type OpenAIChatPrompt = Array<ChatCompletionMessageParam>

export type ChatCompletionMessageParam =
  | ChatCompletionSystemMessageParam
  | ChatCompletionUserMessageParam
  | ChatCompletionAssistantMessageParam
  | ChatCompletionToolMessageParam

export interface ChatCompletionSystemMessageParam {
  role: "system"
  content: string | Array<ChatCompletionContentPartText>
}

export interface ChatCompletionUserMessageParam {
  role: "user"
  content: string | Array<ChatCompletionContentPart>
}

export type ChatCompletionContentPart =
  | ChatCompletionContentPartText
  | ChatCompletionContentPartImage

export interface ChatCompletionContentPartImage {
  type: "image_url"
  image_url: {
    url: string
    detail?: "auto" | "low" | "high"
  }
  prompt_cache_breakpoint?: PromptCacheBreakpoint
}

export interface ChatCompletionContentPartText {
  type: "text"
  text: string
  prompt_cache_breakpoint?: PromptCacheBreakpoint
}

export interface ChatCompletionAssistantMessageParam {
  role: "assistant"
  content?: string | null
  refusal?: string | null
  reasoning_details?: ReasoningDetail[] | null
  provider_metadata?: MessageProviderMetadata
  tool_calls?: Array<ChatCompletionMessageToolCall>
}

export interface ChatCompletionMessageToolCall {
  type: "function"
  id: string
  function: {
    arguments: string
    name: string
  }
}

export interface ChatCompletionToolMessageParam {
  role: "tool"
  content: string | Array<ChatCompletionContentPart>
  tool_call_id: string
}
