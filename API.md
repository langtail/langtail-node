# API reference

## Langtail

### Constructor

The constructor accepts an options object with the following properties:

- `apiKey`: The API key for Langtail. This is required.
- `baseURL`(optional): The base URL for the Langtail API.
- `doNotRecord`(optional): A boolean indicating whether to record the API calls.
- `organization`(optional): The organization ID.
- `project`(optional): The project ID.
- `fetch`(optional): The fetch function to use for making HTTP requests. [It is passed to openAI client under the hood](https://github.com/openai/openai-node?tab=readme-ov-file#customizing-the-fetch-client).
- `onResponse`(optional): A callback that is called with the response object before it is returned. It can be used for logging or debugging purposes.

### Properties

- `completions`: An instance of the `LangtailPrompts` class.
- `chat`: An object containing a `completions` object with a `create` method.

### Methods

#### chat.completions.create

This method accepts two parameters:

- `body`: An object that can be of type `ChatCompletionCreateParamsNonStreaming & ILangtailExtraProps`, `ChatCompletionCreateParamsStreaming & ILangtailExtraProps`, `ChatCompletionCreateParamsBase & ILangtailExtraProps`, or `ChatCompletionCreateParams & ILangtailExtraProps`.
- `options`(optional): OpenAI `Core.RequestOptions` object

It returns a promise that resolves to a `ChatCompletion` or a `Stream<ChatCompletionChunk>` depending whether you are using streaming or not.

### Exceptions

- Throws an error if the `apiKey` is not provided in the options object or as an environment variable.

## LangtailPrompts

### Constructor

The constructor accepts an options object with the following properties:

- `apiKey`: The API key for Langtail. This is required.
- `baseURL`(optional): The base URL for the Langtail API.
- `organization`(optional): The organization ID.
- `project`(optional): The project ID.
- `fetch`(optional): The fetch function to use for making HTTP requests. [It is passed to openAI client under the hood](https://github.com/openai/openai-node?tab=readme-ov-file#customizing-the-fetch-client).
- `onResponse`(optional): A callback that is called with the response object before it is returned. It can be used for logging or debugging purposes.

### Properties

- `apiKey`: The API key for Langtail.
- `baseUrl`(optional): The base URL for the Langtail API.
- `options`(optional): An object containing the options for the Langtail API.

### Methods

#### invoke

This method accepts an `IRequestParams` or `IRequestParamsStream` object and returns a promise that resolves to an `OpenAIResponseWithHttp` or a `StreamResponseType` depending on whether you use streaming or not.

### get

This method accepts one parameter with these fields:

- `prompt`: A string representing the prompt.
- `environment`(optional): An `Environment` string identifier. Accepts values: `"preview" | "staging" | "production"`. Defaults to `production`
- `version`(optional): string for version. Necessary for preview environment

Returns playground state defined here: https://github.com/langtail/langtail-node/blob/48e2690749e26d61c2e43b1bf6ac92e7d4fef48b/src/schemas.ts#L94

### Exceptions

- Throws an error if the fetch operation fails.
- Throws an error if there is no body in the response when streaming is enabled.
