const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getStoragePath() {
  return readConfig().storagePath || null;
}

function setStoragePath(p) {
  const config = readConfig();
  config.storagePath = p;
  writeConfig(config);
  const workspacesDir = path.join(p, 'workspaces');
  const assetsDir = path.join(p, 'assets');
  if (!fs.existsSync(workspacesDir)) fs.mkdirSync(workspacesDir, { recursive: true });
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
}

function listWorkspaces() {
  const storagePath = getStoragePath();
  if (!storagePath) return [];
  const dir = path.join(storagePath, 'workspaces');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      return { id: data.id, name: data.name, createdAt: data.createdAt, updatedAt: data.updatedAt };
    } catch {
      return null;
    }
  }).filter(Boolean).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function createWorkspace(name) {
  const storagePath = getStoragePath();
  if (!storagePath) throw new Error('Storage path not set');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const workspace = {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    viewport: { panX: 0, panY: 0, zoom: 1 },
    nodes: [],
  };
  const filePath = path.join(storagePath, 'workspaces', `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(workspace, null, 2));
  return { id, name, createdAt: now, updatedAt: now };
}

function renameWorkspace(id, newName) {
  const storagePath = getStoragePath();
  const filePath = path.join(storagePath, 'workspaces', `${id}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  data.name = newName;
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return { id, name: newName };
}

function deleteWorkspace(id) {
  const storagePath = getStoragePath();
  const filePath = path.join(storagePath, 'workspaces', `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  const assetsDir = path.join(storagePath, 'assets', id);
  if (fs.existsSync(assetsDir)) fs.rmSync(assetsDir, { recursive: true, force: true });
}

function loadWorkspace(id) {
  const storagePath = getStoragePath();
  const filePath = path.join(storagePath, 'workspaces', `${id}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function saveWorkspace(data) {
  const storagePath = getStoragePath();
  const filePath = path.join(storagePath, 'workspaces', `${data.id}.json`);
  const tmpPath = filePath + '.tmp';
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, filePath);
}

function duplicateWorkspace(id) {
  const storagePath = getStoragePath();
  if (!storagePath) throw new Error('Storage path not set');
  const srcData = loadWorkspace(id);
  const newId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Remap node IDs
  const idMap = {};
  srcData.nodes.forEach(node => {
    const newNodeId = crypto.randomUUID();
    idMap[node.id] = newNodeId;
  });

  const newData = JSON.parse(JSON.stringify(srcData));
  newData.id = newId;
  newData.name = `${srcData.name} (copy)`;
  newData.createdAt = now;
  newData.updatedAt = now;
  newData.nodes.forEach(node => {
    const oldId = node.id;
    node.id = idMap[oldId] || crypto.randomUUID();
    // Update asset references (HTML nodeId, image nodeId)
    if (node.data && node.data.nodeId && idMap[node.data.nodeId]) {
      // Don't remap data.nodeId for assets - they reference the copied directory
    }
  });

  const filePath = path.join(storagePath, 'workspaces', `${newId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));

  // Copy assets
  const fileManager = require('./file-manager');
  fileManager.copyWorkspaceAssets(id, newId);

  return { id: newId, name: newData.name, createdAt: now, updatedAt: now };
}

module.exports = {
  getStoragePath,
  setStoragePath,
  listWorkspaces,
  createWorkspace,
  renameWorkspace,
  deleteWorkspace,
  loadWorkspace,
  saveWorkspace,
  duplicateWorkspace,
};
