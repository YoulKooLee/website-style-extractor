'use strict';

/**
 * 把「网站风格提取器」的提取结果映射成原版引擎认的 Brand 对象。
 *
 * 原版这套体系的关键是「语义色角色」——background / surface / foreground /
 * muted / border / accent / accent-secondary，seed 就是从这几个角色里取的。
 * 我们不接大模型，所以角色靠 CSS 里的真实信号（属性名 + 选择器）来判，
 * 判不出来才退回按亮度/彩度推断。
 */

const { luma } = require('./colors.cjs');

// ─────────────────────────── 颜色小工具 ───────────────────────────

function rgbOf(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function hexOf({ r, g, b }) {
  const to = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function saturation(hex) {
  const { r, g, b } = rgbOf(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function hueOf(hex) {
  const { r, g, b } = rgbOf(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

/** WCAG 相对亮度，用来算对比度（跟简单 Rec709 亮度不是一回事）。 */
function relativeLuminance(hex) {
  const { r, g, b } = rgbOf(hex);
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

function mix(a, b, t) {
  const ca = rgbOf(a);
  const cb = rgbOf(b);
  return hexOf({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

// ─────────────────────────── 角色推断 ───────────────────────────

const ROLE_META = {
  background: { name: 'Background', usage: 'page canvas' },
  surface: { name: 'Surface', usage: 'cards / raised surfaces' },
  foreground: { name: 'Foreground', usage: 'body text' },
  muted: { name: 'Muted', usage: 'secondary text' },
  border: { name: 'Border', usage: 'hairlines / dividers' },
  accent: { name: 'Accent', usage: 'primary brand color' },
  'accent-secondary': { name: 'Accent secondary', usage: 'secondary brand color / links' },
};

const ROLE_ORDER = [
  'background',
  'surface',
  'foreground',
  'muted',
  'border',
  'accent',
  'accent-secondary',
];

function sourceOf(color) {
  return (color.sources || []).join(' ').toLowerCase();
}

function isNeutral(hex) {
  return saturation(hex) < 0.14;
}

function pickValidColors(colors) {
  const seen = new Set();
  const out = [];
  for (const color of colors || []) {
    if (!color || typeof color.hex !== 'string') continue;
    if (!/^#[0-9a-f]{6}$/.test(color.hex)) continue;
    if (seen.has(color.hex)) continue;
    seen.add(color.hex);
    out.push({ hex: color.hex, count: Number(color.count) || 1, sources: color.sources || [] });
  }
  return out.sort((a, b) => b.count - a.count);
}

/** 按「CSS 属性 + 选择器」找最像的那个色；找不到就 null。 */
function bySignal(colors, propRe, selectorRe) {
  for (const color of colors) {
    const source = sourceOf(color);
    if (!propRe.test(source)) continue;
    if (selectorRe && !selectorRe.test(source)) continue;
    return color;
  }
  return null;
}

const ROOT_SELECTOR = /\bselector:(\*|html|body|:root|#__next|#app|#root)\b/;

function inferBackground(colors) {
  const signaled = bySignal(colors, /prop:background[-\w]*/, ROOT_SELECTOR);
  if (signaled) return signaled;

  const light = colors.find((c) => isNeutral(c.hex) && luma(c.hex) > 0.9);
  if (light) return light;
  const dark = colors.find((c) => isNeutral(c.hex) && luma(c.hex) < 0.08);
  if (dark) return dark;
  const neutral = colors.find((c) => isNeutral(c.hex));
  return neutral || { hex: '#ffffff', count: 1, sources: [] };
}

function inferForeground(colors, background) {
  const signaled = bySignal(colors, /prop:color\b/, ROOT_SELECTOR);
  if (signaled && contrast(signaled.hex, background.hex) >= 4.5) return signaled;

  let best = null;
  let bestContrast = 0;
  for (const color of colors.slice(0, 16)) {
    if (!isNeutral(color.hex)) continue;
    if (color.hex === background.hex) continue;
    const ratio = contrast(color.hex, background.hex);
    if (ratio > bestContrast) {
      best = color;
      bestContrast = ratio;
    }
  }
  if (best && bestContrast >= 3) return best;

  // 站点 CSS 里没有可靠的中性色，就按背景明暗直接给一个能读的
  return { hex: luma(background.hex) > 0.5 ? '#111111' : '#f5f5f5', count: 1, sources: [] };
}

function inferSurface(colors, background, foreground) {
  const bgLuma = luma(background.hex);
  let best = null;
  let bestScore = Infinity;
  for (const color of colors.slice(0, 18)) {
    if (!isNeutral(color.hex)) continue;
    if (color.hex === background.hex || color.hex === foreground.hex) continue;
    const delta = Math.abs(luma(color.hex) - bgLuma);
    if (delta < 0.015) continue;
    if (delta > 0.35) continue;
    // 越接近背景、出现越多，越像卡片底色
    const score = delta * 6 - Math.log2(color.count + 1) * 0.01;
    if (score < bestScore) {
      best = color;
      bestScore = score;
    }
  }
  if (best) return best;
  return {
    hex: bgLuma > 0.5 ? mix(background.hex, '#000000', 0.04) : mix(background.hex, '#ffffff', 0.06),
    count: 1,
    sources: [],
  };
}

function inferBorder(colors, background, foreground) {
  // 边框通常是无彩色；品牌色描边（按钮边框）不能拿来当分隔线，所以要过一遍彩度。
  const signaled = bySignal(colors, /prop:border[-\w]*/);
  if (signaled && signaled.hex !== background.hex && isNeutral(signaled.hex) && luma(signaled.hex) > 0.05) {
    return signaled;
  }

  const bgLuma = luma(background.hex);
  let best = null;
  let bestScore = Infinity;
  for (const color of colors.slice(0, 18)) {
    if (!isNeutral(color.hex)) continue;
    if (color.hex === background.hex || color.hex === foreground.hex) continue;
    const delta = Math.abs(luma(color.hex) - bgLuma);
    if (delta < 0.03 || delta > 0.5) continue;
    const score = Math.abs(delta - 0.12);
    if (score < bestScore) {
      best = color;
      bestScore = score;
    }
  }
  if (best) return best;
  return { hex: mix(background.hex, foreground.hex, 0.16), count: 1, sources: [] };
}

function inferMuted(colors, background, foreground) {
  const bgLuma = luma(background.hex);
  const fgLuma = luma(foreground.hex);
  const target = fgLuma * 0.55 + bgLuma * 0.45;

  let best = null;
  let bestScore = Infinity;
  for (const color of colors.slice(0, 18)) {
    if (!isNeutral(color.hex)) continue;
    const distance = Math.abs(luma(color.hex) - target);
    if (distance < bestScore) {
      best = color;
      bestScore = distance;
    }
  }
  if (best && bestScore < 0.18) return best;
  return { hex: mix(background.hex, foreground.hex, 0.45), count: 1, sources: [] };
}

/** 次要品牌色：跟主色色相差得够远的、有彩度的高频色。 */
function inferAccentSecondary(colors, accentHex) {
  const accentHue = hueOf(accentHex);
  let best = null;
  let bestCount = 0;
  for (const color of colors) {
    if (color.hex === accentHex) continue;
    if (saturation(color.hex) < 0.22) continue;
    const l = luma(color.hex);
    if (l < 0.06 || l > 0.94) continue;
    let hueDistance = Math.abs(hueOf(color.hex) - accentHue);
    if (hueDistance > 180) hueDistance = 360 - hueDistance;
    if (hueDistance < 40) continue;
    if (color.count > bestCount) {
      best = color;
      bestCount = color.count;
    }
  }
  return best;
}

function buildColorRoles(result) {
  const colors = pickValidColors(result.colors);
  const accentHex = result.primaryLadder && result.primaryLadder.seed
    ? result.primaryLadder.seed
    : colors.find((c) => !c.extreme && saturation(c.hex) > 0.2)?.hex || '#1677ff';

  const background = inferBackground(colors);
  const foreground = inferForeground(colors, background);
  const surface = inferSurface(colors, background, foreground);
  const border = inferBorder(colors, background, foreground);
  const muted = inferMuted(colors, background, foreground);
  const accentSecondary = inferAccentSecondary(colors, accentHex);

  const picked = {
    background,
    surface,
    foreground,
    muted,
    border,
    accent: { hex: accentHex, count: 1, sources: ['primary-picker'] },
    'accent-secondary': accentSecondary,
  };

  return ROLE_ORDER.filter((role) => picked[role]).map((role) => ({
    role,
    hex: picked[role].hex,
    oklch: '',
    name: ROLE_META[role].name,
    usage: ROLE_META[role].usage,
  }));
}

// ─────────────────────────── 文案与字体 ───────────────────────────

function cleanText(value, max = 240) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

/** 取第一句（按句末标点切），拿不到就整段当一句。 */
function firstSentence(value, max = 400) {
  const text = cleanText(value, max);
  if (!text) return '';
  const matched = /^(.{4,80}?)[。.!?！？；;]/.exec(text);
  return matched ? matched[1].trim() : text;
}

/**
 * 取一句「标语」放进 hero。模板里 hero 标题字号很大，中文一句 30 个字就会顶到
 * 四行，所以按「显示宽度」压到两行以内（中文按 2 个单位算），优先在顿号/逗号处断开。
 */
function shortTagline(value, maxUnits = 44) {
  const sentence = firstSentence(value, 120);
  if (!sentence) return '';
  const width = (text) =>
    [...text].reduce((sum, ch) => sum + (/[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 2 : 1), 0);
  if (width(sentence) <= maxUnits) return sentence;

  const parts = sentence.split(/[、，,]/).map((part) => part.trim()).filter(Boolean);
  let kept = '';
  for (const part of parts) {
    const next = kept ? `${kept}、${part}` : part;
    if (width(next) > maxUnits) break;
    kept = next;
  }
  if (width(kept) >= 10) return `${kept}…`;

  let clipped = '';
  for (const ch of sentence) {
    if (width(clipped + ch) > maxUnits) break;
    clipped += ch;
  }
  return `${clipped.trim()}…`;
}

function fontSpec(family, fallbacks = []) {
  return { family: family || 'Inter', fallbacks, weights: [400, 700] };
}

function pickFonts(result) {
  const measured = (result.fonts || []).map((f) => f.family).filter(Boolean);
  const declared = (result.fontFaceFamilies || []).filter(Boolean);
  const primary = measured[0] || declared[0] || 'Inter';
  const monoCandidate = [...measured, ...declared].find((f) => /mono|code|consol|courier/i.test(f));

  const typography = {
    display: fontSpec(primary),
    body: fontSpec(primary),
  };
  if (monoCandidate) typography.mono = fontSpec(monoCandidate);
  return typography;
}

function buildVoice(result, brandName) {
  const headings = (result.headings || []).map((h) => cleanText(h, 90)).filter(Boolean);
  const pillars = headings.slice(0, 3);
  const description = cleanText(result.description, 200);
  if (pillars.length === 0) {
    if (description) pillars.push(description);
    if (brandName) pillars.push(`${brandName} 官网`);
  }

  return {
    adjectives: ['clear', 'confident', 'modern'],
    tone: headings.length > 0 ? 'direct and product-led' : 'calm and descriptive',
    messagingPillars: pillars,
    vocabulary: {
      use: (result.navLabels || []).map((n) => cleanText(n, 24)).filter(Boolean).slice(0, 6),
      avoid: [],
    },
  };
}

function buildImagery(result, imageryItems) {
  const samples = (imageryItems || []).slice(0, 8).map((item, index) => ({
    file: `imagery/${fileNameFor(item, index)}`,
    kind: item.kind,
    caption: cleanText(item.caption, 60) || `${item.kind} ${index + 1}`,
  }));
  return {
    style: samples.length > 0 ? 'site-native photography / illustration' : '',
    subjects: [],
    treatment: samples.length > 0 ? 'as published on the source site' : '',
    avoid: [],
    samples,
  };
}

function extFromContentType(type, sourceUrl) {
  const byExt = /\.(png|jpe?g|webp|avif|gif)(?:[?#]|$)/i.exec(sourceUrl || '');
  if (byExt) return `.${byExt[1].toLowerCase().replace('jpeg', 'jpg')}`;
  if (/png/i.test(type)) return '.png';
  if (/webp/i.test(type)) return '.webp';
  if (/avif/i.test(type)) return '.avif';
  if (/gif/i.test(type)) return '.gif';
  return '.jpg';
}

function fileNameFor(item, index) {
  return `${item.kind === 'cover' ? 'cover' : 'hero'}-${index}${extFromContentType(item.dataUrl, item.sourceUrl)}`;
}

// ─────────────────────────── 主入口 ───────────────────────────

function siteSlug(result) {
  try {
    const host = new URL(result.finalUrl || result.url).hostname.replace(/^www\./i, '');
    const core = host.split('.')[0] || 'brand';
    const ascii = core.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return ascii || 'brand';
  } catch {
    return 'brand';
  }
}

function buildBrandKit(result, opts = {}) {
  const host = (() => {
    try {
      return new URL(result.finalUrl || result.url).hostname.replace(/^www\./i, '');
    } catch {
      return '';
    }
  })();

  const name = cleanText(result.siteName || result.title || host || 'Brand', 60) || 'Brand';
  const headings = (result.headings || []).map((h) => cleanText(h, 120)).filter(Boolean);
  const paragraphs = (result.paragraphs || []).map((p) => cleanText(p, 400)).filter(Boolean);
  const description =
    paragraphs[0] || cleanText(result.description, 400) || headings[1] || '';
  // 标语要短：hero 标题就靠它，整段简介会撑破版式
  const tagline = shortTagline(result.description) || headings[0] || '';

  const logos = (result.logos || []).filter((logo) => logo && logo.dataUrl);
  const imageryItems = opts.imagery || result.imagery || [];
  const layoutHints = result.layoutHints || { radius: 6, borderWidth: 1 };

  const brand = {
    name,
    tagline,
    description,
    sourceUrl: result.finalUrl || result.url || '',
    logo: {
      primary: logos[0] ? `logos/${logoFileName(logos[0], 0)}` : null,
      alternates: logos.slice(1).map((logo, index) => `logos/${logoFileName(logo, index + 1)}`),
      notes: '',
    },
    colors: buildColorRoles(result),
    typography: pickFonts(result),
    voice: buildVoice(result, name),
    imagery: buildImagery(result, imageryItems),
    layout: {
      radius: `${layoutHints.radius}px`,
      borderWeight: `${layoutHints.borderWidth}px`,
      spacing: '8px baseline grid',
      postureRules: [],
    },
  };

  return { brand, slug: siteSlug(result) };
}

function logoFileName(logo, index) {
  const kind = String(logo.kind || 'logo')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'logo';
  return `${index + 1}-${kind}${extFromContentType(logo.dataUrl, logo.sourceUrl)}`;
}

module.exports = {
  buildBrandKit,
  buildColorRoles,
  logoFileName,
  fileNameFor,
  contrast,
  saturation,
  hueOf,
  mix,
};
