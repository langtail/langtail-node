const fs = require('fs-extra');
const path = require('path');

const rootPath = process.cwd();
const distPath = path.join(rootPath, 'dist');
const movedFilesListPath = path.join(rootPath, '.build_files');

async function moveDistContent() {
  try {
    // Ensure the .build_files is empty or does not exist
    await fs.ensureFile(movedFilesListPath);
    await fs.writeFile(movedFilesListPath, '');

    const filesAndDirs = await fs.readdir(distPath);

    for (const fileOrDir of filesAndDirs) {
      const sourcePath = path.join(distPath, fileOrDir);
      const targetPath = path.join(rootPath, fileOrDir);

      // Move files or directories
      await fs.move(sourcePath, targetPath, { overwrite: true });

      // Log the moved files or directories
      await fs.appendFile(movedFilesListPath, `${fileOrDir}\n`);
    }

    // Optionally remove the dist directory if empty
    await fs.rmdir(distPath);
  } catch (error) {
    console.error('Failed to move files:', error);
  }
}

moveDistContent();
