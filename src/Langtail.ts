export class Langtail {
  apiKey: string;
  baseUrl: string;

  constructor(options: {
    apiKey: string,
    baseURL: string
  }) {
    const { apiKey, baseURL: baseUrl } = options;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }
}