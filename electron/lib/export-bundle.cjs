'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildFontFaceCss } = require('./webfonts.cjs');
const engine = require('./od-engine.cjs');
const { buildBrandKit, logoFileName, fileNameFor } = require('./brand-kit.cjs');
const { finalizeBrand } = require('./brand-finalize.cjs');

function slugify(host) {
  return (host || 'site').toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'site';
}

function extFromDataUrl(dataUrl, fallback) {
  const m = /^data:image\/([a-z0-9.+-]+);/i.exec(dataUrl || '');
  if (!m) return fallback;
  const t = m[1].toLowerCase();
  if (t === 'svg+xml') return '.svg';
  if (t === 'png') return '.png';
  if (t === 'jpeg' || t === 'jpg') return '.jpg';
  if (t === 'webp') return '.webp';
  if (t === 'gif') return '.gif';
  if (t === 'x-icon' || t === 'vnd.microsoft.icon') return '.ico';
  return fallback;
}

function dataUrlToBuffer(dataUrl) {
  const base64 = (dataUrl || '').split(',')[1] || '';
  return Buffer.from(base64, 'base64');
}

function textAndBg(result) {
  const extremes = (result.colors || []).filter((c) => c.extreme);
  const isDark = (hex) => hex.startsWith('#') && hex.length === 7 && Number.parseInt(hex.slice(1, 3), 16) < 80;
  const isLight = (hex) => hex.startsWith('#') && hex.length === 7 && Number.parseInt(hex.slice(1, 3), 16) > 220;
  const textColor = extremes.find((c) => isDark(c.hex))?.hex || '#1f2937';
  const bgColor = extremes.find((c) => isLight(c.hex))?.hex || '#ffffff';
  return { textColor, bgColor };
}

function bodyFontStack(result) {
  const bodyFont = (result.fonts && result.fonts[0] && result.fonts[0].family) || 'system-ui, sans-serif';
  return `"${bodyFont}", system-ui, sans-serif`;
}

function buildTokensCss(result) {
  const lines = [
    '/* 由「网站风格提取器」本地生成，可直接引入项目 */',
    `/* 来源：${result.finalUrl || result.url} */`,
    '',
  ];

  // 只有真正拿到文件的才写 @font-face；历史记录里字体只剩名字时不能指向不存在的文件。
  const fontFiles = ((result.fontSources && result.fontSources.files) || []).filter((f) => f.dataUrl);
  if (fontFiles.length > 0) {
    lines.push('/* 站点自带的字体文件，已一并保存到 fonts/ 文件夹 */');
    lines.push(buildFontFaceCss(fontFiles, './fonts/'));
    lines.push('');
  }

  lines.push(':root {');
  if (result.primaryLadder) {
    result.primaryLadder.steps.forEach((hex, i) => {
      lines.push(`  --brand-${i}: ${hex};`);
    });
    lines.push(`  --brand-primary: ${result.primaryLadder.seed};`);
  }
  const { textColor, bgColor } = textAndBg(result);
  lines.push(`  --color-text: ${textColor};`);
  lines.push(`  --color-background: ${bgColor};`);
  lines.push(`  --font-body: ${bodyFontStack(result)};`);
  if (result.fontFaceFamilies && result.fontFaceFamilies.length) {
    lines.push(`  --font-faces: ${result.fontFaceFamilies.join(', ')};`);
  }

  const others = (result.colors || []).filter((c) => !c.extreme).slice(0, 8);
  others.forEach((c, i) => {
    lines.push(`  --palette-${i + 1}: ${c.hex};`);
  });

  lines.push('}', '');
  return lines.join('\n');
}

