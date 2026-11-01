'use strict';
// 离线验证导出：文本生成（不落盘）+ 真实写入临时目录（拦截系统目录选择框）。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const {
  buildTokensCss,
  buildTailwindConfig,
  buildTokensJson,
  buildSystem,
  previewSystem,
  slugify,
} = require('../electron/lib/export-bundle.cjs');

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

const fake = {
  finalUrl: 'https://www.baidu.com/',
  url: 'https://www.baidu.com/',
  siteName: '百度',
  title: '百度一下，你就知道',
  description: '全球领先的中文搜索引擎',
  headings: ['百度一下，你就知道', '关于我们'],
  navLabels: ['新闻', '地图'],
  colors: [
    { hex: '#315efb', count: 4, sources: ['prop:color selector:.btn'] },
    { hex: '#ffffff', count: 2, extreme: true, sources: ['prop:background-color selector:body'] },
    { hex: '#1f2937', count: 1, extreme: true, sources: ['prop:color selector:body'] },
    { hex: '#f5f5f6', count: 3, sources: ['prop:background-color selector:.card'] },
    { hex: '#8c8c8c', count: 2, sources: ['prop:color selector:.muted'] },
    { hex: '#ff6600', count: 1, sources: ['prop:color selector:.hot'] },
  ],
  primaryLadder: { seed: '#315efb', steps: ['#e6f4ff', '#bae0ff', '#1677ff', '#0958d9'] },
  fonts: [{ family: 'PingFang SC', count: 1 }],
  fontFaceFamilies: [],
  layoutHints: { radius: 8, borderWidth: 1 },
};

const css = buildTokensCss(fake);
assert(css.includes('--brand-primary: #315efb;'), 'tokens 含主色变量');
assert(css.includes('--brand-0:'), 'tokens 含色阶变量');
assert(css.includes('--font-body:'), 'tokens 含字体变量');
assert(css.includes('--color-text:') && css.includes('--color-background:'), 'tokens 含文字/背景色');
assert(slugify('www.Baidu.com') === 'baidu-com', '域名去 www、点号转连字符');
assert(slugify('https://x') !== '', '空域名有兜底');

const tw = buildTailwindConfig(fake);
assert(tw.includes('brand: {'), 'tailwind 配置含 brand 色阶');
assert(tw.includes("DEFAULT: '#315efb'"), 'tailwind 配置含主色 DEFAULT');
assert(tw.includes("sans: ['PingFang SC'"), 'tailwind 配置含正文字体');

const tokensJson = JSON.parse(buildTokensJson(fake));
assert(tokensJson.color.primary.$value === '#315efb', 'tokens.json 主色正确');
assert(tokensJson.color.brand['0'].$value === '#e6f4ff', 'tokens.json 色阶正确');
assert(tokensJson.font.body.$value[0] === 'PingFang SC', 'tokens.json 字体正确');

// ── 设计体系（原版引擎） ──
const built = buildSystem(fake);
assert(Object.keys(built.files).length === 18, `体系共 18 个文件（实际 ${Object.keys(built.files).length}）`);
assert(!!built.files['tokens.default.json'] && !!built.files['tokens.dark.json'], '三套算法里的 default/dark 都在');
assert(!!built.files['kit.html'] && !!built.files['kit.dark.html'], '浅色/深色组件 kit 都在');
['landing', 'deck', 'poster', 'email', 'newsletter', 'form'].forEach((kind) => {
  assert(!!built.files[`artifacts/${kind}.html`], `成品模板 ${kind}.html 存在`);
});
const roleMap = Object.fromEntries(built.brand.colors.map((c) => [c.role, c.hex]));
assert(roleMap.background === '#ffffff', '语义角色 background 取到页面底色');
assert(roleMap.foreground === '#1f2937' || roleMap.foreground === '#000000', '语义角色 foreground 取到正文色');
assert(roleMap.accent === '#315efb', '语义角色 accent 用主色');
assert(roleMap['accent-secondary'] === '#ff6600', '语义角色 accent-secondary 取到次要彩色');
assert(built.brand.layout.radius === '8px', '圆角从 CSS 里读出来了');

