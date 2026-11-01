'use strict';
// 离线验证字体解析与 @font-face 生成（不联网、不下载）。
const { parseFontFaces, buildFontFaceCss, collectFontSources } = require('../electron/lib/webfonts.cjs');

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

const css = `
@font-face {
  font-family: "Inter";
  src: url("/fonts/Inter-Regular.woff2") format("woff2"), url("/fonts/Inter-Regular.woff") format("woff");
  font-weight: 400;
  font-style: normal;
  unicode-range: U+0000-00FF, U+0131;
}
@font-face {
  font-family: 'Source Han Sans';
  src: url(https://cdn.example.com/shs-700.woff2) format('woff2');
  font-weight: 700;
}
@font-face {
  font-family: "Font Awesome 6 Free";
  src: url("/fonts/fa.woff2") format("woff2");
}
@font-face {
  font-family: "Ttf Only";
  src: url("/fonts/x.ttf") format("truetype");
}
`;

const faces = parseFontFaces(css, 'https://www.example.com/page');
assert(faces.length === 3, '解析出 3 个 @font-face（图标字体被排除）');
assert(!faces.some((f) => /awesome/i.test(f.family)), '图标字体被排除');

const inter = faces.find((f) => f.family === 'Inter');
assert(!!inter, 'Inter 字体被识别');
assert(inter.format === 'woff2', '同一家族优先取 woff2');
assert(inter.url === 'https://www.example.com/fonts/Inter-Regular.woff2', '相对路径按页面地址补全');
assert(inter.unicodeRange.includes('U+0000-00FF'), '记录 unicode-range');

const han = faces.find((f) => f.family === 'Source Han Sans');
assert(han && han.weight === '700', '粗细被记录');
assert(han.url === 'https://cdn.example.com/shs-700.woff2', '绝对地址保持原样');

const notSvg = faces.find((f) => f.family === 'Ttf Only');
assert(notSvg && notSvg.format === 'truetype', 'ttf 归为 truetype');

const files = [
  { family: 'Inter', file: 'inter-400.woff2', format: 'woff2', weight: '400', style: 'normal', unicodeRange: 'U+0000-00FF' },
  { family: 'Source Han Sans', file: 'source-han-sans-700.woff2', format: 'woff2', weight: '700', style: 'normal' },
];
const withPrefix = buildFontFaceCss(files, './fonts/');
assert(withPrefix.includes('src: url("./fonts/inter-400.woff2") format("woff2");'), '导出的 @font-face 指向 ./fonts/');
assert(withPrefix.includes('unicode-range: U+0000-00FF;'), '导出时保留 unicode-range');
assert((withPrefix.match(/@font-face/g) || []).length === 2, '两个字体各生成一条 @font-face');

const inline = buildFontFaceCss([{ ...files[0], dataUrl: 'data:font/woff2;base64,AAA' }], '');
assert(inline.includes('data:font/woff2;base64,AAA'), '预览时可用 dataURL 内联字体');

(async () => {
  // 多样式表：每条样式表的相对路径要按它自己的地址补全；Google 样式表要标成在线字体。
  const sheets = [
    {
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400',
      css: `@font-face{font-family:'Inter';src:url(https://fonts.gstatic.com/s/inter/v1/x.woff2) format('woff2');font-weight:400;}`,
    },
    {
      url: 'https://www.example.com/assets/css/site.css',
      css: `@font-face{font-family:'Brand Sans';src:url(../fonts/brand.woff2) format('woff2');font-weight:400;}`,
    },
  ];
  const r = await collectFontSources(sheets, 'https://www.example.com/', {
    preferFamilies: ['Inter', 'Brand Sans'],
    usedFamilies: ['Inter', 'Brand Sans', 'Roboto'],
  });
  const inter = r.families.find((f) => f.family === 'Inter');
  const brand = r.families.find((f) => f.family === 'Brand Sans');
  const roboto = r.families.find((f) => f.family === 'Roboto');
  assert(!!inter && inter.kind === 'google', 'Google 样式表里的字体标为在线字体');
  assert(!!inter && inter.cssUrl.includes('fonts.googleapis.com'), '记录 Google 在线样式地址');
  assert(!!brand && brand.kind === 'self', '自托管字体标为网站自带');
  assert(
    !!brand && brand.sourceUrl === 'https://www.example.com/assets/fonts/brand.woff2',
    '相对路径按样式表地址补全（不是按页面地址）',
  );
  assert(!!roboto && roboto.kind === 'system', '只有名字没有文件时标为系统字体');

  console.log(`\n结果：${pass} 通过，${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();
