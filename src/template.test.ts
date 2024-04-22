import { format } from "date-fns"
import { expect, test } from "vitest"
import {
  compileStringHandlebars,
  extractVariablesForHandlebars,
} from "./template"

test("should return an empty array for an empty string", () => {
  expect(extractVariablesForHandlebars("")).toEqual([])
})

test("should return an empty array for a string wtesth no variables", () => {
  expect(extractVariablesForHandlebars("Hello, World!")).toEqual([])
})

test("should extract single variable", () => {
  expect(extractVariablesForHandlebars("Hello, {{name}}!")).toEqual(["name"])
})

test("should extract multiple variables", () => {
  expect(
    extractVariablesForHandlebars("Hello, {{firstName}} {{lastName}}!")
  ).toEqual(["firstName", "lastName"])
})

test("should trim spaces around variable names", () => {
  expect(
    extractVariablesForHandlebars("Hello, {{ firstName }} {{ lastName }}!")
  ).toEqual(["firstName", "lastName"])
})

test("should handle multiple spaces between curly braces", () => {
  expect(
    extractVariablesForHandlebars(
      "Hello, {{   firstName   }} {{   lastName   }}!"
    )
  ).toEqual(["firstName", "lastName"])
})

test("should return an empty array if there are unclosed curly braces", () => {
  expect(extractVariablesForHandlebars("Hello, {{firstName")).toEqual([])
})

test("should return an empty array if there are unopened curly braces", () => {
  expect(extractVariablesForHandlebars("Hello, firstName}}")).toEqual([])
})

test("should ignore all our helpers", () => {
  const template = `{{#if (or great magnificent)}}A{{else}}B{{/if}}`
  const template2 = `{{#if (and great magnificent)}}A{{else}}B{{/if}}`
  const template3 = `{{#if (eq great magnificent)}}A{{else}}B{{/if}}`
  const template4 = `{{$date someDate "yyyy"}}`

  expect(extractVariablesForHandlebars(template)).toMatchInlineSnapshot(`
    [
      "great",
      "magnificent",
    ]
  `)

  expect(extractVariablesForHandlebars(template2)).toMatchInlineSnapshot(`
    [
      "great",
      "magnificent",
    ]
  `)

  expect(extractVariablesForHandlebars(template3)).toMatchInlineSnapshot(`
    [
      "great",
      "magnificent",
    ]
  `)

  expect(extractVariablesForHandlebars(template4)).toMatchInlineSnapshot(`
    [
      "someDate",
    ]
  `)
})

test("should render date helper", () => {
  const template = `{{$date}}`
  expect(compileStringHandlebars(template, {}).text).toEqual(
    format(new Date(), "MMMM dd, yyyy")
  )

  const templateTwo = `{{$date "yyyy"}}`
  expect(compileStringHandlebars(templateTwo, {}).text).toEqual(
    format(new Date(), "yyyy")
  )

  const templateThree = `{{$date "dd"}}`
  expect(compileStringHandlebars(templateThree, {}).text).toEqual(
    format(new Date(), "dd")
  )

  const templateWithDate = `{{$date "2024-09-01" "MM"}}`
  expect(compileStringHandlebars(templateWithDate, {}).text).toEqual("09")

  const templateWithInvalidDate = `{{$date "invalid_date_string" "MM"}}`
  expect(compileStringHandlebars(templateWithInvalidDate, {}).text).toEqual("")
})

test("should return the same string when there are no variables", () => {
  expect(compileStringHandlebars("Hello, World!", {}).text).toEqual(
    "Hello, World!"
  )
})

test("should replace single variable", () => {
  expect(
    compileStringHandlebars("Hello, {{name}}!", { name: "John" }).text
  ).toEqual("Hello, John!")
})

test("should replace multiple variables", () => {
  expect(
    compileStringHandlebars("Hello, {{firstName}} {{lastName}}!", {
      firstName: "John",
      lastName: "Doe",
    }).text
  ).toEqual("Hello, John Doe!")
})

