import { ChatCompletionAssistantMessageParam, ChatCompletionMessageToolCall } from "openai/resources";
import { chatStreamToRunner, type ChatCompletionStream } from "../../stream";
import { useRef } from "react"


const defaultReturn = {
  abort: () => { },
}

export function useAIStream<P extends Record<string, any>>(createReadableAIStream: (paramters: P) => Promise<ReadableStream<Uint8Array | string> | null>, callbacks: {
  onText?: (delta) => void;
  onToolCall?: (message: ChatCompletionAssistantMessageParam) => void;
  onAbort?: () => void;
  onStart?: () => void;
  onEnd?: () => void;
} = {}): {
  abort: () => void;
  send: (parameters: P) => void;
} {
  const runnerRef = useRef<ChatCompletionStream | typeof defaultReturn>(defaultReturn);
  const toolRunRef = useRef<Boolean>(false);


  return {
    abort: () => {
      runnerRef.current.abort()
    },
    send: (parameters: P) => {
      createReadableAIStream(parameters).then(maybeStream => {
        if (!maybeStream) {
          return () => { }
        }

        const runner = chatStreamToRunner(maybeStream);
        runnerRef.current = runner;

        const onConnect = () => {
          callbacks.onStart?.();
        }

        const onContent = (delta) => {
          callbacks.onText?.(delta);
        }

        const onMessage = (message) => {
          if (message.role === "assistant" && message.tool_calls) {
            toolRunRef.current = true;
            callbacks.onToolCall?.(message);
          }
        }

        const onEnd = () => {
          if (toolRunRef.current) {
            toolRunRef.current = false;
            return
          }
          callbacks.onEnd?.();
        }


        const destroyRunner = () => {
          runner.off("connect", onConnect)
          runner.off("content", onContent)
          runner.off("message", onMessage)
          runner.off("end", onEnd)
          runner.off("abort", onAbort)

          runnerRef.current = defaultReturn;
        }


        const onAbort = () => {
          callbacks.onAbort?.();
          destroyRunner();
        }

        runner.on("connect", onConnect);
        runner.on("content", onContent);
        runner.on("message", onMessage);
        runner.on("end", onEnd);
        runner.on("abort", onAbort);
      })
    }
  }
}
