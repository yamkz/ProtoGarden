const NodeHtml = {
  PC_PRESETS: [
    { label: '13" (1440×900)', width: 1440, height: 900 },
    { label: '14" (1512×982)', width: 1512, height: 982 },
    { label: '16" (1728×1117)', width: 1728, height: 1117 },
    { label: 'FHD (1920×1080)', width: 1920, height: 1080 },
  ],

  interactedNodes: new Set(), // kept for compatibility

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

    // Check if snapshot exists
    const hasSnapshot = await window.api.html.hasSnapshot(Canvas.workspace.id, node.data.nodeId);

    const iframe = document.createElement('iframe');
    iframe.className = 'node-iframe';

    if (hasSnapshot) {
      // Load snapshot (preserved state, not interactive)
      iframe.src = `proto-garden://${Canvas.workspace.id}/html/${node.data.nodeId}/_snapshot.html`;
      nodeEl.classList.add('has-snapshot');
    } else {
      // Load original (interactive)
      iframe.src = `proto-garden://${Canvas.workspace.id}/html/${node.data.nodeId}/${node.data.entryFile}`;
    }

    contentEl.appendChild(iframe);
  },

  async reloadOriginal(nodeId) {
    const node = Canvas.workspace.nodes.find(n => n.id === nodeId);
    if (!node) return;
    // Delete snapshot
    await window.api.html.deleteSnapshot(Canvas.workspace.id, node.data.nodeId);
    // Reload iframe with original
    const el = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`);
    if (!el) return;
    el.classList.remove('has-snapshot');
    const iframe = el.querySelector('.node-iframe');
    if (iframe) {
      iframe.src = `proto-garden://${Canvas.workspace.id}/html/${node.data.nodeId}/${node.data.entryFile}`;
    }
    this.interactedNodes.delete(node.data.nodeId);
  },

  // Save DOM snapshots for all live HTML nodes
  async saveAllSnapshots() {
    if (!Canvas.workspace) return;

    const htmlNodes = Canvas.workspace.nodes.filter(n => n.type === 'html');
    if (htmlNodes.length === 0) return;

    const snapshotsMap = {};
    const promises = [];

    for (const node of htmlNodes) {
      const el = document.querySelector(`.canvas-node[data-node-id="${node.id}"]`);
      if (!el || el.classList.contains('has-snapshot')) continue; // Skip snapshot-loaded nodes
      const iframe = el.querySelector('.node-iframe');
      if (!iframe || !iframe.contentWindow) continue;

      const dataNodeId = node.data.nodeId;
      const p = new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log('[ProtoGarden] Snapshot timeout for', dataNodeId);
          resolve();
        }, 3000);

        const handler = (e) => {
          if (e.data && e.data.type === 'proto-garden-dom' && e.source === iframe.contentWindow) {
            window.removeEventListener('message', handler);
            clearTimeout(timeout);
            snapshotsMap[dataNodeId] = e.data.html;
            resolve();
          }
        };
        window.addEventListener('message', handler);
        iframe.contentWindow.postMessage({ type: 'proto-garden-get-dom' }, '*');
      });
      promises.push(p);
    }

    await Promise.all(promises);
    console.log('[ProtoGarden] Snapshots captured:', Object.keys(snapshotsMap).length);

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

  renderHeaderExtras(node, headerEl) {
    const presets = document.createElement('div');
    presets.className = 'node-presets';

    // Reload button (prominent)
    const reloadBtn = document.createElement('button');
    reloadBtn.className = 'node-reload-btn';
    reloadBtn.textContent = '↻ Reload';
    reloadBtn.title = '元のHTMLを再読込（操作可能に戻す）';
    reloadBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    reloadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.reloadOriginal(node.id);
    });
    presets.appendChild(reloadBtn);

    // Separator
    const sep = document.createElement('div');
    sep.className = 'preset-separator';
    presets.appendChild(sep);

    // Mobile
    const mobileBtn = document.createElement('button');
    mobileBtn.className = 'node-preset-btn';
    mobileBtn.textContent = 'Mobile';
    mobileBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    mobileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.applySize(node.id, 375, 812);
    });
    presets.appendChild(mobileBtn);

    // Tablet
    const tabletBtn = document.createElement('button');
    tabletBtn.className = 'node-preset-btn';
    tabletBtn.textContent = 'Tablet';
    tabletBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    tabletBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.applySize(node.id, 768, 1024);
    });
    presets.appendChild(tabletBtn);

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
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.applySize(node.id, p.width, p.height);
        pcMenu.classList.remove('open');
      });
      pcMenu.appendChild(item);
    });
    pcWrap.appendChild(pcMenu);

    pcBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pcMenu.classList.toggle('open');
    });

    document.addEventListener('mousedown', (e) => {
      if (!pcWrap.contains(e.target)) pcMenu.classList.remove('open');
    });

    presets.appendChild(pcWrap);

    headerEl.insertBefore(presets, headerEl.querySelector('.node-delete'));
  },
};
