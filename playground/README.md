# Langtail Weather Chat Example

**Deployed here**: [https://langtail-weather-chat.vercel.app/](https://langtail-weather-chat.vercel.app/)

This example demonstrates how to create a chat application using the Langtail library within a Next.js framework. It covers making requests to the Langtail API, handling responses on both the client and server sides, managing tool calls, and streaming the AI's responses to the client's UI in React.

## Quickstart Setup

### 1. Clone the Repository

```shell
git clone git@github.com:langtail/examples.git
cd examples/langtail-weather-chat
```

### 2. Set Your API Keys

Set your [Langtail API key](https://app.langtail.com/), [OpenAI API key](https://platform.openai.com/api-keys), and [OpenWeather API key](https://openweathermap.org/appid):

```shell
export OPENAI_API_KEY=""
export LANGTAIL_API_KEY=""
export OPEN_WEATHER_API_KEY=""
```

Alternatively, you can set these in the `.env.example` file and rename it to `.env`.

### 3. Install Dependencies

```shell
npm install
```

### 4. Run the Development Server

```shell
npm run dev
```

### 5. Open in Your Browser

Navigate to [http://localhost:3000](http://localhost:3000).

## Deployment

You can deploy this project to Vercel or any other platform that supports Next.js. Our instance runs here: [https://langtail-weather-chat.vercel.app/](https://langtail-weather-chat.vercel.app/).

## Overview

This project showcases how to create a chat application using Langtail, including streaming AI responses and handling tool calls.

### Important Files

#### API Routes

- [Langtail AI Endpoint](./app/api/langtail/route.ts): A simple endpoint that forwards requests to the Langtail API.
- [Weather Endpoint](./app/api/langtail/weather/route.ts): An endpoint for the OpenWeather API that also forwards requests.

The AI and weather endpoints are called from the backend (Node.js) to ensure that secrets are not exposed to the browser.

#### UI Components

- [Chat Page](./app/page.tsx): Renders the chat interface, handles AI tools and function calls, and calls the weather endpoint to obtain weather data based on AI requests.
- [Chat Component](./app/components/chat.tsx): Manages the AI fetch streams and renders them to the UI through the `messages` state. Calls the `functionHandler` callback in the chat page based on AI responses.

### Test It Live

- Basic Chat Example: [https://langtail-weather-chat.vercel.app/](https://langtail-weather-chat.vercel.app/)
