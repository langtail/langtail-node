#!/usr/bin/env node
import fs from 'fs';
import { LangtailPrompts } from '../LangtailPrompts';
import jsonSchemaToZod from 'json-schema-to-zod';
import SDK_VERSION from '../version'
import { askUserToConfirm, dirExists, getApiKey, getBaseUrl, prepareOutputFilePath } from './utils';
import { Environment, PromptOptions, PromptSlug, Version } from '../types';


const DEFAULT_FILENAME = 'langtailTools.ts';
const TEMPLATE_PATH = new URL('./langtailTools.ts.template', import.meta.url);
const REPLACE_LINE = 'const toolsObject = {};  // replaced by generateTools.ts'

interface FetchToolsOptions<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined> extends PromptOptions<P, E, V> {
  langtailPrompts: LangtailPrompts;
}

interface Tools {
  [name: string]: {
    description: string;
    parameters: string;
  }
}

const fetchTools = async <P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined>({ langtailPrompts, prompt: promptSlug, environment, version }: FetchToolsOptions<P, E, V>): Promise<Tools | undefined> => {
  const prompt = await langtailPrompts.get({
    prompt: promptSlug,
    environment: environment,
    version: version,
  });

  if (prompt.state.tools && prompt.state.tools.length > 0) {
    return Object.fromEntries(prompt.state.tools.map(tool => [
      tool.function.name, {
        description: tool.function.description,
        parameters: jsonSchemaToZod(tool.function.parameters),
        ...(tool.function.handler?.enabled === true && { hosted: tool.function.handler.enabled })
      }
    ]));
  }
}

const stringifyToolsObject = (obj: object, depth = 0): string => {
  const indent = '  '.repeat(depth);
  let result = '{\n';

  Object.entries(obj).forEach(([key, value], index, array) => {
    result += `${indent}  "${key}": `;
    if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      // Recursively call customStringify for nested objects
      result += stringifyToolsObject(value, depth + 1);
    } else if (key === 'parameters') {
      // Directly append the parameters string without quotes
      result += value;
    } else {
      // For simple properties, stringify normally
      result += JSON.stringify(value);
    }
    result += index < array.length - 1 ? ',\n' : '\n';
  });

  result += `${indent}}`;
  return result;
}

interface ToolsObject {
  [promptSlug: string]: {
    [environment: string]: {
      [version: string]: {
        [toolName: string]: {
          description: string;
          parameters: string;
        }
      }
    }
  }
}

export const determineDefaultPath = () => dirExists('src') ? `src/${DEFAULT_FILENAME}` : DEFAULT_FILENAME;

interface GenerateToolsOptions {
  out: string;
}

const generateTools = async ({ out }: GenerateToolsOptions) => {
  const outputFile = await prepareOutputFilePath(out, DEFAULT_FILENAME);
  if (!outputFile) {
    console.log('Operation cancelled by the user.');
    return;
  }

  const langtailPrompts = new LangtailPrompts({
    apiKey: getApiKey(),
    baseURL: getBaseUrl()
  });

  const deployments = await langtailPrompts.listDeployments();

  let toolsObject: ToolsObject = {};
  for (const deployment of deployments) {
    const { promptSlug, environment, version } = deployment;
    try {
      const promptTools = await fetchTools({ langtailPrompts, prompt: promptSlug, environment: environment, version });
      if (promptTools && environment && promptSlug) {
        toolsObject[promptSlug] = toolsObject[promptSlug] || {};
        toolsObject[promptSlug][environment] = toolsObject[promptSlug][environment] || {};
        if (version) {
          toolsObject[promptSlug][environment][version] = promptTools;
        }
        if (!toolsObject[promptSlug][environment]['default']) {
          toolsObject[promptSlug][environment]['default'] = promptTools;
        }
      }
    } catch (error) {
      let errorMessage: string;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = JSON.stringify(error);
      }
      console.error(`Error fetching ${promptSlug} (${environment}, v${version}): ${errorMessage}`);
    }
  }

  if (Object.keys(toolsObject).length === 0) {
    const confirmed = await askUserToConfirm('No tools found. Create an empty tools file? [y/N]: ');
    if (!confirmed) {
      return;
    }
  }

  const fileInfo = '// ' + [
    'Langtail tools file, generated with `langtail generate-tools`',
    `Generated at: ${new Date().toISOString()}`,
    `Langtail SDK Version: ${SDK_VERSION}`,
    ``
  ].filter(Boolean).join('\n// ') + '\n';

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const fileString = fileInfo + template
    .replace('// @ts-ignore\n', '')
    .replace(
      REPLACE_LINE,
      `const toolsObject = ${stringifyToolsObject(toolsObject)} as const;`
    );

  fs.writeFileSync(outputFile, fileString, 'utf8');
  console.log(`Tools data generated at ${outputFile}`);
}

export default generateTools