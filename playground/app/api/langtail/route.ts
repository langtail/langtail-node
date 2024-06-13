import { lt } from "../../langtail";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Create a new assistant
export async function POST(request: NextRequest) {
  const messages = (await request.json()).messages;

  const result = await lt.prompts.invoke({
    prompt: "weather",
    messages,
    stream: true,
  });

  return new Response(result.toReadableStream());
}
