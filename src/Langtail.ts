import { Fetch } from "openai/core"
import { ILangtailAssistants, LangtailAssistants } from "./LangtailAssistants"
import { LangtailPrompts } from "./LangtailPrompts"
import { ILangtailThreads, LangtailThreads } from "./LangtailThreads"
import { LangtailThreadsOptions } from "./types"

export class ErrorResponse extends Error {
  statusCode: number
  extra_data?: Record<string, any>
  constructor(
    message: string,
    statusCode = 400,
    extra_data?: Record<string, any>,
  ) {
    super(message)
    this.statusCode = statusCode
    this.extra_data = extra_data
  }
}

export const createFetcher = (baseUrl: string, apiKey: string) => {
  return {
    fetch: async (url: string, options?: RequestInit) => {
      const response = await fetch(`${baseUrl}${url}`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        ...options,
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new ErrorResponse(
          errorBody.error?.message || response.statusText,
          response.status,
          {
            statusText: response.statusText,
            body: errorBody,
          }
        );
      }

      return response;
    },
  }
}

export class Langtail {
  prompts: LangtailPrompts
  threads: ILangtailThreads
  assistants: ILangtailAssistants

  constructor(clientOptions?: {
    apiKey: string
    organization?: string
    project?: string
    baseURL?: string
    fetch?: Fetch
  }) {
    const apiKey = clientOptions?.apiKey || process.env.LANGTAIL_API_KEY
    if (!apiKey) {
      throw new Error(
        "apiKey is required. You can pass it as an option or set the LANGTAIL_API_KEY environment variable.",
      )
    }

    const baseURL = clientOptions?.baseURL ?? "https://api.langtail.com"
    const threadsAPIVersion: LangtailThreadsOptions["apiVersion"] = '/v2/'

    this.prompts = new LangtailPrompts({
      apiKey,
      baseURL,
      workspace: clientOptions?.organization,
      project: clientOptions?.project,
      fetch: clientOptions?.fetch,
    })

    this.assistants = new LangtailAssistants(this.prompts)

    this.threads = new LangtailThreads(createFetcher(baseURL, apiKey), {
      apiVersion: threadsAPIVersion,
    })

    return this
  }
}

export { LangtailPrompts, LangtailThreads, LangtailAssistants }
