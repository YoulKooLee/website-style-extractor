// 验证：复制网址按钮已去掉；提取完自动补截图，缩略图默认就有。
import fs from 'node:fs';

// 探针：谁在杀进程、杀在第几步。
process.on('SIGTERM', () => {
  console.error('GOT SIGTERM at', new Error().stack?.split('\n').slice(1, 4).join(' | '));
  process.exit(1);
});

const list = await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json());
const page = list.find((t) => t.type === 'page');
if (!page) {
  console.log('NO_PAGE');
  process.exit(1);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const consoleErrors = [];
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
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    consoleErrors.push(m.params.args.map((a) => a.value || a.description || '').join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(m.params.exceptionDetails.exception?.description || 'exception');
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
const clickText = (text) =>
  ev(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)});
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
const bodyText = () => ev('document.body.innerText');

await send('Runtime.enable');
await send('Page.enable');
console.error('cdp ready');
await send('Page.reload', { ignoreCache: true });
await sleep(2500);
console.error('reloaded');

const out = { steps: {} };

// 1. 提取百度
await ev(`(() => {
  const input = document.querySelector('input[placeholder]');
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'https://www.baidu.com');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(200);
await clickText('开始提取');
for (let i = 0; i < 60; i++) {
  await sleep(1000);
  if ((await bodyText()).includes('导出整套设计体系')) break;
}
const afterExtract = await bodyText();
console.error('extract done');
out.steps.extractOk = afterExtract.includes('导出整套设计体系');
out.steps.noCopyUrlButton = !afterExtract.includes('复制网址') && !afterExtract.includes('网址已复制');

// 2. 缩略图自动出现（不点「补一张」）
let thumbAuto = false;
let sawCapturing = false;
for (let i = 0; i < 40; i++) {
  await sleep(1000);
  console.error(`loop ${i}`);
  const t = await bodyText();
  if (t.includes('正在用内置浏览器打开页面截图')) sawCapturing = true;
  const hasImg = await ev(`(() => {
    const imgs = [...document.querySelectorAll('img')];
    return imgs.some((im) => im.alt === '网站缩略图' && (im.src || '').startsWith('data:image'));
  })()`);
  if (hasImg) {
    thumbAuto = true;
    break;
  }
}
out.steps.sawCapturingHint = sawCapturing;
out.steps.thumbAuto = thumbAuto;
await shot('p7-1-auto-thumbnail');

out.consoleErrors = consoleErrors;
console.log(JSON.stringify(out, null, 2));
ws.close();
process.exit(0);
