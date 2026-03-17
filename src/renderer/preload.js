const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  storage: {
    getPath: () => ipcRenderer.invoke('storage:get-path'),
    pickFolder: () => ipcRenderer.invoke('storage:pick-folder'),
    setPath: (p) => ipcRenderer.invoke('storage:set-path', p),
  },
  workspace: {
    list: () => ipcRenderer.invoke('workspace:list'),
    create: (name) => ipcRenderer.invoke('workspace:create', name),
    rename: (id, name) => ipcRenderer.invoke('workspace:rename', id, name),
    delete: (id) => ipcRenderer.invoke('workspace:delete', id),
    load: (id) => ipcRenderer.invoke('workspace:load', id),
    save: (data) => ipcRenderer.invoke('workspace:save', data),
    duplicate: (id) => ipcRenderer.invoke('workspace:duplicate', id),
    export: (id) => ipcRenderer.invoke('workspace:export', id),
    import: () => ipcRenderer.invoke('workspace:import'),
  },
  file: {
    saveImage: (workspaceId, buffer, ext) => ipcRenderer.invoke('file:save-image', workspaceId, buffer, ext),
    copyHtmlDir: (workspaceId, path) => ipcRenderer.invoke('file:copy-html-dir', workspaceId, path),
    pickImage: (workspaceId) => ipcRenderer.invoke('file:pick-image', workspaceId),
    pickHtml: () => ipcRenderer.invoke('file:pick-html'),
    copyAssetsBetween: (srcWs, dstWs, nodeType, dataNodeId, canvasNodeId) =>
      ipcRenderer.invoke('file:copy-assets-between', srcWs, dstWs, nodeType, dataNodeId, canvasNodeId),
    copySnapshotBetween: (srcWs, dstWs, srcNodeId, dstNodeId) =>
      ipcRenderer.invoke('file:copy-snapshot-between', srcWs, dstWs, srcNodeId, dstNodeId),
  },
  html: {
    saveSnapshots: (workspaceId, snapshotsMap) => ipcRenderer.invoke('html:save-snapshots', workspaceId, snapshotsMap),
    hasSnapshot: (workspaceId, nodeId) => ipcRenderer.invoke('html:has-snapshot', workspaceId, nodeId),
    deleteSnapshot: (workspaceId, nodeId) => ipcRenderer.invoke('html:delete-snapshot', workspaceId, nodeId),
  },
});