test("should return a string until the error for missing braces", () => {
  expect(compileStringHandlebars("Hello, {{firstName", {}).text).toEqual(
    "Hello, {{firstName"
  )
  expect(compileStringHandlebars("Hello, {{firstName", {}).error)
    .toMatchInlineSnapshot(`
    [Error: Parse error on line 1:
    Hello, {{firstName
    ---------^
    Expecting 'ID', 'STRING', 'NUMBER', 'BOOLEAN', 'UNDEFINED', 'NULL', 'DATA', got 'INVALID']
  `)
})

test("should leave unmatched variables empty", () => {
  expect(
    compileStringHandlebars("Hello, {{firstName}} {{lastName}}!", {
      firstName: "John",
    }).text
  ).toEqual("Hello, John !")
})

test("should handle variables with spaces", () => {
  expect(
    compileStringHandlebars("Hello, {{ firstName }} {{ lastName }}!", {
      firstName: "John",
      lastName: "Doe",
    }).text
  ).toEqual("Hello, John Doe!")
})

test("should handle multiple spaces between curly braces", () => {
  expect(
    compileStringHandlebars("Hello, {{   firstName   }} {{   lastName   }}!", {
      firstName: "John",
      lastName: "Doe",
    }).text
  ).toEqual("Hello, John Doe!")
})

test("should return the original string when the input object is empty", () => {
  expect(compileStringHandlebars("Hello, {{name}}!", {}).text).toEqual(
    "Hello, !"
  )
})

test("should replace variables with empty strings if not found in the input object", () => {
  expect(
    compileStringHandlebars("Hello, {{firstName}} {{lastName}}!", {}).text
  ).toEqual("Hello,  !")
})

test('should handle "if" helper', () => {
  const input = { name: "John" }
  const template = `{{#if name}}
Hello, {{name}}!{{/if}}`
  expect(compileStringHandlebars(template, input).text).toEqual("Hello, John!")
  expect(compileStringHandlebars(template, {}).text).toEqual("")
})

test("should handle or helper", () => {
  const template = `{{#if (or great magnificent)}}Kiss my shiny metal ass!{{else}}Never mind :({{/if}}`

  expect(
    compileStringHandlebars(template, { great: true, magnificent: false }).text
  ).toEqual("Kiss my shiny metal ass!")

  expect(
    compileStringHandlebars(template, {
      great: false,
      magnificent: false,
    }).text
  ).toMatchInlineSnapshot(`"Never mind :("`)
})

// Test for {{#if}} block helper
test("should remove newline after {{#if}}", () => {
  const template = `{{#if condition}}
Welcome
{{/if}}`
  expect(compileStringHandlebars(template, { condition: true }).text).toEqual(
    "Welcome"
  )
})

test("should remove newline before and after {{else}}", () => {
  const template = `{{#if condition}}
Welcome
{{else}}
Goodbye
{{/if}}`
  expect(compileStringHandlebars(template, { condition: false }).text).toEqual(
    "Goodbye"
  )

  expect(compileStringHandlebars(template, { condition: true }).text).toEqual(
    "Welcome"
  )
})

test("should remove newline before {{/if}}", () => {
  const template = `{{#if condition}}Welcome
{{/if}}`
  expect(compileStringHandlebars(template, { condition: true }).text).toEqual(
    "Welcome"
  )
})

test("should remove newline after {{#unless}}", () => {
  const template = `{{#unless condition}}
Goodbye
{{/unless}}`
  expect(compileStringHandlebars(template, { condition: false }).text).toEqual(
    "Goodbye"
  )
})

test("should concatenate items with newline when using 'each' helper", () => {
  const template = `{{#each items}}
Item
{{/each}}`
  expect(compileStringHandlebars(template, { items: [1, 2] }).text).toEqual(
    "Item\nItem"
  )
})

test("should concatenate items without newline when using 'each' helper", () => {
  const template = `{{#each items}}Item{{/each}}`
  expect(compileStringHandlebars(template, { items: [1, 2] }).text).toEqual(
    "ItemItem"
  )
})

test("should remove newline after {{#with}}", () => {
  const template = `{{#with context}}
Context
{{/with}}`
  expect(compileStringHandlebars(template, { context: {} }).text).toEqual(
    "Context"
  )
})