const defaultTokens = JSON.parse(built.files['tokens.default.json']);
assert(defaultTokens.colorPrimary === '#315efb', 'tokens.default 的主色来自 accent');
assert(Object.keys(defaultTokens).length > 60, '派生出完整 token 面（60+ 字段）');
const darkTokens = JSON.parse(built.files['tokens.dark.json']);
assert(darkTokens.colorBgContainer !== defaultTokens.colorBgContainer, 'dark 算法确实换了底色');
assert(built.files['variables.css'].includes(':root {') && built.files['variables.css'].includes('.dark {'), 'variables.css 同时带 :root 与 .dark');
assert(built.files['variables.dark.css'].includes('--brand-color-primary'), 'variables.dark.css 是独立 :root');
assert(built.files['theme.json'].includes('"algorithm"'), 'theme.json 带 algorithm');
assert(built.files['BRAND-SYSTEM.md'].includes('tokens.compact.json'), 'BRAND-SYSTEM.md 列了文件清单');
assert(built.files['kit.html'].includes('Buttons') && built.files['kit.html'].includes('Form controls'), 'kit 里有关键组件分区');

const preview = previewSystem(fake);
assert(preview.ok && preview.designMd.includes('## Color Palette'), '预览包带 DESIGN.md');
assert(preview.guideMd.includes('## Color roles'), '预览包带 guide.md');
assert(JSON.parse(preview.brandJson).colors.length >= 5, '预览里的 brand.json 是语义色角色');

