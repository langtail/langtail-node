import "dotenv-flow/config"
import { describe, expect, it } from "vitest"

import { LangtailAssistants } from "./LangtailAssistants"
import { Environment } from './types';

import { ILangtailPrompts, IRequestParamsStream, Options } from "./LangtailPrompts"
import { PromptSlug, Version } from "./customTypes"

class MockLangtailPrompts implements ILangtailPrompts {
  baseUrl: string = 'https://mock-base-url.com';
  apiKey: string = 'mock-api-key';
  options: Options = {
    apiKey: this.apiKey,
    baseURL: this.baseUrl
  };
  createPromptPath = vi.fn();
  getPromptPath = vi.fn();
  listDeployments = vi.fn();
  get = vi.fn();
  build = vi.fn();
  getPromptSlug = vi.fn();
  invoke = vi.fn().mockImplementation(async <P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined, S extends boolean = false>(assistantName: P, props: Omit<IRequestParamsStream<P, E, V, S>, "prompt">): Promise<S extends true ? ResponseType : any> => {
    return {} as any;
  });
}

describe("LangtailAssistants", () => {
  const createLt = () => {
    const promptsMock = new MockLangtailPrompts()
    return {
      lt: new LangtailAssistants(promptsMock),
      promptsMock
    }
  }

  describe("public API", () => {
    it("should translate assistant to prompt option in langtailPrompts.invoke call", async () => {
      const { lt, promptsMock } = createLt();
      const assistant = "test-assistant";

      await lt.invoke({ assistant });

      expect(promptsMock.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: assistant,
        }), {}
      );
    });

    it("should pass environment from options to langtailPrompts.invoke call", async () => {
      const { lt, promptsMock } = createLt();
      const assistant = "test-assistant";
      const environment = "production";

      await lt.invoke({ assistant, environment });

      expect(promptsMock.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          environment,
        }), {}
      );
    });

    it("should pass variables from options to langtailPrompts.invoke call", async () => {
      const { lt, promptsMock } = createLt();
      const assistant = "test-assistant";
      const variables = { key: "value" };

      await lt.invoke({ assistant, variables });

      expect(promptsMock.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          variables,
        }), {}
      );
    });

    it("should pass messages from options to langtailPrompts.invoke call", async () => {
      const { lt, promptsMock } = createLt();
      const assistant = "test-assistant";
      const messages = [
        { role: "system" as const, content: "You are a helpful assistant." },
        { role: "user" as const, content: "Hello, how are you?" }
      ];

      await lt.invoke({
        assistant,
        messages,
      });

      expect(promptsMock.invoke).toHaveBeenCalledWith({
        prompt: assistant,
        messages,
      }, {});
    });

    it("should return the same result as langtailPrompts.invoke", async () => {
      const { lt, promptsMock } = createLt();
      const assistant = "test-assistant";
      const mockResponse = { content: "Mock response" };
      promptsMock.invoke.mockResolvedValue(mockResponse);

      const result = await lt.invoke({ assistant });

      expect(result).toBe(mockResponse);
    });
  })

  it("should not pass assistant: true to langtailPrompts.invoke call", async () => {
    const { lt, promptsMock } = createLt();
    const assistant = "test-assistant";

    await lt.invoke({ assistant });

    expect(promptsMock.invoke).toHaveBeenCalledWith(
      expect.not.objectContaining({
        assistant: true,
      }), {}
    );
    expect(promptsMock.invoke.mock.calls[0][0]).not.toHaveProperty('assistant');
  });

  it("should pass optionalCallbacks to langtailPrompts.invoke call", async () => {
    const { lt, promptsMock } = createLt();
    const assistant = "test-assistant";
    const optionalCallbacks = {
      onRawResponse: vi.fn(),
      onThreadId: vi.fn(),
    };

    await lt.invoke({ assistant }, optionalCallbacks);

    expect(promptsMock.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: assistant,
      }),
      optionalCallbacks
    );
  });
})
