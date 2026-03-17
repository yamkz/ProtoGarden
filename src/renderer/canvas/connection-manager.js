const ConnectionManager = {
  svgEl: null,
  selectedConnectionId: null,
  _dragging: null, // { sourceNodeId, sourcePort, previewPath }

  PORTS: ['top', 'bottom', 'left', 'right'],
  SNAP_DISTANCE: 20,
  CONTROL_OFFSET: 80,

  init() {
    const container = document.getElementById('canvas-container');
    if (this.svgEl) this.svgEl.remove();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'connections-svg';
    svg.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:99989;';
    // Arrow marker
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 8 3, 0 6');
    polygon.setAttribute('fill', 'rgba(74, 158, 255, 0.6)');
    marker.appendChild(polygon);
    defs.appendChild(marker);

    // Selected arrow marker
    const markerSel = marker.cloneNode(true);
    markerSel.setAttribute('id', 'arrowhead-selected');
    markerSel.querySelector('polygon').setAttribute('fill', '#4a9eff');
    defs.appendChild(markerSel);

    svg.appendChild(defs);
    container.insertBefore(svg, container.firstChild);
    this.svgEl = svg;
  },

  /**
   * Get port position in canvas coordinates for a given node and port.
   */
  getPortPosition(node, port) {
    switch (port) {
      case 'top': return { x: node.x + node.width / 2, y: node.y };
      case 'bottom': return { x: node.x + node.width / 2, y: node.y + node.height };
      case 'left': return { x: node.x, y: node.y + node.height / 2 };
      case 'right': return { x: node.x + node.width, y: node.y + node.height / 2 };
    }
  },

  /**
   * Get control point direction vector for a port.
   */
  getControlOffset(port) {
    const d = this.CONTROL_OFFSET;
    switch (port) {
      case 'top': return { dx: 0, dy: -d };
      case 'bottom': return { dx: 0, dy: d };
      case 'left': return { dx: -d, dy: 0 };
      case 'right': return { dx: d, dy: 0 };
    }
  },

  /**
   * Calculate cubic bezier path string between two ports.
   */
  calcPath(srcPos, srcPort, tgtPos, tgtPort) {
    const sc = this.getControlOffset(srcPort);
    const tc = this.getControlOffset(tgtPort);
    return `M ${srcPos.x} ${srcPos.y} C ${srcPos.x + sc.dx} ${srcPos.y + sc.dy}, ${tgtPos.x + tc.dx} ${tgtPos.y + tc.dy}, ${tgtPos.x} ${tgtPos.y}`;
  },

  /**
   * Calculate path from port to a free point (for dragging preview).
   */
  calcPreviewPath(srcPos, srcPort, targetX, targetY) {
    const sc = this.getControlOffset(srcPort);
    // Auto-calculate target control point based on direction
    const dx = targetX - srcPos.x;
    const dy = targetY - srcPos.y;
    const dist = Math.max(40, Math.sqrt(dx * dx + dy * dy) * 0.4);
    return `M ${srcPos.x} ${srcPos.y} C ${srcPos.x + sc.dx} ${srcPos.y + sc.dy}, ${targetX - dx * 0.2} ${targetY - dy * 0.2}, ${targetX} ${targetY}`;
  },

  /**
   * Render all connections for the current workspace.
   */
  renderAll() {
    if (!this.svgEl || !Canvas.workspace) return;
    // Remove existing paths (keep defs)
    this.svgEl.querySelectorAll('.connection-path, .connection-hit').forEach(el => el.remove());

    const connections = Canvas.workspace.connections || [];
    connections.forEach(conn => this._renderConnection(conn));
  },

  _renderConnection(conn) {
    const srcNode = Canvas.workspace.nodes.find(n => n.id === conn.sourceNodeId);
    const tgtNode = Canvas.workspace.nodes.find(n => n.id === conn.targetNodeId);
    if (!srcNode || !tgtNode) return;

    const srcPos = this.getPortPosition(srcNode, conn.sourcePort);
    const tgtPos = this.getPortPosition(tgtNode, conn.targetPort);
    const d = this.calcPath(srcPos, conn.sourcePort, tgtPos, conn.targetPort);

    // Visible path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'connection-path');
    path.setAttribute('data-connection-id', conn.id);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', conn.id === this.selectedConnectionId ? '#4a9eff' : 'rgba(74, 158, 255, 0.45)');
    path.setAttribute('stroke-width', conn.id === this.selectedConnectionId ? '3' : '2');
    path.setAttribute('marker-end', conn.id === this.selectedConnectionId ? 'url(#arrowhead-selected)' : 'url(#arrowhead)');
    if (conn.id === this.selectedConnectionId) path.classList.add('selected');

    // Hit area (wider invisible stroke for click detection)
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hit.setAttribute('d', d);
    hit.setAttribute('class', 'connection-hit');
    hit.setAttribute('data-connection-id', conn.id);
    hit.setAttribute('fill', 'none');
    hit.setAttribute('stroke', 'transparent');
    hit.setAttribute('stroke-width', '14');
    hit.style.pointerEvents = 'stroke';
    hit.style.cursor = 'pointer';

    hit.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectConnection(conn.id);
    });

    hit.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectConnection(conn.id);
      this.showContextMenu(e.clientX, e.clientY, conn);
    });

    this.svgEl.appendChild(path);
    this.svgEl.appendChild(hit);
  },

  selectConnection(id) {
    NodeBase.deselectAll();
    this.selectedConnectionId = id;
    this.renderAll();
  },

  deselectConnection() {
    this.selectedConnectionId = null;
    this.renderAll();
  },

  /**
   * Add a new connection.
   */
  addConnection(sourceNodeId, sourcePort, targetNodeId, targetPort) {
    if (!Canvas.workspace.connections) Canvas.workspace.connections = [];
    // Prevent duplicate
    const existing = Canvas.workspace.connections.find(c =>
      c.sourceNodeId === sourceNodeId && c.sourcePort === sourcePort &&
      c.targetNodeId === targetNodeId && c.targetPort === targetPort
    );
    if (existing) return;

    const conn = {
      id: crypto.randomUUID(),
      sourceNodeId, sourcePort, targetNodeId, targetPort,
    };
    Canvas.workspace.connections.push(conn);
    ActionHistory.push({ type: 'connection-add', connection: JSON.parse(JSON.stringify(conn)) });
    this.renderAll();
    Canvas.scheduleSave();
  },

  /**
   * Delete a connection by id.
   */
  deleteConnection(id, skipHistory = false) {
    if (!Canvas.workspace.connections) return;
    const idx = Canvas.workspace.connections.findIndex(c => c.id === id);
    if (idx === -1) return;
    const conn = Canvas.workspace.connections.splice(idx, 1)[0];
    if (!skipHistory) {
      ActionHistory.push({ type: 'connection-delete', connection: JSON.parse(JSON.stringify(conn)) });
    }
    if (this.selectedConnectionId === id) this.selectedConnectionId = null;
    this.renderAll();
    Canvas.scheduleSave();
  },

  /**
   * Delete all connections related to a node.
   */
  deleteConnectionsForNode(nodeId) {
    if (!Canvas.workspace.connections) return;
    Canvas.workspace.connections = Canvas.workspace.connections.filter(c =>
      c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
    );
    this.renderAll();
  },

  /**
   * Reverse a connection's direction.
   */
  reverseConnection(id) {
    if (!Canvas.workspace.connections) return;
    const conn = Canvas.workspace.connections.find(c => c.id === id);
    if (!conn) return;
    const before = JSON.parse(JSON.stringify(conn));
    const tmpNodeId = conn.sourceNodeId;
    const tmpPort = conn.sourcePort;
    conn.sourceNodeId = conn.targetNodeId;
    conn.sourcePort = conn.targetPort;
    conn.targetNodeId = tmpNodeId;
    conn.targetPort = tmpPort;
    ActionHistory.push({ type: 'connection-reverse', connectionId: id, before, after: JSON.parse(JSON.stringify(conn)) });
    this.renderAll();
    Canvas.scheduleSave();
  },

  deleteSelected() {
    if (this.selectedConnectionId) {
      this.deleteConnection(this.selectedConnectionId);
    }
  },

  /**
   * Start dragging a new connection from a port.
   */
  startDrag(nodeId, port, startX, startY) {
    this._dragging = { sourceNodeId: nodeId, sourcePort: port };
    const node = Canvas.workspace.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const preview = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    preview.setAttribute('class', 'connection-preview');
    preview.setAttribute('fill', 'none');
    preview.setAttribute('stroke', 'rgba(74, 158, 255, 0.6)');
    preview.setAttribute('stroke-width', '2');
    preview.setAttribute('stroke-dasharray', '6 4');
    preview.setAttribute('marker-end', 'url(#arrowhead)');
    this.svgEl.appendChild(preview);
    this._dragging.previewPath = preview;
    this._dragging.snapTarget = null;

    NodeBase.blockIframes();
  },

  /**
   * Update drag preview.
   */
  updateDrag(canvasX, canvasY) {
    if (!this._dragging) return;
    const srcNode = Canvas.workspace.nodes.find(n => n.id === this._dragging.sourceNodeId);
    if (!srcNode) return;
    const srcPos = this.getPortPosition(srcNode, this._dragging.sourcePort);

    // Check snap to nearby ports
    let snapped = null;
    let minDist = this.SNAP_DISTANCE;
    Canvas.workspace.nodes.forEach(n => {
      if (n.id === this._dragging.sourceNodeId) return;
      this.PORTS.forEach(port => {
        const pos = this.getPortPosition(n, port);
        const dist = Math.sqrt((canvasX - pos.x) ** 2 + (canvasY - pos.y) ** 2);
        if (dist < minDist) {
          minDist = dist;
          snapped = { nodeId: n.id, port, pos };
        }
      });
    });

    this._dragging.snapTarget = snapped;

    // Highlight snap target port
    document.querySelectorAll('.connection-port.snap-highlight').forEach(el => el.classList.remove('snap-highlight'));
    if (snapped) {
      const targetEl = document.querySelector(`.canvas-node[data-node-id="${snapped.nodeId}"] .connection-port-${snapped.port}`);
      if (targetEl) targetEl.classList.add('snap-highlight');
    }

    const targetX = snapped ? snapped.pos.x : canvasX;
    const targetY = snapped ? snapped.pos.y : canvasY;
    const targetPort = snapped ? snapped.port : this._dragging.sourcePort;

    const d = snapped
      ? this.calcPath(srcPos, this._dragging.sourcePort, { x: targetX, y: targetY }, targetPort)
      : this.calcPreviewPath(srcPos, this._dragging.sourcePort, targetX, targetY);
    this._dragging.previewPath.setAttribute('d', d);
  },

  /**
   * End drag — create connection if snapped, otherwise cancel.
   */
  endDrag() {
    if (!this._dragging) return;
    document.querySelectorAll('.connection-port.snap-highlight').forEach(el => el.classList.remove('snap-highlight'));

    if (this._dragging.snapTarget) {
      this.addConnection(
        this._dragging.sourceNodeId, this._dragging.sourcePort,
        this._dragging.snapTarget.nodeId, this._dragging.snapTarget.port
      );
    }

    if (this._dragging.previewPath) this._dragging.previewPath.remove();
    this._dragging = null;
    NodeBase.unblockIframes();
  },

  /**
   * Show context menu for a connection.
   */
  showContextMenu(x, y, conn) {
    NodeBase.hideContextMenu();
    const menu = document.createElement('div');
    menu.className = 'node-context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const items = [
      { action: 'reverse', label: '向きを反転' },
      { action: 'sep', sep: true },
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
      if (item.danger) btn.classList.add('danger');
      btn.addEventListener('click', () => {
        if (item.action === 'reverse') this.reverseConnection(conn.id);
        if (item.action === 'delete') this.deleteConnection(conn.id);
        menu.remove();
      });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    setTimeout(() => {
      const cleanup = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          window.removeEventListener('mousedown', cleanup);
        }
      };
      window.addEventListener('mousedown', cleanup);
    }, 100);
  },
};
