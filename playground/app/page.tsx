"use client";

import React, { useState } from "react";
import styles from "./page.module.css";
import Chat, { ChatMessage } from "./components/chat";
import WeatherWidget, {
  SkyCondition,
  WeatherData,
} from "./components/weather-widget";
import zod from "zod";
import { ChatCompletionAssistantMessageParam } from "openai/resources";

const WeatherSchema = zod.object({
  main: zod.object({
    temp: zod.number(),
  }),
  weather: zod.array(zod.object({ main: zod.string() })),
});

type WeatherType = zod.infer<typeof WeatherSchema>;

function normalizeYrWeatherData<T>(
  data,
  cb: (weather: WeatherType) => T,
): T | undefined {
  try {
    const weather = WeatherSchema.parse(data);
    return cb(weather);
  } catch (error) {
    console.warn("Couldn't parse weather data", error);
  }
}

function decodeSkyState(maybeSkyState: string): SkyCondition | null {
  const loweredCase = maybeSkyState.toLocaleLowerCase();
  if (loweredCase.includes("cloud")) {
    return "Cloudy";
  }

  if (loweredCase.includes("rain")) {
    return "Rainy";
  }

  if (loweredCase.includes("snow")) {
    return "Snowy";
  }

  if (loweredCase.includes("wind")) {
    return "Windy";
  }

  if (loweredCase.includes("fair")) {
    return "Sunny";
  }

  if (loweredCase.includes("sun")) {
    return "Sunny";
  }

  return null;
}

const FunctionCalling = () => {
  const [weatherData, setWeatherData] = useState<WeatherData[]>([
    {
      location: "---",
      temperature: "---",
      conditions: "Sunny",
      unit: "C",
    },
  ]);

  const functionCallHandler = async (
    message: ChatCompletionAssistantMessageParam,
  ) => {
    const weatherToolCalls =
      message.tool_calls?.filter(
        (toolCall) => toolCall.function.name === "get_weather",
      ) ?? [];

    if ((weatherToolCalls?.length ?? 0) === 0) {
      return;
    }

    return Promise.all(
      weatherToolCalls.map((toolCall) => {
        const location = JSON.parse(toolCall.function.arguments ?? "");

        return fetch(
          `/api/langtail/weather?${new URLSearchParams({
            location: location.location,
          })}`,
          {
            method: "GET",
          },
        )
          .then((res) => res.json())
          .then((weatherData) => ({ toolCall, weatherData, location }));
      }),
    ).then((weathers) => {
      const weatherMessages = weathers.map(
        ({ toolCall, weatherData, location }) => {
          let temperature: number | null = null;
          const unit: string | null = "C";
          let conditions: SkyCondition | null = null;

          const weatherAiMessage = {
            role: "tool" as const,
            name: toolCall.function.name,
            tool_call_id: toolCall.id,
            content:
              normalizeYrWeatherData(weatherData, (data) => {
                temperature = data.main.temp;
                conditions = decodeSkyState(data.weather[0]?.main) ?? "Sunny";

                return `${temperature}, ${unit}, ${conditions}`;
              }) ?? "---",
          };

          const weatherWidgetData: WeatherData = {
            temperature: temperature ?? "---",
            location: location.location,
            unit: unit.substring(0, 1).toUpperCase(),
            conditions: conditions ?? "Sunny",
          };

          return { weatherWidgetData, weatherAiMessage };
        },
      );

      setWeatherData(
        weatherMessages.map(({ weatherWidgetData }) => weatherWidgetData),
      );

      return weatherMessages.map(({ weatherAiMessage }) => weatherAiMessage);
    });
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.weatherColumn}>
          {weatherData.map((data) => (
            <WeatherWidget key={data.location} {...data} />
          ))}
        </div>
        <div className={styles.chatContainer}>
          <div className={styles.chat}>
            <Chat functionCallHandler={functionCallHandler} />
          </div>
        </div>
      </div>
    </main>
  );
};

export default FunctionCalling;
