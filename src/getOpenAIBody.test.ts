import { describe, expect, it } from "vitest"

import { getOpenAIBody } from "./getOpenAIBody"

describe("getOpenAIBody", () => {
  const parsedBody = {
    variables: {},
    messages: [],
  }

  it("should return the expected openAIbody", () => {
    const expectedOpenAIbody = {
      model: "gpt-3.5-turbo",
      max_tokens: 100,
      temperature: 0.8,
      messages: [],
      top_p: 1,
      presence_penalty: 0,
      frequency_penalty: 0,
    }

    const openAIbody = getOpenAIBody(
      {
        state: {
          type: "chat",
          args: {
            model: "gpt-3.5-turbo",
            max_tokens: 100,
            temperature: 0.8,
            top_p: 1,
            presence_penalty: 0,
            frequency_penalty: 0,
            jsonmode: false,
            seed: null,
            stop: [],
          },
          template: [],
        },
        chatInput: {},
      },
      parsedBody,
    )

    expect(openAIbody).toEqual(expectedOpenAIbody)
  })

  it("should extend variables from playground", () => {
    const completionConfig = {
      state: {
        type: "chat" as const,
        args: {
          model: "gpt-3.5-turbo",
          max_tokens: 100,
          temperature: 0.8,
          top_p: 1,
          presence_penalty: 0,
          frequency_penalty: 0,
          jsonmode: false,
          seed: null,
          stop: [],
        },
        template: [
          {
            role: "user" as const,
            content: "{{key}} {{willGetOverwritten}}",
          },
        ],
      },
      chatInput: {
        willGetOverwritten: "original",
      },
    }
    const openAIbody = getOpenAIBody(completionConfig, {
      variables: {},
      messages: [],
    })

    expect(openAIbody).toMatchInlineSnapshot(`
      {
        "frequency_penalty": 0,
        "max_tokens": 100,
        "messages": [
          {
            "content": " original",
            "role": "user",
          },
        ],
        "model": "gpt-3.5-turbo",
        "presence_penalty": 0,
        "reasoning_effort": undefined,
        "temperature": 0.8,
        "top_p": 1,
      }
    `)

    const openAIbody2 = getOpenAIBody(completionConfig, {
      variables: {
        willGetOverwritten: "overwritten",
        key: "value",
      },
    })

    expect(openAIbody2).toMatchInlineSnapshot(`
      {
        "frequency_penalty": 0,
        "max_tokens": 100,
        "messages": [
          {
            "content": "value overwritten",
            "role": "user",
          },
        ],
        "model": "gpt-3.5-turbo",
        "presence_penalty": 0,
        "reasoning_effort": undefined,
        "temperature": 0.8,
        "top_p": 1,
      }
    `)
  })


  it("should add parallel_tool_calls param when it is set in parsedBody", () => {
    const completionConfig = {
      state: {
        type: "chat" as const,
        args: {
          model: "gpt-3.5-turbo",
          max_tokens: 100,
          temperature: 0.8,
          top_p: 1,
          presence_penalty: 0,
          frequency_penalty: 0,
          jsonmode: false,
          seed: 123,
          stop: [],
        },
        template: [
          {
            role: "system" as const,
            content: "tell me a story",
          },
        ],
      },
      chatInput: {},
    }

    const openAIbody = getOpenAIBody(completionConfig, {
      parallelToolCalls: true,
    })

    expect(openAIbody).toHaveProperty('parallel_tool_calls', true)
  })

  it("should override parameters from the playground with the ones in parsedBody", () => {
    const completionConfig = {
      state: {
        type: "chat" as const,
        args: {
          model: "gpt-3.5-turbo",
          max_tokens: 100,
          temperature: 0.8,
          top_p: 1,
          presence_penalty: 0,
          frequency_penalty: 0,
          jsonmode: false,
          seed: 123,
          stop: [],
        },
        template: [
          {
            role: "system" as const,
            content: "tell me a story",
          },
        ],
      },
      chatInput: {},
    }

    const openAIbody = getOpenAIBody(completionConfig, {
      variables: {},
      messages: [],
      max_tokens: 200,
      model: "gpt-4-turbo",
      frequency_penalty: 0.5,
      presence_penalty: 0.5,
      temperature: 0.5,
      top_p: 0.5,
      seed: 123,
      stop: ["stop1", "stop2"],
      tool_choice: {
        type: "function",
        function: {
          name: "functionName",
        },
      },
      response_format: {
        type: "json_object",
      },
      tools: [
        {
          type: "function",
          function: {
            name: "functionName",
            description: "functionDescription",
            parameters: {},
          },
        },
      ],
    })

    expect(openAIbody).toMatchInlineSnapshot(`
      {
        "frequency_penalty": 0.5,
        "max_tokens": 200,
        "messages": [
          {
            "content": "tell me a story",
            "role": "system",
          },
          {
            "content": "format: JSON",
            "role": "system",
          },
        ],
        "model": "gpt-4-turbo",
        "presence_penalty": 0.5,
        "reasoning_effort": undefined,
        "response_format": {
          "type": "json_object",
        },
        "seed": 123,
        "stop": [
          "stop1",
          "stop2",
        ],
        "temperature": 0.5,
        "tool_choice": {
          "function": {
            "name": "functionName",
          },
          "type": "function",
        },
        "tools": [
          {
            "function": {
              "description": "functionDescription",
              "name": "functionName",
              "parameters": {},
            },
            "type": "function",
          },
        ],
        "top_p": 0.5,
      }
    `) // format: JSON is added to messages because response_format is set to json_object

    const openAIbodyTemplated = getOpenAIBody(completionConfig, {
      template: [
        {
          role: "system",
          content: "tell me a joke",
        },
      ],
    })

    expect(openAIbodyTemplated).toMatchInlineSnapshot(`
      {
        "frequency_penalty": 0,
        "max_tokens": 100,
        "messages": [
          {
            "content": "tell me a joke",
            "role": "system",
          },
        ],
        "model": "gpt-3.5-turbo",
        "presence_penalty": 0,
        "reasoning_effort": undefined,
        "seed": 123,
        "temperature": 0.8,
        "top_p": 1,
      }
    `) // template is overridden by the one in parsedBody
  })


  describe('thread messages', () => {
    it('should compile thread messages with passed variables', () => {
      const completionConfig = {
        state: {
          type: "chat" as const,
          args: {
            model: "gpt-3.5-turbo",
            max_tokens: 100,
            temperature: 0.8,
            top_p: 1,
            presence_penalty: 0,
            frequency_penalty: 0,
            jsonmode: false,
            seed: null,
            stop: [],
          },
          template: [
            {
              role: "user" as const,
              content: "TEAMPLTE: This use previous user message.",
            },
          ]
        },
        chatInput: {},
      }

      const openAIbody = getOpenAIBody(completionConfig, {
        variables: {
          footballClub: "Slavia Praha",
        },
        messages: [],
      }, {
        threadMessages: [
          {
            role: "system" as const,
            content: "THREAD: Your favourite football club is {{ footballClub }}",
          },
        ]
      })

      expect(openAIbody).toMatchInlineSnapshot(`
        {
          "frequency_penalty": 0,
          "max_tokens": 100,
          "messages": [
            {
              "content": "TEAMPLTE: This use previous user message.",
              "role": "user",
            },
            {
              "content": "THREAD: Your favourite football club is {{ footballClub }}",
              "role": "system",
            },
          ],
          "model": "gpt-3.5-turbo",
          "presence_penalty": 0,
          "reasoning_effort": undefined,
          "temperature": 0.8,
          "top_p": 1,
        }
      `)
    })

    it('should combine template messages with other messages', () => {
      const completionConfig = {
        state: {
          type: "chat" as const,
          args: {
            model: "gpt-3.5-turbo",
            max_tokens: 100,
            temperature: 0.8,
            top_p: 1,
            presence_penalty: 0,
            frequency_penalty: 0,
            jsonmode: false,
            seed: null,
            stop: [],
          },
          template: [
            {
              role: "system" as const,
              content: "TEMPLATE MESSAGE: This use previous user message. With variable {{ footballClub }}",
            },
          ]
        },
        chatInput: {
          footballClub: "Sparta Praha",
        },
      }

      const openAIbody = getOpenAIBody(completionConfig, {
        variables: {},
        messages: [],
      }, {
        threadMessages: [
          {
            role: "user" as const,
            content: "THREAD message: Your favourite football club is NOT SPARTA",
          },
        ]
      })

      expect(openAIbody).toMatchInlineSnapshot(`
        {
          "frequency_penalty": 0,
          "max_tokens": 100,
          "messages": [
            {
              "content": "TEMPLATE MESSAGE: This use previous user message. With variable Sparta Praha",
              "role": "system",
            },
            {
              "content": "THREAD message: Your favourite football club is NOT SPARTA",
              "role": "user",
            },
          ],
          "model": "gpt-3.5-turbo",
          "presence_penalty": 0,
          "reasoning_effort": undefined,
          "temperature": 0.8,
          "top_p": 1,
        }
      `)
    })

    it('should NOT compile thread messages with variables', () => {
      const completionConfig = {
        state: {
          type: "chat" as const,
          args: {
            model: "gpt-3.5-turbo",
            max_tokens: 100,
            temperature: 0.8,
            top_p: 1,
            presence_penalty: 0,
            frequency_penalty: 0,
            jsonmode: false,
            seed: null,
            stop: [],
          },
          template: []
        },
        chatInput: {
          footballClub: "Sparta Praha",
        },
      }

      const openAIbody = getOpenAIBody(completionConfig, {
        variables: {},
        messages: [],
      }, {
        threadMessages: [
          {
            role: "user" as const,
            content: "THREAD message: Your favourite football club is {{ footballClub }}",
          },
        ]
      })

      expect(openAIbody).toMatchInlineSnapshot(`
        {
          "frequency_penalty": 0,
          "max_tokens": 100,
          "messages": [
            {
              "content": "THREAD message: Your favourite football club is {{ footballClub }}",
              "role": "user",
            },
          ],
          "model": "gpt-3.5-turbo",
          "presence_penalty": 0,
          "reasoning_effort": undefined,
          "temperature": 0.8,
          "top_p": 1,
        }
      `)
    })
  })
})
