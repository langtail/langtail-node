import 'dotenv-flow/config'
import { generateText, tool, streamText } from 'ai';
import { langtail } from '../src/vercel-ai';
import fs from 'fs/promises';
import { z } from 'zod';


async function main() {
  const content = await fs.readFile('./playground/text.txt', 'utf-8');

  const { text, reasoning } = await generateText({
    model: langtail('vtip'),
    messages: [
      {
        role: 'user',
        content: "What is the weather in Tokyo?",
      },
    ],
    tools: {
      weather: tool({
        description: 'Get the weather in a location',
        parameters: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => {
          return {
            location,
            temperature: 12,
          }
        },
      }),
    },
  });

  const { text: text2, reasoning: reasoning2 } = await generateText({
    model: langtail('vtip'),
    providerOptions: {
      anthropic: {
        thinking: {
          budgetTokens: 1025,
          type: "enabled",
        }
      }
    },
    messages: [
      {
        role: 'user',
        content: "What is the weather in Tokyo?",
      },
      {
        role: 'assistant',
        content: text,
      },
      {
        role: 'user',
        content: "What is the weather in Prague?",
      },
    ],
    tools: {
      weather: tool({
        description: 'Get the weather in a location',
        parameters: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => {
          return {
            location,
            temperature: 12,
          }
        },
      }),
    },
  });

  console.log(text);
  console.log(reasoning);

  console.log('--------------------------------');

  console.log(text2);
  console.log(reasoning2);

}

main();

