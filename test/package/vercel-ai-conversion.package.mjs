import assert from "node:assert/strict"
import test from "node:test"
import { generateText } from "ai"
import nock from "nock"
import { createLangtail } from "../../vercel-ai/index.mjs"

const BASE_URL = "https://esm-package-test.langtail.invalid"
const BREAKPOINT = { mode: "explicit" }

test("ESM preserves assistant and tool prompt cache breakpoints", async () => {
  const model = createLangtail({
    apiKey: "test-api-key",
    baseURL: BASE_URL,
  })("test-prompt")

  const scope = nock(BASE_URL)
    .post(/\/project-prompt\/test-prompt\/production\/?$/, (body) => {
      assert.deepEqual(body.messages, [
        { role: "user", content: "Check Prague" },
        {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "I will check the weather and time.",
              prompt_cache_breakpoint: BREAKPOINT,
            },
          ],
          tool_calls: [
            {
              id: "call-weather",
              type: "function",
              function: {
                name: "weather",
                arguments: '{"city":"Prague"}',
              },
            },
            {
              id: "call-time",
              type: "function",
              function: {
                name: "time",
                arguments: '{"city":"Prague"}',
              },
            },
          ],
        },
        {
          role: "tool",
          tool_call_id: "call-weather",
          content: '{"temperature":25}',
        },
        {
          role: "tool",
          tool_call_id: "call-time",
          content: [
            {
              type: "text",
              text: '{"time":"21:15"}',
              prompt_cache_breakpoint: BREAKPOINT,
            },
          ],
        },
      ])
      return true
    })
    .reply(200, {
      id: "chatcmpl-esm",
      choices: [
        {
          message: { role: "assistant", content: "Done" },
          finish_reason: "stop",
          index: 0,
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 1 },
    })

  try {
    await generateText({
      model,
      messages: [
        { role: "user", content: "Check Prague" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "I will check the weather and time." },
            {
              type: "tool-call",
              toolCallId: "call-weather",
              toolName: "weather",
              args: { city: "Prague" },
            },
            {
              type: "tool-call",
              toolCallId: "call-time",
              toolName: "time",
              args: { city: "Prague" },
            },
          ],
          providerOptions: { openai: { promptCacheBreakpoint: BREAKPOINT } },
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call-weather",
              toolName: "weather",
              result: { temperature: 25 },
            },
            {
              type: "tool-result",
              toolCallId: "call-time",
              toolName: "time",
              result: { time: "21:15" },
            },
          ],
          providerOptions: { openai: { promptCacheBreakpoint: BREAKPOINT } },
        },
      ],
    })

    scope.done()
  } finally {
    nock.cleanAll()
  }
})
