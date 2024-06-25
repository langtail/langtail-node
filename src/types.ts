// absolute import of custom types from langtail
// enabling user to override types with local definitions
import * as typesAbsolute from 'langtail/dist/customTypes';
// import local definitions as fallback
import * as typesDefault from './customTypes';

// if absolute types are unresolved, types are any by default
// therefore in a case where type from absolute import is any, we assume the type import is unresolved and we use local definitions
// to do this we use a trick with '0 extends (1 & T)' to see if a type T is 'any'.
export type PromptSlug = 0 extends (1 & typesAbsolute.PromptSlug) ? typesDefault.PromptSlug : typesAbsolute.PromptSlug;
export type Environment<P extends PromptSlug> = 0 extends (1 & typesAbsolute.Environment<P>) ? typesDefault.Environment<P> : typesAbsolute.Environment<P>;
export type Version<P extends PromptSlug, E extends Environment<P>> = 0 extends (1 & typesAbsolute.Version<P, E>) ? E extends typesDefault.Environment<P> ? typesDefault.Version<P, E> : undefined : typesAbsolute.Version<P, E>;
export type Variables<P extends PromptSlug, E extends Environment<P>, V extends Version<P, E>> = 0 extends (1 & typesAbsolute.Variables<P, E, V>) ? typesDefault.Variables<P, E, V> : typesAbsolute.Variables<P, E, V>;

export type LangtailEnvironment = "preview" | "staging" | "production"

export type IsProductionDefined<P extends PromptSlug> = 'production' extends Environment<P> ? true : false;

type PromptOptionsBase<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined> = IsProductionDefined<P> extends true ? {
  environment?: E,
  version?: V
} : (E extends undefined ? {
  environment: E & LangtailEnvironment,
  version?: V
} : {
  environment: E,
  version?: V
});

export type PromptOptions<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined> = PromptOptionsBase<P, E, V> & { prompt: P };
