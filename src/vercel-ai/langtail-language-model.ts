import {
  InvalidResponseDataError,
  JSONValue,
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  LanguageModelV2Content,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  SharedV2ProviderMetadata,
} from "@ai-sdk/provider"
import {
  ParseResult,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  generateId,
  isParsableJson,
  postJsonToApi,
} from "@ai-sdk/provider-utils"
import { z } from "zod/v4"
import { convertToOpenAIChatMessages } from "./convert-to-openai-chat-messages"
import { mapLangtailFinishReason } from "./map-langtail-finish-reason"
import { LangtailChatSettings } from "./langtail-chat-settings"
import {
  openaiErrorDataSchema,
  openaiFailedResponseHandler,
} from "./openai-error"
import { LangtailPrompts } from "../Langtail"
import type {
  PromptSlug,
  Environment,
  Version,
  LangtailEnvironment,
} from "../types"
import { getResponseMetadata } from "./get-response-metadata"
import { prepareTools } from "./openai-prepare-tools"
import { simpleHash } from "./simple-hash"
import {
  ReasoningDetailArraySchema,
  ReasoningDetailType,
  ReasoningDetailUnion,
} from "../reasoning-details-schema"

type LangtailChatConfig = {
  provider: string
  langtailPrompts: LangtailPrompts
  headers: Record<string, string | undefined>
}

// modelId cannot be undefined, therefore we use 'langtail'
// to choose the default model from Langtail playground
const MODEL_IN_LANGTAIL = "langtail"

export class LangtailChatLanguageModel<
  P extends PromptSlug = PromptSlug,
  E extends Environment<P> = undefined,
  V extends Version<P, E> = undefined,
