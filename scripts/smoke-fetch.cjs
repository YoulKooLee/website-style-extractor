'use strict';
// 真实联网冒烟测试：直接走主进程提取编排，验证抓取/颜色/字体/Logo/文案链路。
const { extractSite } = require('../electron/lib/extract-site.cjs');

const target = process.argv[2] || 'https://example.com';

(async () => {
  console.log('目标：', target);
  const resp = await extractSite(target);
  if (!resp.ok) {
    console.log('失败：', resp.error);
    process.exit(1);
  }
  const r = resp.result;
  console.log('最终URL :', r.finalUrl);
  console.log('站点名  :', r.siteName || '(空)');
  console.log('标题    :', r.title);
  console.log('简介    :', (r.description || '(空)').slice(0, 80));
  console.log('被墙    :', r.blocked, '| 内容单薄:', r.thin);
  console.log('颜色数  :', r.colors.length, '前6:', r.colors.slice(0, 6).map(c => c.hex + 'x' + c.count).join(' '));
  console.log('主色阶  :', r.primaryLadder ? r.primaryLadder.seed + ' -> ' + r.primaryLadder.steps.length + '阶' : '无');
  console.log('字体    :', r.fonts.map(f => f.family + 'x' + f.count).join(' | ') || '(无)');
  console.log('@font   :', r.fontFaceFamilies.join(' | ') || '(无)');
  console.log('Logo数  :', r.logos.length, r.logos.map(l => l.kind + ':' + l.bytes + 'B').join(', '));
  console.log('标题文案:', r.headings.slice(0, 3).join(' / '));
})().catch((e) => { console.error('异常：', e); process.exit(1); });
