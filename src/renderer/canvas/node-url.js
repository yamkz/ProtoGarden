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

  navigateBack(nodeId) {
    const el = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`);
    const iframe = el?.querySelector('.node-iframe');
    if (iframe) try { iframe.contentWindow.history.back(); } catch {}
  },

  navigateForward(nodeId) {
    const el = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`);
    const iframe = el?.querySelector('.node-iframe');
    if (iframe) try { iframe.contentWindow.history.forward(); } catch {}
  },

  renderHeaderExtras(node, headerEl) {
    const controls = document.createElement('div');
    controls.className = 'node-presets';

    const backBtn = document.createElement('button');
    backBtn.className = 'node-nav-btn';
    backBtn.innerHTML = '&#9664;';
    backBtn.title = '戻る';
    backBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    backBtn.addEventListener('click', (e) => { e.stopPropagation(); this.navigateBack(node.id); });
    controls.appendChild(backBtn);

    const fwdBtn = document.createElement('button');
    fwdBtn.className = 'node-nav-btn';
    fwdBtn.innerHTML = '&#9654;';
    fwdBtn.title = '進む';
    fwdBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    fwdBtn.addEventListener('click', (e) => { e.stopPropagation(); this.navigateForward(node.id); });
    controls.appendChild(fwdBtn);

    headerEl.insertBefore(controls, headerEl.querySelector('.node-delete'));
  },
};
