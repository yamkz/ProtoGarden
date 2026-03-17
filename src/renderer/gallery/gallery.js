const Gallery = {
  async refresh() {
    const grid = document.getElementById('gallery-grid');
    const workspaces = await window.api.workspace.list();

    if (workspaces.length === 0) {
      grid.innerHTML = `
        <div class="gallery-empty">
          <div class="gallery-empty-icon">&#9881;</div>
          <div class="gallery-empty-text">まだワークスペースがありません</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = workspaces.map(ws => `
      <div class="workspace-card" data-id="${ws.id}">
        <div class="workspace-name">${this.escapeHtml(ws.name)}</div>
        <div class="workspace-meta">${this.formatDate(ws.updatedAt)}</div>
        <div class="workspace-card-actions">
          <button class="btn-card-action-text" data-action="duplicate" data-id="${ws.id}">複製</button>
          <button class="btn-card-action-text" data-action="export" data-id="${ws.id}">書出</button>
          <button class="btn-card-action-text" data-action="rename" data-id="${ws.id}">名変</button>
          <button class="btn-card-action-text danger" data-action="delete" data-id="${ws.id}">削除</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.workspace-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-card-action')) return;
        App.openWorkspace(card.dataset.id);
      });
    });

    grid.querySelectorAll('[data-action="duplicate"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.api.workspace.duplicate(btn.dataset.id);
        this.refresh();
      });
    });

    grid.querySelectorAll('[data-action="export"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.api.workspace.export(btn.dataset.id);
      });
    });

    grid.querySelectorAll('[data-action="rename"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startRename(btn.dataset.id);
      });
    });

    grid.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const deleted = await window.api.workspace.delete(btn.dataset.id);
        if (deleted) this.refresh();
      });
    });
  },

  startRename(id) {
    const card = document.querySelector(`.workspace-card[data-id="${id}"]`);
    const nameEl = card.querySelector('.workspace-name');
    const currentName = nameEl.textContent;

    nameEl.innerHTML = `<input class="workspace-name-input" type="text" value="${this.escapeHtml(currentName)}">`;
    const input = nameEl.querySelector('input');
    input.focus();
    input.select();

    const commit = async () => {
      const newName = input.value.trim();
      if (newName && newName !== currentName) {
        await window.api.workspace.rename(id, newName);
      }
      this.refresh();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') {
        input.value = currentName;
        input.blur();
      }
    });
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  formatDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'たった今';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}日前`;
    return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  },
};

document.getElementById('btn-import-workspace').addEventListener('click', async () => {
  const result = await window.api.workspace.import();
  if (result) Gallery.refresh();
});

document.getElementById('btn-new-workspace').addEventListener('click', async () => {
  const name = await App.showPrompt('新規ワークスペース', 'ワークスペース名を入力', '作成');
  if (name) {
    await window.api.workspace.create(name);
    Gallery.refresh();
  }
});
