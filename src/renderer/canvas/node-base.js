const NodeBase = {
  deleteHistory: [],
  MAX_UNDO: 10,
  selectedNodeIds: new Set(),
  editingTextNodeId: null,
  _contextMenu: null,
  _contextMenuCleanup: null,

  blockIframes() {
    let b = document.getElementById('iframe-blocker');
    if (!b) {
      b = document.createElement('div');
      b.id = 'iframe-blocker';
      b.style.cssText = 'position:fixed;inset:0;z-index:99998;cursor:inherit;display:none;';
      document.body.appendChild(b);
    }
    b.style.display = 'block';
  },
  unblockIframes() {
    const b = document.getElementById('iframe-blocker');
    if (b) b.style.display = 'none';
  },

  createNodeElement(node) {
    const el = document.createElement('div');
    el.className = `canvas-node canvas-node-${node.type}`;
    el.dataset.nodeId = node.id;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${node.width}px`;
    el.style.height = `${node.height}px`;
    el.style.zIndex = node.zIndex || 1;

    if (node.type === 'text') {
      el.style.color = node.data.color || '#e8e8e8';
      const content = document.createElement('div');
      content.className = 'node-content';
      el.appendChild(content);
    } else {
      const header = document.createElement('div');
      header.className = 'node-header';
      const label = document.createElement('span');
      label.className = 'node-label';
      label.textContent = this.getLabel(node);
      header.appendChild(label);

      if (node.type === 'html' && typeof NodeHtml !== 'undefined') {
        NodeHtml.renderHeaderExtras(node, header);
      }

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'node-delete';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); });
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteNode(node.id);
      });
      header.appendChild(deleteBtn);
      el.appendChild(header);

      const content = document.createElement('div');
      content.className = 'node-content';
      el.appendChild(content);
    }

    ['nw','ne','sw','se','n','s','e','w'].forEach(dir => {
      const h = document.createElement('div');
      h.className = `node-resize-handle handle-${dir}`;
      h.dataset.dir = dir;
      el.appendChild(h);
    });

    this.bindDrag(el, node);
    this.bindResize(el, node);
    this.bindSelect(el, node);
    this.bindContextMenu(el, node);
    return el;
  },

  getLabel(node) {
    if (node.type === 'image') return 'Image';
    if (node.type === 'html') return 'HTML';
    if (node.type === 'url') { try { return new URL(node.data.url).hostname; } catch { return 'URL'; } }
    return '';
  },

  // === SELECTION ===
  bindSelect(el, node) {
    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.node-resize-handle') || e.target.closest('.node-delete')) return;
      if (e.target.closest('.node-preset-btn') || e.target.closest('.preset-submenu-item') || e.target.closest('.preset-submenu')) return;
      this.selectNode(node.id);
    });

    if (node.type === 'text') {
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.enterTextEdit(node.id);
      });
    }
  },

  selectNode(id) {
    if (this.editingTextNodeId && this.editingTextNodeId !== id) {
      this.exitTextEdit();
    }
    // Clear previous single selection
    this.selectedNodeIds.forEach(sid => {
      const prev = document.querySelector(`.canvas-node[data-node-id="${sid}"]`);
      if (prev) prev.classList.remove('selected');
    });
    this.selectedNodeIds.clear();
    this.selectedNodeIds.add(id);
    const el = document.querySelector(`.canvas-node[data-node-id="${id}"]`);
    if (el) el.classList.add('selected');
  },

  addToSelection(id) {
    this.selectedNodeIds.add(id);
    const el = document.querySelector(`.canvas-node[data-node-id="${id}"]`);
    if (el) el.classList.add('selected');
  },

  deselectAll() {
    this.exitTextEdit();
    this.selectedNodeIds.forEach(id => {
      const prev = document.querySelector(`.canvas-node[data-node-id="${id}"]`);
      if (prev) prev.classList.remove('selected');
    });
    this.selectedNodeIds.clear();
  },

  getFirstSelectedId() {
    return this.selectedNodeIds.size > 0 ? this.selectedNodeIds.values().next().value : null;
  },

  // === TEXT EDIT ===
  enterTextEdit(nodeId) {
    this.editingTextNodeId = nodeId;
    const el = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`);
    if (!el) return;
    el.classList.add('editing');
    const editable = el.querySelector('.text-editable');
    if (editable) {
      editable.contentEditable = 'true';
      editable.focus();
      // Place cursor at end
      const range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  },

  exitTextEdit() {
    if (!this.editingTextNodeId) return;
    const el = document.querySelector(`.canvas-node[data-node-id="${this.editingTextNodeId}"]`);
    if (el) {
      el.classList.remove('editing');
      const editable = el.querySelector('.text-editable');
      if (editable) editable.contentEditable = 'false';
    }
    this.editingTextNodeId = null;
    window.getSelection()?.removeAllRanges();
  },

  // === DRAG ===
  bindDrag(el, node) {
    let startX, startY, startNodeX, startNodeY, dragReady = false, dragging = false;

    const startDrag = (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.node-delete') || e.target.closest('.node-resize-handle')) return;
      if (e.target.closest('.node-preset-btn') || e.target.closest('.preset-submenu-item') || e.target.closest('.preset-submenu')) return;
      if (e.target.closest('.node-iframe')) return;
      if (node.type === 'text' && this.editingTextNodeId === node.id) return;
      e.stopPropagation();
      // Don't start actual drag yet - wait for mousemove (to allow dblclick)
      dragReady = true;
      dragging = false;
      startX = e.clientX;
      startY = e.clientY;
      startNodeX = node.x;
      startNodeY = node.y;
    };

    const header = el.querySelector('.node-header');
    if (header) header.addEventListener('mousedown', startDrag);
    if (node.type === 'image' || node.type === 'text') {
      el.addEventListener('mousedown', startDrag);
    }

    window.addEventListener('mousemove', (e) => {
      if (!dragReady) return;
      // Only start actual drag after mouse moves > 3px (prevents blocking dblclick)
      if (!dragging) {
        const dist = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
        if (dist < 3) return;
        dragging = true;
        el.classList.add('dragging');
        this.blockIframes();
      }
      const dx = (e.clientX - startX) / Canvas.zoom;
      const dy = (e.clientY - startY) / Canvas.zoom;
      node.x = startNodeX + dx;
      node.y = startNodeY + dy;
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;
    });

    window.addEventListener('mouseup', () => {
      if (!dragReady) return;
      dragReady = false;
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      this.unblockIframes();
      Canvas.scheduleSave();
    });
  },

  // === RESIZE ===
  bindResize(el, node) {
    let startX, startY, startW, startH, startNX, startNY, dir, resizing = false;

    el.querySelectorAll('.node-resize-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        resizing = true;
        dir = handle.dataset.dir;
        startX = e.clientX;
        startY = e.clientY;
        startW = node.width;
        startH = node.height;
        startNX = node.x;
        startNY = node.y;
        el.classList.add('resizing');
        this.blockIframes();
      });
    });

    window.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const dx = (e.clientX - startX) / Canvas.zoom;
      const dy = (e.clientY - startY) / Canvas.zoom;
      const minW = 40, minH = 20;
      if (dir.includes('e')) node.width = Math.max(minW, startW + dx);
      if (dir.includes('s')) node.height = Math.max(minH, startH + dy);
      if (dir.includes('w')) { const nw = Math.max(minW, startW - dx); node.x = startNX + (startW - nw); node.width = nw; }
      if (dir.includes('n')) { const nh = Math.max(minH, startH - dy); node.y = startNY + (startH - nh); node.height = nh; }
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;
      el.style.width = `${node.width}px`;
      el.style.height = `${node.height}px`;
    });

    window.addEventListener('mouseup', () => {
      if (!resizing) return;
      resizing = false;
      el.classList.remove('resizing');
      this.unblockIframes();
      Canvas.scheduleSave();
    });
  },

  // === CONTEXT MENU ===
  bindContextMenu(el, node) {
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectNode(node.id);
      // Delay menu creation to avoid pointerdown conflict
      setTimeout(() => this.showContextMenu(e.clientX, e.clientY, node), 0);
    });
  },

  showContextMenu(x, y, node) {
    this.hideContextMenu();
    const menu = document.createElement('div');
    menu.className = 'node-context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const items = [
      { action: 'copy', label: 'コピー', shortcut: '⌘C' },
      { action: 'duplicate', label: '複製', shortcut: '⌘D' },
      { action: 'sep1', sep: true },
      { action: 'front', label: '最前面へ' },
      { action: 'back', label: '最背面へ' },
      { action: 'sep2', sep: true },
      { action: 'delete', label: '削除', danger: true },
    ];

    items.forEach(item => {
      if (item.sep) {
        const sep = document.createElement('div');
        sep.className = 'context-separator';
        menu.appendChild(sep);
        return;
      }
      const btn = document.createElement('button');
      btn.textContent = item.label;
      if (item.shortcut) {
        const span = document.createElement('span');
        span.className = 'shortcut';
        span.textContent = item.shortcut;
        btn.appendChild(span);
      }
      if (item.danger) btn.classList.add('danger');

      btn.addEventListener('click', () => {
        if (item.action === 'copy') Canvas.copySelectedNode();
        if (item.action === 'duplicate') Canvas.duplicateSelectedNode();
        if (item.action === 'front') {
          const maxZ = Math.max(...Canvas.workspace.nodes.map(n => n.zIndex || 1));
          node.zIndex = maxZ + 1;
          document.querySelector(`.canvas-node[data-node-id="${node.id}"]`).style.zIndex = node.zIndex;
          Canvas.scheduleSave();
        }
        if (item.action === 'back') {
          const minZ = Math.min(...Canvas.workspace.nodes.map(n => n.zIndex || 1));
          node.zIndex = minZ - 1;
          document.querySelector(`.canvas-node[data-node-id="${node.id}"]`).style.zIndex = node.zIndex;
          Canvas.scheduleSave();
        }
        if (item.action === 'delete') this.deleteNode(node.id);
        this.hideContextMenu();
      });
      menu.appendChild(btn);
    });

    if (node.type === 'text' && typeof NodeText !== 'undefined') {
      NodeText.renderContextMenuExtras(menu, node);
    }

    document.body.appendChild(menu);
    this._contextMenu = menu;

    // Close on click outside - use setTimeout to avoid catching the originating right-click
    this._contextMenuCleanup = (e) => {
      if (menu.parentNode && !menu.contains(e.target)) {
        this.hideContextMenu();
      }
    };
    setTimeout(() => {
      window.addEventListener('mousedown', this._contextMenuCleanup);
      window.addEventListener('contextmenu', this._contextMenuCleanup);
    }, 200);
  },

  hideContextMenu() {
    if (this._contextMenu && this._contextMenu.parentNode) {
      this._contextMenu.remove();
    }
    this._contextMenu = null;
    if (this._contextMenuCleanup) {
      window.removeEventListener('mousedown', this._contextMenuCleanup);
      window.removeEventListener('contextmenu', this._contextMenuCleanup);
      this._contextMenuCleanup = null;
    }
    document.querySelectorAll('.text-style-popup').forEach(m => m.remove());
  },

  // === DELETE / UNDO / ADD ===
  deleteNode(id) {
    const idx = Canvas.workspace.nodes.findIndex(n => n.id === id);
    if (idx === -1) return;
    const node = Canvas.workspace.nodes.splice(idx, 1)[0];
    this.deleteHistory.push(node);
    if (this.deleteHistory.length > this.MAX_UNDO) this.deleteHistory.shift();
    document.querySelector(`.canvas-node[data-node-id="${id}"]`)?.remove();
    this.selectedNodeIds.delete(id);
    if (this.editingTextNodeId === id) this.editingTextNodeId = null;
    Canvas.scheduleSave();
  },

  deleteSelected() {
    const ids = [...this.selectedNodeIds];
    ids.forEach(id => this.deleteNode(id));
  },

  undoDelete() {
    if (this.deleteHistory.length === 0) return;
    const node = this.deleteHistory.pop();
    Canvas.workspace.nodes.push(node);
    Canvas.renderNode(node);
    Canvas.scheduleSave();
  },

  duplicateSelected() {
    const ids = [...this.selectedNodeIds];
    const newIds = [];
    ids.forEach(id => {
      const node = Canvas.workspace.nodes.find(n => n.id === id);
      if (!node) return;
      const copy = JSON.parse(JSON.stringify(node));
      copy.id = crypto.randomUUID();
      copy.x += 30;
      copy.y += 30;
      const maxZ = Math.max(...Canvas.workspace.nodes.map(n => n.zIndex || 1));
      copy.zIndex = maxZ + 1;
      Canvas.workspace.nodes.push(copy);
      Canvas.renderNode(copy);
      newIds.push(copy.id);
    });
    // Select the new copies
    this.deselectAll();
    newIds.forEach(id => this.addToSelection(id));
    Canvas.scheduleSave();
  },

  addNode(type, data, x, y, width, height) {
    const id = crypto.randomUUID();
    const maxZ = Canvas.workspace.nodes.length > 0
      ? Math.max(...Canvas.workspace.nodes.map(n => n.zIndex || 1)) : 0;
    const node = { id, type, x, y, width, height, zIndex: maxZ + 1, data };
    Canvas.workspace.nodes.push(node);
    Canvas.renderNode(node);
    this.selectNode(id);
    Canvas.scheduleSave();
    return node;
  },

  showTextStyleUI(nodeId) {
    const node = Canvas.workspace.nodes.find(n => n.id === nodeId);
    if (!node || node.type !== 'text') return;
    const el = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`);
    if (!el) return;
    this.hideContextMenu();

    const rect = el.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'text-style-popup';
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${Math.max(8, rect.top - 50)}px`;

    NodeText.COLORS.forEach(c => {
      const swatch = document.createElement('button');
      swatch.className = 'color-swatch';
      swatch.style.background = c.value;
      if (node.data.color === c.value) swatch.classList.add('active');
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        node.data.color = c.value;
        el.style.color = c.value;
        Canvas.scheduleSave();
        popup.remove();
      });
      popup.appendChild(swatch);
    });

    const sep = document.createElement('div');
    sep.style.cssText = 'width:1px;height:20px;background:var(--border);margin:0 4px;';
    popup.appendChild(sep);

    NodeText.SIZES.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'size-btn';
      if ((node.data.fontSize || 21) === s.value) btn.classList.add('active');
      btn.textContent = s.label;
      btn.style.padding = '4px 8px';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        node.data.fontSize = s.value;
        el.style.setProperty('--text-font-size', `${s.value}px`);
        Canvas.scheduleSave();
        popup.remove();
      });
      popup.appendChild(btn);
    });

    document.body.appendChild(popup);
    setTimeout(() => {
      const hidePopup = (e) => {
        if (!popup.contains(e.target)) {
          popup.remove();
          window.removeEventListener('mousedown', hidePopup);
        }
      };
      window.addEventListener('mousedown', hidePopup);
    }, 200);
  },
};
