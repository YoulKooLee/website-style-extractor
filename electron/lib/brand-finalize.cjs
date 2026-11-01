'use strict';

/**
 * brand.json 的校验与修补。
 *
 * 用途有两个：
 *   1. finalize —— 用户手改 brand.json 后重新生成整套设计体系；
 *   2. AI 补全 —— 把模型返回的补丁合并进 brand 再重生成。
 *
 * 原则：**永远不因为用户改错一处就整包失败**。能修的直接修，修不了的用自动结果兜底，
 * 并把每一处修补写在 notes 里回给界面，让人知道「我写的那行没生效」。
 */

const ROLE_ORDER = [
  'background',
  'surface',
  'foreground',
  'muted',
  'border',
  'accent',
  'accent-secondary',
];

const ROLE_META = {
  background: { name: 'Background', usage: 'page canvas' },
  surface: { name: 'Surface', usage: 'cards / raised surfaces' },
  foreground: { name: 'Foreground', usage: 'body text' },
  muted: { name: 'Muted', usage: 'secondary text' },
  border: { name: 'Border', usage: 'hairlines / dividers' },
  accent: { name: 'Accent', usage: 'primary brand color' },
  'accent-secondary': { name: 'Accent secondary', usage: 'secondary brand color / links' },
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value, max, fallback = '') {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

function stringArray(value, max, eachMax, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  const out = value
    .map((item) => text(item, eachMax))
    .filter(Boolean)
    .slice(0, max);
  return out.length ? out : fallback;
}

/** #abc / ABCDEF / #AABBCC / rgb(...) 都尽量收成 #aabbcc。 */
function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim().toLowerCase();
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(raw);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const full = /^#?([0-9a-f]{6})$/.exec(raw);
  if (full) return `#${full[1]}`;
  const rgb = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/i.exec(raw);
  if (rgb) {
    const to = (n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0');
    return `#${to(rgb[1])}${to(rgb[2])}${to(rgb[3])}`;
  }
  return null;
}

function normalizeColors(editedColors, baseColors, notes) {
  const edited = new Map();
  if (Array.isArray(editedColors)) {
    for (const item of editedColors) {
      if (!isPlainObject(item)) continue;
      const role = String(item.role || '').trim().toLowerCase();
      if (!ROLE_ORDER.includes(role)) {
        if (role) notes.push(`颜色角色「${role}」不认识，已忽略（只支持这 7 个：${ROLE_ORDER.join('、')}）`);
        continue;
      }
      const hex = normalizeHex(item.hex);
      if (!hex) {
        notes.push(`角色 ${role} 的色值「${item.hex}」不是合法十六进制，已保留自动识别的颜色`);
        continue;
      }
      edited.set(role, { ...item, role, hex });
    }
  }

  const base = new Map();
  for (const item of Array.isArray(baseColors) ? baseColors : []) {
    if (isPlainObject(item) && item.role) base.set(item.role, item);
  }

  const out = [];
  for (const role of ROLE_ORDER) {
    const fromEdit = edited.get(role);
    const fromBase = base.get(role) || {};
    if (fromEdit) {
      out.push({
        role,
        hex: fromEdit.hex,
        oklch: text(fromEdit.oklch, 40, ''),
        name: text(fromEdit.name, 40, ROLE_META[role].name),
        usage: text(fromEdit.usage, 80, ROLE_META[role].usage),
      });
    } else if (fromBase.hex) {
      notes.push(`缺少角色 ${role}，已用自动识别的 ${fromBase.hex} 补上`);
      out.push({
        role,
        hex: normalizeHex(fromBase.hex) || '#888888',
        oklch: text(fromBase.oklch, 40, ''),
        name: text(fromBase.name, 40, ROLE_META[role].name),
        usage: text(fromBase.usage, 80, ROLE_META[role].usage),
      });
    } else {
      out.push({ role, hex: '#888888', oklch: '', name: ROLE_META[role].name, usage: ROLE_META[role].usage });
      notes.push(`角色 ${role} 既没写也推断不出来，先用灰色占位`);
    }
  }
  return out;
}

function normalizeFontSpec(edited, base, label, notes) {
  const source = isPlainObject(edited) ? edited : {};
  const fallback = isPlainObject(base) ? base : {};
  const family = text(source.family, 80, text(fallback.family, 80, 'Inter'));
  const fallbacks = stringArray(source.fallbacks, 6, 40, Array.isArray(fallback.fallbacks) ? fallback.fallbacks : []);
  let weights = Array.isArray(source.weights)
    ? source.weights
        .map((w) => Number(w))
        .filter((w) => Number.isFinite(w) && w >= 100 && w <= 900)
        .slice(0, 6)
    : [];
  if (!weights.length) weights = Array.isArray(fallback.weights) && fallback.weights.length ? fallback.weights : [400, 700];
  if (isPlainObject(edited) && edited.family && !family) notes.push(`${label} 字体名为空，已用自动识别结果`);
  return { family, fallbacks, weights };
}

function normalizeTypography(edited, base, notes) {
  const source = isPlainObject(edited) ? edited : {};
  const fallback = isPlainObject(base) ? base : {};
  const out = {
    display: normalizeFontSpec(source.display, fallback.display, 'display', notes),
    body: normalizeFontSpec(source.body, fallback.body, 'body', notes),
  };
  if (isPlainObject(source.mono) || isPlainObject(fallback.mono)) {
    out.mono = normalizeFontSpec(source.mono, fallback.mono, 'mono', notes);
  }
  return out;
}

function normalizeVoice(edited, base) {
  const source = isPlainObject(edited) ? edited : {};
  const fallback = isPlainObject(base) ? base : {};
  const vocab = isPlainObject(source.vocabulary) ? source.vocabulary : {};
  const baseVocab = isPlainObject(fallback.vocabulary) ? fallback.vocabulary : {};
  return {
    adjectives: stringArray(source.adjectives, 6, 24, stringArray(fallback.adjectives, 6, 24)),
    tone: text(source.tone, 120, text(fallback.tone, 120, '')),
    messagingPillars: stringArray(source.messagingPillars, 6, 120, stringArray(fallback.messagingPillars, 6, 120)),
    vocabulary: {
      use: stringArray(vocab.use, 12, 32, stringArray(baseVocab.use, 12, 32)),
      avoid: stringArray(vocab.avoid, 12, 32, stringArray(baseVocab.avoid, 12, 32)),
    },
  };
}

function normalizeImagery(edited, base) {
  const source = isPlainObject(edited) ? edited : {};
  const fallback = isPlainObject(base) ? base : {};
  // samples 指向导出包里的 imagery/ 文件，只认自动结果，避免用户写错路径导致页面裂图。
  const samples = Array.isArray(fallback.samples) ? fallback.samples : [];
  return {
    style: text(source.style, 200, text(fallback.style, 200, '')),
    subjects: stringArray(source.subjects, 6, 60, stringArray(fallback.subjects, 6, 60)),
    treatment: text(source.treatment, 200, text(fallback.treatment, 200, '')),
    avoid: stringArray(source.avoid, 6, 60, stringArray(fallback.avoid, 6, 60)),
    samples,
  };
}

function cssLength(value, fallback, notes, label) {
  if (typeof value === 'number' && Number.isFinite(value)) return `${Math.max(0, value)}px`;
  const raw = text(value, 20, '');
  if (!raw) return fallback;
  const matched = /^(\d+(?:\.\d+)?)\s*(px|rem|em|%)?$/i.exec(raw);
  if (!matched) {
    notes.push(`${label}「${raw}」看不懂，已用自动识别的 ${fallback}`);
    return fallback;
  }
  return `${matched[1]}${(matched[2] || 'px').toLowerCase()}`;
}

function normalizeLayout(edited, base, notes) {
  const source = isPlainObject(edited) ? edited : {};
  const fallback = isPlainObject(base) ? base : {};
  return {
    radius: cssLength(source.radius, text(fallback.radius, 20, '8px'), notes, '圆角'),
    borderWeight: cssLength(source.borderWeight, text(fallback.borderWeight, 20, '1px'), notes, '描边'),
    spacing: text(source.spacing, 60, text(fallback.spacing, 60, '8px baseline grid')),
    postureRules: stringArray(source.postureRules, 8, 120, stringArray(fallback.postureRules, 8, 120)),
  };
}

/**
 * 以 baseBrand 为底，用 edited 覆盖，产出可直接喂给引擎的完整 Brand。
 * 返回 { brand, notes, changed }。
 */
function finalizeBrand(baseBrand, edited) {
  const base = isPlainObject(baseBrand) ? baseBrand : {};
  const notes = [];
  const source = isPlainObject(edited) ? edited : {};
  if (!isPlainObject(edited)) notes.push('brand.json 不是一个对象，已全部按自动结果生成');

  const brand = {
    name: text(source.name, 60, text(base.name, 60, 'Brand')),
    tagline: text(source.tagline, 160, text(base.tagline, 160, '')),
    description: text(source.description, 800, text(base.description, 800, '')),
    // 来源网址固定用本次抓取的，不让手改，否则文档里的出处会骗人
    sourceUrl: text(base.sourceUrl, 400, ''),
    logo: {
      ...(isPlainObject(base.logo) ? base.logo : {}),
      notes: text(isPlainObject(source.logo) ? source.logo.notes : '', 200, ''),
    },
    colors: normalizeColors(source.colors, base.colors, notes),
    typography: normalizeTypography(source.typography, base.typography, notes),
    voice: normalizeVoice(source.voice, base.voice),
    imagery: normalizeImagery(source.imagery, base.imagery),
    layout: normalizeLayout(source.layout, base.layout, notes),
  };

  const changed = ['name', 'tagline', 'description', 'colors', 'typography', 'voice', 'imagery', 'layout'].filter(
    (key) => JSON.stringify(brand[key]) !== JSON.stringify(base[key]),
  );

  return { brand, notes, changed };
}

/**
 * V8 的 JSON 报错在新版本里只给一段片段、不给位置，这里自己扫一遍括号和引号，
 * 尽量把「第几行出错」算出来，比一句「格式不对」有用得多。
 */
function locateProblem(value) {
  const stack = [];
  let inString = false;
  let escaped = false;
  const pairs = { '}': '{', ']': '[' };

  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{' || ch === '[') {
      stack.push({ ch, index: i });
      continue;
    }
    if (ch === '}' || ch === ']') {
      const top = stack.pop();
      if (!top || top.ch !== pairs[ch]) {
        return { index: i, reason: '括号没有配对' };
      }
      continue;
    }
    if (ch === ',' && /^\s*[}\]]/.test(value.slice(i + 1))) {
      return { index: i, reason: '最后一项后面多了一个逗号' };
    }
  }

  if (inString) return { index: value.length, reason: '引号没闭合' };
  if (stack.length) return { index: stack[stack.length - 1].index, reason: '括号没闭合' };
  return null;
}

