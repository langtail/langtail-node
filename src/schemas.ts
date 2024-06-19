import { z } from "zod"
import { Environment, LangtailEnvironment, PromptSlug, Version } from "./types"

export interface ChatState {
  type: "chat"
  template: PlaygroundMessage[]
  functions?: Functions[]
  tools?: Tools[]
  args: ModelParameter
}

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
  max_tokens: number
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
  tool_choice?: ToolChoiceType
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

const ContentArraySchema = z.array(
  z.union([ContentItemTextSchema, ContentItemImageSchema]),
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

const FunctionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.unknown()),
  id: z.string().optional(),
}) satisfies z.ZodType<Functions>

export const ToolSchema = z.object({
  type: z.literal("function"),
  function: FunctionSchema,
}) satisfies z.ZodType<Tools>
