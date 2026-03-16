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

  ipcMain.handle(IPC.HTML_SAVE_SNAPSHOTS, async (_, workspaceId, snapshotsMap) => {
    const storagePath = storage.getStoragePath();
    console.log('[ProtoGarden] Saving snapshots. Storage:', storagePath, 'Workspace:', workspaceId, 'Nodes:', Object.keys(snapshotsMap));
    if (!storagePath) return {};
    const results = {};
    for (const [nodeId, html] of Object.entries(snapshotsMap)) {
      try {
        const snapshotDir = require('path').join(storagePath, 'assets', workspaceId, 'html', nodeId);
        if (!require('fs').existsSync(snapshotDir)) {
          require('fs').mkdirSync(snapshotDir, { recursive: true });
        }
        const snapshotPath = require('path').join(snapshotDir, '_snapshot.html');
        require('fs').writeFileSync(snapshotPath, html, 'utf-8');
        console.log('[ProtoGarden] Snapshot saved:', snapshotPath, 'Size:', html.length);
        results[nodeId] = true;
      } catch (e) {
        console.error('[ProtoGarden] Snapshot save error:', e.message);
        results[nodeId] = false;
      }
    }
    return results;
  });

  ipcMain.handle(IPC.HTML_HAS_SNAPSHOT, (_, workspaceId, nodeId) => {
    const storagePath = storage.getStoragePath();
    if (!storagePath) return false;
    const snapshotPath = require('path').join(
      storagePath, 'assets', workspaceId, 'html', nodeId, '_snapshot.html'
    );
    return require('fs').existsSync(snapshotPath);
  });

  ipcMain.handle(IPC.HTML_DELETE_SNAPSHOT, (_, workspaceId, nodeId) => {
    const storagePath = storage.getStoragePath();
    if (!storagePath) return;
    const snapshotPath = require('path').join(
      storagePath, 'assets', workspaceId, 'html', nodeId, '_snapshot.html'
    );
    try { require('fs').unlinkSync(snapshotPath); } catch {}
  });
}

module.exports = { registerHandlers };
