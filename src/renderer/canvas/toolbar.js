const Toolbar = {
  setWorkspaceName(name) {
    document.getElementById('toolbar-workspace-name').textContent = name;
  },

  updateZoom(zoom) {
    document.getElementById('zoom-indicator').textContent = `${Math.round(zoom * 100)}%`;
  },
};

document.getElementById('btn-back').addEventListener('click', () => App.backToGallery());
document.getElementById('zoom-indicator').addEventListener('click', () => Canvas.resetZoom());

document.getElementById('btn-add-text').addEventListener('click', () => {
  const vp = document.getElementById('canvas-viewport').getBoundingClientRect();
  const pos = Canvas.screenToCanvas(vp.left + vp.width / 2, vp.top + vp.height / 2);
  NodeText.create(pos.x - 120, pos.y - 60);
});

document.getElementById('btn-add-image').addEventListener('click', () => NodeImage.pickAndCreate());
document.getElementById('btn-add-html').addEventListener('click', () => NodeHtml.pickAndCreate());
document.getElementById('btn-add-url').addEventListener('click', () => NodeUrl.promptAndCreate());
