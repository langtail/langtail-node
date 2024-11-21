import handlebarsEvalless from "@langtail/handlebars-evalless"

import { handlebarsDateHelper, operatorHelpers, variableHelpers } from "./handlebars-helpers"
import { JSONValue } from "./jsonType"
import { ContentArray } from "./schemas"

const handlebars = handlebarsEvalless.default ?? handlebarsEvalless

handlebars.registerHelper("$date", handlebarsDateHelper)
handlebars.registerHelper(operatorHelpers)
handlebars.registerHelper(variableHelpers)

export const LANGTAIL_HELPERS = [
  "$date",
  ...Object.keys(operatorHelpers),
  ...Object.keys(variableHelpers),
]

const Visitor = handlebars.Visitor

/*
 * This class is used to wrap the input object to be used in handlebars templates. Without this JSON objects are rendered as [object Object]
 */
class TemplateObject {
  _value: any
  constructor(props: any) {
    this._value = props
  }
  toString() {
    return JSON.stringify(this._value, null, 2)
  }
}

function castToTemplateObject(value: any): any {
  if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) {
      return value.map((item) => castToTemplateObject(item))
    }
    return new TemplateObject(value)
  }
  return value
}

// does not throw
export const compileStringHandlebars = (
  text: string,
  input: Record<string, JSONValue>,
): {
  text: string
  error: Error | null
} => {
  try {
    // Preprocess the template to improve readability and consistency. This involves:
    // 1. Removing newline characters before and after the {{else}} block.
    // 2. Removing newline characters before closing block helpers (like '/if', '/unless', '/with').
    const preprocessedText = text
      .replace(/\n?({{else}})\n?/g, "$1") // Remove newline before and after {{else}}
      .replace(/\n({{\/(if|unless|with)}})/g, "$1") // Remove newline before closing block helpers

    const template = handlebars.compileAST(preprocessedText, {
      noEscape: true,
    }) // regular compile cannot be used in cloudflare worker

    const parsedInput: Record<string, JSONValue | TemplateObject> = {}
    for (const key in input) {
      try {
        const parsed = JSON.parse(input[key] as string)

        if (typeof parsed === "object" && parsed !== null) {
          if (Array.isArray(parsed)) {
            parsedInput[key] = parsed.map((item) => castToTemplateObject(item))
          } else {
            parsedInput[key] = new TemplateObject(parsed)
          }
        } else {
          parsedInput[key] = input[key]
        }
      } catch {
        parsedInput[key] = input[key]
      }
    }

    const handlebarsOutput = template(parsedInput).replace(/\n$/g, "") // Remove trailing newline,
    return {
      text: handlebarsOutput, // ideally we would not even encode it, but in handlebars HTML entities encoding cannot be turned off. We could only use triple curly braces
      error: null,
    }
  } catch (err: any) {
    return { text, error: err }
  }
}

export const compileLTTemplate = (
  content: string | ContentArray | null,
  input: Record<string, string>,
) => {
  if (content === null) {
    return null
  }

  if (typeof content === "string") {
    return compileStringHandlebars(content, input).text
  }

  return content.map((item) => {
    if (item.type === "text") {
      return { ...item, text: compileStringHandlebars(item.text, input).text }
    }

    if (item.type === "gemini_media_url") {
      return { ...item, gemini_media_url: { url: compileStringHandlebars(item.gemini_media_url.url, input).text } }
    }
    return item
  })
}

interface PathExpression {
  original: string
}

class VariableScanner extends Visitor {
  variables: string[]
  builtInHelpers: Set<string>
  withStack: boolean[] // Track 'with' blocks depth
  eachStack: boolean[] // Track 'each' blocks depth
  currentBlockParams: Set<string> // Track block params for 'each' blocks

  constructor() {
    super()
    this.variables = []
    this.builtInHelpers = new Set([
      "if",
      "each",
      "unless",
      "with",
      "log",
      "lookup",
      "this",
      "blockHelperMissing",
      "helperMissing",
      "raw",
      "eq",
      "ne",
      "lt",
      "gt",
      "lte",
      "gte",
      "and",
      "or",
      "@key",
      "@index",
      "$date",
    ])
    this.withStack = []
    this.eachStack = []
    this.currentBlockParams = new Set()
  }

  BlockStatement(block: any): void {
    // Check for 'with' and 'each' blocks
    const isWithBlock = block.path.original === "with"
    const isEachBlock = block.path.original === "each"

    if (isWithBlock) {
      this.withStack.push(true)
      if (
        block.params[0] &&
        !this.builtInHelpers.has(block.params[0].original)
      ) {
        this.variables.push(block.params[0].original)
      }
    }

    if (isEachBlock) {
      this.eachStack.push(true) // Indicate we're inside an 'each' block
      if (block.program.blockParams?.length > 0) {
        block.program.blockParams.forEach((param: any) =>
          this.currentBlockParams.add(param),
        )
      }
    }

    // Process the block's content
    super.BlockStatement(block)

    if (isWithBlock) {
      this.withStack.pop()
    }

    if (isEachBlock) {
      this.eachStack.pop() // Exiting the 'each' block
      if (block.program.blockParams?.length > 0) {
        block.program.blockParams.forEach((param: any) =>
          this.currentBlockParams.delete(param),
        )
      }
    }
  }

  PathExpression(path: PathExpression): void {
    const isInsideWith = this.withStack.length > 0
    const isInsideEach = this.eachStack.length > 0
    const rootVariable = path.original?.split(".")[0] ?? ""
    const isBlockParam = this.currentBlockParams.has(rootVariable)
    const isThisProperty = path.original.startsWith("this.")

    if (
      !isInsideWith &&
      !(isInsideEach && isThisProperty) && // Correctly ignore 'this.' prefixed variables inside 'each' blocks
      !isBlockParam &&
      !this.builtInHelpers.has(path.original)
    ) {
      this.variables.push(rootVariable) // Push rootVariable instead if you want to collect the base name
    }
  }
}

export function extractVariablesForHandlebars(template: string): string[] {
  try {
    const ast = handlebars.parse(template)
    const scanner = new VariableScanner()
    scanner.accept(ast)
    return scanner.variables
  } catch (error) {
    return []
  }
}
