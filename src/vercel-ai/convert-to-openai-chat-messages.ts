import {
  LanguageModelV1Prompt,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider"
import { convertUint8ArrayToBase64 } from "@ai-sdk/provider-utils"
import {
  OpenAIChatPrompt,
  ChatCompletionContentPart,
} from "./openai-chat-prompt"
import type { MessageProviderMetadata, MessageReasoning } from "../schemas"
import { ReasoningDetail } from "../reasoning-details-schema"

function areJsonValuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => areJsonValuesEqual(value, right[index]))
    )
  }

  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false
  }

  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord)
  const rightKeys = Object.keys(rightRecord)

  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(rightRecord, key) &&
        areJsonValuesEqual(leftRecord[key], rightRecord[key]),
    )
  )
}

function getOriginalToolCallArguments({
  providerMetadata,
  toolCallId,
  toolName,
  args,
}: {
  providerMetadata: MessageProviderMetadata | undefined
  toolCallId: string
  toolName: string
  args: unknown
}): string | undefined {
  const outputItem = providerMetadata?.openai?.responses?.output_items.find(
    (item) =>
      item.type === "function_call" &&
      item.call_id === toolCallId &&
      item.name === toolName &&
      typeof item.arguments === "string",
  )

  if (!outputItem || typeof outputItem.arguments !== "string") {
    return undefined
  }

  try {
    const serializedArgs = JSON.stringify(args)
    return serializedArgs !== undefined &&
      areJsonValuesEqual(
        JSON.parse(outputItem.arguments),
        JSON.parse(serializedArgs),
      )
      ? outputItem.arguments
      : undefined
  } catch {
    return undefined
  }
}

export function convertToOpenAIChatMessages({
  prompt,
}: {
  prompt: LanguageModelV1Prompt
}): OpenAIChatPrompt {
  const messages: OpenAIChatPrompt = []

  // Helper function to add a message with cacheControl if needed
  const addMessage = (
    message: any,
    cacheEnabled: boolean,
    cacheTtl?: string,
  ) => {
    if (cacheEnabled) {
      message.cache_enabled = true
    }
    if (cacheTtl) {
      message.cache_ttl = cacheTtl
    }

    messages.push(message)
  }

  for (const { role, content, providerMetadata } of prompt) {
    const anthropicCacheControl = providerMetadata?.anthropic?.cacheControl
    const cacheEnabled = Boolean(anthropicCacheControl)
    const cacheTtl =
      typeof anthropicCacheControl === "object" &&
      anthropicCacheControl !== null
        ? (anthropicCacheControl as { ttl?: string }).ttl
        : undefined

    switch (role) {
      case "system": {
        addMessage({ role: "system", content }, cacheEnabled, cacheTtl)
        break
      }

      case "user": {
        if (content.length === 1 && content[0].type === "text") {
          addMessage(
            { role: "user", content: content[0].text },
            cacheEnabled,
            cacheTtl,
          )
          break
        }

        addMessage(
          {
            role: "user",
            content: content.map((part) => {
              switch (part.type) {
                case "text": {
                  return { type: "text", text: part.text }
                }
                case "image": {
                  return {
                    type: "image_url",
                    image_url: {
                      url:
                        part.image instanceof URL
                          ? part.image.toString()
                          : `data:${
                              part.mimeType ?? "image/jpeg"
                            };base64,${convertUint8ArrayToBase64(part.image)}`,

                      // OpenAI specific extension: image detail
                      detail: part.providerMetadata?.openai?.imageDetail,
                    },
                  }
                }
                case "file": {
                  throw new UnsupportedFunctionalityError({
                    functionality: "File content parts in user messages",
                  })
                }
              }
            }),
          },
          cacheEnabled,
          cacheTtl,
        )
        break
      }

      case "assistant": {
        let text = ""
        let reasoning: MessageReasoning[] = []
        let reasoningDetails: ReasoningDetail[] | undefined
        let responseProviderMetadata: MessageProviderMetadata | undefined
        let refusal: string | undefined
        const toolCalls: Array<{
          id: string
          type: "function"
          function: { name: string; arguments: string }
        }> = []

        // Check if providerMetadata contains preserved reasoning_details
        const langtailMetadata = providerMetadata?.langtail as
          | {
              reasoning_details?: ReasoningDetail[]
              provider_metadata?: MessageProviderMetadata
              refusal?: string | null
            }
          | undefined
        if (langtailMetadata?.reasoning_details) {
          reasoningDetails = langtailMetadata.reasoning_details
        }
        if (langtailMetadata?.provider_metadata) {
          responseProviderMetadata = langtailMetadata.provider_metadata
        }
        if (langtailMetadata?.refusal != null) {
          refusal = langtailMetadata.refusal
        }

        for (const part of content) {
          switch (part.type) {
            case "reasoning": {
              reasoning.push({
                type: "text",
                text: part.text,
                signature: part.signature,
              })
              break
            }
            case "redacted-reasoning": {
              reasoning.push({
                type: "redacted",
                data: part.data,
              })
              break
            }

            case "text": {
              text += part.text
              break
            }
            case "tool-call": {
              toolCalls.push({
                id: part.toolCallId,
                type: "function",
                function: {
                  name: part.toolName,
                  arguments:
                    getOriginalToolCallArguments({
                      providerMetadata: responseProviderMetadata,
                      toolCallId: part.toolCallId,
                      toolName: part.toolName,
                      args: part.args,
                    }) ?? JSON.stringify(part.args),
                },
              })
              break
            }

            default: {
              const _exhaustiveCheck: any = part
              throw new Error(`Unsupported part: ${_exhaustiveCheck}`)
            }
          }
        }

        addMessage(
          {
            role: "assistant",
            content: text,
            refusal,
            reasoning: reasoning.length > 0 ? reasoning : undefined,
            reasoning_details: reasoningDetails,
            provider_metadata: responseProviderMetadata,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          },
          cacheEnabled,
          cacheTtl,
        )
        break
      }

      case "tool": {
        for (const toolResponse of content) {
          let toolContent: string | Array<ChatCompletionContentPart>

          // Check if result is already in message array format
          if (
            Array.isArray(toolResponse.result) &&
            toolResponse.result.length > 0 &&
            toolResponse.result.every(
              (item: any) =>
                typeof item === "object" &&
                item !== null &&
                "type" in item &&
                ["text", "image_url"].includes(item.type),
            )
          ) {
            // Handle as content array (supports images and text)
            toolContent = toolResponse.result.map((part: any) => {
              switch (part.type) {
                case "text": {
                  return { type: "text", text: part.text }
                }
                case "image_url": {
                  return {
                    type: "image_url",
                    image_url: {
                      url: part.image_url.url,
                    },
                  }
                }
                default: {
                  throw new Error(
                    `Unsupported tool result content type: ${part.type}`,
                  )
                }
              }
            })
          } else {
            // Fall back to JSON string for backward compatibility
            toolContent = JSON.stringify(toolResponse.result)
          }

          addMessage(
            {
              role: "tool",
              tool_call_id: toolResponse.toolCallId,
              content: toolContent,
            },
            cacheEnabled,
            cacheTtl,
          )
        }
        break
      }

      default: {
        const _exhaustiveCheck: never = role
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`)
      }
    }
  }

  return messages
}
