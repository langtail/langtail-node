// absolute import of custom types from langtail
// enabling user to override types with local definitions
import * as typesAbsolute from 'langtail/dist/customTypes';
// import local definitions as fallback
import * as typesDefault from './customTypes';

// if relative types are unresolved, types are any by default
// in a case type from absolute import is any, we the type import is unresolved and we use local definitions
// to do this we use a trick with '0 extends (1 & T)' to see if a type T is 'any'.
export type PromptSlug = 0 extends (1 & typesAbsolute.PromptSlug) ? typesDefault.PromptSlug : typesAbsolute.PromptSlug;
export type Environment<P extends PromptSlug> = 0 extends (1 & typesAbsolute.Environment<P>) ? typesDefault.Environment<P> : typesAbsolute.Environment<P>;
export type Version<P extends PromptSlug, E extends Environment<P> = undefined> = 0 extends (1 & typesAbsolute.Version<P, E>) ? E extends typesDefault.Environment<P> ? typesDefault.Version<P, E> : undefined : typesAbsolute.Version<P, E>;

export interface PromptOptions<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined> {
  prompt: P,
  environment?: E,
  version?: V
}

export type LangtailEnvironment = "preview" | "staging" | "production"