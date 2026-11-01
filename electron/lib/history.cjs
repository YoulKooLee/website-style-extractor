'use strict';

// 本地历史：只写 userData/history.json，不联网、不依赖账号。
// 为避免文件膨胀，保存时会对标志图片做体积裁剪（只留小图，最多 4 个）。

const fs = require('node:fs');
const path = require('node:path');

const MAX_ITEMS = 8;
const LOGO_CHAR_BUDGET = 900_000;
const LOGO_MAX_CHARS = 350_000;

let cache = null;

function dataPath() {
  const { app } = require('electron');
  return path.join(app.getPath('userData'), 'history.json');
}

function load() {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(fs.readFileSync(dataPath(), 'utf8'));
    cache = Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    cache = [];
  }
  return cache;
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(dataPath()), { recursive: true });
    fs.writeFileSync(dataPath(), JSON.stringify({ version: 1, items: cache }, null, 1), 'utf8');
  } catch {
    /* 写盘失败不影响当前结果展示 */
  }
}

function hostOf(result) {
  try {
    return new URL(result.finalUrl || result.url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function trimLogos(logos) {
  const out = [];
  let used = 0;
  for (const logo of logos || []) {
    if (!logo || !logo.dataUrl) continue;
    if (logo.dataUrl.length > LOGO_MAX_CHARS) continue;
    if (used + logo.dataUrl.length > LOGO_CHAR_BUDGET) continue;
    used += logo.dataUrl.length;
    out.push(logo);
    if (out.length >= 4) break;
  }
  return out;
}

// 历史里只留两张小素材图（够看得出来源站长什么样），大的全丢，避免 history.json 膨胀。
function trimImagery(imagery) {
  const out = [];
  let used = 0;
  for (const item of imagery || []) {
    if (!item || !item.dataUrl) continue;
    if (item.dataUrl.length > 120_000) continue;
    if (used + item.dataUrl.length > 260_000) continue;
    used += item.dataUrl.length;
    out.push(item);
    if (out.length >= 2) break;
  }
  return out;
}

// 历史里不留字体文件本体（太大），只留名字和体积；字体文件在导出时才有用。
function trimFontSources(fontSources) {
  if (!fontSources) return { families: [], files: [] };
  return {
    families: (fontSources.families || []).map((f) => ({ ...f, previewDataUrl: '' })),
    files: (fontSources.files || []).map(({ dataUrl, ...rest }) => rest),
  };
}

const SCREENSHOT_MAX_CHARS = 220_000;

function iconFor(logos) {
  const order = ['favicon', 'apple-touch-icon', 'inline-svg', 'favicon-service', 'header-img', 'og-image'];
  for (const kind of order) {
    const hit = (logos || []).find((l) => l.kind === kind && l.dataUrl && l.dataUrl.length < 120_000);
    if (hit) return hit.dataUrl;
  }
  return (logos || []).find((l) => l.dataUrl && l.dataUrl.length < 120_000)?.dataUrl || '';
}

function toMeta(result) {
  return {
    siteName: result.siteName || '',
    title: result.title || '',
    description: result.description || '',
    host: hostOf(result),
    url: result.url || '',
    finalUrl: result.finalUrl || '',
    primary: result.primaryLadder?.seed || '',
    blocked: !!result.blocked,
    icon: iconFor(result.logos),
  };
}

function list() {
  return load().map((item) => ({ id: item.id, savedAt: item.savedAt, ...item.meta }));
}

function save(result) {
  if (!result) return list();
  const host = hostOf(result);
  // 同一个站点只留最新一次，避免列表被重复项占满。
  cache = load().filter((item) => host && item.meta?.host !== host);

  const entry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
    meta: toMeta(result),
    result: {
      ...result,
      logos: trimLogos(result.logos),
      imagery: trimImagery(result.imagery),
      fontSources: trimFontSources(result.fontSources),
      screenshot:
        result.screenshot && result.screenshot.length <= SCREENSHOT_MAX_CHARS ? result.screenshot : null,
    },
  };

  cache.unshift(entry);
  if (cache.length > MAX_ITEMS) cache = cache.slice(0, MAX_ITEMS);
  persist();
  return list();
}

function get(id) {
  return load().find((item) => item.id === id) || null;
}

function remove(id) {
  cache = load().filter((item) => item.id !== id);
  persist();
  return list();
}

function clear() {
  cache = [];
  persist();
  return list();
}

module.exports = { save, list, get, remove, clear };
