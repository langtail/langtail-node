import { ILangtailExtraProps } from '../LangtailNode';
import { PromptSlug, Environment, Version, IsProductionDefined, LangtailEnvironment } from '../types';
import { OpenAiBodyType } from '../getOpenAIBody';


type LangtailChatSettingsBase<P extends PromptSlug, E extends Environment<P> & LangtailEnvironment, V extends Version<P, E>> = IsProductionDefined<P> extends true ? {
  environment?: E,
  version?: V
} : {
  environment: E,
  version?: V
};

export type LangtailChatSettings<P extends PromptSlug, E extends Environment<P> & LangtailEnvironment, V extends Version<P, E>> = LangtailChatSettingsBase<P, E, V> & ILangtailExtraProps & OpenAiBodyType & {
  variables?: Record<string, any>
}