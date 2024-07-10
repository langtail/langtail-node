import { loadApiKey, withoutTrailingSlash } from '@ai-sdk/provider-utils';
import { LangtailChatLanguageModel } from './langtail-language-model';
import { userAgent } from '../userAgent';
import { LangtailChatSettings } from './langtail-chat-settings';
import { Langtail } from '../Langtail';
import { LangtailPrompts } from '../LangtailPrompts';
import { Environment, IsProductionDefined, LangtailEnvironment, PromptSlug, Version } from '../types';

export { LangtailChatLanguageModel };

export interface AIBridgeSettings {
  openaiOrganization?: string;
  openaiProject?: string;
  headers?: Record<string, string>;
}

export interface LangtailProviderSettings extends AIBridgeSettings {
  baseURL?: string;
  apiKey?: string;
}

interface LangtailProviderFunction {
  <P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined>(promptId: P, settings: LangtailChatSettings<P, E, V>): LangtailChatLanguageModel<P, E, V>;
  <P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined>(promptId: P): IsProductionDefined<P> extends true ? LangtailChatLanguageModel<P, E, V> : never;
  chat: {
    <P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined>(promptId: P, settings: LangtailChatSettings<P, E, V>): LangtailChatLanguageModel<P, E, V>;
    <P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined>(promptId: P): IsProductionDefined<P> extends true ? LangtailChatLanguageModel<P, E, V> : never;
  };
}

export function createLangtail(
  options: LangtailProviderSettings = {},
): LangtailProviderFunction {
  const baseURL =
    withoutTrailingSlash(options.baseURL) ??
    'https://api.langtail.com';

  const langtailPrompts = new LangtailPrompts({
    apiKey: options.apiKey ?? "",  // loaded later from environment
    baseURL,
  });

  return aiBridge(langtailPrompts, options);
}

export function aiBridge(
  langtail: LangtailPrompts | Langtail,
  options: AIBridgeSettings = {},
): LangtailProviderFunction {

  let langtailPrompts: LangtailPrompts;
  if (langtail instanceof LangtailPrompts) {
    langtailPrompts = langtail;
  } else {
    langtailPrompts = langtail.prompts;
  }

  const createChatModel = <P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined>(
    promptId: P,
    settings: LangtailChatSettings<P, E, V> = {},
  ) => {
    if (!langtailPrompts.apiKey) {
      langtailPrompts.apiKey = loadApiKey({
        apiKey: undefined,
        environmentVariableName: 'LANGTAIL_API_KEY',
        description: 'Langtail',
      })
    }
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

  const provider = function <P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined>(
    promptId: P,
    settings?: LangtailChatSettings<P, E, V>,
  ) {
    if (new.target) {
      throw new Error(
        'The Langtail model function cannot be called with the new keyword.',
      );
    }

    return createChatModel(promptId, settings);
  };

  provider.chat = createChatModel;

  return provider;
}

export const langtail: LangtailProviderFunction = createLangtail();