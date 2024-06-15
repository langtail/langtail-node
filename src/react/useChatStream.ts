import {
  ChatCompletion,
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionChunk,
  ChatCompletionMessageParam,
} from "openai/resources"
import { chatStreamToRunner, type ChatCompletionStream } from "../stream"
import { useRef, useState } from "react"

const defaultReturn = {
  abort: () => { },
}

type ChatMessage =
  | {
    role: "user" | "assistant" | "system"
    content: string | null
  }
  | {
    role: "tool"
    tool_call_id: string
    content: string
  }

export function mapAIMessagesToChatCompletions(
  messages: (ChatCompletion | ChatMessage)[],
): ChatMessage[] {
  return messages.flatMap((message) => {
    if ("id" in message) {
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
    return "content" in choice.delta
  })

  if (!contentMessage) {
    return messages
  }

  const existingMessageToComplete = messages.find((message) => {
    return "id" in message && message.id === messageId
  })

  if (!existingMessageToComplete) {
    return [
      ...messages,
      {
        id: chunk.id,
        created: chunk.created,
        model: chunk.model,
        object: 'chat.completion',
        choices: chunk.choices.map((choice) => {
          const messageChoice: ChatCompletion.Choice = {
            finish_reason: 'length' as const,
            index: choice.index,
            logprobs: null,
            message: {
              content: choice.delta.content ?? "",
              role: "assistant" as const,
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
              finish_reason: 'length' as const,
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

function parameterToMessage(
  parameter: ChatMessage[] | string,
): ChatMessage[] {
  if (Array.isArray(parameter)) {
    return parameter
  }

  return [
    {
      role: "user",
      content: parameter,
    },
  ]
}

// NOTE: Petr error handling

export function useChatStream<
  P extends ChatMessage[] | string,
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
      // NOTE: don't forget to abort the request here too.
      runnerRef.current.abort()
      abortControllerRef.current?.abort()
    },
    send: function send(parameter: P, optional?: O) {
      const abortController = new AbortController()
      abortControllerRef.current = abortController
      // NOTE: tohle pořešit

      switch (options.messageMode ?? 'append') {
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
            messagesRef.current = messagesRef.current
              .filter(
                (currentMessage) =>
                  !("id" in currentMessage) ||
                  currentMessage.id !== finalMessage.id,
              )
              .concat(finalMessage.choices.flatMap((choice) => choice.message))

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
                // NOTE: pass the complete messages from the previous call to finish the tool call
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
            runnerRef.current = { abort: () => { } }
            return
          }
        }, (error) => {
          options.onError?.(error)
          setErrorState(error)
        },
      )
    },
  }
}
