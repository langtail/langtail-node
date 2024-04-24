"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/template.ts
var template_exports = {};
__export(template_exports, {
  compileLTTemplate: () => compileLTTemplate,
  compileStringHandlebars: () => compileStringHandlebars,
  extractVariablesForHandlebars: () => extractVariablesForHandlebars
});
module.exports = __toCommonJS(template_exports);
var import_handlebars_evalless = __toESM(require("@langtail/handlebars-evalless"));
var import_handlebars = require("handlebars");

// src/handlebars-helpers.ts
var import_date_fns = require("date-fns");
var isObject = function(val) {
  return typeof val === "object";
};
var isOptions = function(val) {
  return isObject(val) && isObject(val.hash);
};
var defaultDateFormat = "MMMM dd, yyyy";
var formatDateSafe = function(date, pattern) {
  try {
    return (0, import_date_fns.format)(date, pattern);
  } catch (e) {
    return "";
  }
};
function handlebarsDateHelper(str, pattern, options) {
  if (isOptions(pattern)) {
    options = pattern;
    pattern = null;
  }
  if (isOptions(str)) {
    options = str;
    pattern = null;
    str = null;
  }
  if (str == null && pattern == null) {
    return formatDateSafe(/* @__PURE__ */ new Date(), defaultDateFormat);
  }
  const date = str instanceof Date ? str : new Date(str);
  if (typeof str === "string" && typeof pattern === "string") {
    return formatDateSafe((0, import_date_fns.parseISO)(str), pattern);
  }
  if (typeof str === "string" && !pattern) {
    return formatDateSafe(/* @__PURE__ */ new Date(), str);
  }
  return formatDateSafe(date, pattern);
}
var operatorHelpers = {
  eq: (v1, v2) => v1 == v2,
  ne: (v1, v2) => v1 != v2,
  lt: (v1, v2) => v1 < v2,
  gt: (v1, v2) => v1 > v2,
  lte: (v1, v2) => v1 <= v2,
  gte: (v1, v2) => v1 >= v2,
  and() {
    return Array.prototype.every.call(arguments, Boolean);
  },
  or() {
    return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
  }
};

// src/template.ts
import_handlebars_evalless.default.registerHelper("$date", handlebarsDateHelper);
import_handlebars_evalless.default.registerHelper(operatorHelpers);
var TemplateObject = class {
  constructor(props) {
    this._value = props;
  }
  toString() {
    return JSON.stringify(this._value, null, 2);
  }
};
function castToTemplateObject(value) {
  if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) {
      return value.map((item) => castToTemplateObject(item));
    }
    return new TemplateObject(value);
  }
  return value;
}
var compileStringHandlebars = (text, input) => {
  try {
    const preprocessedText = text.replace(/\n?({{else}})\n?/g, "$1").replace(/\n({{\/(if|unless|with)}})/g, "$1");
    const template = import_handlebars_evalless.default.compileAST(preprocessedText, { noEscape: true });
    const parsedInput = {};
    for (const key in input) {
      try {
        const parsed = JSON.parse(input[key]);
        if (typeof parsed === "object" && parsed !== null) {
          if (Array.isArray(parsed)) {
            parsedInput[key] = parsed.map((item) => castToTemplateObject(item));
          } else {
            parsedInput[key] = new TemplateObject(parsed);
          }
        } else {
          parsedInput[key] = input[key];
        }
      } catch {
        parsedInput[key] = input[key];
      }
    }
    const handlebarsOutput = template(parsedInput).replace(/\n$/g, "");
    return {
      text: handlebarsOutput,
      // ideally we would not even encode it, but in handlebars HTML entities encoding cannot be turned off. We could only use triple curly braces
      error: null
    };
  } catch (err) {
    return { text, error: err };
  }
};
var compileLTTemplate = (content, input) => {
  if (content === null) {
    return null;
  }
  if (typeof content === "string") {
    return compileStringHandlebars(content, input).text;
  }
  return content.map((item) => {
    if (item.type === "text") {
      return { ...item, text: compileStringHandlebars(item.text, input).text };
    }
    return item;
  });
};
var VariableScanner = class extends import_handlebars.Visitor {
  // Track block params for 'each' blocks
  constructor() {
    super();
    this.variables = [];
    this.builtInHelpers = /* @__PURE__ */ new Set([
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
      "$date"
    ]);
    this.withStack = [];
    this.eachStack = [];
    this.currentBlockParams = /* @__PURE__ */ new Set();
  }
  BlockStatement(block) {
    const isWithBlock = block.path.original === "with";
    const isEachBlock = block.path.original === "each";
    if (isWithBlock) {
      this.withStack.push(true);
      if (block.params[0] && !this.builtInHelpers.has(block.params[0].original)) {
        this.variables.push(block.params[0].original);
      }
    }
    if (isEachBlock) {
      this.eachStack.push(true);
      if (block.program.blockParams?.length > 0) {
        block.program.blockParams.forEach(
          (param) => this.currentBlockParams.add(param)
        );
      }
    }
    super.BlockStatement(block);
    if (isWithBlock) {
      this.withStack.pop();
    }
    if (isEachBlock) {
      this.eachStack.pop();
      if (block.program.blockParams?.length > 0) {
        block.program.blockParams.forEach(
          (param) => this.currentBlockParams.delete(param)
        );
      }
    }
  }
  PathExpression(path) {
    const isInsideWith = this.withStack.length > 0;
    const isInsideEach = this.eachStack.length > 0;
    const rootVariable = path.original?.split(".")[0] ?? "";
    const isBlockParam = this.currentBlockParams.has(rootVariable);
    const isThisProperty = path.original.startsWith("this.");
    if (!isInsideWith && !(isInsideEach && isThisProperty) && // Correctly ignore 'this.' prefixed variables inside 'each' blocks
    !isBlockParam && !this.builtInHelpers.has(path.original)) {
      this.variables.push(rootVariable);
    }
  }
};
function extractVariablesForHandlebars(template) {
  try {
    const ast = import_handlebars_evalless.default.parse(template);
    const scanner = new VariableScanner();
    scanner.accept(ast);
    return scanner.variables;
  } catch (error) {
    return [];
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  compileLTTemplate,
  compileStringHandlebars,
  extractVariablesForHandlebars
});
//# sourceMappingURL=template.js.map