> implements LanguageModelV2
{
  readonly specificationVersion = "v2" as const

  readonly modelId: string
  readonly promptId: P
  readonly provider: string

  readonly settings: LangtailChatSettings<P, E, V>

  private readonly config: LangtailChatConfig

  readonly supportedUrls: Record<string, RegExp[]> = {
    "image/*": [/^data:image\/[a-zA-Z0-9.+-]+;base64,/, /^https?:\/\/.+/i],
  }

  constructor(
    promptId: P,
    settings: LangtailChatSettings<P, E, V>,
    config: LangtailChatConfig,
  ) {
    this.promptId = promptId
    this.modelId = settings.model ?? MODEL_IN_LANGTAIL
    this.settings = settings
    this.config = config
    this.provider = config.provider
  }

  get environment(): E extends LangtailEnvironment ? E : "production" {
    return (this.settings.environment ??
      "production") as E extends LangtailEnvironment ? E : "production"
  }

  get version(): NonNullable<V> | "default" {
    return this.settings.version ?? "default"
  }

  get supportsStructuredOutputs(): boolean {
    return this.settings.structuredOutputs ?? false
  }

  get headers(): Record<string, string | undefined> {
    return this.config.headers
  }

  private createPromptPath(): string {
    return this.config.langtailPrompts.createPromptPath({
      prompt: this.promptId,
      environment: this.environment,
      version: this.settings.version, // use undefined if version is 'default'
    })
  }

  private getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    responseFormat,
    seed,
    tools,
    toolChoice,
    providerOptions,
  }: LanguageModelV2CallOptions) {
    const warnings: LanguageModelV2CallWarning[] = []

    if (topK != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "topK",
      })
    }

    if (
      responseFormat?.type === "json" &&
      responseFormat.schema != null &&
      !this.supportsStructuredOutputs
    ) {
      warnings.push({
        type: "unsupported-setting",
        setting: "responseFormat",
        details:
          "JSON response format schema is only supported with structuredOutputs",
      })
    }

    // anthropic thinking
    const thinking = providerOptions?.anthropic?.thinking as
      | {
          budgetTokens: number
          type: "enabled"
        }
      | undefined

    const baseArgs = {
      model: this.modelId,

      // Langtail-specific parameters:
      variables: this.settings.variables,

      // model specific settings:
      user: this.settings.user,
      parallel_tool_calls: true,

      // standardized settings:
      max_tokens: maxOutputTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      response_format:
        responseFormat?.type === "json"
          ? this.supportsStructuredOutputs && responseFormat.schema != null
            ? {
                type: "json_schema",
                json_schema: {
                  schema: responseFormat.schema,
                  strict: true,
                  name: responseFormat.name ?? "response",
                  description: responseFormat.description,
                },
              }
            : { type: "json_object" }
          : undefined,
      stop: stopSequences,
      seed,
      ...(thinking
        ? {
            max_thinking_tokens: thinking.budgetTokens,
          }
        : {}),

      // messages:
      messages: convertToOpenAIChatMessages({ prompt }),
    }

    // reasoning models have fixed params, remove them if they are set:
    if (isReasoningModel(this.modelId)) {
      baseArgs.temperature = undefined
      baseArgs.top_p = undefined
      baseArgs.frequency_penalty = undefined
      baseArgs.presence_penalty = undefined
    }

    // Handle tools if provided
    const { mappedTools, mappedToolChoice, toolWarnings } = prepareTools({
      tools,
      toolChoice,
      structuredOutputs: this.supportsStructuredOutputs,
    })

    return {
      args: {
        ...baseArgs,
        tools: mappedTools,
        tool_choice: mappedToolChoice,
      },
      warnings: [...warnings, ...toolWarnings],
    }
  }

  async doGenerate(
    options: LanguageModelV2CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV2["doGenerate"]>>> {
    const { args, warnings } = this.getArgs(options)

    const body = {
      ...args,
      stream: false,
      model: args.model === MODEL_IN_LANGTAIL ? undefined : args.model,
    }

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.createPromptPath(),
      headers: this.headers,
      body: body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        openaiChatResponseSchema,
      ),
      abortSignal: options.abortSignal,
    })

    const choice = response.choices[0]

    let providerMetadata: SharedV2ProviderMetadata | undefined
    if (
      response.usage?.completion_tokens_details?.reasoning_tokens != null ||
      response.usage?.prompt_tokens_details?.cached_tokens != null
    ) {
      providerMetadata = { openai: {} }
      if (response.usage?.completion_tokens_details?.reasoning_tokens != null) {
        providerMetadata.openai.reasoningTokens =
          response.usage?.completion_tokens_details?.reasoning_tokens
      }
      if (response.usage?.prompt_tokens_details?.cached_tokens != null) {
        providerMetadata.openai.cachedPromptTokens =
          response.usage?.prompt_tokens_details?.cached_tokens
      }
    }

    // Add reasoning_details to providerMetadata for preservation in multi-turn conversations
    if (
      choice.message.reasoning_details &&
      choice.message.reasoning_details.length > 0
    ) {
      if (!providerMetadata) {
        providerMetadata = {}
      }
      providerMetadata.langtail = {
        reasoning_details: choice.message
          .reasoning_details as ReasoningDetailUnion[],
      }
    }

    // Build content array (V2 format)
    const content: LanguageModelV2Content[] = []

    // Process reasoning content
    if (
      choice.message.reasoning_details &&
      choice.message.reasoning_details.length > 0
    ) {
      for (const detail of choice.message.reasoning_details) {
        const typedDetail = detail as ReasoningDetailUnion
        switch (typedDetail.type) {
          case ReasoningDetailType.Text: {
            if (typedDetail.text) {
              content.push({
                type: "reasoning",
                text: typedDetail.text,
                providerMetadata: {
                  langtail: { reasoning_details: [typedDetail] },
                },
              })
            }
            break
          }
          case ReasoningDetailType.Summary: {
            if (typedDetail.summary) {
              content.push({
                type: "reasoning",
                text: typedDetail.summary,
                providerMetadata: {
                  langtail: { reasoning_details: [typedDetail] },
                },
              })
            }
            break
          }
          case ReasoningDetailType.Encrypted: {
            if (typedDetail.data) {
              content.push({
                type: "reasoning",
                text: "[REDACTED]",
                providerMetadata: {
                  langtail: { reasoning_details: [typedDetail] },
                },
              })
            }
            break
          }
          default: {
            typedDetail satisfies never
          }
        }
      }
    } else if (choice.message.reasoning) {
      // Fallback to legacy reasoning field
      const reasoning = choice.message.reasoning
      if (typeof reasoning === "string") {
        content.push({
          type: "reasoning",
          text: reasoning,
        })
      }
    }

    // Add text content
    if (choice.message.content) {
      content.push({
        type: "text",
        text: choice.message.content,
      })
    }

    // Add tool calls
    if (choice.message.tool_calls) {
      // Collect reasoning_details for tool calls (needed for OpenRouter/Gemini)
      const reasoningDetails = choice.message.reasoning_details as
        | ReasoningDetailUnion[]
        | undefined

      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: "tool-call",
          toolCallId: toolCall.id ?? generateId(),
          toolName: toolCall.function.name,
          input: toolCall.function.arguments!,
          // Attach reasoning_details for OpenRouter/Gemini compatibility
          providerMetadata:
            reasoningDetails && reasoningDetails.length > 0
              ? { langtail: { reasoning_details: reasoningDetails } }
              : undefined,
        })
      }
    }

    return {
      content,
      finishReason: mapLangtailFinishReason(
        choice.finish_reason,
        Boolean(choice.message.tool_calls),
      ),
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? undefined,
        outputTokens: response.usage?.completion_tokens ?? undefined,
        totalTokens:
          response.usage?.prompt_tokens != null &&
          response.usage?.completion_tokens != null
            ? response.usage.prompt_tokens + response.usage.completion_tokens
            : undefined,
        reasoningTokens:
          response.usage?.completion_tokens_details?.reasoning_tokens ??
          undefined,
        cachedInputTokens:
          response.usage?.prompt_tokens_details?.cached_tokens ?? undefined,
      },
      request: { body },
      response: {
        ...getResponseMetadata(response),
        headers: responseHeaders,
      },
      warnings,
      providerMetadata,
    }
  }

  async doStream(
    options: LanguageModelV2CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    const { args, warnings } = this.getArgs(options)

    const body = {
      ...args,
      stream: true,
      model: args.model === MODEL_IN_LANGTAIL ? undefined : args.model,
    }

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.createPromptPath(),
      headers: this.headers,
      body: body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        langtailChatChunksSchema,
      ),
      abortSignal: options.abortSignal,
    })

    const toolCalls: Array<{
      id: string
      type: "function"
      function: {
        name: string
        arguments: string
      }
      inputStarted: boolean
      hasFinished: boolean
    }> = []

    let finishReason: LanguageModelV2FinishReason = "unknown"
    let usage: {
      inputTokens: number | undefined
      outputTokens: number | undefined
      totalTokens: number | undefined
      reasoningTokens: number | undefined
      cachedInputTokens: number | undefined
    } = {
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
      reasoningTokens: undefined,
      cachedInputTokens: undefined,
    }
    let isFirstChunk = true

    // Track reasoning details to preserve for multi-turn conversations
    const accumulatedReasoningDetails: ReasoningDetailUnion[] = []

    // Track reasoning items (from delta.reasoning) to preserve signatures for Anthropic
    const accumulatedReasoningItems: Array<{
      type: string
      text?: string
      signature?: string
    }> = []

    // V2 stream state tracking
    let textStarted = false
    let reasoningStarted = false
    let textId: string | undefined
    let reasoningId: string | undefined
    let responseId: string | undefined

    let providerMetadata: SharedV2ProviderMetadata | undefined

    // Helper to build reasoning providerMetadata for tool calls and finish events
    const getReasoningProviderMetadata = ():
      | SharedV2ProviderMetadata
      | undefined => {
      const hasReasoningDetails = accumulatedReasoningDetails.length > 0
      const hasReasoningItems = accumulatedReasoningItems.length > 0

      if (!hasReasoningDetails && !hasReasoningItems) {
        return undefined
      }

      const langtailMeta: Record<string, JSONValue> = {}

      if (hasReasoningDetails) {
        langtailMeta.reasoning_details = accumulatedReasoningDetails
      }

      if (hasReasoningItems) {
        // Consolidate reasoning items into a single reasoning block with signature
        // Anthropic expects this format: [{ type: "text", text: "...", signature: "..." }]
        langtailMeta.reasoning = consolidateReasoningItems(
          accumulatedReasoningItems,
        )
      }

      return { langtail: langtailMeta }
    }

    // Helper to consolidate streaming reasoning items into final format for Anthropic
    const consolidateReasoningItems = (
      items: Array<{ type: string; text?: string; signature?: string }>,
    ): Array<{ type: string; text?: string; signature?: string }> => {
      // Collect all text chunks and the final signature
      let fullText = ""
      let signature: string | undefined

      for (const item of items) {
        if (item.text) {
          fullText += item.text
        }
        if (item.signature) {
          signature = item.signature
        }
      }

      // Return a single consolidated reasoning block
      if (signature) {
        return [{ type: "text", text: fullText, signature }]
      } else if (fullText) {
        return [{ type: "text", text: fullText }]
      }
      return []
    }

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof langtailChatChunksSchema>>,
          LanguageModelV2StreamPart
        >({
          transform(chunk, controller) {
            // handle failed chunk parsing / validation:
            if (!chunk.success) {
              finishReason = "error"
              controller.enqueue({ type: "error", error: chunk.error })
              return
            }

            const value = chunk.value

            // handle error chunks:
            if ("error" in value) {
              finishReason = "error"
              controller.enqueue({ type: "error", error: value.error })
              return
            }

            if (isFirstChunk) {
              isFirstChunk = false
              responseId = value.id ?? generateId()

              controller.enqueue({
                type: "stream-start",
                warnings,
              })

              controller.enqueue({
                type: "response-metadata",
                ...getResponseMetadata(value),
              })
            }

            if (value.usage != null) {
              usage = {
                inputTokens: value.usage.prompt_tokens ?? undefined,
                outputTokens: value.usage.completion_tokens ?? undefined,
                totalTokens:
                  value.usage.prompt_tokens != null &&
                  value.usage.completion_tokens != null
                    ? value.usage.prompt_tokens + value.usage.completion_tokens
                    : undefined,
                reasoningTokens:
                  value.usage.completion_tokens_details?.reasoning_tokens ??
                  undefined,
                cachedInputTokens:
                  value.usage.prompt_tokens_details?.cached_tokens ?? undefined,
              }

              const {
                completion_tokens_details: completionTokenDetails,
                prompt_tokens_details: promptTokenDetails,
              } = value.usage

              if (
                completionTokenDetails?.reasoning_tokens != null ||
                promptTokenDetails?.cached_tokens != null
              ) {
                providerMetadata = { openai: {} }
                if (completionTokenDetails?.reasoning_tokens != null) {
                  providerMetadata.openai.reasoningTokens =
                    completionTokenDetails?.reasoning_tokens
                }
                if (promptTokenDetails?.cached_tokens != null) {
                  providerMetadata.openai.cachedPromptTokens =
                    promptTokenDetails?.cached_tokens
                }
              }
            }

            const choice = value.choices[0]

            if (choice?.finish_reason != null) {
              // Use toolCalls.length instead of delta.tool_calls
              // because tool_calls may have been in previous chunks
              finishReason = mapLangtailFinishReason(
                choice.finish_reason,
                toolCalls.length > 0,
              )
            }

            if (choice?.delta == null) {
              return
            }

            const delta = choice.delta

            // Helper to emit reasoning chunks
            const emitReasoningChunk = (chunkText: string) => {
              if (!reasoningStarted) {
                reasoningId = responseId ?? generateId()
                controller.enqueue({
                  type: "reasoning-start",
                  id: reasoningId,
                })
                reasoningStarted = true
              }
              controller.enqueue({
                type: "reasoning-delta",
                delta: chunkText,
                id: reasoningId!,
              })
            }

            // Handle reasoning_details if present (takes precedence over reasoning)
            if (delta.reasoning_details && delta.reasoning_details.length > 0) {
              // Accumulate reasoning_details to preserve for multi-turn conversations
              accumulatedReasoningDetails.push(
                ...(delta.reasoning_details as ReasoningDetailUnion[]),
              )

              for (const detail of delta.reasoning_details) {
                const typedDetail = detail as ReasoningDetailUnion
                switch (typedDetail.type) {
                  case ReasoningDetailType.Text: {
                    if (typedDetail.text != null) {
                      emitReasoningChunk(typedDetail.text)
                    }
                    break
                  }
                  case ReasoningDetailType.Summary: {
                    if (typedDetail.summary != null) {
                      emitReasoningChunk(typedDetail.summary)
                    }
                    break
                  }
                  case ReasoningDetailType.Encrypted: {
                    if (typedDetail.data != null) {
                      emitReasoningChunk("[REDACTED]")
                    }
                    break
                  }
                  default: {
                    typedDetail satisfies never
                    break
                  }
                }
              }
            } else if (delta.reasoning != null) {
              // Fallback to legacy reasoning field if reasoning_details not present
              const reasoningDelta = delta.reasoning

              if (typeof reasoningDelta === "string") {
                emitReasoningChunk(reasoningDelta)
              } else if (Array.isArray(reasoningDelta)) {
                for (const reasoningItem of reasoningDelta) {
                  // Accumulate reasoning items (including signatures for Anthropic)
                  accumulatedReasoningItems.push(reasoningItem)
                  if (reasoningItem.type === "text" && reasoningItem.text) {
                    emitReasoningChunk(reasoningItem.text)
                  } else if (reasoningItem.type === "redacted") {
                    emitReasoningChunk("[REDACTED]")
                  }
                }
              } else {
                // Accumulate single reasoning item (including signatures for Anthropic)
                accumulatedReasoningItems.push(reasoningDelta)
                if (reasoningDelta.type === "text" && reasoningDelta.text) {
                  emitReasoningChunk(reasoningDelta.text)
                } else if (reasoningDelta.type === "redacted") {
                  emitReasoningChunk("[REDACTED]")
                }
              }
            }

            // Handle text content - only if there's actual content
            if (delta.content != null && delta.content.length > 0) {
              // End reasoning if it was started before text
              if (reasoningStarted && !textStarted) {
                controller.enqueue({
                  type: "reasoning-end",
                  id: reasoningId!,
                })
                reasoningStarted = false
              }

              if (!textStarted) {
                textId = responseId ?? generateId()
                controller.enqueue({
                  type: "text-start",
                  id: textId,
                })
                textStarted = true
              }

              controller.enqueue({
                type: "text-delta",
                delta: delta.content,
                id: textId!,
              })
            }

            const mappedToolCalls: typeof delta.tool_calls = delta.tool_calls

            if (mappedToolCalls != null) {
              for (const toolCallDelta of mappedToolCalls) {
                const index = toolCallDelta.index

                // Tool call start. OpenAI returns all information except the arguments in the first chunk.
                if (toolCalls[index] == null) {
                  if (toolCallDelta.type !== "function") {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function' type.`,
                    })
                  }

                  if (toolCallDelta.id == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'id' to be a string.`,
                    })
                  }

                  if (toolCallDelta.function?.name == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function.name' to be a string.`,
                    })
                  }

                  toolCalls[index] = {
                    // add hash of arguments to the id to avoid collisions
                    // this is happening with Google Gemini 2.5
                    id:
                      toolCallDelta.id === toolCallDelta.function.name
                        ? `${toolCallDelta.id}-${simpleHash(toolCallDelta.function.arguments ?? "")}`
                        : toolCallDelta.id,
                    type: "function",
                    function: {
                      name: toolCallDelta.function.name,
                      arguments: toolCallDelta.function.arguments ?? "",
                    },
                    inputStarted: false,
                    hasFinished: false,
                  }

                  const toolCall = toolCalls[index]

                  if (
                    toolCall.function?.name != null &&
                    toolCall.function?.arguments != null
                  ) {
                    // send delta if the argument text has already started:
                    if (toolCall.function.arguments.length > 0) {
                      if (!toolCall.inputStarted) {
                        toolCall.inputStarted = true
                        controller.enqueue({
                          type: "tool-input-start",
                          id: toolCall.id,
                          toolName: toolCall.function.name,
                        })
                      }
                      controller.enqueue({
                        type: "tool-input-delta",
                        id: toolCall.id,
                        delta: toolCall.function.arguments,
                      })
                    }

                    // check if tool call is complete
                    // (some providers send the full tool call in one chunk):
                    if (isParsableJson(toolCall.function.arguments)) {
                      if (toolCall.inputStarted) {
                        controller.enqueue({
                          type: "tool-input-end",
                          id: toolCall.id,
                        })
                      }
                      controller.enqueue({
                        type: "tool-call",
                        toolCallId: toolCall.id ?? generateId(),
                        toolName: toolCall.function.name,
                        input: toolCall.function.arguments,
                        // Attach reasoning for multi-turn conversations
                        providerMetadata: getReasoningProviderMetadata(),
                      })
                      toolCall.hasFinished = true
                    }
                  }

                  continue
                }

                // existing tool call, merge if not finished
                const toolCall = toolCalls[index]
                if (toolCall.hasFinished) {
                  continue
                }

                if (!toolCall.inputStarted) {
                  toolCall.inputStarted = true
                  controller.enqueue({
                    type: "tool-input-start",
                    id: toolCall.id,
                    toolName: toolCall.function.name,
                  })
                }

                if (toolCallDelta.function?.arguments != null) {
                  toolCall.function!.arguments +=
                    toolCallDelta.function?.arguments ?? ""
                }

                // send delta
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCall.id,
                  delta: toolCallDelta.function.arguments ?? "",
                })

                // check if tool call is complete
                if (
                  toolCall.function?.name != null &&
                  toolCall.function?.arguments != null &&
                  isParsableJson(toolCall.function.arguments)
                ) {
                  controller.enqueue({
                    type: "tool-input-end",
                    id: toolCall.id,
                  })
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId: toolCall.id ?? generateId(),
                    toolName: toolCall.function.name,
                    input: toolCall.function.arguments,
                    // Attach reasoning for multi-turn conversations
                    providerMetadata: getReasoningProviderMetadata(),
                  })
                  toolCall.hasFinished = true
                }
              }
            }
          },

          flush(controller) {
            // Handle any unfinished tool calls
            if (finishReason === "tool-calls") {
              for (const toolCall of toolCalls) {
                if (toolCall && !toolCall.hasFinished) {
                  if (toolCall.inputStarted) {
                    controller.enqueue({
                      type: "tool-input-end",
                      id: toolCall.id,
                    })
                  }
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId: toolCall.id ?? generateId(),
                    toolName: toolCall.function.name,
                    input: isParsableJson(toolCall.function.arguments)
                      ? toolCall.function.arguments
                      : "{}",
                    // Attach reasoning for multi-turn conversations
                    providerMetadata: getReasoningProviderMetadata(),
                  })
                  toolCall.hasFinished = true
                }
              }
            }

            // End reasoning if still active
            if (reasoningStarted) {
              controller.enqueue({
                type: "reasoning-end",
                id: reasoningId!,
              })
            }

            // End text if still active
            if (textStarted) {
              controller.enqueue({
                type: "text-end",
                id: textId!,
              })
            }

            // Include accumulated reasoning in providerMetadata if any were received
            const reasoningMeta = getReasoningProviderMetadata()
            if (reasoningMeta) {
              if (!providerMetadata) {
                providerMetadata = {}
              }
              providerMetadata.langtail = {
                ...providerMetadata.langtail,
                ...reasoningMeta.langtail,
              }
            }

            controller.enqueue({
              type: "finish",
              finishReason,
              usage: {
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                totalTokens: usage.totalTokens,
                reasoningTokens: usage.reasoningTokens,
                cachedInputTokens: usage.cachedInputTokens,
              },
              providerMetadata,
            })
          },
        }),
      ),
      request: { body },
      response: { headers: responseHeaders },
    }
  }
}

