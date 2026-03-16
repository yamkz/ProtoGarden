const NodeUrl = {
  async promptAndCreate() {
    const url = await App.showPrompt('URLを追加', 'https://example.com', '追加');
    if (!url) return;
    let finalUrl = url;
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
    try { new URL(finalUrl); } catch { return; }

    const vp = document.getElementById('canvas-viewport').getBoundingClientRect();
    const pos = Canvas.screenToCanvas(vp.left + vp.width / 2, vp.top + vp.height / 2);
    NodeBase.addNode('url', { url: finalUrl }, pos.x - 300, pos.y - 200, 600, 400);
  },

  render(node, contentEl) {
    const iframe = document.createElement('iframe');
    iframe.className = 'node-iframe';
    iframe.src = node.data.url;
    contentEl.appendChild(iframe);
  },
};
