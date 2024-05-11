import z from "zod"
import { openAIBodySchema } from "./getOpenAIBody"

const choiceStreamedSchema = z.object({
  index: z.number(),
  delta: z.any(), // Adjust based on the actual shape of delta
  logprobs: z.null(),
  finish_reason: z.string().nullable(),
})
export const openAIStreamingResponseSchema = z.object({
  id: z.string(),
  object: z.literal("chat.completion.chunk"),
  created: z.number(),
  model: z.string(),
  system_fingerprint: z.string().nullish(), // TODO change back to non nullable when openAI fixes the issue where system_fingerprint is returned as null
  choices: z.array(choiceStreamedSchema),
})

const ErrorObjectSchema = z.object({
  code: z.string(),
  message: z.string(),
})

const ChatCompletionSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  choices: z.array(
    z.object({
      index: z.number(),
      message: z.object({
        role: z.string(),
        content: z.string(),
      }),
      finish_reason: z.string().nullable(),
    }),
  ),
  model: z.string(),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }),
})

export const OpenAIResponseSchema = z.object({
  status: z.number(),
  error: ErrorObjectSchema.nullable().optional(),
  data: ChatCompletionSchema,
  finishedAt: z.string().datetime(),
  startedAt: z.string().datetime(),
})

export type OpenAIResponseType = z.infer<typeof OpenAIResponseSchema>

// validation and types of the log data
export const LogDataSchema = z.object({
  input: openAIBodySchema,
  openAIResponse: OpenAIResponseSchema,
})

export type LogDataType = z.infer<typeof LogDataSchema>