import { ChatCompletionStream } from 'openai/lib/ChatCompletionStream';
import { AssistantStream } from 'openai/lib/AssistantStream';
import { Stream } from "openai/streaming"


export const chatStreamToRunner = (stream: ReadableStream<any>): ChatCompletionStream => {
  return ChatCompletionStream.fromReadableStream(stream);
}
export const assistantStreamToRunner = (stream: ReadableStream<any>): AssistantStream => {
  return AssistantStream.fromReadableStream(stream);
}

export const readableStreamFromSSEResponse = (reponse: Response, controller?: AbortController): ReadableStream<any> => {
  return Stream.fromSSEResponse(reponse, controller || new AbortController()).toReadableStream();
}

export type {
  ChatCompletionStream,
  AssistantStream,
  Stream
}
