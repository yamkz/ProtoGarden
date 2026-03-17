const NodeGroup = {
  /**
   * Group selected nodes into a group node.
   */
  createGroup() {
    const ids = [...NodeBase.selectedNodeIds];
    if (ids.length < 2) return;

    // Check: no node should already be in a group
    const nodes = ids.map(id => Canvas.workspace.nodes.find(n => n.id === id)).filter(Boolean);
    if (nodes.some(n => n.groupId)) return; // Already grouped
    if (nodes.some(n => n.type === 'group')) return; // Can't nest groups

    // Calculate bounding box
    let bx1 = Infinity, by1 = Infinity, bx2 = -Infinity, by2 = -Infinity;
    nodes.forEach(n => {
      bx1 = Math.min(bx1, n.x);
      by1 = Math.min(by1, n.y);
      bx2 = Math.max(bx2, n.x + n.width);
      by2 = Math.max(by2, n.y + n.height);
    });

    const padding = 16;
    const groupX = bx1 - padding;
    const groupY = by1 - padding;
    const groupW = (bx2 - bx1) + padding * 2;
    const groupH = (by2 - by1) + padding * 2;

    // Create group node
    const groupId = crypto.randomUUID();
    const maxZ = Canvas.workspace.nodes.length > 0
      ? Math.max(...Canvas.workspace.nodes.map(n => n.zIndex || 1)) : 0;

    const groupNode = {
      id: groupId,
      type: 'group',
      x: groupX,
      y: groupY,
      width: groupW,
      height: groupH,
      zIndex: maxZ + 1,
      data: { childIds: ids.slice() },
    };

    // Set groupId on child nodes, store relative positions
    nodes.forEach(n => {
      n.groupId = groupId;
    });

    Canvas.workspace.nodes.push(groupNode);

    // Record for undo
    ActionHistory.push({
      type: 'group-create',
      groupNode: JSON.parse(JSON.stringify(groupNode)),
      childIds: ids.slice(),
    });

    // Re-render all
    Canvas.renderAllNodes();
    NodeBase.selectNode(groupId);
    Canvas.scheduleSave();
  },

  /**
   * Ungroup: dissolve the group, free child nodes.
   */
  ungroupSelected() {
    const selectedId = NodeBase.getFirstSelectedId();
    if (!selectedId) return;
    const groupNode = Canvas.workspace.nodes.find(n => n.id === selectedId && n.type === 'group');
    if (!groupNode) return;

    const childIds = groupNode.data.childIds || [];

    // Clear groupId from children
    childIds.forEach(cid => {
      const child = Canvas.workspace.nodes.find(n => n.id === cid);
      if (child) delete child.groupId;
    });

    // Record for undo
    ActionHistory.push({
      type: 'group-ungroup',
      groupNode: JSON.parse(JSON.stringify(groupNode)),
      childIds: childIds.slice(),
    });

    // Remove group node
    const idx = Canvas.workspace.nodes.findIndex(n => n.id === groupNode.id);
    if (idx !== -1) Canvas.workspace.nodes.splice(idx, 1);

    // Re-render
    Canvas.renderAllNodes();
    NodeBase.deselectAll();
    childIds.forEach(id => NodeBase.addToSelection(id));
    Canvas.scheduleSave();
  },

  /**
   * Render a group node (border frame around children).
   */
  render(node, contentEl) {
    // Group is just a frame, content area shows children will be rendered separately
    contentEl.style.pointerEvents = 'none';
  },

  /**
   * Delete group and all its children.
   */
  deleteGroup(groupId) {
    const groupNode = Canvas.workspace.nodes.find(n => n.id === groupId);
    if (!groupNode) return;
    const childIds = groupNode.data.childIds || [];

    // Collect all nodes for undo
    const allNodes = [JSON.parse(JSON.stringify(groupNode))];
    childIds.forEach(cid => {
      const child = Canvas.workspace.nodes.find(n => n.id === cid);
      if (child) allNodes.push(JSON.parse(JSON.stringify(child)));
    });

    ActionHistory.push({ type: 'multi-node-delete', nodes: allNodes });

    // Remove children first, then group
    childIds.forEach(cid => {
      NodeBase.deleteNode(cid, true);
    });
    NodeBase.deleteNode(groupId, true);
  },

  /**
   * Update group bounds to fit its children.
   */
  updateGroupBounds(groupId) {
    const groupNode = Canvas.workspace.nodes.find(n => n.id === groupId);
    if (!groupNode || !groupNode.data.childIds) return;

    const children = groupNode.data.childIds
      .map(id => Canvas.workspace.nodes.find(n => n.id === id))
      .filter(Boolean);
    if (children.length === 0) return;

    const padding = 16;
    let bx1 = Infinity, by1 = Infinity, bx2 = -Infinity, by2 = -Infinity;
    children.forEach(c => {
      bx1 = Math.min(bx1, c.x);
      by1 = Math.min(by1, c.y);
      bx2 = Math.max(bx2, c.x + c.width);
      by2 = Math.max(by2, c.y + c.height);
    });

    groupNode.x = bx1 - padding;
    groupNode.y = by1 - padding;
    groupNode.width = (bx2 - bx1) + padding * 2;
    groupNode.height = (by2 - by1) + padding * 2;

    const el = document.querySelector(`.canvas-node[data-node-id="${groupId}"]`);
    if (el) {
      el.style.left = `${groupNode.x}px`;
      el.style.top = `${groupNode.y}px`;
      el.style.width = `${groupNode.width}px`;
      el.style.height = `${groupNode.height}px`;
    }
  },
};
