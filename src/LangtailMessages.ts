
import { assistantMessageListResponseSchema, assistantMessageSchema, deleteEntitySchema } from "./schemas"
import { IFetcher, LangtailThreadsOptions, PaginationOptions, PublicAPI } from './types';
import { paginationParamsToQuery } from "./bin/utils";


export type ILangtailMessages = PublicAPI<LangtailMessages>

export class LangtailMessages {
  fetcher: IFetcher
  apiVersion: NonNullable<LangtailThreadsOptions["apiVersion"]> = '/v2/'


  constructor(fetcher: IFetcher, options: LangtailThreadsOptions = {}) {
    this.fetcher = fetcher
    if (options.apiVersion) {
      this.apiVersion = options.apiVersion
    }
  }

  list(threadId: string, paginationOptions: PaginationOptions = {}) {
    return this.fetcher.fetch(`${this.apiVersion}threads/${threadId}/messages${paginationParamsToQuery(paginationOptions)}`).then(res => res.json()).then(assistantMessageListResponseSchema.parse)
  }

  retrieve(threadId: string, messageId: string) {
    return this.fetcher.fetch(`${this.apiVersion}threads/${threadId}/messages/${messageId}`).then(res => res.json()).then(assistantMessageSchema.parse)
  }

  del(threadId: string, messageId: string) {
    return this.fetcher.fetch(`${this.apiVersion}threads/${threadId}/messages/${messageId}`, { method: 'DELETE' }).then(res => res.json()).then(deleteEntitySchema.parse)
  }

  update(threadId: string, messageId: string, metadata: Record<string, any>) {
    return this.fetcher.fetch(`${this.apiVersion}threads/${threadId}/messages/${messageId}`, {
      method: 'POST',
      body: JSON.stringify({ metadata })
    }).then(res => res.json()).then(assistantMessageSchema.parse)
  }
}