const openaiTokenUsageSchema = z
  .object({
    prompt_tokens: z.number().nullish(),
    completion_tokens: z.number().nullish(),
    prompt_tokens_details: z
      .object({
        cached_tokens: z.number().nullish(),
      })
      .nullish(),
    completion_tokens_details: z
      .object({
        reasoning_tokens: z.number().nullish(),
      })
      .nullish(),
  })
  .nullish()

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const openaiChatResponseSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      message: z.object({
        role: z.literal("assistant").nullish(),
        content: z.string().nullish(),
        reasoning: z
          .union([
            z.string(),
            z.object({
              type: z.literal("text"),
              text: z.string().optional(),
              signature: z.string().optional(),
            }),
            z.object({
              type: z.literal("redacted"),
              data: z.string(),
            }),
            z.array(
              z.union([
                z.object({
                  type: z.literal("text"),
                  text: z.string(),
                  signature: z.string().optional(),
                }),
                z.object({
                  type: z.literal("redacted"),
                  data: z.string(),
                }),
              ]),
            ),
          ])
          .nullish(),
        reasoning_details: ReasoningDetailArraySchema.nullish(),
        function_call: z
          .object({
            arguments: z.string(),
            name: z.string(),
          })
          .nullish(),
        tool_calls: z
          .array(
            z.object({
              id: z.string().nullish(),
              type: z.literal("function"),
              function: z.object({
                name: z.string(),
                arguments: z.string(),
              }),
            }),
          )
          .nullish(),
      }),
      index: z.number(),
      logprobs: z
        .object({
          content: z
            .array(
              z.object({
                token: z.string(),
                logprob: z.number(),
                top_logprobs: z.array(
                  z.object({
                    token: z.string(),
                    logprob: z.number(),
                  }),
                ),
              }),
            )
            .nullable(),
        })
        .nullish(),
      finish_reason: z.string().nullish(),
    }),
  ),
  usage: openaiTokenUsageSchema,
})

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const langtailChatChunksSchema = z.union([
  z.object({
    id: z.string().nullish(),
    created: z.number().nullish(),
    model: z.string().nullish(),
    choices: z.array(
      z.object({
        delta: z
          .object({
            role: z.enum(["assistant"]).nullish(),
            content: z.string().nullish(),
            reasoning: z
              .union([
                z.string(),
                z.object({
                  type: z.literal("text"),
                  text: z.string().optional(),
                  signature: z.string().optional(),
                }),
                z.object({
                  type: z.literal("redacted"),
                  data: z.string(),
                }),
                z.array(
                  z.union([
                    z.object({
                      type: z.literal("text"),
                      text: z.string(),
                      signature: z.string().optional(),
                    }),
                    z.object({
                      type: z.literal("redacted"),
                      data: z.string(),
                    }),
                  ]),
                ),
              ])
              .nullish(),
            reasoning_details: ReasoningDetailArraySchema.nullish(),
            function_call: z
              .object({
                name: z.string().optional(),
                arguments: z.string().optional(),
              })
              .nullish(),
            tool_calls: z
              .array(
                z.object({
                  index: z.number(),
                  id: z.string().nullish(),
                  type: z.literal("function").optional(),
                  function: z.object({
                    name: z.string().nullish(),
                    arguments: z.string().nullish(),
                  }),
                }),
              )
              .nullish(),
          })
          .nullish(),
        logprobs: z
          .object({
            content: z
              .array(
                z.object({
                  token: z.string(),
                  logprob: z.number(),
                  top_logprobs: z.array(
                    z.object({
                      token: z.string(),
                      logprob: z.number(),
                    }),
                  ),
                }),
              )
              .nullable(),
          })
          .nullish(),
        finish_reason: z.string().nullable().optional(),
        index: z.number(),
      }),
    ),
    usage: openaiTokenUsageSchema,
  }),
  openaiErrorDataSchema,
])

function isReasoningModel(modelId: string) {
  return modelId.startsWith("o1-")
}

function isAudioModel(modelId: string) {
  return modelId.startsWith("gpt-4o-audio-preview")
}
