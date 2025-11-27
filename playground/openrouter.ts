import "dotenv-flow/config"
import { stepCountIs, streamText, tool } from "ai"
import { z } from "zod/v4"

import { openrouter } from "@openrouter/ai-sdk-provider"

async function main() {
  const result = streamText({
    model: openrouter("google/gemini-3-pro-preview"),
    messages: [
      {
        role: "user",
        content: "What is the weather in Tokyo?",
      },
    ],
    stopWhen: stepCountIs(5),
    onStepFinish: (step) => {
      console.log(step.content)
    },
    tools: {
      weather: tool({
        description: "Get the weather in a location",
        inputSchema: z.object({
          location: z.string().describe("The location to get the weather for"),
        }),
        execute: async ({ location }) => {
          return {
            location,
            temperature: 12,
          }
        },
      }),
    },
  })

  for await (const chunk of result.fullStream) {
    console.log("chunk", chunk)
  }
}

main()
