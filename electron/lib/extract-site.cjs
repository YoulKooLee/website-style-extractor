'use strict';

const { normalizeUrl, fetchText } = require('./fetch-http.cjs');
const { extractColors, pickPrimary } = require('./colors.cjs');
const { extractFonts } = require('./fonts.cjs');
const { harvestLogos } = require('./logos.cjs');
const { extractMeta } = require('./meta.cjs');
const { collectCss } = require('./css-collect.cjs');
const { generate } = require('./palette.cjs');
const { renderPage } = require('./render-page.cjs');
const { collectFontSources } = require('./webfonts.cjs');
const { harvestImagery } = require('./imagery.cjs');
const { collectLayoutHints } = require('./layout.cjs');

const HTML_CAP = 6_000_000;

const CHALLENGE_TITLE_RE =
  /just a moment|attention required|access denied|verifying you are human|checking your browser|security check|please verify|are you a robot|ddos[- ]guard|captcha/i;
const CHALLENGE_MARKER_RE =
  /cf-browser-verification|_cf_chl_opt|enable javascript and cookies to continue|px-captcha|_incapsula_|EO_Bot_Ssid|__tst_status/i;
const CHALLENGE_AMBIGUOUS_RE = /challenges\.cloudflare\.com|cf-turnstile|datadome/i;

function looksContentRich(html) {
  const scan = html.slice(0, 400_000);
  const anchors = (scan.match(/<a\s[^>]*\bhref=/gi) ?? []).length;
  const headings = (scan.match(/<h[1-3][\s/>]/gi) ?? []).length;
  const paragraphs = (scan.match(/<p[\s/>]/gi) ?? []).length;
  return anchors >= 8 || headings >= 3 || (anchors >= 3 && paragraphs >= 3);
}

// 只认真正的验证页：标题命中、或有验证页专属标记；可嵌入的组件标记还要页面够空才算。
function looksBlocked(html) {
  if (!html) return false;
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '';
  if (CHALLENGE_TITLE_RE.test(title)) return true;
  const head = html.slice(0, 60_000);
  if (CHALLENGE_MARKER_RE.test(head)) return true;
  if (CHALLENGE_AMBIGUOUS_RE.test(head)) return !looksContentRich(html);
  return false;
}

function emptyMeta() {
  return { title: '', description: '', siteName: '', headings: [], paragraphs: [], navLabels: [] };
}

// 从 HTML（+ 可选运行期样式）里抽出颜色、字体、文案；标志单独在最后抓一次，避免重复下载。
async function analyze(html, baseUrl, seedCss) {
  const blocked = looksBlocked(html);
  if (blocked) {
    return {
      blocked,
      colors: [],
      fonts: [],
      fontFaceFamilies: [],
      meta: emptyMeta(),
      css: '',
      googleSheets: [],
    };
  }
  const collected = await collectCss(html, baseUrl, seedCss);
  const colors = extractColors(collected.css);
  const f = extractFonts(collected.css);
  return {
    blocked,
    colors,
    fonts: f.fonts,
    fontFaceFamilies: f.fontFaceFamilies,
    meta: extractMeta(html, baseUrl),
    css: collected.css,
    sheets: collected.sheets,
    googleSheets: collected.googleSheets,
    layoutHints: collectLayoutHints(collected.css),
  };
}

function needsRender(analysis) {
  if (!analysis) return true;
  if (analysis.blocked) return true;
  const chromatic = analysis.colors.filter((c) => !c.extreme);
  return chromatic.length < 2 || (analysis.meta.headings.length === 0 && !analysis.meta.description);
}

/**
 * 提取主流程。
 * @param {string} inputUrl
 * @param {(p:{id:string,label:string,percent:number})=>void} onProgress
 * @param {{mode?: 'auto'|'static'|'render'}} opts
 */
