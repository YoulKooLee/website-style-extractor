'use strict';

function clamp255(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function toHexPair(n) {
  return clamp255(n).toString(16).padStart(2, '0');
}

// 把 hex / rgb / hsl 统一成 #rrggbb；其余（oklch、var()、命名色）返回 null。
function normalizeColor(raw) {
  const v = (raw || '').trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) {
      h = h.slice(0, 3).split('').map((c) => c + c).join('');
    } else if (h.length === 8) {
      h = h.slice(0, 6);
    } else if (h.length !== 6) {
      return null;
    }
    return `#${h}`;
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/.exec(v);
  if (rgb) {
    return `#${toHexPair(Number(rgb[1]))}${toHexPair(Number(rgb[2]))}${toHexPair(Number(rgb[3]))}`;
  }
  const hsl = /^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%/.exec(v);
  if (hsl) {
    const h = Number(hsl[1]) / 360;
    const s = Number(hsl[2]) / 100;
    const l = Number(hsl[3]) / 100;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = (t) => {
      let x = t;
      if (x < 0) x += 1;
      if (x > 1) x -= 1;
      if (x < 1 / 6) return p + (q - p) * 6 * x;
      if (x < 1 / 2) return q;
      if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
      return p;
    };
    return `#${toHexPair(hue(h + 1 / 3) * 255)}${toHexPair(hue(h) * 255)}${toHexPair(hue(h - 1 / 3) * 255)}`;
  }
  return null;
}

function luma(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function colorSourceForMatch(css, index) {
  const before = css.slice(Math.max(0, index - 900), index);
  const declStart = Math.max(before.lastIndexOf(';'), before.lastIndexOf('{'));
  const declaration = before.slice(declStart + 1);
  const prop = /([-\w]+)\s*:\s*[^:]*$/i.exec(declaration)?.[1]?.trim();
  const selectorStart = before.lastIndexOf('}');
  const blockStart = before.lastIndexOf('{');
  const selector =
    blockStart > selectorStart
      ? before.slice(selectorStart + 1, blockStart).replace(/\s+/g, ' ').trim().slice(-160)
      : '';
  const parts = [];
  if (prop) parts.push(prop.startsWith('--') ? `css-var:${prop}` : `prop:${prop}`);
  if (selector) parts.push(`selector:${selector}`);
  return parts.length ? parts.join(' ') : undefined;
}

function hasHighSignal(source) {
  const s = (source || '').toLowerCase();
  return /css-var:--(?:brand|primary|accent|cta|action|highlight|link|main)/i.test(s);
}

function sortCandidates(counts) {
  const all = [...counts.entries()].map(([hex, v]) => {
    const isHex = hex.startsWith('#') && hex.length === 7;
    const extreme = v.extreme ?? (isHex ? luma(hex) > 0.96 || luma(hex) < 0.04 : false);
    return { hex, count: v.count, extreme, sources: [...(v.sources || [])].slice(0, 12) };
  }).sort((a, b) => b.count - a.count);

  const highSignal = all.filter((c) => !c.extreme && hasHighSignal((c.sources || []).join(' '))).slice(0, 8);
  const chromatic = all.filter((c) => !c.extreme).slice(0, 15);
  const extremes = all.filter((c) => c.extreme).slice(0, 4);

  const out = [];
  const seen = new Set();
  for (const c of [...highSignal, ...chromatic, ...extremes]) {
    if (seen.has(c.hex)) continue;
    seen.add(c.hex);
    out.push(c);
  }
  return out;
}

function extractColors(css) {
  const counts = new Map();
  const re = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]{1,48}\)|hsla?\([^)]{1,48}\)|oklch\([^)]{1,64}\)/g;
  for (const m of css.matchAll(re)) {
    const raw = m[0];
    const norm = normalizeColor(raw) ?? raw.trim().toLowerCase();
    const existing = counts.get(norm) || { count: 0, sources: new Set() };
    existing.count += 1;
    const src = colorSourceForMatch(css, m.index ?? 0);
    if (src) existing.sources.add(src);
    counts.set(norm, existing);
  }
  return sortCandidates(counts);
}

function saturationOf(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

// 从候选里挑最适合做“主色”的一个：优先有彩度的高信号品牌色，避免整站被黑白文字色带偏。
function pickPrimary(colors) {
  const colored = colors.filter((c) => !c.extreme && /^#[0-9a-f]{6}$/.test(c.hex));
  if (colored.length === 0) return null;

  const vivid = colored.filter((c) => saturationOf(c.hex) >= 0.22 && luma(c.hex) > 0.06 && luma(c.hex) < 0.95);
  const high = colored.filter((c) => hasHighSignal((c.sources || []).join(' ')));
  const highVivid = vivid.filter((c) => hasHighSignal((c.sources || []).join(' ')));

  const pick = highVivid[0] || vivid[0] || high[0] || colored[0];
  return pick.hex;
}

module.exports = { normalizeColor, luma, saturationOf, extractColors, pickPrimary };
