import { LangtailPrompts } from "./LangtailPrompts"

export class Langtail {
  prompts: LangtailPrompts

  constructor(clientOptions?: {
    apiKey: string
    organization?: string
    project?: string
  }) {
    const apiKey = clientOptions?.apiKey || process.env.LANGTAIL_API_KEY
    if (!apiKey) {
      throw new Error(
        "apiKey is required. You can pass it as an option or set the LANGTAIL_API_KEY environment variable.",
      )
    }

    this.prompts = new LangtailPrompts({
      apiKey,
      workspace: clientOptions?.organization,
      project: clientOptions?.project,
    })

    return this
  }
}

export { LangtailPrompts }
