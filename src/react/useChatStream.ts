import {
  ChatCompletion,
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionMessage,
} from "openai/resources"
import { chatStreamToRunner, type ChatCompletionStream } from "../stream"
import { useRef, useState } from "react"

const defaultReturn = {
  abort: () => { },
}

export type ChatMessage =
  | {
    role: "user" | "assistant" | "system"
    content: string | null
    tool_calls?: ChatCompletionMessageToolCall[]
  }
  | {
    role: "tool"
    tool_call_id: string
    content: string | null
    tool_calls?: ChatCompletionMessageToolCall[]
  } | {
    role: "assistant" | "user" | "system" | "tool"
    content: [
      {
        type: "image_url",
        image_url: {
          detail: "auto",
          url: string,
        },
      },
    ] | [
      {
        type: "image_url",
        image_url: {
          detail: "auto",
          url: string,
        },
      },
      {
        type: "text",
        text: string,
      },
    ]
    tool_calls?: ChatCompletionMessageToolCall[]
  }

export function mapAIMessagesToChatCompletions(
  messages: (ChatCompletion | ChatMessage)[],
): ChatMessage[] {
  return messages.flatMap((message) => {
    if ("id" in message && "choices" in message) {
      return message.choices.map((choice) => {
        return choice.message
      })
    }

    return [message]
  })
}

export function combineAIMessageChunkWithCompleteMessages(
  messages: (ChatCompletion | ChatMessage)[],
  chunk: ChatCompletionChunk,
): (ChatCompletion | ChatMessage)[] {
  const messageId = chunk.id

  const contentMessage = chunk.choices.find((choice) => {
    const lookForContentIn = choice.delta || ("message" in choice && choice.message) || {}
    return "content" in lookForContentIn
  })

  if (!contentMessage) {
    return messages
  }

  const existingMessageToComplete = messages.find((message) => {
    return "id" in message && message.id === messageId
  })

  const choicesDeltas = chunk.choices.filter((choice) => {
    return "delta" in choice && choice.delta // NOTE: delte can be null
  })

  if (!existingMessageToComplete && choicesDeltas.length > 0) {
    return [
      ...messages,
      {
        id: chunk.id,
        created: chunk.created,
        model: chunk.model,
        object: 'chat.completion',
        choices: choicesDeltas.map((choice) => {
          const messageChoice: ChatCompletion.Choice = {
            finish_reason: 'length' as const,
            index: choice.index,
            logprobs: null,
            delta: choice.delta,
            message: {
              ...choice.delta,
              content: choice.delta.content ?? "",
              // @ts-expect-error - mantain the original role here
              role: choice.delta.role ?? "assistant" as const,
            },
          }

          return messageChoice
        }),
      },
    ]
  }

  return messages.map((message) => {
    if ("id" in message && message.id === messageId) {
      const chunkChoices = chunk.choices.reduce<
        Map<number, ChatCompletionChunk.Choice>
      >((acc, choice) => {
        acc.set(choice.index, choice)
        return acc
      }, new Map())

      return {
        ...message,
        choices: message.choices.map((choice) => {
          const chunkChoice = chunkChoices.get(choice.index)

          if (!chunkChoice) {
            return choice
          }

          return {
            ...choice,
            ...{
              ...chunkChoice,
              finish_reason: chunkChoice.finish_reason ?? 'length' as const,
            },
            message: {
              ...choice.message,
              content:
                (choice.message?.content ?? "") +
                (chunkChoice.delta.content ?? ""),
            },
          }
        }),
      }
    }
    return message
  })
}

function normalizeMessage(message: ChatCompletionMessage, currentMessage?: ChatCompletionChunk) {
  const toolCalls = (message.tool_calls && message.tool_calls.length === 0 && currentMessage?.choices?.some(choice => (("delta" in choice) && "tool_calls" in choice.delta) && choice.delta?.tool_calls)
    ? currentMessage?.choices?.flatMap(choice => (("delta" in choice) && "tool_calls" in choice.delta) && Array.isArray(choice.delta?.tool_calls) ? choice.delta?.tool_calls : [])
    : message.tool_calls ?? []) as ChatCompletionMessageToolCall[]
  return {
    ...message,
    // NOTE: ensure that message isn't null or undefined
    content: message.content ?? "",
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  }
}

function parameterToMessage(
  parameter: ChatMessage | ChatMessage[] | string,
): ChatMessage[] {
  if (Array.isArray(parameter)) {
    return parameter
  }

  if (typeof parameter === "string") {
    return [
      {
        role: "user",
        content: parameter,
      },
    ]
  }

  return [parameter]
}

export function useChatStream<
  P extends ChatMessage[] | ChatMessage | string,
  O extends Record<string, any> = Record<string, any>,
