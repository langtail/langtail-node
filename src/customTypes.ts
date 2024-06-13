type LangtailEnvironment = "preview" | "staging" | "production";

export type PromptSlug = string;
export type Environment<P extends PromptSlug> = LangtailEnvironment | undefined
export type Version<P extends PromptSlug, E extends Environment<P>> = string | undefined;

export interface PromptOptions<P extends PromptSlug, E extends Environment<P> = "production", V extends Version<P, E> = undefined> {
  prompt: P,
  environment?: E,
  version?: V
}
