#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { LangtailEnvironment, LangtailPrompts } from '../LangtailPrompts';
import jsonSchemaToZod from 'json-schema-to-zod';
import packageJson from "../../package.json"

const SDK_VERSION = packageJson.version;
const TEMPLATE_PATH = new URL('./langtailTools.template.ts', import.meta.url);
const REPLACE_LINE = 'const toolsObject = {};  // replaced by generateTools.ts'

const getApiKey = (): string => {
  const apiKey = process.env.LANGTAIL_API_KEY;
  if (!apiKey) {
    throw new Error('LANGTAIL_API_KEY environment variable is required');
  }
  return apiKey;
}

interface Deployment {
  environment: string;
  version?: string;
  default?: boolean;
}

interface DeployedPrompt {
  promptSlug: string;
  deployments: Deployment[];
}

const fetchDeployedPrompts = async (): Promise<DeployedPrompt[]> => {
  return [
    {
      promptSlug: 'stock-simple',
      deployments: [
        {
          environment: 'staging',
          default: true,
        },
        {
          environment: 'production',
          version: '2',
        },
        {
          environment: 'production',
          version: '3',
          default: true,
        }
      ]
    },
    {
      promptSlug: 'stock-trading-bot',
      deployments: [
        {
          environment: 'production',
          version: '5',
        },
        {
          environment: 'production',
          version: '6',
          default: true,
        }
      ]
    },
  ]
}


interface FetchToolsOptions {
  langtailPrompts: LangtailPrompts;
  promptSlug: string;
  environment: LangtailEnvironment;
  version: string | undefined;
}

interface Tools {
  [name: string]: {
    description: string;
    parameters: string;
  }
}

const fetchTools = async ({ langtailPrompts, promptSlug, environment, version }: FetchToolsOptions): Promise<Tools | undefined> => {
  const prompt = await langtailPrompts.get({
    prompt: promptSlug,
    environment: environment,
    version: version,
  });

  if (prompt.state.tools && prompt.state.tools.length > 0) {
    return Object.fromEntries(prompt.state.tools.map(tool => [
      tool.function.name, {
        description: tool.function.description,
        parameters: jsonSchemaToZod(tool.function.parameters)
      }
    ]));
  }
}

function askUserToConfirm(query: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

const prepareOutputFilePath = async (outputFile: string): Promise<string | undefined> => {
  let resultFilePath = outputFile;
  if (fs.existsSync(resultFilePath) && fs.statSync(resultFilePath).isDirectory()) {
    resultFilePath = path.join(resultFilePath, 'langtailTools.ts');
  }

  if (fs.existsSync(resultFilePath)) {
    const confirmed = await askUserToConfirm(`File ${resultFilePath} exists. Overwrite? [y/N]: `);
    if (!confirmed) {
      return;
    }
  }

  const directory = path.dirname(resultFilePath);
  if (!fs.existsSync(directory)) {
    const confirmed = await askUserToConfirm(`Directory ${directory} does not exist. Create it? [y/N]: `);
    if (confirmed) {
      fs.mkdirSync(directory, { recursive: true });
      console.log(`Created directory: ${directory}`);
    } else {
      return;
    }
  }

  return resultFilePath;
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

interface GenerateToolsOptions {
  out: string;
}

const generateTools = async ({ out }: GenerateToolsOptions) => {
  const outputFile = await prepareOutputFilePath(out);
  if (!outputFile) {
    console.log('Operation cancelled by the user.');
    return;
  }

  const langtailPrompts = new LangtailPrompts({
    apiKey: getApiKey()
  });

  const promptDeployments = await fetchDeployedPrompts();

  let toolsObject: ToolsObject = {};
  for (const deployedPrompt of promptDeployments) {
    const { promptSlug, deployments } = deployedPrompt;
    for (const deployment of deployments) {
      const { environment, version } = deployment;
      try {
        const promptTools = await fetchTools({ langtailPrompts, promptSlug, environment: environment as LangtailEnvironment, version });
        if (promptTools) {
          toolsObject[promptSlug] = toolsObject[promptSlug] || {};
          toolsObject[promptSlug][environment] = toolsObject[promptSlug][environment] || {};
          if (version) {
            toolsObject[promptSlug][environment][version] = promptTools;
          }
          if (deployment.default) {
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
  }

  if (Object.keys(toolsObject).length === 0) {
    const confirmed = await askUserToConfirm('No tools found. Create an empty tools file? [y/N]: ');
    if (!confirmed) {
      return;
    }
  }

  const fileInfo = '// ' + [
    'Langtail tools file, generated with `langtail generate`',
    `Generated at: ${new Date().toISOString()}`,
    `Langtail SDK Version: ${SDK_VERSION}`,
    ``
  ].filter(Boolean).join('\n// ') + '\n';

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const fileString = fileInfo + template.replace(
    REPLACE_LINE,
    `const toolsObject = ${stringifyToolsObject(toolsObject)};`
  );

  fs.writeFileSync(outputFile, fileString, 'utf8');
  console.log(`Tools data generated at ${outputFile}`);
}

export default generateTools