>(
  options: {
    messageMode?: 'append' | 'replace'
    fetcher: (
      paramters: P,
      optional: O | undefined,
      abortController: AbortController,
    ) => Promise<ReadableStream<Uint8Array | string> | null>,
    onText?: (contentDelta: string) => void
    onToolCall?: (
      toolCall: ChatCompletionMessageToolCall,
      message: ChatCompletionAssistantMessageParam,
    ) => Promise<string> | string
    onAbort?: () => void
    onChunk?: (chunk: ChatCompletionChunk) => void
    onError?: (error: Error) => void
    onStart?: () => void
    onEnd?: (finalAIMessages: ChatMessage[]) => void
    onMessagesChange?: (messages: ChatMessage[]) => void
  } = {
      fetcher: () => Promise.resolve(null),
    },
): {
  isLoading: boolean
  error: null | Error
  messages: ChatMessage[]
  addMessages: (additionalMessages: ChatCompletion[]) => void
  setMessages: (additionalMessages: ChatCompletion[]) => void
  abort: () => void
  send: (parameters: P, optional?: O | undefined) => void
} {
  const messagesRef = useRef<(ChatCompletion | ChatMessage)[]>([])
  const runnerRef = useRef<ChatCompletionStream | typeof defaultReturn>(
    defaultReturn,
  )
  const toolRunRef = useRef<Boolean>(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [messages, setMessages] = useState<(ChatCompletion | ChatMessage)[]>([])
  const [error, setError] = useState<Error | null>(null)
  const generatingRef = useRef<boolean>(false)
  const endedRef = useRef<boolean>(false)
  const errorRef = useRef<Error | null>(null)
  const messageMode = options.messageMode ?? 'append'

  function setIsLoadingState(generating: boolean) {
    generatingRef.current = generating
    setIsLoading(generatingRef.current)
  }

  function setMessagesState(messages: (ChatCompletion | ChatMessage)[]) {
    messagesRef.current = messages
    setMessages(messagesRef.current)
  }

  function setErrorState(error: Error | null) {
    errorRef.current = error
    setError(errorRef.current)
  }


  function addMessages(
    messages: (ChatCompletion | ChatMessage)[],
  ): (ChatCompletion | ChatMessage)[] {
    messagesRef.current = messagesRef.current.concat(messages)
    setMessagesState(messagesRef.current)

    return messagesRef.current
  }

  return {
    error,
    messages: mapAIMessagesToChatCompletions(messages),
    isLoading,
    addMessages,
    setMessages: (messages: ChatCompletion[]) => {
      setMessagesState(messages)
    },
    abort: () => {
      setIsLoadingState(false)
      runnerRef.current.abort()
      abortControllerRef.current?.abort()
    },
    send: function send(parameter: P, optional?: O) {
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      switch (messageMode) {
        case 'replace':
          setMessagesState(parameterToMessage(parameter))
        case 'append':
          addMessages(parameterToMessage(parameter))
      }

      setIsLoadingState(true)
      return options.fetcher(parameter, optional, abortController).then(
        (maybeStream) => {
          if (!maybeStream) {
            setIsLoadingState(false)
            return () => { }
          }


          const onConnect = () => {
            if (endedRef.current) {
              options.onStart?.()
            }
          }

          const onFinalChatCompletion = (finalMessage: ChatCompletion) => {
            // NOTE: for some reason, tool_calls are empty in finalMessage, that's why we keep them through storing the finalized message
            const finalizedMessage = messagesRef.current.find((currentMessage) => {
              return "id" in currentMessage && currentMessage.id === finalMessage.id
            })

            messagesRef.current = messagesRef.current
              .filter(
                (currentMessage) =>
                  !("id" in currentMessage) ||
                  currentMessage.id !== finalMessage.id,
              )
              .concat(finalMessage.choices.flatMap((choice) => normalizeMessage(choice.message, finalizedMessage as unknown as (ChatCompletionChunk | undefined))))


            const userChatMessages = mapAIMessagesToChatCompletions(
              messagesRef.current,
            )
            options.onMessagesChange?.(userChatMessages)
            setMessagesState(messagesRef.current)
          }

          const onChunk = (chunk: ChatCompletionChunk) => {
            options.onChunk?.(chunk)

            const combinedMessages = combineAIMessageChunkWithCompleteMessages(
              messagesRef.current,
              chunk,
            )
            const mappedAiToChatCompletions =
              mapAIMessagesToChatCompletions(combinedMessages)
            options.onMessagesChange?.(mappedAiToChatCompletions)

            setMessagesState(combinedMessages)
          }

          const onContent = (delta: string) => {
            options.onText?.(delta)
          }

          const onMessage = (message: ChatCompletionMessageParam) => {
            const { onToolCall } = options
            if (
              message.role === "assistant" &&
              message.tool_calls &&
              onToolCall
            ) {
              toolRunRef.current = true
              Promise.all(
                message.tool_calls.map((toolCall) =>
                  Promise.resolve(onToolCall(toolCall, message)).then(
                    (content) => ({
                      role: "tool" as const,
                      tool_call_id: toolCall.id,
                      content,
                    })
                  ),
                ),
              ).then((toolMessages) => {
                const nextMessages = [...addMessages(toolMessages)]
                messagesRef.current = []
                return send(nextMessages as P, optional)
              }, (error) => {
                setErrorState(error)
                options.onError?.(error)
              })
            }
          }

          const onEnd = () => {
            abortControllerRef.current = null
            if (toolRunRef.current) {
              toolRunRef.current = false
              return
            }

            endedRef.current = true
            setIsLoadingState(false)
            options.onEnd?.(mapAIMessagesToChatCompletions(messagesRef.current))
          }


          const runner = chatStreamToRunner(maybeStream)

          const destroyRunner = () => {
            runner.off("connect", onConnect)
            runner.off("finalChatCompletion", onFinalChatCompletion)
            runner.off("content", onContent)
            runner.off("message", onMessage)
            runner.off("chunk", onChunk)
            runner.off("end", onEnd)
            runner.off("abort", onAbort)

            runnerRef.current = defaultReturn
          }

          const onAbort = () => {
            options.onAbort?.()
            destroyRunner()
          }

          runner.on("connect", onConnect)
          runner.on("content", onContent)
          runner.on("chunk", onChunk)
          runner.on("finalChatCompletion", onFinalChatCompletion)
          runner.on("message", onMessage)
          runner.on("end", onEnd)
          runner.on("abort", onAbort)

          runnerRef.current = runner
          if (abortControllerRef.current?.signal.aborted) {
            runner.abort()
            setIsLoadingState(false)
            runnerRef.current = { abort: () => { } }
            return
          }
        }, (error) => {
          setIsLoadingState(false)
          options.onError?.(error)
          setErrorState(error)
        },
      )
    },
  }
}