function buildTailwindConfig(result) {
  const steps = result.primaryLadder ? result.primaryLadder.steps : [];
  const { textColor, bgColor } = textAndBg(result);
  const brandLines = steps.map((hex, i) => `        ${i}: '${hex}',`).join('\n');
  const others = (result.colors || []).filter((c) => !c.extreme).slice(0, 8);
  const otherLines = others.map((c, i) => `        palette${i + 1}: '${c.hex}',`).join('\n');
  const family = (result.fonts && result.fonts[0] && result.fonts[0].family) || '';

  return [
    '/** 由「网站风格提取器」在本机生成，可直接合并进你自己的 tailwind.config.js */',
    `/** 来源：${result.finalUrl || result.url} */`,
    '',
    '/** @type {import(\'tailwindcss\').Config} */',
    'module.exports = {',
    '  theme: {',
    '    extend: {',
    '      colors: {',
    '        brand: {',
    brandLines || '        // 没有识别到主色',
    steps.length ? `        DEFAULT: '${result.primaryLadder.seed}',` : '',
    '        },',
    otherLines,
    `        ink: '${textColor}',`,
    `        canvas: '${bgColor}',`,
    '      },',
    '      fontFamily: {',
    `        sans: [${family ? `'${family}', ` : ''}'system-ui', 'sans-serif'],`,
    '      },',
    '    },',
    '  },',
    '};',
    '',
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n');
}

function buildTokensJson(result) {
  const steps = result.primaryLadder ? result.primaryLadder.steps : [];
  const { textColor, bgColor } = textAndBg(result);

  const color = {};
  if (steps.length) {
    color.brand = {};
    steps.forEach((hex, i) => {
      color.brand[i] = { $type: 'color', $value: hex };
    });
    color.primary = { $type: 'color', $value: result.primaryLadder.seed };
  }
  color.text = { $type: 'color', $value: textColor };
  color.background = { $type: 'color', $value: bgColor };

  const others = (result.colors || []).filter((c) => !c.extreme).slice(0, 8);
  if (others.length) {
    color.palette = {};
    others.forEach((c, i) => {
      color.palette[i + 1] = { $type: 'color', $value: c.hex };
    });
  }

  const bodyFamily = (result.fonts && result.fonts[0] && result.fonts[0].family) || 'system-ui';
  const token = {
    $description: `由「网站风格提取器」根据 ${result.finalUrl || result.url} 生成`,
    $type: 'design-tokens',
    color,
    font: {
      body: { $type: 'fontFamily', $value: [bodyFamily, 'system-ui', 'sans-serif'] },
    },
  };

  const fontFiles = ((result.fontSources && result.fontSources.files) || []).filter((f) => f.dataUrl);
  if (fontFiles.length) {
    token.font.face = fontFiles.map((f) => ({
      family: f.family,
      file: `fonts/${f.file}`,
      weight: f.weight,
      style: f.style,
      format: f.format,
    }));
  }

  return JSON.stringify(token, null, 2);
}

/** 旧版 brand.json 里的「提取明细」，现在单独放 extraction.json，brand.json 保持原版契约。 */
function buildExtractionJson(result, savedLogos) {
  const files = ((result.fontSources && result.fontSources.files) || []).filter((f) => f.dataUrl);
  return {
    sourceUrl: result.finalUrl || result.url,
    siteName: result.siteName,
    title: result.title,
    description: result.description,
    fetchMode: result.fetchMode || 'static',
    primary: result.primaryLadder ? result.primaryLadder.seed : null,
    primaryLadder: result.primaryLadder ? result.primaryLadder.steps : [],
    colors: result.colors,
    fonts: result.fonts,
    fontFaceFamilies: result.fontFaceFamilies,
    fontFiles: files.map((f) => ({
      family: f.family,
      weight: f.weight,
      style: f.style,
      file: `fonts/${f.file}`,
      format: f.format,
      bytes: f.bytes,
      sourceUrl: f.sourceUrl,
    })),
    fontSources: ((result.fontSources && result.fontSources.families) || []).map(
      ({ previewDataUrl, ...rest }) => rest,
    ),
    googleFontsUrls: result.googleFontsUrls || [],
    logos: savedLogos,
    headings: result.headings,
    navLabels: result.navLabels,
    screenshot: result.screenshot ? 'screenshot.jpg' : null,
    exportedAt: new Date().toISOString(),
  };
}

/** 原版 brand.json：语义色角色 + 字体 + 语气 + 素材 + 版式。 */
function buildBrandJson(brand) {
  return JSON.stringify(brand, null, 2);
}

// ─────────────────────────── 文档 ───────────────────────────

function listOrNone(values, prefix = '- ') {
  if (!values || values.length === 0) return `${prefix}(none yet)`;
  return values.map((v) => `${prefix}${v}`).join('\n');
}

function buildDesignMd(brand) {
  const roleLines = brand.colors
    .map((c) => `  ${c.role}: "${c.hex}"`)
    .join('\n');
  const tableRows = brand.colors
    .map((c) => `| ${c.role} | ${c.name} | \`${c.hex}\` | ${c.usage} |`)
    .join('\n');
  const fontLine = (spec) =>
    `- **${spec === brand.typography.display ? 'Display' : 'Body'}:** ${spec.family} — weights ${spec.weights.join(', ')} — fallbacks: ${(spec.fallbacks.length ? spec.fallbacks : ['system-ui', 'sans-serif']).join(', ')}`;

  return `---
name: "${brand.name}"
category: Brands
surface: web
colors:
${roleLines}
---

# ${brand.name}

> Category: Brands

> Surface: web

*${brand.tagline || ''}*

${brand.description || ''}

## Color Palette

| Role | Name | Hex | Usage |
| --- | --- | --- | --- |
${tableRows}

## Typography
${fontLine(brand.typography.display)}
${fontLine(brand.typography.body)}

## Voice & Tone

- **Adjectives:** ${brand.voice.adjectives.length ? brand.voice.adjectives.join(', ') : '(none yet)'}
- **Tone:** ${brand.voice.tone || '(none yet)'}

### Messaging pillars
${listOrNone(brand.voice.messagingPillars)}

### Vocabulary
- **Use:** ${brand.voice.vocabulary.use.length ? brand.voice.vocabulary.use.join(', ') : '(none yet)'}
- **Avoid:** ${brand.voice.vocabulary.avoid.length ? brand.voice.vocabulary.avoid.join(', ') : '(none yet)'}

## Imagery

- **Style:** ${brand.imagery.style || '(none yet)'}
- **Subjects:** ${brand.imagery.subjects.length ? brand.imagery.subjects.join(', ') : '(none yet)'}
- **Treatment:** ${brand.imagery.treatment || '(none yet)'}
- **Avoid:** ${brand.imagery.avoid.length ? brand.imagery.avoid.join(', ') : '(none yet)'}

## Layout

- **Radius:** ${brand.layout.radius}
- **Border weight:** ${brand.layout.borderWeight}
- **Spacing:** ${brand.layout.spacing}

### Posture rules
${brand.layout.postureRules.length ? listOrNone(brand.layout.postureRules) : '- (none)'}
`;
}

function buildGuideMd(brand) {
  const colorLines = brand.colors
    .map((c) => `- **${c.name}** (\`${c.hex}\`) — ${c.role}: ${c.usage}`)
    .join('\n');
  return `# ${brand.name} — Brand Guide

*${brand.tagline || ''}*

${brand.description || ''}

Extracted from ${brand.sourceUrl}.

## Color roles

${colorLines}

## Typography

- Display: ${brand.typography.display.family}
- Body: ${brand.typography.body.family}

## Messaging pillars

${listOrNone(brand.voice.messagingPillars)}
`;
}

// ─────────────────────────── 设计体系（原版同构） ───────────────────────────

function portableFontFiles(result) {
  return ((result.fontSources && result.fontSources.files) || [])
    .filter((f) => f && f.dataUrl)
    .map(({ dataUrl, ...rest }) => rest);
}

/**
 * 用原版引擎生成 system/ 下的全部文件。
 * 传了 override（用户手改或 AI 补全后的 brand）就先校验修补，再拿它生成。
 * 返回 { brand, slug, files: { 相对路径: 内容 }, notes }。
 */
function buildSystem(result, override) {
  const auto = buildBrandKit(result);
  const baseBrand = auto.brand;
  let brand = baseBrand;
  let notes = [];
  if (override) {
    const finalized = finalizeBrand(baseBrand, override);
    brand = finalized.brand;
    notes = finalized.notes;
  }
  const system = engine.buildBrandSystem(brand, {
    slug: auto.slug,
    fontFiles: portableFontFiles(result),
  });
  return { brand, slug: auto.slug, files: system.files, notes };
}

/** 给界面预览用：只生成、不落盘。 */
function previewSystem(result, override) {
  const { brand, slug, files, notes } = buildSystem(result, override);
  return {
    ok: true,
    slug,
    brandJson: buildBrandJson(brand),
    designMd: buildDesignMd(brand),
    guideMd: buildGuideMd(brand),
    files,
    notes,
  };
}

// ─────────────────────────── 抓取留档（尽力而为） ───────────────────────────

async function writePrefetch(result, outDir) {
  const written = [];
  try {
    const { fetchText } = require('./fetch-http.cjs');
    const { collectCss } = require('./css-collect.cjs');
    const target = result.finalUrl || result.url;
    const page = await fetchText(target, 6_000_000, true);
    if (!page) return written;
    const dir = path.join(outDir, 'prefetch');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'page.html'), page.text, 'utf8');
    fs.writeFileSync(
      path.join(dir, 'material.md'),
      buildMaterialMd(result),
      'utf8',
    );
    written.push('prefetch/page.html', 'prefetch/material.md');
    try {
      const collected = await collectCss(page.text, page.finalUrl);
      if (collected && collected.css) {
        fs.writeFileSync(path.join(dir, 'styles.css'), collected.css, 'utf8');
        written.push('prefetch/styles.css');
      }
    } catch {
      /* 样式表抓不到就只留页面与清单 */
    }
  } catch {
    /* 留档是加分项，失败不影响导出 */
  }
  return written;
}

