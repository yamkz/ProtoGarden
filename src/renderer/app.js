const App = {
  currentView: null,
  currentWorkspaceId: null,

  async init() {
    const storagePath = await window.api.storage.getPath();
    if (storagePath) {
      // Verify storage folder still exists
      try {
        const workspaces = await window.api.workspace.list();
        this.showView('gallery');
      } catch {
        // Storage folder missing - show welcome to re-pick
        this.showView('welcome');
      }
    } else {
      this.showView('welcome');
    }

    document.getElementById('btn-pick-folder').addEventListener('click', async () => {
      const path = await window.api.storage.pickFolder();
      if (path) this.showView('gallery');
    });

    document.getElementById('btn-change-folder').addEventListener('click', async () => {
      const path = await window.api.storage.pickFolder();
      if (path) Gallery.refresh();
    });
  },

  showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(`view-${name}`);
    if (view) {
      view.classList.add('active');
      this.currentView = name;
    }
    if (name === 'gallery') Gallery.refresh();
  },

  async openWorkspace(id) {
    this.currentWorkspaceId = id;
    this.showView('canvas');
    await Canvas.load(id);
  },

  async backToGallery() {
    await Canvas.unload();
    this.currentWorkspaceId = null;
    this.showView('gallery');
  },

  showPrompt(title, placeholder = '', confirmLabel = 'OK') {
    return new Promise((resolve) => {
      const overlay = document.getElementById('modal-overlay');
      const input = document.getElementById('modal-input');
      const titleEl = document.getElementById('modal-title');
      const confirmBtn = document.getElementById('modal-confirm');
      const cancelBtn = document.getElementById('modal-cancel');

      titleEl.textContent = title;
      confirmBtn.textContent = confirmLabel;
      input.value = '';
      input.placeholder = placeholder;
      overlay.style.display = 'flex';
      input.focus();

      const cleanup = (value) => {
        overlay.style.display = 'none';
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        input.removeEventListener('keydown', onKey);
        resolve(value);
      };

      const onKey = (e) => {
        if (e.key === 'Enter') cleanup(input.value.trim() || null);
        if (e.key === 'Escape') cleanup(null);
      };

      input.addEventListener('keydown', onKey);
      document.getElementById('modal-confirm').addEventListener('click', () => cleanup(input.value.trim() || null));
      document.getElementById('modal-cancel').addEventListener('click', () => cleanup(null));
    });
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
