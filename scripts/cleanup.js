import fs from 'fs';
import path from 'path';

// Files to remove during cleanup
const filesToRemove = [
  'dist',
  'build', 
  '.next',
  '.turbo',
  '.vite',
  'node_modules/.vite',
  'node_modules/.cache',
  '*.tmp',
  '*.cache',
  '.DS_Store',
  'Thumbs.db'
];

function removeDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`Removed: ${dirPath}`);
  }
}

function removeFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Removed: ${filePath}`);
  }
}

console.log('🧹 Cleaning build artifacts...');

filesToRemove.forEach(item => {
  if (item.includes('*')) {
    // Handle glob patterns - simplified for common cases
    return;
  }
  
  const fullPath = path.resolve(item);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      removeDirectory(fullPath);
    } else {
      removeFile(fullPath);
    }
  }
});

console.log('✅ Cleanup complete!');