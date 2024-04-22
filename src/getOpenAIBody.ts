import type OpenAI from "openai"
import { z } from "zod"
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi"

import { MessageSchema, PlaygroundState } from "./schemas"
import { compileLTTemplate } from "./template"

extendZodWithOpenApi(z)

export const bodyMetadataSchema = z
  .record(z.string().max(64), z.union([z.string(), z.number()]))
  .optional()

export const langtailBodySchema = z.object({
  doNotRecord: z.boolean().optional().openapi({
    description:
      "If true, potentially sensitive data like the prompt and response will not be recorded in the logs",
    example: false,
  }),
  metadata: bodyMetadataSchema,
  _langtailTestRunId: z.string().optional(),
  _langtailTestInputId: z.string().optional(),
})

export const openAiBodySchema = z.object({
  stream: z.boolean().optional().openapi({ example: false }),
  user: z.string().optional().openapi({
    description: "A unique identifier representing your end-user",
    example: "user_123",
  }),

  seed: z.number().optional().openapi({
    description: "A seed is used  to generate reproducible results",
    example: 123,
  }),

  variables: z.record(z.string(), z.string()).optional(),

  messages: z
    .array(MessageSchema)
    .optional()
    .openapi({
      description: "Additional messages to seed the conversation with",
      example: [
        {
          role: "user",
          content: "Hello",
        },
      ],
    }),
})

export const bothBodySchema = langtailBodySchema.merge(openAiBodySchema)

export type IncomingBodyType = z.infer<typeof bothBodySchema>
export type OpenAiBodyType = z.infer<typeof openAiBodySchema>

// TODO remove this from our prompt-API when this is merged so that we don't have this code duplicated
export function getOpenAIBody(
  completionConfig: PlaygroundState,
  parsedBody: IncomingBodyType,
) {
  const completionArgs = completionConfig.state.args

  const inputMessages = [
    ...completionConfig.state.template.map((item) => {
      const needsCompilation =
        typeof item.content === "string" ? item.content?.includes("{{") : true

      return {
        ...item,
        content:
          item.content &&
          (needsCompilation
            ? compileLTTemplate(
                item.content,
                parsedBody.variables as Record<string, string>,
              )
            : item.content),
      }
    }),
    ...(parsedBody.messages ?? []),
  ]
  const openAIbody: OpenAI.Chat.ChatCompletionCreateParams = {
    model: completionArgs.model,
    max_tokens:
      completionArgs.max_tokens == -1 ? undefined : completionArgs.max_tokens,
    temperature: completionArgs.temperature,
    // @ts-expect-error
    messages: inputMessages,
    top_p: completionArgs.top_p,
    presence_penalty: completionArgs.presence_penalty,
    frequency_penalty: completionArgs.frequency_penalty,
    ...(completionArgs.jsonmode
      ? {
          response_format: {
            type: "json_object",
          },
        }
      : {}),
    ...(parsedBody.seed || completionArgs.seed
      ? {
          seed: parsedBody.seed ?? completionArgs.seed,
        }
      : {}),
    ...(Array.isArray(completionArgs.stop) && completionArgs.stop.length > 0
      ? { stop: completionArgs.stop }
      : {}),
  }
  if (
    completionConfig.state.functions &&
    completionConfig.state.functions.length > 0
  ) {
    openAIbody.functions = completionConfig.state.functions
  }
  if (completionConfig.state.tools && completionConfig.state.tools.length > 0) {
    // Remove tools[0].function.id from the tools array as that is an internal langtail id
    openAIbody.tools = completionConfig.state.tools.map((tool) => {
      const { id: _, ...rest } = tool.function
      return { ...tool, function: rest }
    })
  }
  return openAIbody
}
