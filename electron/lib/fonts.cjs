'use strict';

const GENERIC_FONTS = new Set([
  'sans-serif', 'serif', 'monospace', 'system-ui', 'ui-sans-serif', 'ui-serif',
  'ui-monospace', 'cursive', 'fantasy', 'inherit', 'initial', 'unset',
  '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'arial', 'helvetica',
  'helvetica neue', 'times new roman', 'courier new', 'emoji',
  'apple color emoji', 'segoe ui emoji', 'segoe ui symbol', 'noto color emoji',
]);

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
}

function isIconFontFamily(family) {
  const s = (family || '').toLowerCase();
  // 图标字体名五花八门（cIconfont、iconfont、FontAwesome、feather 等），一并排掉；
  // 「xx Fallback」是某些框架自动生成的兜底字体，不是品牌字体。
  if (/iconfont|fontello|icomoon|glyphicon|fontawesome|font-awesome|remixicon|lucide|feather|material ?(icons|symbols)|fallback/.test(s)) {
    return true;
  }
  return /\b(icon|icons|symbol|symbols)\b/.test(s);
}

function extractFonts(css) {
  // 用全小写做键，避免同一字体因大小写不同被算成两个。
  const counts = new Map();
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{!]+)/gi)) {
    for (const partRaw of m[1].split(',')) {
      const part = decodeEntities(partRaw).trim().replace(/^["']|["']$/g, '').trim();
      if (!part || part.startsWith('var(')) continue;
      if (part.includes('&quot') || /placeholder$/i.test(part)) continue;
      if (GENERIC_FONTS.has(part.toLowerCase())) continue;
      if (isIconFontFamily(part)) continue;
      const key = part.toLowerCase();
      const prev = counts.get(key);
      counts.set(key, { family: prev ? prev.family : part, count: (prev?.count ?? 0) + 1 });
      break;
    }
  }
  const fontFace = new Map();
  for (const m of css.matchAll(/@font-face\s*{[^}]*font-family\s*:\s*["']?([^;"'}]+)/gi)) {
    const family = decodeEntities(m[1]).trim().replace(/^["']|["']$/g, '').trim();
    if (!family || /placeholder$/i.test(family) || isIconFontFamily(family)) continue;
    if (!fontFace.has(family.toLowerCase())) fontFace.set(family.toLowerCase(), family);
  }
  return {
    fonts: [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 10),
    fontFaceFamilies: [...fontFace.values()].slice(0, 10),
  };
}

module.exports = { extractFonts };
