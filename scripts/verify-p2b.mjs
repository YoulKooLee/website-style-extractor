// 补充验证：Google Fonts 站点 → 在线字体标记；字体面板与缩略图。
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:9222';
const OUT_DIR = path.resolve(process.cwd(), '.workbuddy');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await fetch(`${BASE}/json/list`).then((r) => r.json());
const page = list.find((t) => t.type === 'page');
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

await send('Runtime.enable');
await send('Page.enable');
await send('Log.enable');
await send('Page.reload', { ignoreCache: true });
await sleep(2500);

const out = {};
await evalJs(clickByText('自动'));
await evalJs(setUrl('https://tailwindcss.com'));
await evalJs(clickByText('开始提取'));
for (let i = 0; i < 90; i += 1) {
  await sleep(1000);
  if (await evalJs(`document.body.innerText.includes('导出配色与字体文件')`)) break;
}

out.summary = await evalJs(`(() => {
  const t = document.body.innerText;
  const badgeEl = [...document.querySelectorAll('span')].find((s) => /^(浏览器渲染|只读源码)$/.test(s.textContent.trim()) && String(s.className).includes('rounded-full'));
  return {
    hasResult: t.includes('导出配色与字体文件'),
    fetchMode: badgeEl ? badgeEl.textContent.trim() : '',
    primary: (t.match(/主色 (#[0-9a-f]{6})/) || [])[1] || '',
    google: t.includes('在线字体 · Google Fonts'),
    downloaded: t.includes('网站自带字体 · 已下载'),
    fontFiles: (t.match(/已下载 \\d+ 个字体文件/) || [])[0] || '',
    googleUrlButton: t.includes('复制在线地址'),
    hasScreenshot: !!document.querySelector('img[alt="网站缩略图"]'),
  };
})()`);

// 滚到字体面板
await evalJs(`(() => {
  const h = [...document.querySelectorAll('h2')].find((x) => x.textContent.trim() === '字体');
  if (h) h.scrollIntoView({ block: 'center' });
  return 'ok';
})()`);
await sleep(600);
out.fontShot = await shot('p2-5-fonts.png');

// brand.json 体积检查
await evalJs(clickByText('设计文件'));
await sleep(900);
await evalJs(clickByText('brand.json'));
await sleep(800);
out.brandJson = await evalJs(`(() => {
  const pre = document.querySelector('pre');
  const text = pre ? pre.innerText : '';
  return { chars: text.length, hasPreviewDataUrl: text.includes('previewDataUrl'), hasFontFile: text.includes('.woff2') };
})()`);

out.consoleErrors = events
  .filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'))
  .map((e) => (e.method === 'Runtime.exceptionThrown' ? `exception: ${e.params.exceptionDetails?.exception?.description}` : `log: ${e.params.entry.text}`))
  .slice(0, 5);

out.historyCleared = await evalJs(`window.api.historyClear().then((r) => (r.items || []).length)`);
console.log(JSON.stringify(out, null, 2));
ws.close();
process.exit(0);