/** 解析用户编辑的文本，语法错时给出「第几行」这种能定位的提示。 */
function parseBrandText(raw) {
  const value = String(raw || '').trim();
  if (!value) return { ok: false, error: 'brand.json 是空的，可以先点「恢复自动生成」拿回原始内容。' };
  try {
    const parsed = JSON.parse(value);
    if (!isPlainObject(parsed)) return { ok: false, error: 'brand.json 的最外层要用花括号 { } 包起来。' };
    return { ok: true, brand: parsed };
  } catch (e) {
    const message = String((e && e.message) || '');
    const position = /position (\d+)/i.exec(message);
    let index = position ? Number(position[1]) : null;
    let reason = '';
    if (index === null) {
      const located = locateProblem(value);
      if (located) {
        index = located.index;
        reason = located.reason;
      }
    }
    if (index !== null) {
      const line = value.slice(0, index).split('\n').length;
      const suffix = reason ? `，${reason}` : '，多半是少了逗号或引号';
      return { ok: false, error: `brand.json 第 ${line} 行附近有语法错误${suffix}。` };
    }
    return { ok: false, error: `brand.json 格式不对：${message.slice(0, 120)}` };
  }
}

/**
 * 把 AI 补丁合并进 brand（供 ai:enrich 使用）。
 * 只认 finalize 支持的键，颜色按 role 定位改名字。
 */
function applyBrandPatch(baseBrand, patch) {
  const base = isPlainObject(baseBrand) ? JSON.parse(JSON.stringify(baseBrand)) : {};
  const next = { ...base };
  if (!isPlainObject(patch)) return next;

  if (patch.name) next.name = patch.name;
  if (patch.tagline) next.tagline = patch.tagline;
  if (patch.description) next.description = patch.description;
  if (isPlainObject(patch.voice)) next.voice = { ...base.voice, ...patch.voice };
  if (isPlainObject(patch.imagery)) next.imagery = { ...base.imagery, ...patch.imagery, samples: base.imagery ? base.imagery.samples : [] };
  if (Array.isArray(patch.postureRules) && patch.postureRules.length) {
    next.layout = { ...base.layout, postureRules: patch.postureRules };
  }
  if (isPlainObject(patch.colorNames)) {
    next.colors = (base.colors || []).map((color) => {
      const name = patch.colorNames[color.role];
      return name ? { ...color, name } : color;
    });
  }
  return next;
}

module.exports = {
  ROLE_ORDER,
  finalizeBrand,
  parseBrandText,
  applyBrandPatch,
  normalizeHex,
};
