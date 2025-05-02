import { z, ZodSchema } from "zod"
import { Environment, LangtailEnvironment, PromptSlug, Version } from "./types"
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/index"
import type {
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions"

export interface ILangtailExtraProps {
  doNotRecord?: boolean
  threadId?: string
  metadata?: Record<string, string>
}

export type ChatCompletionsCreateParams =
  | (ChatCompletionCreateParamsStreaming & ILangtailExtraProps)
  | (ChatCompletionCreateParamsNonStreaming & ILangtailExtraProps)

export interface ChatState {
  type: "chat"
  template: PlaygroundMessage[]
  functions?: Functions[]
  tools?: Tools[]
  args: ModelParameter
}

export type ReasoningEffortType = "low" | "medium" | "high"

type ToolChoiceType =
  | {
    type: "function"
    function: {
      name: string
    }
  }
  | "auto"
  | "none"
  | "required"

export type ModelParameter = {
  model: string
  temperature: number
  reasoning_effort?: ReasoningEffortType
  max_tokens: number
  max_thinking_tokens?: number
  top_p: number
  stop?: string[]
  presence_penalty: number
  frequency_penalty: number
  stream?: boolean
  jsonmode?: boolean
  seed?: number | null
  tool_choice?: ToolChoiceType
}

export interface Functions {
  name: string
  description: string
  parameters: Record<string, unknown>
  id?: string
  handler?: {
    enabled: boolean
  }
}

export interface Tools {
  type: "function"
  function: Functions
}

export interface CompletionState {
  type: "completion"
  template: string
  args: ModelParameter
}

export interface ContentItemText {
  type: "text"
  text: string
}

export interface ContentItemImage {
  type: "image_url"
  image_url: {
    url: string
    detail?: "auto" | "low" | "high"
  }
}

export interface ContentItemGeminiMediaUrl {
  type: "gemini_media_url"
  gemini_media_url: {
    url: string
  }
}

export type ContentArray = Array<ContentItemText | ContentItemImage | ContentItemGeminiMediaUrl>

export interface ToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

export interface MessageReasoningText {
  type: "text"
  text: string
  signature?: string
}
export interface MessageReasoningRedacted {
  type: "redacted"
  data: string
}

export type MessageReasoning = MessageReasoningText | MessageReasoningRedacted

export interface Message {
  role: "assistant" | "user" | "system" | "function" | "tool"
  name?: string
  content: string | ContentArray | null
  reasoning?: MessageReasoning[] | null
  function_call?: {
    name: string
    arguments: string
  }
  tool_calls?: ToolCall[]
  tool_choice?: ToolChoiceType
  tool_call_id?: string
  // NOTE: dynamic property calculated by the client for the diff view
  hash?: string
  cache_enabled?: boolean
}

export interface PlaygroundMessage extends Message {
  pending?: boolean
  error?: unknown
}

export interface PlaygroundState {
  state: ChatState
  chatInput: Record<string, string>
}

export interface Deployment<P extends PromptSlug> {
  deployedAt: string;
  promptSlug: P;
  environment: Environment<P> & LangtailEnvironment;
  version?: Version<P, Environment<P>> & string;
}

export const ContentItemTextSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
}) satisfies z.ZodType<ContentItemText>

export const ContentItemImageSchema = z.object({
  type: z.literal("image_url"),
  image_url: z.object({
    url: z.string(),
    detail: z.enum(["auto", "low", "high"]).default("auto"),
  }),
}) satisfies z.ZodType<ContentItemImage>

export const ContentItemGeminiMediaUrlSchema = z.object({
  type: z.literal("gemini_media_url"),
  gemini_media_url: z.object({
    url: z.string(),
  }),
}) satisfies z.ZodType<ContentItemGeminiMediaUrl>

const ContentArraySchema = z.array(
  z.union([ContentItemTextSchema, ContentItemImageSchema, ContentItemGeminiMediaUrlSchema]),
) satisfies z.ZodType<ContentArray>

const FunctionCallSchema = z.object({
  name: z.string(),
  arguments: z.string(),
})

const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: FunctionCallSchema,
}) satisfies z.ZodType<ToolCall>

export const ToolChoiceSchema = z.union([
  z.literal("auto"),
  z.literal("required"),
  z.literal("none"),
  z.object({
    type: z.literal("function"),
    function: z.object({
      name: z.string(),
    }),
  }),
])

export const MessageReasoningTextSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  signature: z.string().optional(),
}) satisfies z.ZodType<MessageReasoningText>

