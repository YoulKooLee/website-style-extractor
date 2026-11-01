'use strict';

// 字体：从 @font-face 里挑出能用的字体文件下载回来（woff2 优先），
// 同时记下 Google Fonts 的在线样式地址，便于直接 <link> 引用。

const { fetchBinary } = require('./fetch-http.cjs');

const MAX_FILES = 10;
const MAX_FILE_BYTES = 1_200_000;
const MAX_TOTAL_BYTES = 4_000_000;
const PREVIEW_DATAURL_MAX = 150_000;
const PREVIEW_DATAURL_COUNT = 3;
const MAX_FAMILIES = 8;

const ICON_FAMILY_RE = /icon|awesome|glyph|symbols|emoji|icomoon|fontello|pictogram|fallback/i;

const FORMAT_RANK = { woff2: 0, woff: 1, opentype: 2, truetype: 3 };
const FORMAT_EXT = { woff2: '.woff2', woff: '.woff', opentype: '.otf', truetype: '.ttf' };

const GENERIC_FONTS = new Set([
  'sans-serif', 'serif', 'monospace', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace',
  'cursive', 'fantasy', 'inherit', 'initial', 'unset', '-apple-system', 'blinkmacsystemfont',
  'segoe ui', 'arial', 'helvetica', 'helvetica neue', 'times new roman', 'courier new', 'emoji',
  'apple color emoji', 'segoe ui emoji', 'segoe ui symbol', 'noto color emoji',
]);

function formatFromUrl(url) {
  const m = /\.(woff2|woff|otf|ttf)(?:[?#]|$)/i.exec(url);
  if (!m) return null;
  const ext = m[1].toLowerCase();
  return ext === 'otf' ? 'opentype' : ext === 'ttf' ? 'truetype' : ext;
}

function coversLatin(range) {
  if (!range) return true;
  return /u\+0(?:0|1)?[0-9a-f]{2}\b|u\+0000/i.test(range);
}

function fontMagicOk(buf, format) {
  if (!buf || buf.length < 8) return false;
  const tag = buf.toString('latin1', 0, 4);
  if (format === 'woff2') return tag === 'wOF2';
  if (format === 'woff') return tag === 'wOFF';
  if (format === 'opentype') return tag === 'OTTO';
  if (format === 'truetype') return buf.readUInt32BE(0) === 0x00010000 || tag === 'true';
  return false;
}

function parseFontFaces(css, baseUrl) {
  const out = [];
  for (const block of (css || '').matchAll(/@font-face\s*\{([^}]+)\}/gi)) {
    const body = block[1];
    const family = /font-family\s*:\s*["']?([^;"'}]+?)["']?\s*(?:;|$)/i.exec(body)?.[1]?.trim();
    if (!family) continue;
    if (ICON_FAMILY_RE.test(family)) continue;
    if (GENERIC_FONTS.has(family.toLowerCase())) continue;
    if (!/src\s*:/i.test(body)) continue;

    const weight = /font-weight\s*:\s*([^;}]+)/i.exec(body)?.[1]?.trim() || '400';
    const style = /font-style\s*:\s*([^;}]+)/i.exec(body)?.[1]?.trim() || 'normal';
    const unicodeRange = /unicode-range\s*:\s*([^;}]+)/i.exec(body)?.[1]?.trim();

    let best = null;
    for (const m of body.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)(?:\s*format\(\s*["']?([^"')]+)["']?\s*\))?/gi)) {
      const raw = m[1].trim();
      if (raw.startsWith('data:')) continue; // 内联字体体积不可控，跳过
      const fmt = (m[2]?.trim().toLowerCase() || formatFromUrl(raw) || '').replace('font/', '');
      const key = fmt === 'otf' ? 'opentype' : fmt === 'ttf' ? 'truetype' : fmt;
      if (!(key in FORMAT_RANK)) continue;
      let abs;
      try {
        abs = new URL(raw, baseUrl).href;
      } catch {
        continue;
      }
      if (best && FORMAT_RANK[best.format] <= FORMAT_RANK[key]) continue;
      best = { url: abs, format: key };
    }
    if (!best) continue;
    out.push({ family, weight, style, url: best.url, format: best.format, unicodeRange });
  }
  return out;
}

function slugFamily(family) {
  return family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'font';
}

function fileSlug(ref) {
  const w = String(ref.weight).replace(/\s+/g, '-');
  const s = ref.style && ref.style !== 'normal' ? `-${ref.style.replace(/[^a-z]/gi, '')}` : '';
  return `${slugFamily(ref.family)}-${w}${s}${FORMAT_EXT[ref.format] || '.woff2'}`;
}

function isGoogleFontUrl(url) {
  return /^https?:\/\/fonts\.(googleapis|gstatic)\.com\//i.test(url);
}

function pickBest(refs, preferFamilies) {
  const rank = (ref) => {
    let score = 0;
    if (!coversLatin(ref.unicodeRange)) score += 40;
    score += (FORMAT_RANK[ref.format] ?? 9) * 4;
    const w = String(ref.weight).trim();
    if (w === '400' || w === 'normal') score += 0;
    else if (w === '700' || w === 'bold') score += 1;
    else score += 2;
    return score;
  };
  return [...refs].sort((a, b) => rank(a) - rank(b))[0];
}

/**
 * 解析样式里的字体，按家族归并；能下载的把文件取回来（带体积上限）。
 * @param {string|Array<{url:string,css:string}>} sheetsOrCss 每个样式表带自己的地址，相对路径才不会算错
 * @returns {Promise<{families:Array, files:Array}>}
 */
