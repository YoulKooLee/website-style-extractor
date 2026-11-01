'use strict';

// 用隐藏窗口真正打开网页（执行 JS），把「渲染后的 DOM + 运行期注入的样式 + 计算样式」取回来，
// 再交给现有的静态提取器。全程只允许公网 http/https，内网与本机地址一律拦截。

const { BrowserWindow, session } = require('electron');
const { isPrivateHost, UA } = require('./fetch-http.cjs');

const LOAD_TIMEOUT_MS = 20000;
const SETTLE_MS = 1200;
const SHEET_CSS_CAP = 600_000;
const COMPUTED_RULES_CAP = 2500;

// 页面内执行：等字体就绪，抓样式表规则、计算样式、标题与最终地址。
const IN_PAGE_SCRIPT = `
(async () => {
  const out = { title: document.title || '', finalUrl: location.href || '', sheetCss: '', computedCss: '' };
  try { await document.fonts.ready; } catch (e) {}
  await new Promise((r) => setTimeout(r, 120));

  const sheetParts = [];
  let sheetLen = 0;
  for (const sheet of Array.from(document.styleSheets)) {
    let rules = null;
    try { rules = sheet.cssRules; } catch (e) { rules = null; }
    if (!rules) continue;
    const base = sheet.href || document.baseURI;
    for (const rule of Array.from(rules)) {
      let text = rule.cssText || '';
      if (!text) continue;
      // 相对路径（字体、图片）按这条样式表自己的地址补全，否则下游会算错。
      text = text.replace(/url\\(\\s*(['"]?)([^'")]+)\\1\\s*\\)/g, (m, q, u) => {
        if (/^(data:|https?:|\\/\\/)/i.test(u)) return m;
        try { return 'url("' + new URL(u, base).href + '")'; } catch (e) { return m; }
      });
      if (sheetLen + text.length > ${SHEET_CSS_CAP}) break;
      sheetParts.push(text);
      sheetLen += text.length;
    }
    if (sheetLen >= ${SHEET_CSS_CAP}) break;
  }
  out.sheetCss = sheetParts.join('\\n');

  const parts = [];
  const els = Array.from(document.querySelectorAll('*'));
  const cap = ${COMPUTED_RULES_CAP};
  const step = Math.max(1, Math.ceil(els.length / cap));
  let skipped = 0;
  for (let i = 0; i < els.length && parts.length < cap + skipped; i += step) {
    const el = els[i];
    if (!el || !el.tagName || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
    let cs = null;
    try { cs = getComputedStyle(el); } catch (e) { continue; }
    if (!cs) continue;
    const decl = [];
    const addColor = (prop, value) => {
      if (!value) return;
      if (!/^(rgba?\\(|#)/i.test(value)) return;
      if (/rgba\\([^)]*,\\s*0\\s*\\)$/.test(value)) return;
      decl.push(prop + ':' + value);
    };
    addColor('color', cs.color);
    addColor('background-color', cs.backgroundColor);
    addColor('border-top-color', cs.borderTopColor);
    addColor('outline-color', cs.outlineColor);
    addColor('text-decoration-color', cs.textDecorationColor);
    addColor('fill', cs.fill);
    if (cs.fontFamily) decl.push('font-family:' + cs.fontFamily);
    if (decl.length < 2) { skipped++; continue; }
    let cls = '';
    if (typeof el.className === 'string' && el.className.trim()) {
      cls = '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.');
    }
    const sel = (el.tagName.toLowerCase() + cls).replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 60) || 'div';
    parts.push(sel + '{' + decl.join(';') + ';}');
  }
  out.computedCss = parts.join('\\n');
  return out;
})()
`;

function normalizeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function assertPublic(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return '网址格式无法识别';
  }
  if (!/^https?:$/.test(u.protocol)) return '只支持 http/https 网址';
  if (isPrivateHost(u.hostname)) return '出于安全限制，不抓取本机与内网地址';
  return '';
}

/**
 * 打开页面并取回渲染结果。
 * @returns {Promise<null | {html:string, sheetCss:string, computedCss:string, finalUrl:string, title:string, screenshot:string|null}>}
 */
