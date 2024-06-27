const fs = require('fs-extra');
const path = require('path');

const rootPath = process.cwd();
const movedFilesListPath = path.join(rootPath, '.build_files');

async function cleanMovedFiles() {
  if (!await fs.pathExists(movedFilesListPath)) {
    console.log('Nothing to clean.');
    return;
  }
  try {
    const movedFiles = await fs.readFile(movedFilesListPath, 'utf-8');
    const filesToClean = movedFiles.split('\n').filter(Boolean);

    for (const fileOrDir of filesToClean) {
      const filePath = path.join(rootPath, fileOrDir);
      await fs.remove(filePath);
    }

    // Remove the .build_files after cleaning
    await fs.remove(movedFilesListPath);
  } catch (error) {
    console.error('Failed to clean files:', error);
  }
}

cleanMovedFiles();
