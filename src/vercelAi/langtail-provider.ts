import { loadApiKey, withoutTrailingSlash } from '@ai-sdk/provider-utils';
import { LangtailChatLanguageModel } from './langtail-language-model';
import { userAgent } from '../userAgent';
import { LangtailPrompts } from '../LangtailPrompts';
import { LangtailChatSettings } from './langtail-chat-settings';
import { LangtailNode } from '../LangtailNode';

export interface LangtailProvider {
  (
    promptId: string,
    settings?: LangtailChatSettings,
  ): LangtailChatLanguageModel;

  chat(
    promptId: string,
    settings?: LangtailChatSettings,
  ): LangtailChatLanguageModel;
}

export interface AIBridgeSettings {
  openaiOrganization?: string;
  openaiProject?: string;
  headers?: Record<string, string>;
}

export interface LangtailProviderSettings extends AIBridgeSettings {
  baseURL?: string;
  apiKey?: string;
  langtailWorkspace?: string;
  langtailProject?: string;
}


export function createLangtail(
  options: LangtailProviderSettings = {},
): LangtailProvider {
  const baseURL =
    withoutTrailingSlash(options.baseURL) ??
    'https://api.langtail.com';

  const apiKey = loadApiKey({
    apiKey: options.apiKey,
    environmentVariableName: 'LANGTAIL_API_KEY',
    description: 'Langtail',
  })

  const langtailPrompts = new LangtailPrompts({
    apiKey,
    baseURL,
    workspace: options.langtailWorkspace,
    project: options.langtailProject,
  });

  return aiBridge(langtailPrompts, options);
}

export function aiBridge(
  langtail: LangtailPrompts | LangtailNode,
  options: AIBridgeSettings = {},
): LangtailProvider {

  let langtailPrompts: LangtailPrompts;
  if (langtail instanceof LangtailPrompts) {
    langtailPrompts = langtail;
  } else {
    langtailPrompts = langtail.prompts;
  }

  const createChatModel = (
    promptId: string,
    settings: LangtailChatSettings = {},
  ) => {
    const metadataHeaders = settings.metadata
      ? Object.entries(settings.metadata).reduce((acc, [key, value]) => {
        acc[`x-langtail-metadata-${key}`] = value
        return acc
      }, {})
      : {}
    const headers = {
      'X-API-Key': langtailPrompts.apiKey,
      'user-agent': userAgent,
      'content-type': 'application/json',
      'OpenAI-Organization': options.openaiOrganization,
      'OpenAI-Project': options.openaiProject,
      ...options.headers,
      'x-langtail-do-not-record': settings.doNotRecord ? 'true' : 'false',
      ...metadataHeaders,
    };
    return new LangtailChatLanguageModel(promptId, settings, {
      provider: 'langtail.chat',
      langtailPrompts,
      headers,
    });
  }

  const provider = function (
    promptId: string,
    settings?: LangtailChatSettings,
  ) {
    if (new.target) {
      throw new Error(
        'The Langtail model function cannot be called with the new keyword.',
      );
    }

    return createChatModel(promptId, settings);
  };

  provider.chat = createChatModel;

  return provider as LangtailProvider;
}

export const langtail = createLangtail();