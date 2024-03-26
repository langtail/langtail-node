import { ChatCompletion, ChatCompletionAssistantMessageParam } from "openai/resources/chat/completions"
import { Response, fetch } from "undici"
import { z } from "zod"
import { openAIStreamingResponseSchema } from "./dataSchema"
import { Stream } from "openai/streaming"

export type Environment =
  | "preview"
  | "staging"
  | "production"
  | {
    name: string
    version: string
  }

interface LangtailPromptVariables { } // TODO use this when generating schema for deployed prompts

type StreamResponseType = Stream<z.infer<typeof openAIStreamingResponseSchema>>


type OpenAIResponseWithHttp = ChatCompletion & {
  httpResponse: Response
}

type Options = {
  apiKey: string
  baseURL?: string | undefined
  organization?: string | undefined
  project?: string | undefined
}

export class LangtailCompletion {
  apiKey: string
  baseUrl: string
  options: Options

  constructor(options: Options) {
    const { apiKey, baseURL: baseUrl } = options
    this.apiKey = apiKey
    this.baseUrl = baseUrl ?? "https://api.langtail.com"
    this.options = options
  }

  createPromptPath(prompt: string, environment: Environment) {
    const envPath = typeof environment === "string" ? environment : `${environment.name}/${environment.version}`
    if (this.options.organization && this.options.project) {
      return `${this.options.organization}/${this.options.project}/${prompt}/${envPath}`
    }
    if (this.options.project) {
      return `${this.options.project}/${prompt}/${envPath}`
    }
    const urlPath = `${prompt}/${envPath}`
    return urlPath.startsWith("/") ? this.baseUrl + urlPath : `${this.baseUrl}/${urlPath}`
  }

  request(options: {
    prompt: string
    environment: Environment
    variables?: Record<string, any>
    doNotRecord?: boolean
    messages?: ChatCompletionAssistantMessageParam[]
  }): Promise<OpenAIResponseWithHttp>
  request(options: {
    prompt: string
    environment: Environment
    variables?: Record<string, any>
    doNotRecord?: boolean
    stream?: boolean
    messages?: ChatCompletionAssistantMessageParam[]
  }): Promise<StreamResponseType>
  async request({ prompt, environment, ...rest }) {
    const options = {
      method: "POST",
      headers: { "X-API-Key": this.apiKey, "content-type": "application/json" },
      body: JSON.stringify({ stream: false, ...rest }),
    }
    const promptPath = this.createPromptPath(prompt, environment)

    const res = await fetch(promptPath, options)

    if (!res.ok) {
      throw new Error(
        `Failed to fetch prompt: ${res.status} ${await res.text()}`,
      )
    }

    if (rest.stream) {
      if (!res.body) {
        throw new Error("No body in response")
      }
      // @ts-expect-error
      return Stream.fromSSEResponse(res, new AbortController())
    }

    const result = (await res.json()) as OpenAIResponseWithHttp
    result.httpResponse = res
    return result
  }
}
