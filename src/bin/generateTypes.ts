import fs from 'fs';
import path from 'path';
import { LangtailEnvironment, LangtailPrompts } from "../LangtailPrompts";
import { dirExists, getApiKey, prepareOutputFilePath } from "./utils";
import SDK_VERSION from '../version'

const DEFAULT_FILENAME = 'langtailTypes.d.ts';
const TEMPLATE_PATH = new URL('./langtailTypes.d.ts.template', import.meta.url);
const REPLACE_LINE = 'type PromptsType = {};  // replaced by generateTypes.ts'

export const determineDefaultPath = (): string => {
  // Default directories to check
  const defaultTypeDirs = [
    'src/types',
    'src/typings',
    'types',
    'typings',
    'src'
  ];

  // Try to read and parse the tsconfig.json
  try {
    const tsConfigPath = path.resolve(process.cwd(), 'tsconfig.json');
    const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));

    if (tsConfig.compilerOptions && tsConfig.compilerOptions.typeRoots) {
      // Filter out any paths pointing to node_modules
      const typeRoots = tsConfig.compilerOptions.typeRoots.filter((dir: string) => !dir.includes('node_modules'));

      // Check these directories first, in the order they are specified in tsconfig.json
      for (const dir of typeRoots) {
        if (dirExists(dir)) {
          return path.join(dir, DEFAULT_FILENAME);
        }
      }
    }
  } catch (error) {
    console.error('Error reading or parsing tsconfig.json:', error);
  }

  // Check the default directories
  for (const dir of defaultTypeDirs) {
    if (dirExists(dir)) {
      return path.join(dir, DEFAULT_FILENAME);
    }
  }

  // If no existing directory is found, return the default file name
  return DEFAULT_FILENAME;
}

interface PromptObject {
  [promptSlug: string]: {
    [environment in LangtailEnvironment]?: {
      [version: string]: {}
    }
  }
}

interface GenerateTypesOptions {
  out: string;
}

const generateTypes = async ({ out }: GenerateTypesOptions) => {
  const outputFile = await prepareOutputFilePath(out, 'langtail.d.ts');
  if (!outputFile) {
    console.log('Operation cancelled by the user.');
    return;
  }

  const langtailPrompts = new LangtailPrompts({
    apiKey: getApiKey()
  });

  const deployments = await langtailPrompts.listDeployments();

  const promptObject: PromptObject = {};
  for (const deployment of deployments) {
    const { promptSlug, environment, version } = deployment;
    if (promptSlug && environment) {
      if (!promptObject[promptSlug]) {
        promptObject[promptSlug] = {};
      }
      if (!promptObject[promptSlug][environment]) {
        promptObject[promptSlug][environment] = {};
      }
      if (version) {
        promptObject[promptSlug][environment]![version] = {};
      }
    }
  }

  const fileInfo = '// ' + [
    'Langtail types file, generated with `langtail generate-types`',
    `Generated at: ${new Date().toISOString()}`,
    `Langtail SDK Version: ${SDK_VERSION}`,
    ``
  ].filter(Boolean).join('\n// ') + '\n';

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const fileString = fileInfo + template
    .replace(
      REPLACE_LINE,
      `type PromptsType = ${JSON.stringify(promptObject, null, 2)};`
    );

  fs.writeFileSync(outputFile, fileString, 'utf8');
  console.log(`Tools data generated at ${outputFile}`);
}

export default generateTypes