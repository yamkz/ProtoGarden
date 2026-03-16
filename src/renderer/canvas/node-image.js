const NodeImage = {
  async pickAndCreate() {
    const result = await window.api.file.pickImage(Canvas.workspace.id);
    if (!result) return;
    const vp = document.getElementById('canvas-viewport').getBoundingClientRect();
    const pos = Canvas.screenToCanvas(vp.left + vp.width / 2, vp.top + vp.height / 2);
    NodeBase.addNode('image', { fileName: result.fileName, nodeId: result.nodeId }, pos.x - 200, pos.y - 150, 400, 300);
  },

  async createFromBlob(blob) {
    const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    const buffer = await blob.arrayBuffer();
    const result = await window.api.file.saveImage(Canvas.workspace.id, Array.from(new Uint8Array(buffer)), ext);
    const vp = document.getElementById('canvas-viewport').getBoundingClientRect();
    const pos = Canvas.screenToCanvas(vp.left + vp.width / 2, vp.top + vp.height / 2);
    NodeBase.addNode('image', { fileName: result.fileName, nodeId: result.nodeId }, pos.x - 200, pos.y - 150, 400, 300);
  },

  async createFromDrop(file, dropX, dropY) {
    const ext = file.name.split('.').pop().toLowerCase();
    const buffer = await file.arrayBuffer();
    const result = await window.api.file.saveImage(Canvas.workspace.id, Array.from(new Uint8Array(buffer)), ext);
    const pos = Canvas.screenToCanvas(dropX, dropY);
    NodeBase.addNode('image', { fileName: result.fileName, nodeId: result.nodeId }, pos.x - 200, pos.y - 150, 400, 300);
  },

  render(node, contentEl) {
    const img = document.createElement('img');
    img.className = 'node-image';
    img.src = `proto-garden://${Canvas.workspace.id}/images/${node.data.fileName}`;
    img.draggable = false;
    contentEl.appendChild(img);
  },
};
