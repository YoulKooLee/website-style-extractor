// 驱动界面实测：提取 → 预览 kit → 切深色 → 切模板 → 切源码，并逐张截图。
import fs from 'node:fs';

const list = await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json());
const page = list.find((t) => t.type === 'page');
if (!page) {
  console.log('NO_PAGE');
  process.exit(1);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
  }
});
const send = (method, params = {}) => {
  const n = ++id;
  return new Promise((res, rej) => {
    pending.set(n, { res, rej });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
};
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
  return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`.workbuddy/${name}.png`, Buffer.from(s.data, 'base64'));
};

await send('Runtime.enable');
await send('Page.enable');

const url = process.argv[2] || 'https://www.baidu.com';
const out = {};

// 1. 触发提取
await ev(`(() => {
  const input = document.querySelector('input[type="text"], input[placeholder]');
  if (input) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(url)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  return true;
})()`);
await sleep(300);
await ev(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /开始提取/.test(b.textContent));
  if (btn) btn.click();
  return !!btn;
})()`);

// 2. 等结果（最多 90 秒）
for (let i = 0; i < 90; i++) {
  await sleep(1000);
  const ready = await ev(`document.body.innerText.includes('导出整套设计体系')`);
  if (ready) break;
}

out.summary = await ev(`(() => {
  const t = document.body.innerText;
  return { hasResult: t.includes('导出整套设计体系') };
})()`);

// 切到「设计文件」标签页
await ev(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '设计文件');
  if (btn) btn.click();
  return !!btn;
})()`);
await sleep(1200);

out.summary = await ev(`(() => {
  const t = document.body.innerText;
  return {
    hasResult: t.includes('导出整套设计体系'),
    hasPreviewTab: t.includes('成品预览'),
    fileCount: (t.match(/共 (\\d+) 个设计体系文件/) || [])[1] || '',
    slug: (t.match(/slug ([a-z0-9-]+)/) || [])[1] || '',
    iframeCount: document.querySelectorAll('iframe').length,
  };
})()`);

// 3. 等 kit 渲染出来再截图
await sleep(2500);
await shot('p3-1-kit-light');

// 4. 切深色 kit
await ev(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '组件 kit · 深色');
  if (btn) btn.click();
  return !!btn;
})()`);
await sleep(2500);
out.dark = await ev(`(() => {
  const f = document.querySelector('iframe');
  const doc = f && f.contentDocument;
  return { iframe: !!f, bg: doc ? getComputedStyle(doc.body).backgroundColor : 'n/a' };
})()`);
await shot('p3-2-kit-dark');

// 5. 切 landing 模板
await ev(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Landing 落地页'));
  if (btn) btn.click();
  return !!btn;
})()`);
await sleep(2500);
await shot('p3-3-landing');

// 6. 切源码 → BRAND-SYSTEM.md
await ev(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '源码');
  if (btn) btn.click();
  return !!btn;
})()`);
await sleep(600);
await ev(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'BRAND-SYSTEM.md');
  if (btn) btn.click();
  return !!btn;
})()`);
await sleep(900);
out.code = await ev(`(() => {
  const pre = document.querySelector('pre');
  const text = pre ? pre.textContent : '';
  return { chars: text.length, hasFiles: text.includes('tokens.compact.json'), head: text.slice(0, 40) };
})()`);
await shot('p3-4-brand-system');

// 7. 控制台错误
out.consoleErrors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') out.consoleErrors.push(m.params.exceptionDetails.text);
});

console.log(JSON.stringify(out, null, 2));
ws.close();
process.exit(0);
