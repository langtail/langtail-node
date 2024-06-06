#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import generateTools from './generateTools';
import packageJson from "../../package.json";


function actionErrorHanlder(error: Error) {
  console.error(error.message);
}

export function actionRunner(fn: (...args) => Promise<any>) {
  // wrapper for handling errors
  // https://github.com/tj/commander.js/issues/782#issuecomment-430190791
  return (...args) => fn(...args).catch(actionErrorHanlder);
}

program
  .version(packageJson.version);

function determineDefaultPath() {
  return fs.existsSync(path.join(process.cwd(), 'src')) ? 'src/langtailTools.ts' : 'langtailTools.ts';
}

program
  .command('generate-tools')
  .description('Generate tools based on a Langtail prompt')
  .option('--out [path]', 'output file path', determineDefaultPath())
  .action(actionRunner(generateTools));

program.parse(process.argv);