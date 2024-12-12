import fs from 'fs';
import path from 'path';
import readline from 'readline';


export const getBaseUrl = (): string => {
  let baseUrl = process.env.LANGTAIL_BASE_URL;
  if (!baseUrl) {
    baseUrl = "https://api.langtail.com";
  }
  return baseUrl;
}


export const getApiKey = (): string => {
  const apiKey = process.env.LANGTAIL_API_KEY;
  if (!apiKey) {
    throw new Error('LANGTAIL_API_KEY environment variable is required');
  }
  return apiKey;
}

export const askUserToConfirm = (query: string): Promise<boolean> => {
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

export const prepareOutputFilePath = async (outputFile: string, filename: string): Promise<string | undefined> => {
  let resultFilePath = outputFile;
  if (fs.existsSync(resultFilePath) && fs.statSync(resultFilePath).isDirectory()) {
    resultFilePath = path.join(resultFilePath, filename);
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

export const dirExists = (dir: string): boolean => {
  try {
    const stats = fs.statSync(dir);
    return stats.isDirectory();
  } catch (e) {
    return false;
  }
}