export const MessageReasoningRedactedSchema = z.object({
  type: z.literal("redacted"),
  data: z.string(),
}) satisfies z.ZodType<MessageReasoningRedacted>

export const MessageReasoningSchema = z.union([MessageReasoningTextSchema, MessageReasoningRedactedSchema]) satisfies z.ZodType<MessageReasoning>

export const MessageSchema = z.object({
  role: z.union([
    z.literal("assistant"),
    z.literal("user"),
    z.literal("system"),
    z.literal("function"),
    z.literal("tool"),
  ]),
  name: z.string().optional(),
  content: ContentArraySchema.or(z.string().nullable()),
  function_call: FunctionCallSchema.optional(),
  tool_calls: z.array(ToolCallSchema).optional(),
  tool_choice: ToolChoiceSchema.optional(),
  tool_call_id: z.string().optional(),
  cache_enabled: z.boolean().optional(),
  reasoning: z.array(MessageReasoningSchema).optional(),
}) satisfies z.ZodType<Message>

const FunctionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.object({}).passthrough(),
  id: z.string().optional(),
}) satisfies z.ZodType<Functions>

export const ToolSchema = z.object({
  type: z.literal("function"),
  function: FunctionSchema,
}) satisfies z.ZodType<Tools>

export const bodyMetadataSchema = z
  .record(z.string().max(64), z.union([z.string(), z.number()]))
  .optional()

export const langtailBodySchema = z.object({
  doNotRecord: z.boolean().optional(),
  parallelToolCalls: z.boolean().optional(),
  metadata: bodyMetadataSchema,
  _langtailTestRunId: z.string().optional(),
  _langtailTestInputId: z.string().optional(),
})

export const openAIBodySchemaObjectDefinition = {
  stream: z.boolean().optional(),
  user: z.string().optional(),

  seed: z.number().optional(),
  max_tokens: z.number().optional(),
  max_thinking_tokens: z.number().optional(),
  temperature: z.number().optional(),
  reasoning_effort: z.enum(["low", "medium", "high"]).optional(),
  top_p: z.number().optional(),
  parallel_tool_calls: z.boolean().optional(),
  presence_penalty: z.number().optional(),
  frequency_penalty: z.number().optional(),
  model: z.string().optional(),
  tools: z.array(ToolSchema).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  template: z.array(MessageSchema).optional(),
  variables: z.record(z.string(), z.string()).optional(),
  tool_choice: ToolChoiceSchema.optional(),
  response_format: z
    .object({
      type: z.enum(["json_object"]),
    })
    .optional(),
  messages: z.array(MessageSchema).optional(),
}
export const openAIBodySchema = z.object(openAIBodySchemaObjectDefinition)

export const bothBodySchema = langtailBodySchema.merge(openAIBodySchema)

export type IncomingBodyType = z.infer<typeof bothBodySchema>
export type OpenAiBodyType = z.infer<typeof openAIBodySchema>


export const threadSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  deletedAt: z.string().nullable().optional(),
  projectId: z.string(),
  createLog: z.unknown().nullable(),
  metadata: bodyMetadataSchema.nullable().optional(),
})

export type Thread = z.infer<typeof threadSchema>

export const threadCreateSchema = z.object({
  createLog: openAIBodySchema.nullable().optional(),
  metadata: bodyMetadataSchema.nullable().optional(),
})

export type ThreadCreate = z.infer<typeof threadCreateSchema>

export const deleteEntitySchema = z.object({
  id: z.string(),
  object: z.string(),
  deleted: z.boolean(),
})

export const assistantMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  createdAt: z.string(),
  content: MessageSchema,
  requestLogId: z.string().nullable().optional(),
  metadata: bodyMetadataSchema.nullable().optional(),
})

export type AssistantMessage = z.infer<typeof assistantMessageSchema>

export const createListResponseSchema = <Z extends ZodSchema>(listItemType: Z) => z.object({
  object: z.enum(["list"]),
  data: z.array(listItemType),
  first_id: z.string().nullable(),
  last_id: z.string().nullable(),
  has_more: z.boolean(),
})

export const threadListResponseSchema = createListResponseSchema(threadSchema)
export type ThreadListResponse = z.infer<typeof threadListResponseSchema>

export const assistantMessageListResponseSchema = createListResponseSchema(assistantMessageSchema)
export type AssistantMessageListResponse = z.infer<typeof assistantMessageListResponseSchema>