async function extractSite(inputUrl, onProgress, opts = {}) {
  const mode = opts.mode === 'render' || opts.mode === 'static' ? opts.mode : 'auto';
  const report = (id, label, percent) => {
    if (typeof onProgress !== 'function') return;
    try {
      onProgress({ id, label, percent });
    } catch {
      /* 进度推送失败不影响主流程 */
    }
  };

  report('check', '正在检查网址…', 6);
  const norm = normalizeUrl(inputUrl);
  if (norm.error) return { ok: false, code: norm.code || 'BAD_URL', error: norm.error };

  let html = '';
  let baseUrl = norm.url;
  let analysis = null;
  let screenshot = null;
  let screenshotError = '';
  let fetchMode = 'static';
  let renderError = '';

  if (mode !== 'render') {
    report('fetch', '正在打开网页…', 16);
    const page = await fetchText(norm.url, HTML_CAP, true);
    if (page) {
      html = page.text;
      baseUrl = page.finalUrl;
      report('css', '正在整理网页样式…', 34);
      analysis = await analyze(html, baseUrl);
    } else if (mode === 'static') {
      return {
        ok: false,
        code: 'NETWORK',
        error: '网页没有返回内容（可能网络不通、超时或站点拒绝访问）',
      };
    }
  }

  const wantRender = mode === 'render' || (mode === 'auto' && needsRender(analysis));
  if (wantRender) {
    report('render', '正在用内置浏览器打开页面…', 24);
    const rendered = await renderPage(norm.url, { onProgress: report });
    if (rendered && !rendered.error && rendered.html) {
      html = rendered.html;
      baseUrl = rendered.finalUrl || baseUrl;
      screenshot = rendered.screenshot || null;
      screenshotError = rendered.screenshotError || '';
      fetchMode = 'render';
      report('css', '正在整理渲染后的样式…', 52);
      const seedCss = [rendered.sheetCss, rendered.computedCss].filter(Boolean).join('\n');
      analysis = await analyze(html, baseUrl, seedCss);
    } else if (!analysis) {
      return {
        ok: false,
        code: (rendered && rendered.code) || 'RENDER_FAIL',
        error: (rendered && rendered.error) || '内置浏览器打不开这个页面',
      };
    } else {
      renderError = (rendered && rendered.error) || '内置浏览器打不开这个页面';
    }
  }

  if (!analysis) {
    return { ok: false, code: 'NETWORK', error: '网页没有返回内容（可能网络不通、超时或站点拒绝访问）' };
  }

  report('logo', '正在寻找标志…', 76);
  const logos = await harvestLogos(analysis.blocked ? '' : html, baseUrl);

  report('imagery', '正在收集站点素材图…', 80);
  let imagery = [];
  try {
    imagery = await harvestImagery(analysis.blocked ? '' : html, baseUrl);
  } catch {
    imagery = [];
  }

  report('ladder', '正在展开主色色阶…', 84);
  const primary = pickPrimary(analysis.colors);
  let primaryLadder = null;
  if (primary && /^#[0-9a-fA-F]{6}$/.test(primary)) {
    primaryLadder = { seed: primary, steps: generate(primary) };
  }

  let fontSources = { families: [], files: [] };
  if (!analysis.blocked && analysis.css) {
    report('fonts', '正在下载字体文件…', 90);
    try {
      fontSources = await collectFontSources(analysis.sheets || analysis.css, baseUrl, {
        preferFamilies: analysis.fonts.map((f) => f.family),
        usedFamilies: [...analysis.fonts.map((f) => f.family), ...analysis.fontFaceFamilies],
      });
    } catch {
      fontSources = { families: [], files: [] };
    }
  }

  const thin =
    analysis.blocked ||
    analysis.colors.filter((c) => !c.extreme).length < 3 ||
    (analysis.meta.headings.length === 0 && !analysis.meta.description);

  report('done', '已完成', 100);

  return {
    ok: true,
    result: {
      url: norm.url,
      finalUrl: baseUrl,
      siteName: analysis.meta.siteName,
      title: analysis.meta.title,
      description: analysis.meta.description,
      colors: analysis.colors,
      fonts: analysis.fonts,
      fontFaceFamilies: analysis.fontFaceFamilies,
      logos,
      imagery,
      layoutHints: analysis.layoutHints || { radius: 6, borderWidth: 1 },
      headings: analysis.meta.headings,
      paragraphs: analysis.meta.paragraphs,
      navLabels: analysis.meta.navLabels,
      blocked: analysis.blocked,
      thin,
      primaryLadder,
      fetchMode,
      screenshot,
      screenshotError,
      renderError,
      fontSources,
      googleFontsUrls: analysis.googleSheets.map((s) => s.url),
      extractedAt: new Date().toISOString(),
    },
  };
}

module.exports = { extractSite, looksBlocked };
