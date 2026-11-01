const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require('electron');
const path = require('node:path');
const crypto = require('node:crypto');

// 界面自动化验证用：设了 VERIFY_CDP_PORT 才开 CDP 调试端口，日常启动完全不受影响。
if (process.env.VERIFY_CDP_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.VERIFY_CDP_PORT);
}

// 单实例：再次启动时不重复开窗，直接聚焦已有窗口。
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1000,
    minHeight: 680,
    title: '网站风格提取器',
    backgroundColor: '#f8fafc',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  mainWindow.center();
  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // 站内链接一律外部浏览器打开，不在应用窗口里跳走。
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  // ./lib 下的模块都是命名导出（module.exports = { xxx }），必须解构后再用。
  const { extractSite } = require('./lib/extract-site.cjs');
  const {
    exportBundle,
    buildTokensCss,
    buildTokensJson,
    buildTailwindConfig,
    previewSystem,
    slugify,
  } = require('./lib/export-bundle.cjs');
  const { generate } = require('./lib/palette.cjs');
  const { captureThumbnail } = require('./lib/render-page.cjs');
  const { buildBrandKit } = require('./lib/brand-kit.cjs');
  const { finalizeBrand, parseBrandText, applyBrandPatch } = require('./lib/brand-finalize.cjs');
  const settings = require('./lib/settings.cjs');
  const ai = require('./lib/ai.cjs');
  const history = require('./lib/history.cjs');

  // 配置文件放在系统给的应用数据目录，卸载重装也还在。
  const settingsDir = app.getPath('userData');

  function brandHash(override) {
    if (!override) return 'auto';
    return crypto.createHash('sha1').update(JSON.stringify(override)).digest('hex').slice(0, 12);
  }

  // 设计体系生成一次要 300ms 上下，界面会连着点好几个预览，按结果指纹缓存一下。
  let systemCache = { key: '', value: null };
  function systemFor(result, override) {
    const key = [
      result.finalUrl || result.url,
      result.primaryLadder ? result.primaryLadder.seed : '',
      (result.colors || []).length,
      (result.fontSources && result.fontSources.files && result.fontSources.files.length) || 0,
      (result.imagery || []).length,
      (result.layoutHints && result.layoutHints.radius) || '',
      brandHash(override),
    ].join('|');
    if (systemCache.key === key && systemCache.value) return systemCache.value;
    const value = previewSystem(result, override || null);
    systemCache = { key, value };
    return value;
  }

  /** 本次抓取的「自动品牌」（不含手改与 AI 补全），finalize 与 AI 都拿它当底。 */
  function autoBrand(result) {
    return buildBrandKit(result).brand;
  }

  ipcMain.handle('extract:site', async (event, url, opts) => {
    const sender = event.sender;
    let lastSent = '';
    const onProgress = (payload) => {
      if (!sender || sender.isDestroyed()) return;
      // 同一条提示不重复推送，避免刷屏。
      if (payload && payload.id === lastSent) return;
      lastSent = payload && payload.id;
      sender.send('extract:progress', payload);
    };

    const resp = await extractSite(url, onProgress, { mode: opts && opts.mode });
    if (resp && resp.ok && resp.result) {
      try {
        history.save(resp.result);
      } catch {
        /* 历史写失败不影响本次结果 */
      }
    }
    return resp;
  });

  // 只在内存里生成文本用于界面预览，不写盘。override 是用户改过（或 AI 补全过）的 brand。
  ipcMain.handle('bundle:preview', (_event, result, override) => {
    if (!result) return { ok: false, error: '没有可预览的结果' };
    try {
      const system = systemFor(result, override);
      const files = Object.entries(system.files).map(([rel, content]) => ({
        path: rel,
        bytes: Buffer.byteLength(content, 'utf8'),
      }));
      return {
        ok: true,
        slug: system.slug,
        tokensCss: buildTokensCss(result),
        brandJson: system.brandJson,
        tailwindConfig: buildTailwindConfig(result),
        tokensJson: buildTokensJson(result),
        designMd: system.designMd,
        guideMd: system.guideMd,
        files,
        notes: system.notes || [],
      };
    } catch (e) {
      return { ok: false, error: `预览生成失败：${(e && e.message) || '未知错误'}` };
    }
  });

  // 按需取单个设计体系文件（kit.html 这类几十上百 KB，不整包塞给界面）。
  ipcMain.handle('system:file', (_event, result, relPath, override) => {
    if (!result || !relPath) return { ok: false, error: '缺少参数' };
    try {
      const system = systemFor(result, override);
      const content = system.files[relPath];
      if (typeof content !== 'string') return { ok: false, error: '这个文件不存在' };
      return { ok: true, content };
    } catch (e) {
      return { ok: false, error: `生成失败：${(e && e.message) || '未知错误'}` };
    }
  });

  // ── finalize：改完 brand.json 重新生成整套 ──
  ipcMain.handle('brand:finalize', (_event, result, brandText) => {
    if (!result) return { ok: false, error: '没有可用的提取结果' };
    const parsed = parseBrandText(brandText);
    if (!parsed.ok) return { ok: false, error: parsed.error, code: 'BAD_JSON' };
    try {
      const base = autoBrand(result);
      const finalized = finalizeBrand(base, parsed.brand);
      const system = previewSystem(result, finalized.brand);
      return {
        ok: true,
        brand: finalized.brand,
        brandJson: JSON.stringify(finalized.brand, null, 2),
        notes: finalized.notes,
        changed: finalized.changed,
        fileCount: Object.keys(system.files).length,
      };
    } catch (e) {
      return { ok: false, error: `重新生成失败：${(e && e.message) || '未知错误'}` };
    }
  });

  // 恢复成自动识别的结果（手改和 AI 补全都撤掉）。
  ipcMain.handle('brand:auto', (_event, result) => {
    if (!result) return { ok: false, error: '没有可用的提取结果' };
    try {
      const brand = autoBrand(result);
      return { ok: true, brand, brandJson: JSON.stringify(brand, null, 2) };
    } catch (e) {
      return { ok: false, error: `生成失败：${(e && e.message) || '未知错误'}` };
    }
  });

  ipcMain.handle('bundle:export', (_event, result, opts) => exportBundle(result, BrowserWindow, opts || {}));

  // ── AI 配置 ──
  ipcMain.handle('ai:providers', () => ({ ok: true, providers: settings.PROVIDERS }));

  ipcMain.handle('ai:config:get', () => {
    try {
      return { ok: true, config: settings.load(settingsDir) };
    } catch (e) {
      return { ok: false, error: `读取配置失败：${(e && e.message) || '未知错误'}` };
    }
  });

  ipcMain.handle('ai:config:save', (_event, patch) => {
    try {
      const saved = settings.save(settingsDir, patch || {});
      return saved.ok ? { ok: true, config: saved.config } : saved;
    } catch (e) {
      return { ok: false, error: `保存失败：${(e && e.message) || '未知错误'}` };
    }
  });

  ipcMain.handle('ai:config:clear', () => {
    try {
      return settings.clear(settingsDir);
    } catch (e) {
      return { ok: false, error: `清除失败：${(e && e.message) || '未知错误'}` };
    }
  });

  // 测试连接：界面上填的临时值优先；Key 留空时用已保存的那把。
  ipcMain.handle('ai:test', async (_event, draft) => {
    const saved = settings.resolve(settingsDir);
    const config = {
      baseUrl: settings.normalizeBaseUrl((draft && draft.baseUrl) || saved.baseUrl),
      model: String((draft && draft.model) || saved.model || '').trim(),
      apiKey: String((draft && draft.apiKey) || saved.apiKey || '').trim(),
      temperature: 0,
    };
    if (!config.baseUrl) return { ok: false, error: '先填接口地址，比如 https://api.deepseek.com/v1', code: 'NO_BASE_URL' };
    if (!config.model) return { ok: false, error: '先填模型名，比如 deepseek-chat', code: 'NO_MODEL' };
    if (!config.apiKey) return { ok: false, error: '先填 API Key', code: 'NO_KEY' };
    return ai.testConnection(config);
  });

  // 让模型补全品牌语气、文案与配色命名。
  ipcMain.handle('ai:enrich', async (_event, result, override) => {
    if (!result) return { ok: false, error: '没有可用的提取结果' };
    const config = settings.resolve(settingsDir);
    if (!config.configured) {
      return {
        ok: false,
        code: 'NO_CONFIG',
        error: '还没配置 AI 接口。点右上角「AI 设置」填一个 API Key 就能用。',
      };
    }
    try {
      const base = autoBrand(result);
      const current = override ? finalizeBrand(base, override).brand : base;
      const enriched = await ai.enrichBrand(config, { result, brand: current });
      if (!enriched.ok) return enriched;
      const merged = applyBrandPatch(current, enriched.patch);
      const finalized = finalizeBrand(base, merged);
      return {
        ok: true,
        brand: finalized.brand,
        brandJson: JSON.stringify(finalized.brand, null, 2),
        notes: enriched.notes,
        changed: finalized.changed,
        usage: enriched.usage,
        model: config.model,
      };
    } catch (e) {
      return { ok: false, error: `AI 处理失败：${(e && e.message) || '未知错误'}` };
    }
  });

  // 让模型为官网/公众号/App 商店各写一套分渠道文案（独立于 brand，进 copy.json）。
  ipcMain.handle('ai:copy', async (_event, result, override) => {
    if (!result) return { ok: false, error: '没有可用的提取结果' };
    const config = settings.resolve(settingsDir);
    if (!config.configured) {
      return {
        ok: false,
        code: 'NO_CONFIG',
        error: '还没配置 AI 接口。点右上角「AI 设置」填一个 API Key 就能用。',
      };
    }
    try {
      const base = autoBrand(result);
      const current = override ? finalizeBrand(base, override).brand : base;
      const generated = await ai.generateCopy(config, { result, brand: current });
      if (!generated.ok) return generated;
      return {
        ok: true,
        copy: generated.copy,
        notes: generated.notes,
        usage: generated.usage,
        model: config.model,
      };
    } catch (e) {
      return { ok: false, error: `AI 处理失败：${(e && e.message) || '未知错误'}` };
    }
  });

  // 手动换主色：只重算十阶，不重新联网。
  ipcMain.handle('palette:generate', (_event, seed) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(String(seed || ''))) return { ok: false, error: '色值格式不对' };
    return { ok: true, steps: generate(String(seed)) };
  });

  // 只读源码模式下补一张网站缩略图。
  ipcMain.handle('capture:thumbnail', (_event, url) => captureThumbnail(url));

  ipcMain.handle('history:list', () => ({ ok: true, items: history.list() }));
  ipcMain.handle('history:get', (_event, id) => {
    const item = history.get(id);
    return item ? { ok: true, result: item.result, savedAt: item.savedAt } : { ok: false, error: '这条记录已不存在' };
  });
  ipcMain.handle('history:remove', (_event, id) => ({ ok: true, items: history.remove(id) }));
  ipcMain.handle('history:clear', () => ({ ok: true, items: history.clear() }));

  ipcMain.handle('clipboard:write', (_event, text) => {
    clipboard.writeText(String(text ?? ''));
    return { ok: true };
  });

  ipcMain.handle('shell:open-external', (_event, url) => {
    if (!/^https?:\/\//i.test(String(url || ''))) return { ok: false };
    shell.openExternal(String(url));
    return { ok: true };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
