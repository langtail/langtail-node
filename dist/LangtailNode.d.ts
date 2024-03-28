import * as Core from 'openai/core';
import { APIPromise } from 'openai/core';
import { ChatCompletionChunk, ChatCompletion, ChatCompletionAssistantMessageParam, ChatCompletionCreateParamsNonStreaming, ChatCompletionCreateParamsBase, ChatCompletionCreateParams } from 'openai/resources/chat/completions';
import { Response } from 'undici';
import { Stream } from 'openai/streaming';
import { ChatCompletionCreateParamsStreaming } from 'openai/resources/index';
import { Stream as Stream$1 } from 'openai/src/streaming';

type Environment = "preview" | "staging" | "production" | {
    name: string;
    version: string;
};
type StreamResponseType = Stream<ChatCompletionChunk>;
type OpenAIResponseWithHttp = ChatCompletion & {
    httpResponse: Response;
};
type Options = {
    apiKey: string;
    baseURL?: string | undefined;
    organization?: string | undefined;
    project?: string | undefined;
};
interface IRequestParams extends ILangtailExtraProps {
    prompt: string;
    environment: Environment;
    variables?: Record<string, any>;
    messages?: ChatCompletionAssistantMessageParam[];
}
interface IRequestParamsStream extends IRequestParams {
    stream: boolean;
}
declare class LangtailCompletion {
    apiKey: string;
    baseUrl: string;
    options: Options;
    constructor(options: Options);
    createPromptPath(prompt: string, environment: Environment): string;
    request(options: IRequestParams): Promise<OpenAIResponseWithHttp>;
    request(options: IRequestParamsStream): Promise<StreamResponseType>;
}

declare const baseURL = "https://proxy.langtail.com/v1";
interface ILangtailExtraProps {
    doNotRecord?: boolean;
    metadata?: Record<string, any>;
}
declare class LangtailNode {
    completions: LangtailCompletion;
    chat: {
        completions: {
            create(body: ChatCompletionCreateParamsNonStreaming & ILangtailExtraProps, options?: Core.RequestOptions): APIPromise<ChatCompletion>;
            create(body: ChatCompletionCreateParamsStreaming & ILangtailExtraProps, options?: Core.RequestOptions): APIPromise<Stream$1<ChatCompletionChunk>>;
            create(body: ChatCompletionCreateParamsBase & ILangtailExtraProps, options?: Core.RequestOptions): APIPromise<Stream$1<ChatCompletionChunk> | ChatCompletion>;
            create(body: ChatCompletionCreateParams & ILangtailExtraProps, options?: Core.RequestOptions): APIPromise<ChatCompletion> | APIPromise<Stream$1<ChatCompletionChunk>>;
        };
    };
    private _open_ai;
    constructor(options?: {
        apiKey: string;
        baseURL?: string;
        doNotRecord?: boolean;
        organization?: string;
        project?: string;
    });
}

export { type ILangtailExtraProps, LangtailNode as Langtail, LangtailNode, baseURL };
