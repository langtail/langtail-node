#!/usr/bin/env node
import 'dotenv-flow/config'
import { program } from 'commander';
import generateTools, { determineDefaultPath as determineDefaultPathTools } from './generateTools';
import generateTypes, { determineDefaultPath as determineDefaultPathTypes } from './generateTypes';
import SDK_VERSION from '../version'

function actionErrorHanlder(error: Error) {
  console.error(error.message);
}

export function actionRunner(fn: (...args) => Promise<any>) {
  // wrapper for handling errors
  // https://github.com/tj/commander.js/issues/782#issuecomment-430190791
  return (...args) => fn(...args).catch(actionErrorHanlder);
}

program
  .version(SDK_VERSION);

program
  .command('generate-types')
  .description('Generate types for your Langtail project')
  .option('--out [path]', 'output file path', determineDefaultPathTypes())
  .action(actionRunner(generateTypes));

program
  .command('generate-tools')
  .description('Generate tools based on Langtail prompts in your project')
  .option('--out [path]', 'output file path', determineDefaultPathTools())
  .action(actionRunner(generateTools));

program.parse(process.argv);