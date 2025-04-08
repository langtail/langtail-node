import 'dotenv-flow/config'
import { generateText } from 'ai';
import { langtail } from '../src/vercel-ai';
import fs from 'fs/promises';


async function main() {
  const content = await fs.readFile('./playground/text.txt', 'utf-8');

  const { text } = await generateText({
    model: langtail('vtip'),
    messages: [
      {
        role: 'user',
        content,
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral" } }
        }
      },
    ],
  });


}

main();

