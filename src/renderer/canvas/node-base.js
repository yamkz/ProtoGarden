const NodeBase = {
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

    if (node.type === 'group') {
      const content = document.createElement('div');
      content.className = 'node-content';
      el.appendChild(content);
    } else if (node.type === 'text') {
      el.style.color = node.data.color || '#e8e8e8';
      const content = document.createElement('div');
      content.className = 'node-content';
      el.appendChild(content);
    } else if (node.type === 'note') {
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
      if (node.type === 'url' && typeof NodeUrl !== 'undefined') {
        NodeUrl.renderHeaderExtras(node, header);
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

    // Connection ports (top, bottom, left, right)
    ['top', 'bottom', 'left', 'right'].forEach(port => {
      const dot = document.createElement('div');
      dot.className = `connection-port connection-port-${port}`;
      dot.dataset.port = port;
      dot.dataset.nodeId = node.id;
      el.appendChild(dot);
    });

    // Lock indicator
    if (node.locked) {
      el.classList.add('locked');
      const lockIcon = document.createElement('div');
      lockIcon.className = 'node-lock-icon';
      lockIcon.textContent = '\u{1F512}';
      el.appendChild(lockIcon);
    }

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
    if (node.type === 'note') return node.data.mode || 'Note';
    if (node.type === 'group') return 'Group';
    return '';
  },

  // === SELECTION ===
  bindSelect(el, node) {
    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.node-resize-handle') || e.target.closest('.node-delete') || e.target.closest('.connection-port')) return;
      if (e.target.closest('.node-preset-btn') || e.target.closest('.preset-submenu-item') || e.target.closest('.preset-submenu')) return;

      // If node is in a group and not in group edit mode, select the group instead
      if (node.groupId && Canvas.editingGroupId !== node.groupId) {
        if (e.shiftKey) {
          if (this.selectedNodeIds.has(node.groupId)) {
            this.selectedNodeIds.delete(node.groupId);
            const gel = document.querySelector(`.canvas-node[data-node-id="${node.groupId}"]`);
            if (gel) gel.classList.remove('selected');
          } else {
            this.addToSelection(node.groupId);
          }
        } else {
          if (this.selectedNodeIds.has(node.groupId) && this.selectedNodeIds.size > 1) return;
          this.selectNode(node.groupId);
        }
        return;
      }

      if (e.shiftKey) {
        if (this.selectedNodeIds.has(node.id)) {
          this.selectedNodeIds.delete(node.id);
          el.classList.remove('selected');
        } else {
          this.addToSelection(node.id);
        }
        return;
      }
      if (this.selectedNodeIds.has(node.id) && this.selectedNodeIds.size > 1) return;
      this.selectNode(node.id);
    });

    if (node.type === 'text') {
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.enterTextEdit(node.id);
      });
    }

    // Double-click group to enter group edit mode
    if (node.type === 'group') {
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        Canvas.editingGroupId = node.id;
        el.classList.add('group-editing');
        // Add overlay to non-group nodes
        document.querySelectorAll('.canvas-node').forEach(nel => {
          const nid = nel.dataset.nodeId;
          const n = Canvas.workspace.nodes.find(nd => nd.id === nid);
          if (n && n.groupId !== node.id && nid !== node.id) {
            nel.classList.add('group-dimmed');
          }
        });
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
    const nodeData = Canvas.workspace.nodes.find(n => n.id === nodeId);
    if (nodeData && nodeData.locked) return;
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
    let dragStartPositions = null;

    const startDrag = (e) => {
      if (e.button !== 0) return;
      if (node.locked) return;
      if (e.target.closest('.node-delete') || e.target.closest('.node-resize-handle') || e.target.closest('.connection-port')) return;
      if (e.target.closest('.node-preset-btn') || e.target.closest('.preset-submenu-item') || e.target.closest('.preset-submenu')) return;
      if (e.target.closest('.node-iframe')) return;
      if (e.target.closest('.note-textarea') || e.target.closest('.note-mode-btn') || e.target.closest('.note-model-btn') || e.target.closest('.note-run-btn')) return;
      if (node.type === 'text' && this.editingTextNodeId === node.id) return;

      // If this node is in a group and not in group edit mode, let the group handle drag
      if (node.groupId && Canvas.editingGroupId !== node.groupId) {
        // Don't start drag on child — the group's selection already happened via bindSelect.
        // We need to initiate drag from the group's perspective.
        const groupNode = Canvas.workspace.nodes.find(n => n.id === node.groupId);
        if (groupNode && groupNode.locked) return;
        e.stopPropagation();
        dragReady = true;
        dragging = false;
        startX = e.clientX;
        startY = e.clientY;
        // Use group node position as the reference
        startNodeX = groupNode ? groupNode.x : node.x;
        startNodeY = groupNode ? groupNode.y : node.y;
        dragStartPositions = collectDragNodes([node.groupId]);
        return;
      }

      e.stopPropagation();
      dragReady = true;
      dragging = false;
      startX = e.clientX;
      startY = e.clientY;
      startNodeX = node.x;
      startNodeY = node.y;

      if (this.selectedNodeIds.has(node.id) && this.selectedNodeIds.size > 1) {
        dragStartPositions = collectDragNodes([...this.selectedNodeIds]);
      } else {
        dragStartPositions = collectDragNodes([node.id]);
      }
    };

    // Collect drag nodes including group children
    const collectDragNodes = (nodeIds) => {
      const positions = [];
      const seen = new Set();
      nodeIds.forEach(id => {
        if (seen.has(id)) return;
        seen.add(id);
        const n = Canvas.workspace.nodes.find(nd => nd.id === id);
        if (n) {
          positions.push({ id: n.id, x: n.x, y: n.y });
          if (n.type === 'group' && n.data.childIds) {
            n.data.childIds.forEach(cid => {
              if (seen.has(cid)) return;
              seen.add(cid);
              const cn = Canvas.workspace.nodes.find(nd => nd.id === cid);
              if (cn) positions.push({ id: cn.id, x: cn.x, y: cn.y });
            });
          }
        }
      });
      return positions;
    };

    const header = el.querySelector('.node-header');
    if (header) header.addEventListener('mousedown', startDrag);
    if (node.type === 'image' || node.type === 'text' || node.type === 'note' || node.type === 'group') {
      el.addEventListener('mousedown', startDrag);
    }

    window.addEventListener('mousemove', (e) => {
      if (!dragReady) return;
      if (!dragging) {
        const dist = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
        if (dist < 3) return;
        dragging = true;
        el.classList.add('dragging');
        this.blockIframes();
      }
      const dx = (e.clientX - startX) / Canvas.zoom;
      const dy = (e.clientY - startY) / Canvas.zoom;

      // Multi-select drag or group drag: move all collected nodes
      const isMulti = dragStartPositions && dragStartPositions.length > 1;
      if (isMulti) {
        // Compute bounding box of all dragged nodes
        let bx1 = Infinity, by1 = Infinity, bx2 = -Infinity, by2 = -Infinity;
        dragStartPositions.forEach(sp => {
          const n = Canvas.workspace.nodes.find(nd => nd.id === sp.id);
          if (!n) return;
          bx1 = Math.min(bx1, sp.x + dx);
          by1 = Math.min(by1, sp.y + dy);
          bx2 = Math.max(bx2, sp.x + dx + n.width);
          by2 = Math.max(by2, sp.y + dy + n.height);
        });
        const excludeIds = dragStartPositions.map(sp => sp.id);
        const snap = SmartGuide.calculate({ x: bx1, y: by1, width: bx2 - bx1, height: by2 - by1 }, excludeIds);
        const sdx = snap.snapX || 0;
        const sdy = snap.snapY || 0;
        if (snap.guides.length > 0) SmartGuide.showGuides(snap.guides);
        else SmartGuide.clearGuides();

        dragStartPositions.forEach(sp => {
          const n = Canvas.workspace.nodes.find(nd => nd.id === sp.id);
          if (!n) return;
          n.x = sp.x + dx + sdx;
          n.y = sp.y + dy + sdy;
          const nel = document.querySelector(`.canvas-node[data-node-id="${sp.id}"]`);
          if (nel) {
            nel.style.left = `${n.x}px`;
            nel.style.top = `${n.y}px`;
          }
        });
      } else {
        const rawX = startNodeX + dx;
        const rawY = startNodeY + dy;
        const snap = SmartGuide.calculate({ x: rawX, y: rawY, width: node.width, height: node.height }, [node.id]);
        node.x = rawX + (snap.snapX || 0);
        node.y = rawY + (snap.snapY || 0);
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
        if (snap.guides.length > 0) SmartGuide.showGuides(snap.guides);
        else SmartGuide.clearGuides();
      }
      // Update connections during drag
      if (typeof ConnectionManager !== 'undefined') ConnectionManager.renderAll();
    });

    window.addEventListener('mouseup', () => {
      if (!dragReady) return;
      dragReady = false;
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      this.unblockIframes();
      SmartGuide.clearGuides();

      // Record move action for undo
      if (dragStartPositions) {
        const afterPositions = dragStartPositions.map(sp => {
          const n = Canvas.workspace.nodes.find(nd => nd.id === sp.id);
          return { id: sp.id, x: n ? n.x : sp.x, y: n ? n.y : sp.y };
        });
        const moved = dragStartPositions.some((sp, i) => sp.x !== afterPositions[i].x || sp.y !== afterPositions[i].y);
        if (moved) {
          ActionHistory.push({
            type: 'node-move',
            before: dragStartPositions,
            after: afterPositions,
          });
        }
      }
      dragStartPositions = null;
      Canvas.scheduleSave();
    });
  },

  // === RESIZE ===
  bindResize(el, node) {
    let startX, startY, startW, startH, startNX, startNY, dir, resizing = false;
    let resizeStartBounds = null;
    let multiResizeInfo = null; // { bbox, nodes: [{ id, x, y, w, h }] }

    el.querySelectorAll('.node-resize-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (node.locked) return;
        resizing = true;
        dir = handle.dataset.dir;
        startX = e.clientX;
        startY = e.clientY;
        startW = node.width;
        startH = node.height;
        startNX = node.x;
        startNY = node.y;

        // Group resize: collect children for proportional scaling
        if (node.type === 'group' && node.data.childIds) {
          const entries = [{ id: node.id, x: node.x, y: node.y, w: node.width, h: node.height }];
          node.data.childIds.forEach(cid => {
            const cn = Canvas.workspace.nodes.find(nd => nd.id === cid);
            if (cn) entries.push({ id: cn.id, x: cn.x, y: cn.y, w: cn.width, h: cn.height });
          });
          const bx1 = node.x, by1 = node.y;
          const bx2 = node.x + node.width, by2 = node.y + node.height;
          multiResizeInfo = {
            bbox: { x: bx1, y: by1, w: bx2 - bx1, h: by2 - by1 },
            nodes: entries,
          };
          resizeStartBounds = entries.map(e => ({ id: e.id, x: e.x, y: e.y, width: e.w, height: e.h }));
        }
        // Multi-select resize
        else if (this.selectedNodeIds.has(node.id) && this.selectedNodeIds.size > 1) {
          const entries = [];
          let bx1 = Infinity, by1 = Infinity, bx2 = -Infinity, by2 = -Infinity;
          this.selectedNodeIds.forEach(id => {
            const n = Canvas.workspace.nodes.find(nd => nd.id === id);
            if (!n) return;
            entries.push({ id: n.id, x: n.x, y: n.y, w: n.width, h: n.height });
            bx1 = Math.min(bx1, n.x);
            by1 = Math.min(by1, n.y);
            bx2 = Math.max(bx2, n.x + n.width);
            by2 = Math.max(by2, n.y + n.height);
          });
          multiResizeInfo = {
            bbox: { x: bx1, y: by1, w: bx2 - bx1, h: by2 - by1 },
            nodes: entries,
          };
          resizeStartBounds = entries.map(e => ({ id: e.id, x: e.x, y: e.y, width: e.w, height: e.h }));
        } else {
          multiResizeInfo = null;
          resizeStartBounds = [{ id: node.id, x: node.x, y: node.y, width: node.width, height: node.height }];
        }

        el.classList.add('resizing');
        this.blockIframes();
      });
    });

    window.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const dx = (e.clientX - startX) / Canvas.zoom;
      const dy = (e.clientY - startY) / Canvas.zoom;
      const minW = 40, minH = 20;

      if (multiResizeInfo) {
        // Proportional multi-resize based on bounding box
        const bb = multiResizeInfo.bbox;
        let newBBw = bb.w, newBBh = bb.h, newBBx = bb.x, newBBy = bb.y;
        if (dir.includes('e')) newBBw = Math.max(minW, bb.w + dx);
        if (dir.includes('s')) newBBh = Math.max(minH, bb.h + dy);
        if (dir.includes('w')) { const nw = Math.max(minW, bb.w - dx); newBBx = bb.x + (bb.w - nw); newBBw = nw; }
        if (dir.includes('n')) { const nh = Math.max(minH, bb.h - dy); newBBy = bb.y + (bb.h - nh); newBBh = nh; }
        const sx = newBBw / bb.w;
        const sy = newBBh / bb.h;
        multiResizeInfo.nodes.forEach(entry => {
          const n = Canvas.workspace.nodes.find(nd => nd.id === entry.id);
          if (!n) return;
          n.x = newBBx + (entry.x - bb.x) * sx;
          n.y = newBBy + (entry.y - bb.y) * sy;
          n.width = Math.max(minW, entry.w * sx);
          n.height = Math.max(minH, entry.h * sy);
          const nel = document.querySelector(`.canvas-node[data-node-id="${entry.id}"]`);
          if (nel) {
            nel.style.left = `${n.x}px`;
            nel.style.top = `${n.y}px`;
            nel.style.width = `${n.width}px`;
            nel.style.height = `${n.height}px`;
          }
        });
      } else {
        // Single node resize with snap
        let rawX = startNX, rawY = startNY, rawW = startW, rawH = startH;
        if (dir.includes('e')) rawW = Math.max(minW, startW + dx);
        if (dir.includes('s')) rawH = Math.max(minH, startH + dy);
        if (dir.includes('w')) { const nw = Math.max(minW, startW - dx); rawX = startNX + (startW - nw); rawW = nw; }
        if (dir.includes('n')) { const nh = Math.max(minH, startH - dy); rawY = startNY + (startH - nh); rawH = nh; }

        const snap = SmartGuide.calculate({ x: rawX, y: rawY, width: rawW, height: rawH }, [node.id]);
        // Apply snap only to the edges being resized
        if (snap.snapX !== null) {
          if (dir.includes('e')) rawW += snap.snapX;
          else if (dir.includes('w')) { rawX += snap.snapX; rawW -= snap.snapX; }
        }
        if (snap.snapY !== null) {
          if (dir.includes('s')) rawH += snap.snapY;
          else if (dir.includes('n')) { rawY += snap.snapY; rawH -= snap.snapY; }
        }
        node.x = rawX; node.y = rawY; node.width = rawW; node.height = rawH;
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
        el.style.width = `${node.width}px`;
        el.style.height = `${node.height}px`;
        if (snap.guides.length > 0) SmartGuide.showGuides(snap.guides);
        else SmartGuide.clearGuides();
      }
    });

    window.addEventListener('mouseup', () => {
      if (!resizing) return;
      resizing = false;
      el.classList.remove('resizing');
      this.unblockIframes();
      SmartGuide.clearGuides();
      if (resizeStartBounds) {
        const afterBounds = resizeStartBounds.map(sb => {
          const n = Canvas.workspace.nodes.find(nd => nd.id === sb.id);
          return n ? { id: n.id, x: n.x, y: n.y, width: n.width, height: n.height } : sb;
        });
        const changed = resizeStartBounds.some((sb, i) =>
          sb.width !== afterBounds[i].width || sb.height !== afterBounds[i].height ||
          sb.x !== afterBounds[i].x || sb.y !== afterBounds[i].y
        );
        if (changed) {
          ActionHistory.push({
            type: 'node-resize',
            before: resizeStartBounds,
            after: afterBounds,
          });
        }
        resizeStartBounds = null;
      }
      multiResizeInfo = null;
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

    const isLocked = !!node.locked;
    const items = [
      { action: 'copy', label: 'コピー', shortcut: '⌘C' },
      { action: 'duplicate', label: '複製', shortcut: '⌘D' },
      { action: 'sep1', sep: true },
      { action: 'lock', label: isLocked ? 'アンロック' : 'ロック', shortcut: '⌘L' },
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
        if (item.action === 'duplicate') NodeBase.duplicateSelected();
        if (item.action === 'lock') this.toggleLock(node.id);
        if (item.action === 'front') {
          const oldZ = node.zIndex || 1;
          const maxZ = Math.max(...Canvas.workspace.nodes.map(n => n.zIndex || 1));
          node.zIndex = maxZ + 1;
          ActionHistory.push({ type: 'node-zindex', nodeId: node.id, before: oldZ, after: node.zIndex });
          document.querySelector(`.canvas-node[data-node-id="${node.id}"]`).style.zIndex = node.zIndex;
          Canvas.scheduleSave();
        }
        if (item.action === 'back') {
          const oldZ = node.zIndex || 1;
          const minZ = Math.min(...Canvas.workspace.nodes.map(n => n.zIndex || 1));
          node.zIndex = minZ - 1;
          ActionHistory.push({ type: 'node-zindex', nodeId: node.id, before: oldZ, after: node.zIndex });
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
  deleteNode(id, skipHistory = false) {
    const idx = Canvas.workspace.nodes.findIndex(n => n.id === id);
    if (idx === -1) return;
    if (Canvas.workspace.nodes[idx].locked) return;
    // Group deletion: delete children too
    if (Canvas.workspace.nodes[idx].type === 'group' && !skipHistory) {
      if (typeof NodeGroup !== 'undefined') {
        NodeGroup.deleteGroup(id);
        return;
      }
    }
    const node = Canvas.workspace.nodes.splice(idx, 1)[0];
    if (!skipHistory) {
      ActionHistory.push({ type: 'node-delete', node: JSON.parse(JSON.stringify(node)) });
    }
    // Remove related connections
    if (typeof ConnectionManager !== 'undefined') {
      ConnectionManager.deleteConnectionsForNode(id);
    }
    document.querySelector(`.canvas-node[data-node-id="${id}"]`)?.remove();
    this.selectedNodeIds.delete(id);
    if (this.editingTextNodeId === id) this.editingTextNodeId = null;
    Canvas.scheduleSave();
  },

  deleteSelected() {
    const ids = [...this.selectedNodeIds];
    if (ids.length > 1) {
      const nodes = ids.map(id => {
        const node = Canvas.workspace.nodes.find(n => n.id === id);
        return node ? JSON.parse(JSON.stringify(node)) : null;
      }).filter(Boolean);
      ActionHistory.push({ type: 'multi-node-delete', nodes });
      ids.forEach(id => this.deleteNode(id, true));
    } else {
      ids.forEach(id => this.deleteNode(id));
    }
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
      ActionHistory.push({ type: 'node-add', node: JSON.parse(JSON.stringify(copy)) });
      newIds.push(copy.id);
    });
    this.deselectAll();
    newIds.forEach(id => this.addToSelection(id));
    Canvas.scheduleSave();
  },

  addNode(type, data, x, y, width, height, skipHistory = false) {
    const id = crypto.randomUUID();
    const maxZ = Canvas.workspace.nodes.length > 0
      ? Math.max(...Canvas.workspace.nodes.map(n => n.zIndex || 1)) : 0;
    const node = { id, type, x, y, width, height, zIndex: maxZ + 1, data };
    Canvas.workspace.nodes.push(node);
    Canvas.renderNode(node);
    this.selectNode(id);
    if (!skipHistory) {
      ActionHistory.push({ type: 'node-add', node: JSON.parse(JSON.stringify(node)) });
    }
    Canvas.scheduleSave();
    return node;
  },

  toggleLock(nodeId) {
    const node = Canvas.workspace.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const wasLocked = !!node.locked;
    node.locked = !wasLocked;
    ActionHistory.push({ type: 'node-lock', nodeId, before: wasLocked, after: node.locked });
    // Re-render to update lock visuals
    const el = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`);
    if (el) {
      el.remove();
      Canvas.renderNode(node);
      this.selectNode(nodeId);
    }
    Canvas.scheduleSave();
  },

  toggleLockSelected() {
    this.selectedNodeIds.forEach(id => this.toggleLock(id));
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
