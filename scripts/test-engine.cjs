'use strict';
// 引擎与映射层的离线测试：不联网，只用固定输入验证「语义角色推断」和「产物结构」。
const { buildBrandKit } = require('../electron/lib/brand-kit.cjs');
const engine = require('../electron/lib/od-engine.cjs');

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log('PASS', msg);
  } else {
    fail++;
    console.log('FAIL', msg);
  }
}

// ── 1. 语义角色推断 ──
const lightSite = {
  url: 'https://example.com/',
  finalUrl: 'https://www.example.com/',
  siteName: 'Example',
  title: 'Example — 让事情更简单',
  description: '一个示例站点',
  headings: ['让事情更简单', '为团队而生', '开箱即用'],
  navLabels: ['产品', '定价'],
  colors: [
    { hex: '#ffffff', count: 12, extreme: true, sources: ['prop:background-color selector:body'] },
    { hex: '#111827', count: 9, extreme: true, sources: ['prop:color selector:body'] },
    { hex: '#2563eb', count: 7, sources: ['prop:background-color selector:.btn-primary'] },
    { hex: '#f9fafb', count: 6, sources: ['prop:background-color selector:.card'] },
    { hex: '#6b7280', count: 5, sources: ['prop:color selector:.muted'] },
    { hex: '#e5e7eb', count: 4, sources: ['prop:border-color selector:.card'] },
    { hex: '#f97316', count: 3, sources: ['prop:color selector:.promo'] },
  ],
  fonts: [{ family: 'Inter', count: 9 }],
  fontFaceFamilies: ['Inter'],
  logos: [{ kind: 'favicon', sourceUrl: 'https://www.example.com/favicon.ico', dataUrl: 'data:image/png;base64,AAA' }],
  layoutHints: { radius: 12, borderWidth: 1 },
  primaryLadder: { seed: '#2563eb', steps: Array.from({ length: 10 }, (_, i) => `#00000${i}`) },
};

const light = buildBrandKit(lightSite);
const roleOf = (brand, role) => brand.colors.find((c) => c.role === role)?.hex;
assert(roleOf(light.brand, 'background') === '#ffffff', '浅色站：background = #ffffff');
assert(roleOf(light.brand, 'foreground') === '#111827', '浅色站：foreground 取正文色');
assert(roleOf(light.brand, 'surface') === '#f9fafb', '浅色站：surface 取卡片底色');
assert(roleOf(light.brand, 'border') === '#e5e7eb', '浅色站：border 取描边色');
assert(roleOf(light.brand, 'accent') === '#2563eb', '浅色站：accent 用主色');
assert(roleOf(light.brand, 'accent-secondary') === '#f97316', '浅色站：accent-secondary 取次要彩色');
assert(light.slug === 'example', 'slug 从域名取');
assert(light.brand.layout.radius === '12px', '圆角写进 layout');
assert(light.brand.voice.messagingPillars.length === 3, '文案支柱取页面标题前三条');
assert(light.brand.typography.body.family === 'Inter', '正文字体取测量最多的家族');

// 深色站：底色深 + 文字浅 → 原版会保留深色画布
const darkSite = {
  ...lightSite,
  colors: [
    { hex: '#0a0a0a', count: 14, extreme: true, sources: ['prop:background-color selector:body'] },
    { hex: '#fafafa', count: 10, extreme: true, sources: ['prop:color selector:body'] },
    { hex: '#171717', count: 6, sources: ['prop:background-color selector:.card'] },
    { hex: '#a3a3a3', count: 4, sources: ['prop:color selector:.muted'] },
    { hex: '#262626', count: 3, sources: ['prop:border-color selector:.card'] },
    { hex: '#8b5cf6', count: 5, sources: ['prop:color selector:.accent'] },
  ],
  primaryLadder: { seed: '#8b5cf6', steps: Array.from({ length: 10 }, (_, i) => `#11111${i}`) },
};
const dark = buildBrandKit(darkSite);
const darkTokens = JSON.parse(
  JSON.stringify(engine.deriveTokens(engine.seedFromBrand(dark.brand), 'default')),
);
assert(roleOf(dark.brand, 'background') === '#0a0a0a', '深色站：background 保留深底');
assert(roleOf(dark.brand, 'foreground') === '#fafafa', '深色站：foreground 取浅色文字');
assert(darkTokens.colorBgContainer.startsWith('#0') || darkTokens.colorBgContainer.startsWith('#1'), '深色站的默认主题仍是深色画布');

// ── 2. 引擎产物结构 ──
const seed = engine.seedFromBrand(light.brand);
assert(seed.colorPrimary === '#2563eb', 'seed 的 colorPrimary 来自 accent');
assert(seed.borderRadius === 12, 'seed 的 borderRadius 来自 layout.radius');

const themes = ['default', 'dark', 'compact'].map((algo) => engine.deriveTokens(seed, algo));
themes.forEach((tokens, index) => {
  // 顶层 81 个字段；展平后（色阶 + presets 全部展开）是 218 个 CSS 变量。
  assert(Object.keys(tokens).length === 81, `${['default', 'dark', 'compact'][index]} 主题有 81 个顶层 token`);
  assert(engine.flattenTokens(tokens).length === 218, `${['default', 'dark', 'compact'][index]} 主题展平 218 个变量`);
});
assert(themes[0].colorBgContainer !== themes[1].colorBgContainer, 'dark 与 default 的底色不同');
assert(themes[0].colorPrimary === themes[2].colorPrimary, 'compact 只改密度，不改颜色');

const css = engine.tokensToCssVars(themes[0], ':root');
const varCount = css.split('\n').filter((line) => line.includes('--brand-')).length;
assert(varCount === 218, `variables.css 的变量数与 token 数一致（${varCount}）`);

const system = engine.buildBrandSystem(light.brand, { slug: light.slug });
assert(Object.keys(system.files).length === 18, '一次组装产出 18 个文件');
assert(!/\bundefined\b/.test(system.files['kit.html']), 'kit.html 里没有 undefined 漏出来');
assert(!/NaN/.test(system.files['artifacts/landing.html']), 'landing 里没有 NaN');
assert(system.files['index.html'].includes('tokens.compact.json'), '总览页列了 compact tokens');
assert(system.files['kit.dark.html'].includes('var(--brand-color-bg-container)'), '深色 kit 用的是深色变量');

// 同一颗种子必须完全可复现（否则用户改一次主色结果就飘了）
const again = engine.buildBrandSystem(light.brand, { slug: light.slug });
assert(
  Object.keys(system.files).every((key) => system.files[key] === again.files[key]),
  '同样输入两次生成的内容完全一致',
);

// 换主色后：色阶、组件、模板全部跟着变
const changed = engine.buildBrandSystem(
  { ...light.brand, colors: light.brand.colors.map((c) => (c.role === 'accent' ? { ...c, hex: '#dc2626' } : c)) },
  { slug: light.slug },
);
assert(JSON.parse(changed.files['tokens.default.json']).colorPrimary === '#dc2626', '换主色后 tokens 跟着变');
assert(changed.files['kit.html'] !== system.files['kit.html'], '换主色后组件 kit 也跟着变');

console.log(`\n结果：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
