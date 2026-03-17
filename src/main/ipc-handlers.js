const { ipcMain, dialog } = require('electron');
const { IPC } = require('../shared/constants');
const storage = require('./storage');
const fileManager = require('./file-manager');

function registerHandlers(mainWindow) {
  ipcMain.handle(IPC.STORAGE_GET_PATH, () => storage.getStoragePath());

  ipcMain.handle(IPC.STORAGE_PICK_FOLDER, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'ProtoGarden のデータ保存先を選択',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'このフォルダを使用',
    });
    if (result.canceled) return null;
    const folderPath = result.filePaths[0];
    storage.setStoragePath(folderPath);
    return folderPath;
  });

  ipcMain.handle(IPC.STORAGE_SET_PATH, (_, p) => {
    storage.setStoragePath(p);
  });

  ipcMain.handle(IPC.WORKSPACE_LIST, () => storage.listWorkspaces());
  ipcMain.handle(IPC.WORKSPACE_CREATE, (_, name) => storage.createWorkspace(name));
  ipcMain.handle(IPC.WORKSPACE_RENAME, (_, id, newName) => storage.renameWorkspace(id, newName));

  ipcMain.handle(IPC.WORKSPACE_DELETE, async (_, id) => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'ワークスペースの削除',
      message: 'このワークスペースを削除しますか？この操作は取り消せません。',
      buttons: ['削除', 'キャンセル'],
      defaultId: 1,
      cancelId: 1,
    });
    if (result.response === 0) {
      storage.deleteWorkspace(id);
      return true;
    }
    return false;
  });

  ipcMain.handle(IPC.WORKSPACE_LOAD, (_, id) => storage.loadWorkspace(id));
  ipcMain.handle(IPC.WORKSPACE_SAVE, (_, data) => storage.saveWorkspace(data));

  ipcMain.handle(IPC.WORKSPACE_DUPLICATE, (_, id) => storage.duplicateWorkspace(id));

  // Export workspace as .zip
  ipcMain.handle(IPC.WORKSPACE_EXPORT, async (_, id) => {
    const workspace = storage.loadWorkspace(id);
    const safeName = workspace.name.replace(/[^a-zA-Z0-9_\-\u3000-\u9fff\u4e00-\u9faf]/g, '_');
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'ワークスペースをエクスポート',
      defaultPath: `${safeName}.protogarden.zip`,
      filters: [{ name: 'ProtoGarden Archive', extensions: ['zip'] }],
    });
    if (result.canceled) return null;

    const archiver = require('archiver');
    const fs = require('fs');
    const path = require('path');
    const storagePath = storage.getStoragePath();

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(result.filePath);
      const archive = archiver('zip', { zlib: { level: 5 } });
      output.on('close', () => resolve(result.filePath));
      archive.on('error', (err) => reject(err));
      archive.pipe(output);

      // Add workspace JSON
      archive.append(JSON.stringify(workspace, null, 2), { name: 'workspace.json' });

      // Add assets directory
      const assetsDir = path.join(storagePath, 'assets', id);
      if (fs.existsSync(assetsDir)) {
        archive.directory(assetsDir, 'assets');
      }

      archive.finalize();
    });
  });

  // Import workspace from .zip
  ipcMain.handle(IPC.WORKSPACE_IMPORT, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'ワークスペースをインポート',
      filters: [{ name: 'ProtoGarden Archive', extensions: ['zip'] }],
      properties: ['openFile'],
    });
    if (result.canceled) return null;

    const AdmZip = require('adm-zip');
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    const storagePath = storage.getStoragePath();

    try {
      const zip = new AdmZip(result.filePaths[0]);
      const workspaceEntry = zip.getEntry('workspace.json');
      if (!workspaceEntry) throw new Error('Invalid archive: missing workspace.json');

      const workspaceData = JSON.parse(workspaceEntry.getData().toString('utf-8'));
      const newId = crypto.randomUUID();
      const oldId = workspaceData.id;

      // Check for name conflict
      const existing = storage.listWorkspaces();
      if (existing.some(w => w.name === workspaceData.name)) {
        workspaceData.name = `${workspaceData.name} (imported)`;
      }

      workspaceData.id = newId;
      const now = new Date().toISOString();
      workspaceData.updatedAt = now;

      // Save workspace JSON
      const filePath = path.join(storagePath, 'workspaces', `${newId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(workspaceData, null, 2));

      // Extract assets
      const assetsEntries = zip.getEntries().filter(e => e.entryName.startsWith('assets/'));
      if (assetsEntries.length > 0) {
        const destAssetsDir = path.join(storagePath, 'assets', newId);
        for (const entry of assetsEntries) {
          if (entry.isDirectory) continue;
          const relativePath = entry.entryName.replace(/^assets\//, '');
          const destPath = path.join(destAssetsDir, relativePath);
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.writeFileSync(destPath, entry.getData());
        }
      }

      return { id: newId, name: workspaceData.name };
    } catch (e) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'インポートエラー',
        message: `ファイルのインポートに失敗しました: ${e.message}`,
      });
      return null;
    }
  });

  ipcMain.handle(IPC.FILE_SAVE_IMAGE, (_, workspaceId, buffer, ext) => {
    return fileManager.saveImage(workspaceId, buffer, ext);
  });

  ipcMain.handle(IPC.FILE_COPY_HTML_DIR, (_, workspaceId, htmlFilePath) => {
    return fileManager.copyHtmlDir(workspaceId, htmlFilePath);
  });

  ipcMain.handle(IPC.FILE_PICK_IMAGE, async (_, workspaceId) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '画像を選択',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
      properties: ['openFile'],
    });
    if (result.canceled) return null;
    const filePath = result.filePaths[0];
    const ext = require('path').extname(filePath).slice(1).toLowerCase();
    const buffer = require('fs').readFileSync(filePath);
    return fileManager.saveImage(workspaceId, buffer, ext);
  });

  ipcMain.handle(IPC.FILE_PICK_HTML, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'HTMLファイルを選択',
      filters: [{ name: 'HTML', extensions: ['html', 'htm'] }],
      properties: ['openFile'],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });
  // === HTML Snapshot (DOM state preservation) ===

  // Snapshots are stored per canvas-node-id (not per asset-nodeId)
  // so duplicated nodes get independent snapshots
  ipcMain.handle(IPC.HTML_SAVE_SNAPSHOTS, async (_, workspaceId, snapshotsMap) => {
    const storagePath = storage.getStoragePath();
    if (!storagePath) return {};
    const snapshotDir = require('path').join(storagePath, 'assets', workspaceId, 'snapshots');
    if (!require('fs').existsSync(snapshotDir)) {
      require('fs').mkdirSync(snapshotDir, { recursive: true });
    }
    const results = {};
    for (const [canvasNodeId, html] of Object.entries(snapshotsMap)) {
      try {
        const snapshotPath = require('path').join(snapshotDir, `${canvasNodeId}.html`);
        require('fs').writeFileSync(snapshotPath, html, 'utf-8');
        results[canvasNodeId] = true;
      } catch (e) {
        results[canvasNodeId] = false;
      }
    }
    return results;
  });

  ipcMain.handle(IPC.HTML_HAS_SNAPSHOT, (_, workspaceId, canvasNodeId) => {
    const storagePath = storage.getStoragePath();
    if (!storagePath) return false;
    const snapshotPath = require('path').join(
      storagePath, 'assets', workspaceId, 'snapshots', `${canvasNodeId}.html`
    );
    return require('fs').existsSync(snapshotPath);
  });

  ipcMain.handle(IPC.HTML_DELETE_SNAPSHOT, (_, workspaceId, canvasNodeId) => {
    const storagePath = storage.getStoragePath();
    if (!storagePath) return;
    const snapshotPath = require('path').join(
      storagePath, 'assets', workspaceId, 'snapshots', `${canvasNodeId}.html`
    );
    try { require('fs').unlinkSync(snapshotPath); } catch {}
  });
}

module.exports = { registerHandlers };
