import * as Core from 'openai/core';
import { Fetch, APIPromise } from 'openai/core';
import * as openai_resources_chat_completions from 'openai/resources/chat/completions';
import { ChatCompletionChunk, ChatCompletion, ChatCompletionAssistantMessageParam, ChatCompletionCreateParamsNonStreaming, ChatCompletionCreateParamsBase, ChatCompletionCreateParams } from 'openai/resources/chat/completions';
import { Stream } from 'openai/streaming';
import { ChatCompletionCreateParamsStreaming } from 'openai/resources/index';
import { Stream as Stream$1 } from 'openai/src/streaming';
import { P as PlaygroundState } from './schemas-BCLbcYMU.js';
import { OpenAiBodyType } from './getOpenAIBody.js';
import 'openai';
import 'zod';

type Environment = "preview" | "staging" | "production";
type StreamResponseType = Stream<ChatCompletionChunk>;
type OpenAIResponseWithHttp = ChatCompletion & {
    httpResponse: Response | globalThis.Response;
};
type Options = {
    apiKey: string;
    baseURL?: string | undefined;
    workspace?: string | undefined;
    project?: string | undefined;
    fetch?: Fetch;
};
interface IRequestParams extends ILangtailExtraProps {
    prompt: string;
    environment?: Environment;
    version?: string;
    variables?: Record<string, any>;
    messages?: ChatCompletionAssistantMessageParam[];
}
interface IRequestParamsStream extends IRequestParams {
    stream: boolean;
}
declare class LangtailPrompts {
    apiKey: string;
    baseUrl: string;
    options: Options;
    constructor(options: Options);
    _createPromptPath({ prompt, environment, version, configGet, }: {
        prompt: string;
        environment: Environment;
        version?: string;
        configGet?: boolean;
    }): string;
    invoke(options: IRequestParams): Promise<OpenAIResponseWithHttp>;
    invoke(options: IRequestParamsStream): Promise<StreamResponseType>;
    get({ prompt, environment, version, }: {
        prompt: string;
        environment: Environment;
        version?: string;
    }): Promise<PlaygroundState>;
    build(completionConfig: PlaygroundState, parsedBody: OpenAiBodyType): openai_resources_chat_completions.ChatCompletionCreateParams;
}

declare const baseURL = "https://proxy.langtail.com/v1";
interface ILangtailExtraProps {
    doNotRecord?: boolean;
    metadata?: Record<string, any>;
}
declare class LangtailNode {
    prompts: LangtailPrompts;
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
        fetch?: Core.Fetch;
    });
}

export { type ILangtailExtraProps, LangtailNode as Langtail, LangtailNode, LangtailPrompts, baseURL };
