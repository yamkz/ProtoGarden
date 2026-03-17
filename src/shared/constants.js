const IPC = {
  STORAGE_GET_PATH: 'storage:get-path',
  STORAGE_SET_PATH: 'storage:set-path',
  STORAGE_PICK_FOLDER: 'storage:pick-folder',
  WORKSPACE_LIST: 'workspace:list',
  WORKSPACE_CREATE: 'workspace:create',
  WORKSPACE_RENAME: 'workspace:rename',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_LOAD: 'workspace:load',
  WORKSPACE_SAVE: 'workspace:save',
  FILE_SAVE_IMAGE: 'file:save-image',
  FILE_COPY_HTML_DIR: 'file:copy-html-dir',
  FILE_PICK_IMAGE: 'file:pick-image',
  FILE_PICK_HTML: 'file:pick-html',
  HTML_SAVE_SNAPSHOTS: 'html:save-snapshots',
  HTML_HAS_SNAPSHOT: 'html:has-snapshot',
  HTML_DELETE_SNAPSHOT: 'html:delete-snapshot',
  WORKSPACE_DUPLICATE: 'workspace:duplicate',
  WORKSPACE_EXPORT: 'workspace:export',
  WORKSPACE_IMPORT: 'workspace:import',
};

if (typeof module !== 'undefined') {
  module.exports = { IPC };
}