async function collectFontSources(sheetsOrCss, fallbackBaseUrl, opts = {}) {
  const sheets = typeof sheetsOrCss === 'string'
    ? [{ url: fallbackBaseUrl, css: sheetsOrCss }]
    : (sheetsOrCss || []).map((s) => ({ url: s.url || fallbackBaseUrl, css: s.css || '' }));
  const preferFamilies = (opts.preferFamilies || []).map((f) => f.toLowerCase());
  const usedFamilies = opts.usedFamilies || [];

  // 每个样式表按自己的地址解析，才能拿到正确的字体文件绝对地址。
  const refs = [];
  const googleFamilyCss = new Map();
  for (const sheet of sheets) {
    if (!sheet.css) continue;
    const parsed = parseFontFaces(sheet.css, sheet.url || fallbackBaseUrl);
    const isGoogleSheet = /^https?:\/\/fonts\.googleapis\.com\//i.test(sheet.url || '');
    for (const ref of parsed) {
      refs.push(ref);
      if (isGoogleSheet && !googleFamilyCss.has(ref.family.toLowerCase())) {
        googleFamilyCss.set(ref.family.toLowerCase(), sheet.url);
      }
    }
  }

  const byFamily = new Map();
  for (const ref of refs) {
    const key = ref.family.toLowerCase();
    if (!byFamily.has(key)) byFamily.set(key, { family: ref.family, refs: [] });
    byFamily.get(key).refs.push(ref);
  }

  // 先把「页面上真正用到的家族」排前面，其次是有字体文件的家族。
  const ordered = [...byFamily.values()].sort((a, b) => {
    const ia = preferFamilies.indexOf(a.family.toLowerCase());
    const ib = preferFamilies.indexOf(b.family.toLowerCase());
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  const files = [];
  const families = [];
  let total = 0;

  for (const entry of ordered) {
    if (families.length >= MAX_FAMILIES) break;
    const ref = pickBest(entry.refs, preferFamilies);
    const key = entry.family.toLowerCase();
    const googleCssUrl = googleFamilyCss.get(key) || '';
    const kind = googleCssUrl ? 'google' : isGoogleFontUrl(ref.url) ? 'google' : 'self';

    let downloaded = null;
    if (files.length < MAX_FILES && total < MAX_TOTAL_BYTES) {
      const bin = await fetchBinary(ref.url, fallbackBaseUrl);
      if (bin && bin.buf.length > 0 && bin.buf.length <= MAX_FILE_BYTES && fontMagicOk(bin.buf, ref.format)) {
        const file = fileSlug(ref);
        total += bin.buf.length;
        downloaded = {
          family: entry.family,
          weight: ref.weight,
          style: ref.style,
          file,
          format: ref.format,
          bytes: bin.buf.length,
          sourceUrl: ref.url,
          unicodeRange: ref.unicodeRange || '',
          dataUrl: `data:font/${ref.format === 'opentype' ? 'otf' : ref.format};base64,${bin.buf.toString('base64')}`,
        };
        files.push(downloaded);
      }
    }

    families.push({
      family: entry.family,
      kind,
      cssUrl: googleCssUrl,
      weight: ref.weight,
      style: ref.style,
      format: ref.format,
      sourceUrl: ref.url,
      bytes: downloaded ? downloaded.bytes : 0,
      file: downloaded ? downloaded.file : '',
      previewDataUrl: '',
    });
  }

  // 只给排在前面的几个「真正用得到」的家族内联预览数据，控制体积。
  let previewBudget = PREVIEW_DATAURL_COUNT;
  for (const fam of families) {
    if (previewBudget <= 0) break;
    const hit = files.find((f) => f.family === fam.family && f.bytes <= PREVIEW_DATAURL_MAX);
    if (hit) {
      fam.previewDataUrl = hit.dataUrl;
      previewBudget -= 1;
    }
  }

  // 页面用到但完全没有 @font-face 的家族，标注为系统字体。
  for (const name of usedFamilies.slice(0, 10)) {
    if (families.some((f) => f.family.toLowerCase() === name.toLowerCase())) continue;
    if (GENERIC_FONTS.has(name.toLowerCase())) continue;
    if (ICON_FAMILY_RE.test(name)) continue;
    families.push({
      family: name,
      kind: 'system',
      cssUrl: '',
      weight: '400',
      style: 'normal',
      format: '',
      sourceUrl: '',
      bytes: 0,
      file: '',
      previewDataUrl: '',
    });
  }

  return { families, files };
}

// 生成 @font-face 样式；urlPrefix 为空时用内联 dataURL（界面预览用）。
function buildFontFaceCss(files, urlPrefix) {
  return (files || [])
    .filter((f) => f.file)
    .map((f) => {
      const src = urlPrefix ? `${urlPrefix}${f.file}` : f.dataUrl;
      if (!src) return '';
      return [
        '@font-face {',
        `  font-family: "${String(f.family).replace(/"/g, '')}";`,
        `  src: url("${src}") format("${f.format}");`,
        `  font-weight: ${f.weight};`,
        `  font-style: ${f.style};`,
        ...(f.unicodeRange ? [`  unicode-range: ${f.unicodeRange};`] : []),
        '  font-display: swap;',
        '}',
      ].join('\n');
    })
    .filter(Boolean)
    .join('\n');
}

module.exports = { collectFontSources, parseFontFaces, buildFontFaceCss, GENERIC_FONTS, ICON_FAMILY_RE };
