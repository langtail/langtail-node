import { z } from "zod"

export interface ChatState {
  type: "chat"
  template: PlaygroundMessage[]
  functions?: Functions[]
  tools?: Tools[]
  args: ModelParameter
}

export type ModelParameter = {
  model: string
  temperature: number
  max_tokens: number
  top_p: number
  stop?: string[]
  presence_penalty: number
  frequency_penalty: number
  stream?: boolean
  jsonmode?: boolean
  seed?: number | null
}

export interface Functions {
  name: string
  description: string
  parameters: Record<string, unknown>
  id?: string
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

export type ContentArray = Array<ContentItemText | ContentItemImage>

export interface ToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

export interface Message {
  role: "assistant" | "user" | "system" | "function" | "tool"
  name?: string
  content: string | ContentArray | null
  function_call?: {
    name: string
    arguments: string
  }
  tool_calls?: ToolCall[]
  tool_choice?:
    | {
        type: "function"
        function: {
          name: string
        }
      }
    | "auto"
    | "none"
  tool_call_id?: string
  // NOTE: dynamic property calculated by the client for the diff view
  hash?: string
}

export interface PlaygroundMessage extends Message {
  pending?: boolean
  error?: unknown
}

export interface PlaygroundState {
  state: ChatState
  chatInput: Record<string, string>
  chatPlaygroundHistory: PlaygroundMessage[]
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

export const PlaygroundContentItemImageSchema = ContentItemImageSchema.augment({
  // NOTE: this is used to uniquely identify the image in the playground
  // For image upload we do optimistic base64 immediately and then replace it with the real url
  _id: z.string().optional(),
})

export const ContentArraySchema = z.array(
  z.union([ContentItemTextSchema, ContentItemImageSchema]),
) satisfies z.ZodType<ContentArray>

export const PlaygroundContentArraySchema = z.array(
  z.union([ContentItemTextSchema, PlaygroundContentItemImageSchema]),
) satisfies z.ZodType<ContentArray>

export const FunctionCallSchema = z.object({
  name: z.string(),
  arguments: z.string(),
})

export const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: FunctionCallSchema,
}) satisfies z.ZodType<ToolCall>

export const ToolChoiceSchema = z.union([
  z.literal("auto"),
  z.literal("none"),
  z.object({
    type: z.literal("function"),
    function: z.object({
      name: z.string(),
    }),
  }),
])

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
}) satisfies z.ZodType<Message>

export const ToolMessageSchema = z.object({
  role: z.literal("tool"),
  content: z.string(),
  tool_call_id: z.string(),
  name: z.string().optional(),
})

export const ArrayMessageSchema = z.array(MessageSchema)

const FunctionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.unknown()),
  id: z.string().optional(),
}) satisfies z.ZodType<Functions>

const ToolSchema = z.object({
  type: z.literal("function"),
  function: FunctionSchema,
}) satisfies z.ZodType<Tools>

// Historically, in playground we had most parameters as
const ModelParameterSchema = z.object({
  model: z.string(),
  temperature: z.number(),
  max_tokens: z.number(),
  top_p: z.number(),
  stop: z.array(z.string()).optional(),
  presence_penalty: z.number(),
  frequency_penalty: z.number(),
  stream: z.boolean().optional().default(true),
  jsonmode: z.boolean().optional().default(false),
  seed: z.number().nullable().optional(),
}) satisfies z.ZodType<ModelParameter>

// This is used to validate log playground and request overrides
export const ModelParameterWithPlaygroundDefaults = z.object({
  model: ModelParameterSchema.shape.model,
  temperature: ModelParameterSchema.shape.temperature.default(0.5),
  max_tokens: z
    .number()
    .transform((v) => (v !== undefined && (v > 0 || v === -1) ? v : 800))
    .default(800),
  top_p: z.number().default(1),
  stop: z
    .array(z.string())
    .optional()
    .transform((s) => (s?.length ? s : undefined)),
  presence_penalty: z.number().default(0),
  frequency_penalty: z.number().default(0),
  stream: ModelParameterSchema.shape.stream,
  jsonmode: ModelParameterSchema.shape.jsonmode,
  seed: ModelParameterSchema.shape.seed,
})

export const ArrayToolsSchema = z.array(ToolSchema)
export const ArrayFunctionsSchema = z.array(FunctionSchema)

export const ToolsToFunctionsSchema = ArrayToolsSchema.transform((tools) => {
  return tools.map((tool) => FunctionSchema.parse(tool.function))
})

export const FunctionsToToolsSchema = ArrayFunctionsSchema.transform(
  (functions) => {
    return functions.map((fn) =>
      ToolSchema.parse({ type: "function", function: fn }),
    )
  },
)

export const transformFunctionsToTools = (state: ChatState) => {
  if (!state.functions || !state.functions.length) return state

  return {
    ...state,
    functions: [],
    tools: state.functions ? FunctionsToToolsSchema.parse(state.functions) : [],
  }
}