function buildMaterialMd(result) {
  const colors = (result.colors || []).slice(0, 12);
  const colorLines = colors
    .map((c) => `- \`${c.hex}\` ×${c.count}${c.sources && c.sources.length ? ` — ${c.sources.join('; ')}` : ''}`)
    .join('\n');
  const fontLines = (result.fonts || [])
    .slice(0, 8)
    .map((f) => `- ${f.family} ×${f.count}`)
    .join('\n');
  return `# Brand material — ${result.finalUrl || result.url}

- site name: ${result.siteName || ''}
- title: ${result.title || ''}
- description: ${result.description || ''}
- fetch mode: ${result.fetchMode || 'static'}
- blocked: ${result.blocked ? 'yes' : 'no'}

## Measured colors (frequency-ranked from the site's actual CSS)

${colorLines || '- (none)'}

## Measured fonts

${fontLines || '- (none)'}
`;
}

// ─────────────────────────── 导出 ───────────────────────────

async function exportBundle(result, BrowserWindow, opts = {}) {
  if (!result) return { ok: false, error: '没有可导出的结果' };
  const override = opts.brand || opts.brandOverride || null;

  const host = (() => {
    try {
      return new URL(result.finalUrl || result.url).hostname;
    } catch {
      return 'site';
    }
  })();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const parentWin = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!parentWin) return { ok: false, error: '窗口已关闭，无法选择保存位置' };

  const { canceled, filePaths } = await require('electron').dialog.showOpenDialog(parentWin, {
    title: '选择保存位置',
    buttonLabel: '保存到这里',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (canceled || filePaths.length === 0) return { ok: false, error: '已取消导出' };

  const outDir = path.join(filePaths[0], `风格提取-${slugify(host)}-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  // ── 标志 ──
  const savedLogos = [];
  const logosWithData = (result.logos || []).filter((logo) => logo && logo.dataUrl);
  if (logosWithData.length > 0) {
    const logosDir = path.join(outDir, 'logos');
    fs.mkdirSync(logosDir, { recursive: true });
    logosWithData.forEach((logo, idx) => {
      const file = logoFileName(logo, idx);
      fs.writeFileSync(path.join(logosDir, file), dataUrlToBuffer(logo.dataUrl));
      savedLogos.push({ file, kind: logo.kind, sourceUrl: logo.sourceUrl });
    });
  }

  // ── 素材图 ──
  const written = [];
  const imageryItems = (result.imagery || []).filter((item) => item && item.dataUrl).slice(0, 8);
  if (imageryItems.length > 0) {
    const imageryDir = path.join(outDir, 'imagery');
    fs.mkdirSync(imageryDir, { recursive: true });
    imageryItems.forEach((item, idx) => {
      fs.writeFileSync(path.join(imageryDir, fileNameFor(item, idx)), dataUrlToBuffer(item.dataUrl));
    });
    written.push('imagery/');
  }

  // ── 字体 ──
  const fontFiles = (result.fontSources && result.fontSources.files) || [];
  if (fontFiles.length > 0) {
    const fontsDir = path.join(outDir, 'fonts');
    fs.mkdirSync(fontsDir, { recursive: true });
    const portable = [];
    for (const f of fontFiles) {
      if (!f.dataUrl) continue;
      fs.writeFileSync(path.join(fontsDir, f.file), dataUrlToBuffer(f.dataUrl));
      portable.push({ ...f, dataUrl: undefined });
    }
    fs.writeFileSync(path.join(fontsDir, 'fonts.css'), buildFontFaceCss(portable, './') + '\n', 'utf8');
    fs.writeFileSync(
      path.join(fontsDir, 'manifest.json'),
      JSON.stringify(
        { format: 'brand-fonts/1', files: portable.map(({ dataUrl, ...rest }) => rest) },
        null,
        2,
      ),
      'utf8',
    );
    written.push('fonts/');
  }

  // ── 截图 ──
  if (result.screenshot && /^data:image\//i.test(result.screenshot)) {
    fs.writeFileSync(path.join(outDir, 'screenshot.jpg'), dataUrlToBuffer(result.screenshot));
    written.push('screenshot.jpg');
  }

  // ── 设计体系：原版引擎生成 system/ ──
  let brand = null;
  let slug = slugify(host);
  try {
    const built = buildSystem(result, override);
    brand = built.brand;
    slug = built.slug;
    engine.writeBrandSystem({ files: built.files }, path.join(outDir, 'system'));
    written.push('system/');
  } catch (e) {
    return {
      ok: false,
      error: `设计体系生成失败：${(e && e.message) || '未知错误'}`,
      dir: outDir,
    };
  }

  // ── 品牌文档 ──
  if (brand) {
    fs.writeFileSync(path.join(outDir, 'brand.json'), buildBrandJson(brand), 'utf8');
    fs.writeFileSync(path.join(outDir, 'DESIGN.md'), buildDesignMd(brand), 'utf8');
    fs.writeFileSync(path.join(outDir, 'guide.md'), buildGuideMd(brand), 'utf8');
    written.unshift('brand.json', 'DESIGN.md', 'guide.md');
  }

  // ── 旧格式（still useful：给 Tailwind / Design Tokens 消费方） ──
  fs.writeFileSync(path.join(outDir, 'tokens.css'), buildTokensCss(result), 'utf8');
  fs.writeFileSync(path.join(outDir, 'tokens.json'), buildTokensJson(result), 'utf8');
  fs.writeFileSync(path.join(outDir, 'tailwind.config.js'), buildTailwindConfig(result), 'utf8');
  fs.writeFileSync(
    path.join(outDir, 'extraction.json'),
    JSON.stringify(buildExtractionJson(result, savedLogos), null, 2),
    'utf8',
  );
  written.push('tokens.css', 'tokens.json', 'tailwind.config.js', 'extraction.json');

  // ── 分渠道文案（AI 生成过才带；没有就安静跳过） ──
  if (opts.copy && typeof opts.copy === 'object' && Object.keys(opts.copy).length > 0) {
    const copyDoc = {
      format: 'brand-copy/1',
      brand: brand ? brand.name : undefined,
      generatedAt: new Date().toISOString(),
      ...opts.copy,
    };
    fs.writeFileSync(path.join(outDir, 'copy.json'), JSON.stringify(copyDoc, null, 2), 'utf8');
    written.push('copy.json');
  }

  // ── 抓取留档（尽力而为，失败不影响结果） ──
  if (opts.prefetch !== false) {
    const prefetchWritten = await writePrefetch(result, outDir);
    written.push(...prefetchWritten);
  }

  return { ok: true, dir: outDir, files: written, slug };
}

module.exports = {
  exportBundle,
  buildTokensCss,
  buildTailwindConfig,
  buildTokensJson,
  buildBrandJson,
  buildDesignMd,
  buildGuideMd,
  buildExtractionJson,
  buildSystem,
  previewSystem,
  slugify,
  extFromDataUrl,
};
