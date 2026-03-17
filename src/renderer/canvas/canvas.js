const Canvas = {
  workspace: null,
  panX: 0,
  panY: 0,
  zoom: 1,
  isPanning: false,
  spaceHeld: false,
  lastMouse: { x: 0, y: 0 },
  saveTimeout: null,
  clipboard: null,

  async load(id) {
    this.workspace = await window.api.workspace.load(id);
    this.panX = this.workspace.viewport.panX;
    this.panY = this.workspace.viewport.panY;
    this.zoom = this.workspace.viewport.zoom;
    this.updateTransform();
    Toolbar.setWorkspaceName(this.workspace.name);
    Toolbar.updateZoom(this.zoom);
    this.renderAllNodes();
    this.bindEvents();
  },

  async unload() {
    // Save DOM snapshots for HTML nodes before leaving
    try {
      if (typeof NodeHtml !== 'undefined') {
        await NodeHtml.saveAllSnapshots();
      }
    } catch (e) {
      console.error('[ProtoGarden] Snapshot save error:', e);
    }
    this.save();
    this.workspace = null;
    this.unbindEvents();
    document.getElementById('canvas-container').innerHTML = '';
    NodeBase.selectedNodeIds.clear();
    ActionHistory.clear();
  },

  renderAllNodes() {
    const container = document.getElementById('canvas-container');
    container.innerHTML = '';
    if (!this.workspace) return;
    this.workspace.nodes.forEach(node => this.renderNode(node));
  },

  renderNode(node) {
    const container = document.getElementById('canvas-container');
    const el = NodeBase.createNodeElement(node);
    const contentEl = el.querySelector('.node-content');

    switch (node.type) {
      case 'text': NodeText.render(node, contentEl); break;
      case 'image': NodeImage.render(node, contentEl); break;
      case 'html': if (typeof NodeHtml !== 'undefined') NodeHtml.render(node, contentEl); break;
      case 'url': if (typeof NodeUrl !== 'undefined') NodeUrl.render(node, contentEl); break;
      case 'note': if (typeof NodeNote !== 'undefined') NodeNote.render(node, contentEl); break;
    }

    container.appendChild(el);
  },

  updateTransform() {
    const container = document.getElementById('canvas-container');
    container.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  },

  screenToCanvas(sx, sy) {
    const vp = document.getElementById('canvas-viewport').getBoundingClientRect();
    return {
      x: (sx - vp.left - this.panX) / this.zoom,
      y: (sy - vp.top - this.panY) / this.zoom,
    };
  },

  scheduleSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.save(), 500);
  },

  save() {
    if (!this.workspace) return;
    this.workspace.viewport = { panX: this.panX, panY: this.panY, zoom: this.zoom };
    window.api.workspace.save(this.workspace);
  },

  // Copy/Paste/Duplicate
  copySelectedNode() {
    if (NodeBase.selectedNodeIds.size === 0) return;
    this.clipboard = [];
    NodeBase.selectedNodeIds.forEach(id => {
      const node = this.workspace.nodes.find(n => n.id === id);
      if (node) this.clipboard.push(JSON.parse(JSON.stringify(node)));
    });
  },

  pasteNode() {
    if (!this.clipboard || this.clipboard.length === 0) return;
    NodeBase.deselectAll();
    this.clipboard.forEach(orig => {
      const copy = JSON.parse(JSON.stringify(orig));
      copy.id = crypto.randomUUID();
      copy.x += 30;
      copy.y += 30;
      const maxZ = this.workspace.nodes.length > 0
        ? Math.max(...this.workspace.nodes.map(n => n.zIndex || 1)) : 0;
      copy.zIndex = maxZ + 1;
      this.workspace.nodes.push(copy);
      this.renderNode(copy);
      NodeBase.addToSelection(copy.id);
    });
    this.scheduleSave();
  },

  _handlers: {},

  bindEvents() {
    const vp = document.getElementById('canvas-viewport');

    // Marquee selection state
    let marquee = null;
    let marqueeStart = null;

    // Pan: space+click, middle-click. Marquee: left-click on empty canvas
    this._handlers.mousedown = (e) => {
      if (e.target.closest('.canvas-node') || e.target.closest('.node-context-menu') || e.target.closest('.text-style-popup')) return;

      if (e.button === 0 && !this.spaceHeld) {
        NodeBase.deselectAll();
        // Start marquee selection
        marqueeStart = { x: e.clientX, y: e.clientY };
      }

      if (e.button === 1 || (e.button === 0 && this.spaceHeld)) {
        this.isPanning = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
        vp.classList.add('panning');
        e.preventDefault();
      }
    };

    this._handlers.mousemove = (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.lastMouse.x;
        const dy = e.clientY - this.lastMouse.y;
        this.panX += dx;
        this.panY += dy;
        this.lastMouse = { x: e.clientX, y: e.clientY };
        this.updateTransform();
        return;
      }

      // Marquee drag
      if (marqueeStart && e.buttons === 1) {
        if (!marquee) {
          marquee = document.createElement('div');
          marquee.className = 'marquee-selection';
          document.body.appendChild(marquee);
        }
        const x = Math.min(marqueeStart.x, e.clientX);
        const y = Math.min(marqueeStart.y, e.clientY);
        const w = Math.abs(e.clientX - marqueeStart.x);
        const h = Math.abs(e.clientY - marqueeStart.y);
        marquee.style.left = `${x}px`;
        marquee.style.top = `${y}px`;
        marquee.style.width = `${w}px`;
        marquee.style.height = `${h}px`;
      }
    };

    this._handlers.mouseup = (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        vp.classList.remove('panning');
        this.scheduleSave();
      }

      // Finish marquee selection
      if (marquee && marqueeStart) {
        const mx1 = Math.min(marqueeStart.x, e.clientX);
        const my1 = Math.min(marqueeStart.y, e.clientY);
        const mx2 = Math.max(marqueeStart.x, e.clientX);
        const my2 = Math.max(marqueeStart.y, e.clientY);

        // Select nodes that intersect with marquee
        if (mx2 - mx1 > 5 || my2 - my1 > 5) {
          document.querySelectorAll('.canvas-node').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.left < mx2 && rect.right > mx1 && rect.top < my2 && rect.bottom > my1) {
              NodeBase.addToSelection(el.dataset.nodeId);
            }
          });
        }

        marquee.remove();
        marquee = null;
      }
      marqueeStart = null;
    };

    // Wheel: trackpad pan (2-finger scroll) + pinch zoom (ctrlKey)
    this._handlers.wheel = (e) => {
      if (App.currentView !== 'canvas') return;
      e.preventDefault();

      if (e.ctrlKey) {
        // Pinch zoom (trackpad sends ctrlKey + deltaY for pinch)
        const rect = vp.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const zoomFactor = 1 - e.deltaY * 0.01;
        const newZoom = Math.max(0.1, Math.min(5, this.zoom * zoomFactor));

        this.panX = mx - (mx - this.panX) * (newZoom / this.zoom);
        this.panY = my - (my - this.panY) * (newZoom / this.zoom);
        this.zoom = newZoom;

        Toolbar.updateZoom(this.zoom);
      } else {
        // Trackpad 2-finger scroll → pan
        this.panX -= e.deltaX;
        this.panY -= e.deltaY;
      }

      this.updateTransform();
      this.scheduleSave();
    };

    // Double-click to create text node
    this._handlers.dblclick = (e) => {
      if (e.target.closest('.canvas-node')) return;
      const pos = this.screenToCanvas(e.clientX, e.clientY);
      NodeText.create(pos.x, pos.y);
    };

    // Keyboard shortcuts
    this._handlers.keydown = (e) => {
      if (App.currentView !== 'canvas') return;
      // Don't intercept when typing in modal or editing text
      if (e.target.closest('.modal-input') || e.target.closest('input') || e.target.closest('textarea')) return;
      const isEditing = !!NodeBase.editingTextNodeId;

      if (e.code === 'Space' && !e.repeat) {
        this.spaceHeld = true;
        vp.classList.add('space-held');
        if (!isEditing) e.preventDefault();
      }

      // Delete selected nodes
      if ((e.key === 'Delete' || e.key === 'Backspace') && NodeBase.selectedNodeIds.size > 0 && !isEditing) {
        NodeBase.deleteSelected();
      }

      // Cmd+Z undo / Cmd+Shift+Z redo
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !isEditing) {
        e.preventDefault();
        if (e.shiftKey) {
          ActionHistory.redo();
        } else {
          ActionHistory.undo();
        }
      }

      // Cmd+C copy
      if (e.key === 'c' && (e.metaKey || e.ctrlKey) && !isEditing) {
        this.copySelectedNode();
      }

      // Cmd+D duplicate
      if (e.key === 'd' && (e.metaKey || e.ctrlKey) && !isEditing) {
        if (NodeBase.selectedNodeIds.size > 0) {
          e.preventDefault();
          NodeBase.duplicateSelected();
        }
      }
    };

    this._handlers.keyup = (e) => {
      if (e.code === 'Space') {
        this.spaceHeld = false;
        vp.classList.remove('space-held');
      }
    };

    // Paste: images from clipboard or node paste
    this._handlers.paste = async (e) => {
      if (App.currentView !== 'canvas') return;
      if (e.target.closest('.modal-input') || e.target.closest('input') || e.target.closest('textarea')) return;
      if (NodeBase.editingTextNodeId) return;

      const items = e.clipboardData?.items;
      if (items) {
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            const blob = item.getAsFile();
            if (blob) await NodeImage.createFromBlob(blob);
            return;
          }
        }
      }

      // No image in clipboard → paste copied nodes
      if (this.clipboard && this.clipboard.length > 0) {
        e.preventDefault();
        this.pasteNode();
      }
    };

    // Drag & drop images
    this._handlers.dragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    };

    this._handlers.drop = async (e) => {
      e.preventDefault();
      if (App.currentView !== 'canvas') return;
      const files = e.dataTransfer.files;
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          await NodeImage.createFromDrop(file, e.clientX, e.clientY);
        }
      }
    };

    vp.addEventListener('mousedown', this._handlers.mousedown);
    window.addEventListener('mousemove', this._handlers.mousemove);
    window.addEventListener('mouseup', this._handlers.mouseup);
    // Use window-level wheel to catch events over iframes too
    window.addEventListener('wheel', this._handlers.wheel, { passive: false });
    vp.addEventListener('dblclick', this._handlers.dblclick);
    window.addEventListener('keydown', this._handlers.keydown);
    window.addEventListener('keyup', this._handlers.keyup);
    document.addEventListener('paste', this._handlers.paste);
    vp.addEventListener('dragover', this._handlers.dragover);
    vp.addEventListener('drop', this._handlers.drop);
  },

  unbindEvents() {
    const vp = document.getElementById('canvas-viewport');
    if (this._handlers.mousedown) {
      vp.removeEventListener('mousedown', this._handlers.mousedown);
      window.removeEventListener('mousemove', this._handlers.mousemove);
      window.removeEventListener('mouseup', this._handlers.mouseup);
      window.removeEventListener('wheel', this._handlers.wheel);
      vp.removeEventListener('dblclick', this._handlers.dblclick);
      window.removeEventListener('keydown', this._handlers.keydown);
      window.removeEventListener('keyup', this._handlers.keyup);
      document.removeEventListener('paste', this._handlers.paste);
      vp.removeEventListener('dragover', this._handlers.dragover);
      vp.removeEventListener('drop', this._handlers.drop);
    }
    this._handlers = {};
  },

  resetZoom() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.updateTransform();
    Toolbar.updateZoom(this.zoom);
    this.scheduleSave();
  },
};
