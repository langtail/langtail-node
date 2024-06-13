"use client"

import React, { useState } from "react"
import styles from "./page.module.css"
import Chat, { ChatMessage } from "./components/chat"
import WeatherWidget, {
  SkyCondition,
  WeatherData,
} from "./components/weather-widget"
import zod from "zod"
import { ChatCompletionMessageToolCall } from "openai/resources"

const WeatherSchema = zod.object({
  main: zod.object({
    temp: zod.number(),
  }),
  weather: zod.array(zod.object({ main: zod.string() })),
})

type WeatherType = zod.infer<typeof WeatherSchema>

function normalizeYrWeatherData<T>(
  data,
  cb: (weather: WeatherType) => T,
): T | undefined {
  try {
    const weather = WeatherSchema.parse(data)
    return cb(weather)
  } catch (error) {
    console.warn("Couldn't parse weather data", error)
  }
}

function decodeSkyState(maybeSkyState: string): SkyCondition | null {
  const loweredCase = maybeSkyState.toLocaleLowerCase()
  if (loweredCase.includes("cloud")) {
    return "Cloudy"
  }

  if (loweredCase.includes("rain")) {
    return "Rainy"
  }

  if (loweredCase.includes("snow")) {
    return "Snowy"
  }

  if (loweredCase.includes("wind")) {
    return "Windy"
  }

  if (loweredCase.includes("fair")) {
    return "Sunny"
  }

  if (loweredCase.includes("sun")) {
    return "Sunny"
  }

  return null
}

const defaultWeatherData: WeatherData[] = [
  {
    location: "---",
    temperature: "---",
    conditions: "Sunny",
    unit: "C",
  },
]

const FunctionCalling = () => {
  const [weatherData, setWeatherData] = useState<WeatherData[] | null>(null)

  const functionCallHandler = async (
    toolCall: ChatCompletionMessageToolCall,
  ) => {
    const location = JSON.parse(toolCall.function.arguments ?? "")

    const weatherData = await (
      await fetch(
        `/api/langtail/weather?${new URLSearchParams({
          location: location.location,
        })}`,
        {
          method: "GET",
        },
      )
    ).json()

    return (
      normalizeYrWeatherData(weatherData, (data) => {
        const temperature = data.main.temp
        const conditions = decodeSkyState(data.weather[0]?.main) ?? "Sunny"
        const unit = "C"

        const weatherWidgetData: WeatherData = {
          temperature: String(temperature ?? "---"),
          location: location.location,
          unit,
          conditions: conditions ?? "Sunny",
        }

        setWeatherData((prev) => [...(prev ?? []), weatherWidgetData])
        return `${temperature}, ${unit}, ${conditions}`
      }) ?? "Unknown weather data"
    )
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.weatherColumn}>
          {(weatherData ?? defaultWeatherData).map((data) => (
            <WeatherWidget key={data.location} {...data} />
          ))}
        </div>
        <div className={styles.chatContainer}>
          <div className={styles.chat}>
            <Chat
              functionCallHandler={functionCallHandler}
              onStart={() => {
                setWeatherData(null)
              }}
            />
          </div>
        </div>
      </div>
    </main>
  )
}

export default FunctionCalling
