'use strict';
// 离线自测：颜色规范、色频排序、字体识别、主色十阶展开。
const { normalizeColor, extractColors } = require('../electron/lib/colors.cjs');
const { extractFonts } = require('../electron/lib/fonts.cjs');
const { generate } = require('../electron/lib/palette.cjs');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('PASS', msg); }
  else { fail++; console.log('FAIL', msg); }
}

// 1. 颜色规范化
assert(normalizeColor('#1677ff') === '#1677ff', 'hex6 保持');
assert(normalizeColor('#1677FF') === '#1677ff', 'hex6 转小写');
assert(normalizeColor('#abc') === '#aabbcc', 'hex3 扩成 hex6');
assert(normalizeColor('rgb(22, 119, 255)') === '#1677ff', 'rgb 转 hex');
assert(normalizeColor('rgba(22,119,255,0.5)') === '#1677ff', 'rgba 取前三通道');

// 2. 色频 + 高信号品牌色优先
const css = `
:root{ --brand-primary:#1677ff; --accent:#52c41a; }
.btn{ background:#1677ff; color:#fff; }
.link{ color:#1677ff; }
.card{ background:#ffffff; }
.text{ color:#1f2937; }
`;
const colors = extractColors(css);
const top = colors[0];
assert(colors.length > 0, '提取到颜色候选');
assert(colors.some(c => c.hex === '#1677ff'), '主色 #1677ff 入选');
console.log('  候选前5:', colors.slice(0, 5).map(c => `${c.hex}x${c.count}`).join(', '));

// 3. 字体识别（排除通用与图标字体）
const fontCss = `
body{ font-family:"Inter", -apple-system, sans-serif; }
h1{ font-family:"Inter", sans-serif; }
.nav{ font-family:"Material Icons", sans-serif; }
@font-face{ font-family:"Source Sans Pro"; src:url(x.woff2); }
`;
const fonts = extractFonts(fontCss);
assert(fonts.fonts.some(f => f.family === 'Inter' && f.count === 2), 'Inter 按频次 2');
assert(!fonts.fonts.some(f => /icon/i.test(f.family)), '图标字体被排除');
assert(fonts.fontFaceFamilies.includes('Source Sans Pro'), '@font-face 家族被记录');
console.log('  fonts:', JSON.stringify(fonts.fonts.map(f => f.family)));

// 4. 主色十阶
const steps = generate('#1677ff');
assert(steps.length === 10, '色阶共 10 阶');
assert(/^#[0-9a-f]{6}$/.test(steps[5]), 'index5 是合法 hex');
console.log('  blue ladder:', steps.join(' '));

console.log(`\n结果：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
