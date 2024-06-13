import { NextRequest } from "next/server";

// Create a new assistant
export async function GET(request: NextRequest) {
  const url = new URL(request.url ?? "");

  const result = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${url.searchParams.get("location")}&units=metric&appid=${process.env.OPEN_WEATHER_API_KEY}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    },
  ).then((res) => res.json());

  return Response.json(result);
}