async function renderPage(rawUrl, opts = {}) {
  const bad = assertPublic(rawUrl);
  if (bad) return { error: bad, code: 'PRIVATE' };

  const wantShot = opts.wantScreenshot !== false;
  const timeoutMs = opts.timeoutMs || LOAD_TIMEOUT_MS;
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : () => {};

  // 独立的临时会话：不写盘、不与应用窗口共享 cookie。
  const ses = session.fromPartition(`brand-render-${Date.now()}`, { cache: true });
  ses.setUserAgent(UA);

  let win = null;
  let timer = null;

  try {
    win = new BrowserWindow({
      show: false,
      width: 1366,
      height: 900,
      webPreferences: {
        session: ses,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        javascript: true,
        images: true,
        backgroundThrottling: false,
        webSecurity: true,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.setAudioMuted(true);

    // 只放行公网 http/https：内网、本机、云元数据地址一律取消。
    ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      let blocked = false;
      try {
        const u = new URL(details.url);
        blocked = !/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname);
      } catch {
        blocked = true;
      }
      callback({ cancel: blocked });
    });

    onProgress({ id: 'render', label: '正在用内置浏览器打开页面…', percent: 20 });

    const loadPromise = win.loadURL(rawUrl);
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('RENDER_TIMEOUT')), timeoutMs);
    });
    await Promise.race([loadPromise, timeoutPromise]);
    clearTimeout(timer);
    timer = null;

    onProgress({ id: 'render-wait', label: '正在等页面加载完…', percent: 30 });
    // 先等文档进入 complete，再留一点时间给首屏动画和字体替换。
    for (let i = 0; i < 20; i += 1) {
      const ready = await win.webContents
        .executeJavaScript('document.readyState', true)
        .catch(() => 'complete');
      if (ready === 'complete') break;
      await new Promise((r) => setTimeout(r, 150));
    }
    await new Promise((r) => setTimeout(r, SETTLE_MS));

    onProgress({ id: 'render-read', label: '正在读取渲染后的页面…', percent: 40 });
    const harvest = await win.webContents.executeJavaScript(IN_PAGE_SCRIPT, true);

    let html = '';
    try {
      html = await win.webContents.executeJavaScript('document.documentElement.outerHTML', true);
    } catch {
      html = '';
    }

    let screenshot = null;
    let screenshotError = '';
    if (wantShot) {
      // 隐藏窗口偶尔会截到空白帧，隔一会儿重试两次。
      for (let attempt = 0; attempt < 3 && !screenshot; attempt += 1) {
        try {
          const image = await win.webContents.capturePage();
          if (image && !image.isEmpty()) {
            const resized = image.resize({ width: 900, quality: 'good' });
            const buf = resized.toJPEG(72);
            if (buf && buf.length > 1200) {
              screenshot = `data:image/jpeg;base64,${buf.toString('base64')}`;
              break;
            }
            screenshotError = 'capture-too-small';
          } else {
            screenshotError = 'capture-empty';
          }
        } catch (e) {
          screenshotError = `capture-failed: ${(e && e.message) || e}`;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    return {
      html: typeof html === 'string' ? html : '',
      sheetCss: harvest?.sheetCss || '',
      computedCss: harvest?.computedCss || '',
      finalUrl: harvest?.finalUrl || win.webContents.getURL() || rawUrl,
      title: harvest?.title || '',
      screenshot,
      screenshotError,
    };
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (msg.includes('RENDER_TIMEOUT')) return { error: '内置浏览器打开页面超时（20 秒）', code: 'RENDER_TIMEOUT' };
    return { error: '内置浏览器打不开这个页面', code: 'RENDER_FAIL' };
  } finally {
    if (timer) clearTimeout(timer);
    if (win && !win.isDestroyed()) win.destroy();
    try {
      await ses.clearStorageData();
      await ses.clearCache();
    } catch {
      /* 清理失败不影响结果 */
    }
  }
}

// 只补一张缩略图（用于「只读源码」模式下临时补图）。
async function captureThumbnail(rawUrl) {
  const r = await renderPage(rawUrl, { wantScreenshot: true, timeoutMs: 15000 });
  if (!r || r.error) return { ok: false, error: (r && r.error) || '截图失败' };
  if (!r.screenshot) return { ok: false, error: '这个页面没能截图' };
  return { ok: true, screenshot: r.screenshot, finalUrl: r.finalUrl };
}

module.exports = { renderPage, captureThumbnail, assertPublic, normalizeHost };
