import { PromptSlug, Environment, Version, IsProductionDefined, LangtailEnvironment, Variables } from '../types';
import { OpenAiBodyType, ILangtailExtraProps } from '../schemas';


type LangtailChatSettingsBase<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined> = IsProductionDefined<P> extends true ? {
  environment?: E,
  version?: V
} : (E extends undefined ? {
  environment: E & LangtailEnvironment,
  version?: V
} : {
  environment: E,
  version?: V
});

export type LangtailChatSettings<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined> = LangtailChatSettingsBase<P, E, V> & ILangtailExtraProps & OpenAiBodyType & {
  variables?: Variables<P, E, V>
  structuredOutputs?: boolean
}