(async () => {
  // 拦截 electron 的目录选择框，让导出直接写到临时目录，验证真实落盘。
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-export-'));
  const origLoad = Module._load;
  Module._load = function patched(request, ...rest) {
    if (request === 'electron') {
      return { dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [tmp] }) } };
    }
    return origLoad.call(this, request, ...rest);
  };

  const pngDataUrl = `data:image/png;base64,${Buffer.from('89504e470d0a1a0a', 'hex').toString('base64')}`;
  const { exportBundle } = require('../electron/lib/export-bundle.cjs');
  const fakeWindow = { getFocusedWindow: () => ({}), getAllWindows: () => [{}] };
  const result = {
    ...fake,
    logos: [{ kind: 'favicon', sourceUrl: 'https://www.baidu.com/favicon.ico', bytes: 8, dataUrl: pngDataUrl }],
    imagery: [{ kind: 'cover', caption: 'OG cover', sourceUrl: 'https://www.baidu.com/og.png', bytes: 8, dataUrl: pngDataUrl }],
  };

  // prefetch 会真的联网抓页面，离线测试里关掉。
  const r = await exportBundle(result, fakeWindow, { prefetch: false });
  Module._load = origLoad;

  assert(!!(r && r.ok && r.dir), '导出返回保存目录');
  if (r && r.dir) {
    assert(fs.existsSync(path.join(r.dir, 'brand.json')), 'brand.json 已落盘');
    assert(fs.existsSync(path.join(r.dir, 'DESIGN.md')), 'DESIGN.md 已落盘');
    assert(fs.existsSync(path.join(r.dir, 'guide.md')), 'guide.md 已落盘');
    assert(fs.existsSync(path.join(r.dir, 'extraction.json')), 'extraction.json 已落盘');
    assert(fs.existsSync(path.join(r.dir, 'system', 'kit.html')), 'system/kit.html 已落盘');
    assert(fs.existsSync(path.join(r.dir, 'system', 'artifacts', 'landing.html')), 'system/artifacts/landing.html 已落盘');
    assert(fs.existsSync(path.join(r.dir, 'system', 'scripts', 'apply-design-tokens.mjs')), '应用脚本已落盘');
    assert(fs.existsSync(path.join(r.dir, 'logos', '1-favicon.png')), '标志图片已落盘');
    assert(fs.existsSync(path.join(r.dir, 'imagery', 'cover-0.png')), '素材图已落盘');

    const brand = JSON.parse(fs.readFileSync(path.join(r.dir, 'brand.json'), 'utf8'));
    assert(brand.name === '百度', 'brand.json 记了站名');
    assert(brand.logo.primary === 'logos/1-favicon.png', 'brand.json 标志路径与磁盘一致');
    assert(Array.isArray(brand.imagery.samples) && brand.imagery.samples[0].file === 'imagery/cover-0.png', 'brand.json 素材路径与磁盘一致');

    const extraction = JSON.parse(fs.readFileSync(path.join(r.dir, 'extraction.json'), 'utf8'));
    assert(extraction.primary === '#315efb', 'extraction.json 记了主色');
    assert(!JSON.stringify(extraction).includes('data:image'), 'extraction.json 不含图片二进制');

    const written = fs.readFileSync(path.join(r.dir, 'tokens.css'), 'utf8');
    assert(written === css, '落盘的 tokens.css 与预览一致');

    const kit = fs.readFileSync(path.join(r.dir, 'system', 'kit.html'), 'utf8');
    assert(kit.includes('var(--brand-color-primary)'), 'kit.html 用的是 --brand-* 变量');
  }

  fs.rmSync(tmp, { recursive: true, force: true });

  // 带字体文件和缩略图时的导出
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-export2-'));
  Module._load = function patched2(request, ...rest) {
    if (request === 'electron') {
      return { dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [tmp2] }) } };
    }
    return origLoad.call(this, request, ...rest);
  };
  const woff2 = Buffer.from('wOF2' + '0'.repeat(60), 'latin1').toString('base64');
  const withFonts = {
    ...fake,
    screenshot: `data:image/jpeg;base64,${Buffer.from('ffd8ff', 'hex').toString('base64')}`,
    fetchMode: 'render',
    fontSources: {
      families: [{ family: 'Inter', kind: 'google', cssUrl: 'https://fonts.googleapis.com/css2?family=Inter', previewDataUrl: 'data:font/woff2;base64,AAA' }],
      files: [
        {
          family: 'Inter',
          weight: '400',
          style: 'normal',
          file: 'inter-400.woff2',
          format: 'woff2',
          bytes: 63,
          sourceUrl: 'https://fonts.gstatic.com/inter.woff2',
          dataUrl: `data:font/woff2;base64,${woff2}`,
        },
      ],
    },
  };
  const r2 = await exportBundle(withFonts, fakeWindow, { prefetch: false });
  Module._load = origLoad;
  assert(!!(r2 && r2.ok && r2.dir), '带字体时导出成功');
  if (r2 && r2.dir) {
    assert(fs.existsSync(path.join(r2.dir, 'fonts', 'inter-400.woff2')), '字体文件已落盘');
    assert(fs.existsSync(path.join(r2.dir, 'fonts', 'fonts.css')), 'fonts.css 已落盘');
    assert(fs.existsSync(path.join(r2.dir, 'screenshot.jpg')), '缩略图已落盘');
    const cssWithFonts = fs.readFileSync(path.join(r2.dir, 'tokens.css'), 'utf8');
    assert(cssWithFonts.includes('@font-face'), 'tokens.css 带上了 @font-face');
    assert(cssWithFonts.includes('url("./fonts/inter-400.woff2")'), 'tokens.css 指向 fonts/ 目录');
    const kitWithFonts = fs.readFileSync(path.join(r2.dir, 'system', 'kit.html'), 'utf8');
    assert(kitWithFonts.includes('data-brand-fonts'), 'kit.html 内联了自托管字体');
    assert(kitWithFonts.includes('../fonts/inter-400.woff2'), 'kit.html 的字体路径指向上层 fonts/');
    const extraction = JSON.parse(fs.readFileSync(path.join(r2.dir, 'extraction.json'), 'utf8'));
    assert(extraction.screenshot === 'screenshot.jpg', 'extraction.json 记录了缩略图');
    assert(!JSON.stringify(extraction).includes('data:font/'), 'extraction.json 不重复塞字体二进制');
  }
  fs.rmSync(tmp2, { recursive: true, force: true });

  // 带 copy.json（分渠道文案）时的导出
  const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-export3-'));
  Module._load = function patched3(request, ...rest) {
    if (request === 'electron') {
      return { dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [tmp3] }) } };
    }
    return origLoad.call(this, request, ...rest);
  };
  const r3 = await exportBundle(fake, fakeWindow, {
    prefetch: false,
    copy: { landing: { heroTitle: '让发布更简单', cta: '开始使用' } },
  });
  Module._load = origLoad;
  assert(!!(r3 && r3.ok && r3.dir), '带文案时导出成功');
  if (r3 && r3.dir) {
    assert(fs.existsSync(path.join(r3.dir, 'copy.json')), 'copy.json 已落盘');
    const copy = JSON.parse(fs.readFileSync(path.join(r3.dir, 'copy.json'), 'utf8'));
    assert(copy.format === 'brand-copy/1', 'copy.json 带格式版本');
    assert(copy.brand === '百度', 'copy.json 记了站名');
    assert(copy.landing.heroTitle === '让发布更简单', 'copy.json 内容与传入一致');
    assert(r3.files.includes('copy.json'), '文件清单里报了 copy.json');
  }
  fs.rmSync(tmp3, { recursive: true, force: true });

  // 不带 copy 时不应出现 copy.json
  const tmp4 = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-export4-'));
  Module._load = function patched4(request, ...rest) {
    if (request === 'electron') {
      return { dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [tmp4] }) } };
    }
    return origLoad.call(this, request, ...rest);
  };
  const r4 = await exportBundle(fake, fakeWindow, { prefetch: false });
  Module._load = origLoad;
  assert(r4 && r4.ok && !fs.existsSync(path.join(r4.dir, 'copy.json')), '没生成文案时不写 copy.json');
  fs.rmSync(tmp4, { recursive: true, force: true });

  console.log('\n--- tokens.css 预览 ---\n' + css);
  console.log(`\n结果：${pass} 通过，${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();
