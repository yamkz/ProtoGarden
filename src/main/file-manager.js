const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const storage = require('./storage');

function saveImage(workspaceId, buffer, ext) {
  const storagePath = storage.getStoragePath();
  const nodeId = crypto.randomUUID();
  const dir = path.join(storagePath, 'assets', workspaceId, 'images');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fileName = `${nodeId}.${ext}`;
  fs.writeFileSync(path.join(dir, fileName), Buffer.from(buffer));
  return { nodeId, fileName };
}

function copyHtmlDir(workspaceId, htmlFilePath) {
  const storagePath = storage.getStoragePath();
  const nodeId = crypto.randomUUID();
  const srcDir = path.dirname(htmlFilePath);
  const destDir = path.join(storagePath, 'assets', workspaceId, 'html', nodeId);
  fs.mkdirSync(destDir, { recursive: true });
  copyDirSync(srcDir, destDir);
  const entryFile = path.basename(htmlFilePath);
  return { nodeId, entryFile };
}

function copyDirSync(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyWorkspaceAssets(srcWorkspaceId, dstWorkspaceId) {
  const storagePath = storage.getStoragePath();
  const srcDir = path.join(storagePath, 'assets', srcWorkspaceId);
  const dstDir = path.join(storagePath, 'assets', dstWorkspaceId);
  if (fs.existsSync(srcDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
    copyDirSync(srcDir, dstDir);
  }
}

module.exports = { saveImage, copyHtmlDir, copyDirSync, copyWorkspaceAssets };
