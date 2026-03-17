const NodeText = {
  COLORS: [
    { label: 'White', value: '#e8e8e8' },
    { label: 'Orange', value: '#e8943a' },
    { label: 'Blue', value: '#4a9eff' },
    { label: 'Green', value: '#4ecb71' },
    { label: 'Red', value: '#e85454' },
  ],
  SIZES: [
    { label: 'S', value: 14 },
    { label: 'M', value: 21 },
    { label: 'L', value: 32 },
    { label: 'XL', value: 48 },
    { label: 'XXL', value: 72 },
  ],

  create(x, y) {
    const node = NodeBase.addNode('text', { content: '', color: '#e8e8e8', fontSize: 21 }, x, y, 300, 60);
    // Auto enter edit mode for new text nodes
    setTimeout(() => NodeBase.enterTextEdit(node.id), 50);
  },

  render(node, contentEl) {
    const parent = contentEl.closest('.canvas-node');
    parent.style.setProperty('--text-font-size', `${node.data.fontSize || 21}px`);

    const editable = document.createElement('div');
    editable.className = 'text-editable';
    editable.contentEditable = false; // Start non-editable (click=select, dblclick=edit)
    editable.spellcheck = false;
    editable.innerHTML = node.data.content || '';
    editable.setAttribute('placeholder', 'テキストを入力...');

    let textBeforeEdit = node.data.content || '';
    editable.addEventListener('focus', () => {
      textBeforeEdit = node.data.content || '';
    });
    editable.addEventListener('input', () => {
      node.data.content = editable.innerHTML;
      Canvas.scheduleSave();
    });
    editable.addEventListener('blur', () => {
      const after = node.data.content || '';
      if (textBeforeEdit !== after) {
        ActionHistory.push({
          type: 'node-edit',
          nodeId: node.id,
          before: { content: textBeforeEdit },
          after: { content: after },
        });
      }
    });

    // Cmd+A in text edit mode: show style UI
    editable.addEventListener('keydown', (e) => {
      if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        // Select all text first (default behavior), then show style UI
        setTimeout(() => NodeBase.showTextStyleUI(node.id), 100);
      }
    });

    contentEl.appendChild(editable);
  },

  renderContextMenuExtras(menu, node) {
    const sizeSep = document.createElement('div');
    sizeSep.className = 'context-separator';
    menu.insertBefore(sizeSep, menu.firstChild);

    const sizeRow = document.createElement('div');
    sizeRow.className = 'context-size-row';
    this.SIZES.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'size-btn';
      if ((node.data.fontSize || 21) === s.value) btn.classList.add('active');
      btn.textContent = s.label;
      btn.addEventListener('click', () => {
        node.data.fontSize = s.value;
        const el = document.querySelector(`.canvas-node[data-node-id="${node.id}"]`);
        if (el) el.style.setProperty('--text-font-size', `${s.value}px`);
        Canvas.scheduleSave();
        NodeBase.hideContextMenu();
      });
      sizeRow.appendChild(btn);
    });
    menu.insertBefore(sizeRow, menu.firstChild);

    const colorSep = document.createElement('div');
    colorSep.className = 'context-separator';
    menu.insertBefore(colorSep, menu.firstChild);

    const colorRow = document.createElement('div');
    colorRow.className = 'context-color-row';
    this.COLORS.forEach(c => {
      const swatch = document.createElement('button');
      swatch.className = 'color-swatch';
      swatch.style.background = c.value;
      if (node.data.color === c.value) swatch.classList.add('active');
      swatch.addEventListener('click', () => {
        node.data.color = c.value;
        const el = document.querySelector(`.canvas-node[data-node-id="${node.id}"]`);
        if (el) el.style.color = c.value;
        Canvas.scheduleSave();
        NodeBase.hideContextMenu();
      });
      colorRow.appendChild(swatch);
    });

    const customBtn = document.createElement('button');
    customBtn.className = 'color-swatch color-custom';
    customBtn.innerHTML = '+';
    customBtn.title = 'カスタム色';
    customBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = node.data.color || '#e8e8e8';
      input.style.cssText = 'position:absolute;opacity:0;pointer-events:none;';
      document.body.appendChild(input);
      input.click();
      input.addEventListener('input', () => {
        node.data.color = input.value;
        const el = document.querySelector(`.canvas-node[data-node-id="${node.id}"]`);
        if (el) el.style.color = input.value;
        Canvas.scheduleSave();
      });
      input.addEventListener('change', () => {
        input.remove();
        NodeBase.hideContextMenu();
      });
    });
    colorRow.appendChild(customBtn);
    menu.insertBefore(colorRow, menu.firstChild);
  },
};
