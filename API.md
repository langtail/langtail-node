# Full API reference

## LangtailNode

### Constructor

The constructor accepts an options object with the following properties:

- `apiKey`: The API key for Langtail. This is required.
- `baseURL`: The base URL for the Langtail API. This is optional.
- `doNotRecord`: A boolean indicating whether to record the API calls. This is optional.
- `organization`: The organization ID. This is optional.
- `project`: The project ID. This is optional.
- `fetch`: The fetch function to use for making HTTP requests. [It is passed to openAI client under the hood](https://github.com/openai/openai-node?tab=readme-ov-file#customizing-the-fetch-client). This is optional.

### Properties

- `completions`: An instance of the `LangtailPrompts` class.
- `chat`: An object containing a `completions` object with a `create` method.

### Methods

#### chat.completions.create

This method accepts two parameters:

- `body`: An object that can be of type `ChatCompletionCreateParamsNonStreaming & ILangtailExtraProps`, `ChatCompletionCreateParamsStreaming & ILangtailExtraProps`, `ChatCompletionCreateParamsBase & ILangtailExtraProps`, or `ChatCompletionCreateParams & ILangtailExtraProps`.
- `options`: An optional `Core.RequestOptions` object.

It returns a promise that resolves to a `ChatCompletion` or a `Stream<ChatCompletionChunk>` depending whether you are using streaming or not.

### Exceptions

- Throws an error if the `apiKey` is not provided in the options object or as an environment variable.

## LangtailPrompts

### Constructor

The constructor accepts an options object with the following properties:

- `apiKey`: The API key for Langtail. This is required.
- `baseURL`: The base URL for the Langtail API. This is optional.
- `organization`: The organization ID. This is optional.
- `project`: The project ID. This is optional.
- `fetch`: The fetch function to use for making HTTP requests. [It is passed to openAI client under the hood](https://github.com/openai/openai-node?tab=readme-ov-file#customizing-the-fetch-client). This is optional.

### Properties

- `apiKey`: The API key for Langtail.
- `baseUrl`: The base URL for the Langtail API.
- `options`: An object containing the options for the Langtail API.

### Methods

#### createPromptPath

This method accepts two parameters:

- `prompt`: A string representing the prompt.
- `environment`: An `Environment` object.

It returns a string representing the URL path for the prompt.

#### request

This method accepts an `IRequestParams` or `IRequestParamsStream` object and returns a promise that resolves to an `OpenAIResponseWithHttp` or a `StreamResponseType` depending on whether you use streaming or not.

### Exceptions

- Throws an error if the fetch operation fails.
- Throws an error if there is no body in the response when streaming is enabled.
