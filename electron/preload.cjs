const { contextBridge, ipcRenderer } = require('electron');

// 仅暴露白名单方法给渲染层；渲染层拿不到 Node/Node API，也拿不到 API Key 明文。
contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  extract: (url, opts) => ipcRenderer.invoke('extract:site', url, opts || {}),
  exportBundle: (result, opts) => ipcRenderer.invoke('bundle:export', result, opts || {}),
  previewFiles: (result, override) => ipcRenderer.invoke('bundle:preview', result, override || null),
  systemFile: (result, relPath, override) => ipcRenderer.invoke('system:file', result, relPath, override || null),
  generatePalette: (seed) => ipcRenderer.invoke('palette:generate', seed),
  captureThumbnail: (url) => ipcRenderer.invoke('capture:thumbnail', url),

  // finalize：改完 brand.json 重新生成整套设计体系。
  finalizeBrand: (result, brandText) => ipcRenderer.invoke('brand:finalize', result, brandText),
  autoBrand: (result) => ipcRenderer.invoke('brand:auto', result),

  // AI 配置与调用
  aiProviders: () => ipcRenderer.invoke('ai:providers'),
  aiConfigGet: () => ipcRenderer.invoke('ai:config:get'),
  aiConfigSave: (patch) => ipcRenderer.invoke('ai:config:save', patch),
  aiConfigClear: () => ipcRenderer.invoke('ai:config:clear'),
  aiTest: (draft) => ipcRenderer.invoke('ai:test', draft || {}),
  aiEnrich: (result, override) => ipcRenderer.invoke('ai:enrich', result, override || null),
  aiCopy: (result, override) => ipcRenderer.invoke('ai:copy', result, override || null),

  // 进度：订阅后返回取消订阅函数，组件卸载时调用避免重复监听。
  onProgress: (cb) => {
    const handler = (_event, payload) => cb(payload);
    ipcRenderer.on('extract:progress', handler);
    return () => ipcRenderer.removeListener('extract:progress', handler);
  },

  historyList: () => ipcRenderer.invoke('history:list'),
  historyGet: (id) => ipcRenderer.invoke('history:get', id),
  historyRemove: (id) => ipcRenderer.invoke('history:remove', id),
  historyClear: () => ipcRenderer.invoke('history:clear'),

  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
});
