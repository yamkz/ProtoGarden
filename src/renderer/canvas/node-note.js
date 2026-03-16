const NodeNote = {
  MODES: ['Context', 'Prompt'],
  MODELS: ['Opus 4.6', 'Sonnet 4.6', 'Haiku 4.5', 'GPT-4o', 'o3'],

  create(x, y) {
    NodeBase.addNode('note', {
      mode: 'Context',
      content: '',
      model: 'Opus 4.6',
    }, x, y, 420, 280);
  },

  render(node, contentEl) {
    const noteEl = contentEl.closest('.canvas-node');
    noteEl.dataset.noteMode = node.data.mode || 'Context';

    // Mode dropdown
    const modeRow = document.createElement('div');
    modeRow.className = 'note-mode-row';

    const modeBtn = document.createElement('button');
    modeBtn.className = 'note-mode-btn';
    modeBtn.innerHTML = `${node.data.mode || 'Context'} <span class="note-chevron">&#9662;</span>`;
    modeBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    modeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showModeMenu(modeBtn, node, noteEl);
    });
    modeRow.appendChild(modeBtn);
    contentEl.appendChild(modeRow);

    // Dashed separator
    const sep = document.createElement('div');
    sep.className = 'note-separator';
    contentEl.appendChild(sep);

    // Text area
    const textarea = document.createElement('textarea');
    textarea.className = 'note-textarea';
    textarea.value = node.data.content || '';
    textarea.placeholder = node.data.mode === 'Prompt'
      ? 'プロンプトを入力...'
      : 'コンテキストを入力...';
    textarea.spellcheck = false;

    textarea.addEventListener('input', () => {
      node.data.content = textarea.value;
      Canvas.scheduleSave();
    });
    textarea.addEventListener('mousedown', (e) => e.stopPropagation());
    textarea.addEventListener('wheel', (e) => {
      // Allow internal scroll, prevent canvas pan/zoom
      if (textarea.scrollHeight > textarea.clientHeight) {
        e.stopPropagation();
      }
    }, { passive: true });

    contentEl.appendChild(textarea);

    // Footer (only for Prompt mode)
    if (node.data.mode === 'Prompt') {
      const footer = document.createElement('div');
      footer.className = 'note-footer';

      // Model selector
      const modelBtn = document.createElement('button');
      modelBtn.className = 'note-model-btn';
      modelBtn.innerHTML = `${node.data.model || 'Opus 4.6'} <span class="note-chevron">&#9662;</span>`;
      modelBtn.addEventListener('mousedown', (e) => e.stopPropagation());
      modelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showModelMenu(modelBtn, node);
      });
      footer.appendChild(modelBtn);

      // Run button
      const runBtn = document.createElement('button');
      runBtn.className = 'note-run-btn';
      runBtn.innerHTML = '&#9654; Run';
      runBtn.addEventListener('mousedown', (e) => e.stopPropagation());
      runBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Future: AI execution
      });
      footer.appendChild(runBtn);

      contentEl.appendChild(footer);
    }
  },

  showModeMenu(btn, node, noteEl) {
    const existing = document.querySelector('.note-dropdown');
    if (existing) existing.remove();

    const rect = btn.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'note-dropdown';
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;

    this.MODES.forEach(mode => {
      const item = document.createElement('button');
      item.className = 'note-dropdown-item';
      if (node.data.mode === mode) item.classList.add('active');
      item.textContent = mode;
      item.addEventListener('click', () => {
        node.data.mode = mode;
        noteEl.dataset.noteMode = mode;
        // Re-render content
        const contentEl = noteEl.querySelector('.node-content');
        contentEl.innerHTML = '';
        this.render(node, contentEl);
        Canvas.scheduleSave();
        menu.remove();
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);
    setTimeout(() => {
      const hide = (e) => {
        if (!menu.contains(e.target)) { menu.remove(); window.removeEventListener('mousedown', hide); }
      };
      window.addEventListener('mousedown', hide);
    }, 100);
  },

  showModelMenu(btn, node) {
    const existing = document.querySelector('.note-dropdown');
    if (existing) existing.remove();

    const rect = btn.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'note-dropdown';
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.top - this.MODELS.length * 32 - 8}px`;

    this.MODELS.forEach(model => {
      const item = document.createElement('button');
      item.className = 'note-dropdown-item';
      if (node.data.model === model) item.classList.add('active');
      item.textContent = model;
      item.addEventListener('click', () => {
        node.data.model = model;
        btn.innerHTML = `${model} <span class="note-chevron">&#9662;</span>`;
        Canvas.scheduleSave();
        menu.remove();
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);
    setTimeout(() => {
      const hide = (e) => {
        if (!menu.contains(e.target)) { menu.remove(); window.removeEventListener('mousedown', hide); }
      };
      window.addEventListener('mousedown', hide);
    }, 100);
  },
};
