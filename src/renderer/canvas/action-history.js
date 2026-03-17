const ActionHistory = {
  stack: [],
  index: -1,
  MAX_SIZE: 50,

  clear() {
    this.stack = [];
    this.index = -1;
  },

  push(action) {
    // Discard any redo entries beyond current position
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(action);
    if (this.stack.length > this.MAX_SIZE) {
      this.stack.shift();
    }
    this.index = this.stack.length - 1;
  },

  canUndo() {
    return this.index >= 0;
  },

  canRedo() {
    return this.index < this.stack.length - 1;
  },

  undo() {
    if (!this.canUndo()) return;
    const action = this.stack[this.index];
    this.index--;
    this._apply(action, 'undo');
  },

  redo() {
    if (!this.canRedo()) return;
    this.index++;
    const action = this.stack[this.index];
    this._apply(action, 'redo');
  },

  _apply(action, direction) {
    switch (action.type) {
      case 'node-add':
        if (direction === 'undo') this._removeNodes([action.node.id]);
        else this._restoreNodes([action.node]);
        break;

      case 'node-delete':
        if (direction === 'undo') this._restoreNodes([action.node]);
        else this._removeNodes([action.node.id]);
        break;

      case 'node-move':
        if (direction === 'undo') this._setPositions(action.before);
        else this._setPositions(action.after);
        break;

      case 'node-resize':
        if (direction === 'undo') this._setBounds(action.before);
        else this._setBounds(action.after);
        break;

      case 'node-edit':
        if (direction === 'undo') this._setData(action.nodeId, action.before);
        else this._setData(action.nodeId, action.after);
        break;

      case 'node-zindex':
        if (direction === 'undo') this._setZIndex(action.nodeId, action.before);
        else this._setZIndex(action.nodeId, action.after);
        break;

      case 'multi-node-delete':
        if (direction === 'undo') this._restoreNodes(action.nodes);
        else this._removeNodes(action.nodes.map(n => n.id));
        break;

      case 'node-lock':
        this._setLock(action.nodeId, direction === 'undo' ? action.before : action.after);
        break;

      case 'group-create':
        if (direction === 'undo') {
          // Remove group node, clear groupId from children
          action.childIds.forEach(cid => {
            const child = Canvas.workspace.nodes.find(n => n.id === cid);
            if (child) delete child.groupId;
          });
          this._removeNodes([action.groupNode.id]);
          Canvas.renderAllNodes();
        } else {
          // Re-create group
          Canvas.workspace.nodes.push(JSON.parse(JSON.stringify(action.groupNode)));
          action.childIds.forEach(cid => {
            const child = Canvas.workspace.nodes.find(n => n.id === cid);
            if (child) child.groupId = action.groupNode.id;
          });
          Canvas.renderAllNodes();
        }
        break;

      case 'group-ungroup':
        if (direction === 'undo') {
          // Re-create group
          Canvas.workspace.nodes.push(JSON.parse(JSON.stringify(action.groupNode)));
          action.childIds.forEach(cid => {
            const child = Canvas.workspace.nodes.find(n => n.id === cid);
            if (child) child.groupId = action.groupNode.id;
          });
          Canvas.renderAllNodes();
        } else {
          // Remove group, clear groupId
          action.childIds.forEach(cid => {
            const child = Canvas.workspace.nodes.find(n => n.id === cid);
            if (child) delete child.groupId;
          });
          this._removeNodes([action.groupNode.id]);
          Canvas.renderAllNodes();
        }
        break;
    }
    Canvas.scheduleSave();
  },

  _removeNodes(ids) {
    ids.forEach(id => {
      const idx = Canvas.workspace.nodes.findIndex(n => n.id === id);
      if (idx !== -1) Canvas.workspace.nodes.splice(idx, 1);
      document.querySelector(`.canvas-node[data-node-id="${id}"]`)?.remove();
      NodeBase.selectedNodeIds.delete(id);
    });
  },

  _restoreNodes(nodes) {
    nodes.forEach(node => {
      Canvas.workspace.nodes.push(JSON.parse(JSON.stringify(node)));
      Canvas.renderNode(node);
    });
  },

  _setPositions(entries) {
    // entries: [{ id, x, y }, ...]
    entries.forEach(({ id, x, y }) => {
      const node = Canvas.workspace.nodes.find(n => n.id === id);
      if (!node) return;
      node.x = x;
      node.y = y;
      const el = document.querySelector(`.canvas-node[data-node-id="${id}"]`);
      if (el) {
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      }
    });
  },

  _setBounds(entries) {
    // entries: [{ id, x, y, width, height }, ...]
    entries.forEach(({ id, x, y, width, height }) => {
      const node = Canvas.workspace.nodes.find(n => n.id === id);
      if (!node) return;
      node.x = x;
      node.y = y;
      node.width = width;
      node.height = height;
      const el = document.querySelector(`.canvas-node[data-node-id="${id}"]`);
      if (el) {
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.width = `${width}px`;
        el.style.height = `${height}px`;
      }
    });
  },

  _setData(nodeId, data) {
    const node = Canvas.workspace.nodes.find(n => n.id === nodeId);
    if (!node) return;
    Object.assign(node.data, data);
    // Re-render the node to reflect data changes
    const el = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`);
    if (el) {
      el.remove();
      Canvas.renderNode(node);
      NodeBase.selectNode(nodeId);
    }
  },

  _setZIndex(nodeId, zIndex) {
    const node = Canvas.workspace.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.zIndex = zIndex;
    const el = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`);
    if (el) el.style.zIndex = zIndex;
  },

  _setLock(nodeId, locked) {
    const node = Canvas.workspace.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.locked = locked;
    const el = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`);
    if (el) {
      el.remove();
      Canvas.renderNode(node);
    }
  },
};
