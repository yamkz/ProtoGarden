const ConnectionManager = {
  svgEl: null,
  selectedConnectionId: null,
  _dragging: null,
  _reconnecting: null,

  PORTS: ['top', 'bottom', 'left', 'right'],
  SNAP_DISTANCE: 20,

  init() {
    const container = document.getElementById('canvas-container');
    if (this.svgEl) this.svgEl.remove();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'connections-svg';
    svg.setAttribute('width', '1');
    svg.setAttribute('height', '1');
    svg.style.cssText = 'position:absolute;top:0;left:0;overflow:visible;pointer-events:none;z-index:99989;';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Small minimal arrow marker
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '5');
    marker.setAttribute('refX', '6');
    marker.setAttribute('refY', '2.5');
    marker.setAttribute('orient', 'auto');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', '0 0, 6 2.5, 0 5');
    poly.setAttribute('fill', 'rgba(74, 158, 255, 0.55)');
    marker.appendChild(poly);
    defs.appendChild(marker);

    const markerSel = marker.cloneNode(true);
    markerSel.setAttribute('id', 'arrowhead-selected');
    markerSel.querySelector('polygon').setAttribute('fill', '#4a9eff');
    defs.appendChild(markerSel);

    svg.appendChild(defs);
    container.insertBefore(svg, container.firstChild);
    this.svgEl = svg;
  },

  getPortPosition(node, port) {
    switch (port) {
      case 'top': return { x: node.x + node.width / 2, y: node.y };
      case 'bottom': return { x: node.x + node.width / 2, y: node.y + node.height };
      case 'left': return { x: node.x, y: node.y + node.height / 2 };
      case 'right': return { x: node.x + node.width, y: node.y + node.height / 2 };
    }
  },

  /**
   * Calculate control offset proportional to the distance between points.
   */
  getControlOffsetFor(port, distance) {
    const d = Math.min(Math.max(distance * 0.35, 30), 150);
    switch (port) {
      case 'top': return { dx: 0, dy: -d };
      case 'bottom': return { dx: 0, dy: d };
      case 'left': return { dx: -d, dy: 0 };
      case 'right': return { dx: d, dy: 0 };
    }
  },

  calcPath(srcPos, srcPort, tgtPos, tgtPort) {
    const dist = Math.sqrt((tgtPos.x - srcPos.x) ** 2 + (tgtPos.y - srcPos.y) ** 2);
    const sc = this.getControlOffsetFor(srcPort, dist);
    const tc = this.getControlOffsetFor(tgtPort, dist);
    return `M ${srcPos.x} ${srcPos.y} C ${srcPos.x + sc.dx} ${srcPos.y + sc.dy}, ${tgtPos.x + tc.dx} ${tgtPos.y + tc.dy}, ${tgtPos.x} ${tgtPos.y}`;
  },

  calcPreviewPath(srcPos, srcPort, targetX, targetY) {
    const dist = Math.sqrt((targetX - srcPos.x) ** 2 + (targetY - srcPos.y) ** 2);
    const sc = this.getControlOffsetFor(srcPort, dist);
    return `M ${srcPos.x} ${srcPos.y} C ${srcPos.x + sc.dx} ${srcPos.y + sc.dy}, ${targetX} ${targetY}, ${targetX} ${targetY}`;
  },

  renderAll() {
    if (!this.svgEl || !Canvas.workspace) return;
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
    const isSelected = conn.id === this.selectedConnectionId;

    // Visible path — dashed, 1.5px
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'connection-path');
    path.setAttribute('data-connection-id', conn.id);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', isSelected ? '#4a9eff' : 'rgba(74, 158, 255, 0.45)');
    path.setAttribute('stroke-width', isSelected ? '2.5' : '1.5');
    path.setAttribute('stroke-dasharray', isSelected ? 'none' : '6 4');
    path.setAttribute('marker-end', isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)');

    // Hit area for click/drag detection
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hit.setAttribute('d', d);
    hit.setAttribute('class', 'connection-hit');
    hit.setAttribute('data-connection-id', conn.id);
    hit.setAttribute('fill', 'none');
    hit.setAttribute('stroke', 'transparent');
    hit.setAttribute('stroke-width', '16');
    hit.style.pointerEvents = 'stroke';
    hit.style.cursor = 'pointer';

    hit.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Check if click is near the target end (last 1/5) for reconnect
      const pathLen = path.getTotalLength();
      const clickPos = Canvas.screenToCanvas(e.clientX, e.clientY);
      // Sample points in last 1/5 of path
      let minDist = Infinity;
      for (let t = 0.8; t <= 1.0; t += 0.05) {
        const pt = path.getPointAtLength(pathLen * t);
        const dd = Math.sqrt((clickPos.x - pt.x) ** 2 + (clickPos.y - pt.y) ** 2);
        if (dd < minDist) minDist = dd;
      }

      if (minDist < 30) {
        // Start reconnect from source (detach target end)
        this._startReconnect(conn, e.clientX, e.clientY);
      } else {
        this.selectConnection(conn.id);
      }
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

  _startReconnect(conn, clientX, clientY) {
    // Remove the connection and start a new drag from the source
    const { sourceNodeId, sourcePort } = conn;
    this.deleteConnection(conn.id);
    this.startDrag(sourceNodeId, sourcePort, clientX, clientY);
    // Immediately update to mouse position
    const pos = Canvas.screenToCanvas(clientX, clientY);
    this.updateDrag(pos.x, pos.y);
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

  addConnection(sourceNodeId, sourcePort, targetNodeId, targetPort) {
    if (!Canvas.workspace.connections) Canvas.workspace.connections = [];
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

  deleteConnectionsForNode(nodeId) {
    if (!Canvas.workspace.connections) return;
    Canvas.workspace.connections = Canvas.workspace.connections.filter(c =>
      c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
    );
    this.renderAll();
  },

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

  startDrag(nodeId, port, startX, startY) {
    this._dragging = { sourceNodeId: nodeId, sourcePort: port };
    const node = Canvas.workspace.nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (!this.svgEl || !this.svgEl.parentNode) this.init();

    const srcPos = this.getPortPosition(node, port);
    const preview = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    preview.setAttribute('class', 'connection-preview');
    preview.setAttribute('fill', 'none');
    preview.setAttribute('stroke', 'rgba(74, 158, 255, 0.7)');
    preview.setAttribute('stroke-width', '1.5');
    preview.setAttribute('stroke-dasharray', '6 4');
    preview.setAttribute('marker-end', 'url(#arrowhead)');
    preview.setAttribute('d', `M ${srcPos.x} ${srcPos.y} L ${srcPos.x} ${srcPos.y}`);
    this.svgEl.appendChild(preview);
    this._dragging.previewPath = preview;
    this._dragging.snapTarget = null;

    NodeBase.blockIframes();
  },

  updateDrag(canvasX, canvasY) {
    if (!this._dragging) return;
    const srcNode = Canvas.workspace.nodes.find(n => n.id === this._dragging.sourceNodeId);
    if (!srcNode) return;
    const srcPos = this.getPortPosition(srcNode, this._dragging.sourcePort);

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
