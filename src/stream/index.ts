import { ChatCompletionStream } from 'openai/lib/ChatCompletionStream';
import { AssistantStream } from 'openai/lib/AssistantStream';


export const chatStreamToRunner = (stream: ReadableStream<any>): ChatCompletionStream => {
  return ChatCompletionStream.fromReadableStream(stream);
}
export const assistantStreamToRunner = (stream: ReadableStream<any>): AssistantStream => {
  return AssistantStream.fromReadableStream(stream);
}

export type {
  ChatCompletionStream,
  AssistantStream
}
