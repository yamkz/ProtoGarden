const NodeHtml = {
  PC_PRESETS: [
    { label: '13" (1440×900)', width: 1440, height: 900 },
    { label: '14" (1512×982)', width: 1512, height: 982 },
    { label: '16" (1728×1117)', width: 1728, height: 1117 },
    { label: 'FHD (1920×1080)', width: 1920, height: 1080 },
  ],

  async pickAndCreate() {
    const htmlPath = await window.api.file.pickHtml();
    if (!htmlPath) return;
    const result = await window.api.file.copyHtmlDir(Canvas.workspace.id, htmlPath);
    const vp = document.getElementById('canvas-viewport').getBoundingClientRect();
    const pos = Canvas.screenToCanvas(vp.left + vp.width / 2, vp.top + vp.height / 2);
    NodeBase.addNode('html', {
      nodeId: result.nodeId,
      entryFile: result.entryFile,
    }, pos.x - 640, pos.y - 400, 1280, 800);
  },

  async render(node, contentEl) {
    const nodeEl = contentEl.closest('.canvas-node');
    // Use canvas node id for snapshot (independent per node, even if duplicated)
    const hasSnapshot = await window.api.html.hasSnapshot(Canvas.workspace.id, node.id);

    const iframe = document.createElement('iframe');
    iframe.className = 'node-iframe';

    if (hasSnapshot) {
      iframe.src = `proto-garden://${Canvas.workspace.id}/snapshots/${node.id}.html`;
      nodeEl.classList.add('has-snapshot');
    } else {
      iframe.src = `proto-garden://${Canvas.workspace.id}/html/${node.data.nodeId}/${node.data.entryFile}`;
    }

    contentEl.appendChild(iframe);
  },

  async reloadOriginal(nodeId) {
    const node = Canvas.workspace.nodes.find(n => n.id === nodeId);
    if (!node) return;
    await window.api.html.deleteSnapshot(Canvas.workspace.id, nodeId);
    const el = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`);
    if (!el) return;
    el.classList.remove('has-snapshot');
    const iframe = el.querySelector('.node-iframe');
    if (iframe) {
      iframe.src = `proto-garden://${Canvas.workspace.id}/html/${node.data.nodeId}/${node.data.entryFile}`;
    }
  },

  async saveAllSnapshots() {
    if (!Canvas.workspace) return;
    const htmlNodes = Canvas.workspace.nodes.filter(n => n.type === 'html');
    if (htmlNodes.length === 0) return;

    const snapshotsMap = {};
    const promises = [];

    for (const node of htmlNodes) {
      const el = document.querySelector(`.canvas-node[data-node-id="${node.id}"]`);
      if (!el || el.classList.contains('has-snapshot')) continue;
      const iframe = el.querySelector('.node-iframe');
      if (!iframe || !iframe.contentWindow) continue;

      const canvasNodeId = node.id;
      const p = new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(), 800);
        const handler = (e) => {
          if (e.data && e.data.type === 'proto-garden-dom' && e.source === iframe.contentWindow) {
            window.removeEventListener('message', handler);
            clearTimeout(timeout);
            snapshotsMap[canvasNodeId] = e.data.html;
            resolve();
          }
        };
        window.addEventListener('message', handler);
        iframe.contentWindow.postMessage({ type: 'proto-garden-get-dom' }, '*');
      });
      promises.push(p);
    }

    await Promise.all(promises);
    if (Object.keys(snapshotsMap).length > 0) {
      await window.api.html.saveSnapshots(Canvas.workspace.id, snapshotsMap);
    }
  },

  applySize(nodeId, width, height) {
    const node = Canvas.workspace.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.width = width;
    node.height = height;
    const el = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`);
    if (el) {
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
    }
    Canvas.scheduleSave();
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

    // Back button
    const backBtn = document.createElement('button');
    backBtn.className = 'node-nav-btn';
    backBtn.innerHTML = '&#9664;';
    backBtn.title = '戻る';
    backBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    backBtn.addEventListener('click', (e) => { e.stopPropagation(); this.navigateBack(node.id); });
    controls.appendChild(backBtn);

    // Forward button
    const fwdBtn = document.createElement('button');
    fwdBtn.className = 'node-nav-btn';
    fwdBtn.innerHTML = '&#9654;';
    fwdBtn.title = '進む';
    fwdBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    fwdBtn.addEventListener('click', (e) => { e.stopPropagation(); this.navigateForward(node.id); });
    controls.appendChild(fwdBtn);

    // Separator
    const sep1 = document.createElement('div');
    sep1.className = 'preset-separator';
    controls.appendChild(sep1);

    // Reload button
    const reloadBtn = document.createElement('button');
    reloadBtn.className = 'node-reload-btn';
    reloadBtn.textContent = '↻ Reload';
    reloadBtn.title = '元のHTMLを再読込';
    reloadBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    reloadBtn.addEventListener('click', (e) => { e.stopPropagation(); this.reloadOriginal(node.id); });
    controls.appendChild(reloadBtn);

    // Separator
    const sep2 = document.createElement('div');
    sep2.className = 'preset-separator';
    controls.appendChild(sep2);

    // Mobile
    const mobileBtn = document.createElement('button');
    mobileBtn.className = 'node-preset-btn';
    mobileBtn.textContent = 'Mobile';
    mobileBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    mobileBtn.addEventListener('click', (e) => { e.stopPropagation(); this.applySize(node.id, 375, 812); });
    controls.appendChild(mobileBtn);

    // Tablet
    const tabletBtn = document.createElement('button');
    tabletBtn.className = 'node-preset-btn';
    tabletBtn.textContent = 'Tablet';
    tabletBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    tabletBtn.addEventListener('click', (e) => { e.stopPropagation(); this.applySize(node.id, 768, 1024); });
    controls.appendChild(tabletBtn);

    // PC dropdown
    const pcWrap = document.createElement('div');
    pcWrap.className = 'node-preset-wrap';
    const pcBtn = document.createElement('button');
    pcBtn.className = 'node-preset-btn';
    pcBtn.textContent = 'PC ▾';
    pcBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    pcWrap.appendChild(pcBtn);

    const pcMenu = document.createElement('div');
    pcMenu.className = 'preset-submenu';
    this.PC_PRESETS.forEach(p => {
      const item = document.createElement('button');
      item.className = 'preset-submenu-item';
      item.textContent = p.label;
      item.addEventListener('mousedown', (e) => e.stopPropagation());
      item.addEventListener('click', (e) => { e.stopPropagation(); this.applySize(node.id, p.width, p.height); pcMenu.classList.remove('open'); });
      pcMenu.appendChild(item);
    });
    pcWrap.appendChild(pcMenu);
    pcBtn.addEventListener('click', (e) => { e.stopPropagation(); pcMenu.classList.toggle('open'); });
    document.addEventListener('mousedown', (e) => { if (!pcWrap.contains(e.target)) pcMenu.classList.remove('open'); });
    controls.appendChild(pcWrap);

    headerEl.insertBefore(controls, headerEl.querySelector('.node-delete'));
  },
};