test("should remove newline after {{else if condition}}", () => {
  const template = `{{#if condition}}
Welcome
{{else if anotherCondition}}
Goodbye
{{/if}}`
  expect(
    compileStringHandlebars(template, {
      condition: false,
      anotherCondition: true,
    }).text
  ).toEqual("Goodbye")
})

test("should handle multiple block helpers correctly", () => {
  const template = `{{#if condition}}Welcome{{else}}
Goodbye
{{/if}}
{{#unless condition}}
Stay awhile
{{/unless}}
{{#each items}}
Item
{{/each}}
{{#with context}}
Context
{{/with}}`

  expect(
    compileStringHandlebars(template, {
      condition: false,
      items: [1, 2],
      context: {},
    }).text
  ).toEqual("Goodbye\nStay awhile\nItem\nItem\nContext")
})

test("should correctly handle multiple block helpers in template", () => {
  const template = `{{#if condition}}
Welcome
{{/if}}
{{#each items}}
Item
{{/each}}
{{#with context}}
Context
{{/with}}`

  expect(
    compileStringHandlebars(template, {
      condition: true,
      items: [1, 2],
      context: {},
    }).text
  ).toEqual("Welcome\nItem\nItem\nContext")
})

test("should render each properly", () => {
  const template = `{{#each numbers}}
  - {{this}}
{{/each}}`

  expect(
    compileStringHandlebars(template, {
      numbers: "[1, 2, 3]",
    }).text
  ).toEqual("  - 1\n  - 2\n  - 3")
})

test("should remove newline before {{else if condition}}", () => {
  const template = `{{#if (eq variant "A")}}
Welcome
{{else if (eq variant "B")}}
Adios
{{/if}}`

  expect(
    compileStringHandlebars(template, {
      variant: "A",
    }).text
  ).toEqual("Welcome")

  expect(
    compileStringHandlebars(template, {
      variant: "B",
    }).text
  ).toEqual("Adios")
})

test("should correctly handle 'if history' condition in template", () => {
  const template = `Chatbot.
{{#if history}}
History
{{/if}}`

  expect(
    compileStringHandlebars(template, {
      history: "abc",
    }).text
  ).toEqual("Chatbot.\nHistory")

  expect(
    compileStringHandlebars(template, {
      history: undefined,
    }).text
  ).toEqual("Chatbot.")
})

test("should correctly handle 'unless history' condition in template", () => {
  const template = `Chatbot.
{{#unless history}}
No history.
{{/unless}}`

  expect(
    compileStringHandlebars(template, {
      history: "abc",
    }).text
  ).toEqual("Chatbot.")

  expect(
    compileStringHandlebars(template, {
      history: undefined,
    }).text
  ).toEqual("Chatbot.\nNo history.")
})

test("should correctly handle history condition in template", () => {
  const template = `Chatbot.
{{#if history}}
History
{{else}}
No history.
{{/if}}`

  expect(
    compileStringHandlebars(template, {
      history: "abc",
    }).text
  ).toEqual("Chatbot.\nHistory")

  expect(
    compileStringHandlebars(template, {
      history: undefined,
    }).text
  ).toEqual("Chatbot.\nNo history.")
})

test("should render json correctly", () => {
  const template = `test {{data}}`
  const data = { name: "John", age: 30 }
  expect(compileStringHandlebars(template, { data: JSON.stringify(data) }).text)
    .toMatchInlineSnapshot(`
    "test {
      "name": "John",
      "age": 30
    }"
  `)

  const dataArray = [
    { name: "John", age: 30 },
    { name: "Jane", age: 25 },
  ]

  expect(
    compileStringHandlebars(template, { data: JSON.stringify(dataArray) }).text
  ).toMatchInlineSnapshot(`
    "test {
      "name": "John",
      "age": 30
    },{
      "name": "Jane",
      "age": 25
    }"
  `)
})

test("should not escape apostrophes inside variables", () => {
  const template = "test {{data}}"

  expect(compileStringHandlebars(template, { data: "John's" }).text).toEqual(
    "test John's"
  )
})
