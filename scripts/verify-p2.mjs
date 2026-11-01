// P2 验证：浏览器渲染抓取、字体下载、四种预览、换主色、补缩略图。
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:9222';
const OUT_DIR = path.resolve(process.cwd(), '.workbuddy');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await fetch(`${BASE}/json/list`).then((r) => r.json());
const page = list.find((t) => t.type === 'page');
if (!page) throw new Error('没有窗口');

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const events = [];
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) rej(new Error(JSON.stringify(m.error)));
    else res(m.result);
  } else if (m.method) events.push(m);
});
const send = (method, params = {}) => {
  const n = ++id;
  return new Promise((res, rej) => {
    pending.set(n, { res, rej });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
};
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
  return r.result.value;
};
const shot = async (file) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, file), Buffer.from(r.data, 'base64'));
  return file;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Log.enable');
await send('Page.reload', { ignoreCache: true });
await sleep(2500);

const clickByText = (text) => `(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)});
  if (!b) return 'NOT_FOUND';
  b.click();
  return 'ok';
})()`;

const setUrl = (url) => `(() => {
  const input = document.querySelector('input:not([type=color])');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, ${JSON.stringify(url)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input.value;
})()`;

const out = {};

// ── 1. 浏览器渲染模式抓一个重脚本站点 ──
out.modeClick = await evalJs(clickByText('浏览器渲染'));
out.urlSet = await evalJs(setUrl('https://www.shopify.com'));
await evalJs(clickByText('开始提取'));

let done = false;
for (let i = 0; i < 120; i += 1) {
  await sleep(1000);
  done = await evalJs(`document.body.innerText.includes('导出配色与字体文件') || document.body.innerText.includes('这次没有提取到内容') || document.body.innerText.includes('出错了')`);
  if (done) break;
}
out.renderDone = done;

out.summary = await evalJs(`(() => {
  const t = document.body.innerText;
  return {
    hasResult: t.includes('导出配色与字体文件'),
    error: t.includes('这次没有提取到内容') ? t.split('\\n').find((l) => l.includes('没有提取到内容') || l.includes('没有返回内容')) : '',
    renderBadge: t.includes('浏览器渲染'),
    hasScreenshot: !!document.querySelector('img[alt="网站缩略图"]'),
    fontBadges: {
      google: t.includes('在线字体 · Google Fonts'),
      downloaded: t.includes('网站自带字体 · 已下载'),
      system: t.includes('系统字体'),
    },
    primary: (t.match(/主色 (#[0-9a-f]{6})/) || [])[1] || '',
    swatches: document.querySelectorAll('button[title^="点击复制 #"]').length,
    fontFilesText: (t.match(/已下载 \\d+ 个字体文件/) || [])[0] || '',
    logoThumbs: document.querySelectorAll('.grid.grid-cols-4 button img').length,
  };
})()`);
out.renderShot = await shot('p2-1-render.png');

// ── 2. 四种文件预览 ──
await evalJs(clickByText('设计文件'));
await sleep(1200);
const tabNames = ['tokens.css', 'brand.json', 'tailwind.config.js', 'tokens.json'];
out.previews = {};
for (const name of tabNames) {
  await evalJs(clickByText(name));
  await sleep(600);
  out.previews[name] = await evalJs(`(() => {
    const pre = document.querySelector('pre');
    const text = pre ? pre.innerText : '';
    return { chars: text.length, head: text.split('\\n').slice(0, 3).join(' | ').slice(0, 160) };
  })()`);
}
await evalJs(clickByText('tailwind.config.js'));
await sleep(500);
out.filesShot = await shot('p2-2-files.png');

// ── 3. 换主色 ──
await evalJs(clickByText('设计体系'));
await sleep(500);
const before = await evalJs(`(() => {
  const t = document.body.innerText;
  return { primary: (t.match(/主色 (#[0-9a-f]{6})/) || [])[1] || '', first: (t.match(/(#[0-9a-f]{6})\\n/) || [])[1] || '' };
})()`);
out.seedChange = await evalJs(`(() => {
  const input = document.querySelector('input[type=color]');
  if (!input) return 'NO_COLOR_INPUT';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '#e0245e');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'set';
})()`);
await sleep(1500);
const after = await evalJs(`(() => {
  const t = document.body.innerText;
  return { primary: (t.match(/主色 (#[0-9a-f]{6})/) || [])[1] || '' };
})()`);
out.seedChanged = { before: before.primary, after: after.primary, ok: before.primary !== after.primary && after.primary === '#e0245e' };
out.seedShot = await shot('p2-3-seed.png');

// tokens.css 应当跟着变
await evalJs(clickByText('设计文件'));
await sleep(800);
await evalJs(clickByText('tokens.css'));
await sleep(700);
out.tokensAfterSeed = await evalJs(`(() => {
  const text = document.querySelector('pre') ? document.querySelector('pre').innerText : '';
  return { hasNewSeed: text.includes('#e0245e'), chars: text.length };
})()`);

// ── 4. 只读源码 + 补缩略图 ──
await evalJs(clickByText('设计体系'));
await evalJs(clickByText('只读源码'));
await evalJs(setUrl('https://www.baidu.com'));
await evalJs(clickByText('开始提取'));
for (let i = 0; i < 60; i += 1) {
  await sleep(800);
  if (await evalJs(`document.body.innerText.includes('导出配色与字体文件')`)) break;
}
out.staticMode = await evalJs(`(() => {
  const t = document.body.innerText;
  return {
    hasResult: t.includes('导出配色与字体文件'),
    staticBadge: t.includes('只读源码'),
    hasScreenshotBefore: !!document.querySelector('img[alt="网站缩略图"]'),
    hasCaptureButton: t.includes('补一张'),
  };
})()`);
out.captureClick = await evalJs(clickByText('补一张'));
let captured = false;
for (let i = 0; i < 40; i += 1) {
  await sleep(800);
  captured = await evalJs(`!!document.querySelector('img[alt="网站缩略图"]')`);
  if (captured) break;
}
out.captureWorked = captured;
out.staticShot = await shot('p2-4-thumb.png');

// ── 5. 内网地址在渲染模式下也应被拦截 ──
await evalJs(clickByText('浏览器渲染'));
await evalJs(setUrl('http://127.0.0.1:9222/json'));
await evalJs(clickByText('开始提取'));
await sleep(2500);
out.renderGuard = await evalJs(`(() => {
  const t = document.body.innerText;
  return { blocked: t.includes('不抓取本机与内网地址'), snippet: (t.match(/出于安全限制[^\\n]*/) || [])[0] || '' };
})()`);

out.consoleErrors = events
  .filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'))
  .map((e) =>
    e.method === 'Runtime.exceptionThrown'
      ? `exception: ${e.params.exceptionDetails?.exception?.description || e.params.exceptionDetails?.text}`
      : `log: ${e.params.entry.text}`,
  )
  .slice(0, 6);

// 清掉测试历史
out.historyCleared = await evalJs(`window.api.historyClear().then((r) => (r.items || []).length)`);

console.log(JSON.stringify(out, null, 2));
ws.close();
process.exit(0);
