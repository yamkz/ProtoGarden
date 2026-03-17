const { app, BrowserWindow, protocol, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerHandlers } = require('./ipc-handlers');
const storage = require('./storage');

let mainWindow;
let isQuitting = false;

// Must register BEFORE app.ready
protocol.registerSchemesAsPrivileged([{
  scheme: 'proto-garden',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
  },
}]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'ProtoGarden',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, '..', 'renderer', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: false,
    },
    backgroundColor: '#0a0a0a',
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  registerHandlers(mainWindow);
}

function buildMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: '新規ワークスペース',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) mainWindow.webContents.executeJavaScript(
              'App.currentView === "gallery" && document.getElementById("btn-new-workspace").click()'
            );
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: '元に戻す',
          accelerator: 'CmdOrCtrl+Z',
          click: () => {
            if (mainWindow) mainWindow.webContents.executeJavaScript(
              'typeof ActionHistory !== "undefined" && ActionHistory.undo()'
            );
          },
        },
        {
          label: 'やり直す',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => {
            if (mainWindow) mainWindow.webContents.executeJavaScript(
              'typeof ActionHistory !== "undefined" && ActionHistory.redo()'
            );
          },
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'ズームリセット',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            if (mainWindow) mainWindow.webContents.executeJavaScript(
              'typeof Canvas !== "undefined" && Canvas.resetZoom()'
            );
          },
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const MIME_TYPES = {
  '.html': 'text/html', '.htm': 'text/html',
  '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

app.whenReady().then(() => {
  const SNAPSHOT_SCRIPT = `<script>window.addEventListener("message",function(e){if(e.data&&e.data.type==="proto-garden-get-dom"){var c=document.documentElement.cloneNode(true);c.querySelectorAll("script").forEach(function(s){s.remove()});window.parent.postMessage({type:"proto-garden-dom",html:"<!DOCTYPE html>"+c.outerHTML},"*")}});</script>`;

  protocol.handle('proto-garden', (request) => {
    const url = new URL(request.url);
    const storagePath = storage.getStoragePath();
    if (!storagePath) return new Response('Storage not configured', { status: 404 });

    const filePath = path.join(storagePath, 'assets', url.hostname, decodeURIComponent(url.pathname));

    try {
      let data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

      if ((ext === '.html' || ext === '.htm') && !filePath.includes('_snapshot.html')) {
        let html = data.toString('utf-8');
        if (html.includes('</body>')) {
          html = html.replace('</body>', SNAPSHOT_SCRIPT + '</body>');
        } else {
          html += SNAPSHOT_SCRIPT;
        }
        data = Buffer.from(html, 'utf-8');
      }

      return new Response(data, {
        headers: { 'Content-Type': mimeType },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Save snapshots before quitting
app.on('before-quit', (e) => {
  if (isQuitting) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    e.preventDefault();
    isQuitting = true;
    mainWindow.webContents.executeJavaScript(
      '(typeof NodeHtml !== "undefined" && typeof Canvas !== "undefined" && Canvas.workspace) ? NodeHtml.saveAllSnapshots() : Promise.resolve()'
    ).then(() => {
      mainWindow.destroy();
      app.exit(0);
    }).catch(() => {
      mainWindow.destroy();
      app.exit(0);
    });
  }
});
