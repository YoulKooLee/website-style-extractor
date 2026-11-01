// 检查三个状态：抓取中的进度提示、网址不合法、站点连不上。
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
  }
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
await send('Page.reload', { ignoreCache: true });
await sleep(2500);

const setUrlAndClick = (url) => `(() => {
  const input = document.querySelector('input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, ${JSON.stringify(url)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('开始提取'));
  btn.click();
  return 'ok';
})()`;

const out = {};

// 1) 进度提示：慢一点的站点，密集采样（只取带百分比的那行，避开按钮文字）
await evalJs(setUrlAndClick('https://www.apple.com.cn'));
const labels = [];
for (let i = 0; i < 60; i += 1) {
  await sleep(120);
  const s = await evalJs(`(() => {
    const line = document.body.innerText.split('\\n').find((l) => /%$/.test(l.trim()) || /^\\d{1,3}%$/.test(l.trim()));
    const label = document.body.innerText.split('\\n').find((l) => /^正在.+…$/.test(l.trim()) && !l.includes('提取…'));
    return { label: label || '', pct: line || '' };
  })()`);
  const key = `${s.label} ${s.pct}`.trim();
  if (key && !labels.includes(key)) labels.push(key);
  const finished = await evalJs(`document.body.innerText.includes('导出配色与字体文件')`);
  if (finished) break;
}
out.progressLabels = labels;
out.appleDone = await evalJs(`(() => {
  const t = document.body.innerText;
  return { hasResult: t.includes('导出配色与字体文件'), primary: (t.match(/主色 (#[0-9a-f]{6})/) || [])[1] || '' };
})()`);

// 2) 内网地址/本机地址
await evalJs(setUrlAndClick('http://127.0.0.1:3000'));
await sleep(1500);
out.localGuard = await evalJs(`(() => {
  const t = document.body.innerText;
  const head = t.split('\\n').find((l) => l.includes('安全限制')) || '';
  const hint = t.split('\\n').find((l) => l.includes('内网') && l.includes('公开网站')) || '';
  return { head, hint };
})()`);
out.localShot = await shot('verify-5-guard.png');

// 3) 连不上的域名：等它超时（8 秒）后看错误态
await evalJs(setUrlAndClick('https://this-domain-should-not-exist-9f3a2b.com'));
let netErr = null;
for (let i = 0; i < 40; i += 1) {
  await sleep(500);
  netErr = await evalJs(`(() => {
    const t = document.body.innerText;
    const head = t.split('\\n').find((l) => l.includes('没有返回内容')) || '';
    const hint = t.split('\\n').find((l) => l.includes('可能是网络不通')) || '';
    return head ? { head, hint } : null;
  })()`);
  if (netErr) break;
}
out.networkFail = netErr || { head: '', hint: '' };
out.networkShot = await shot('verify-6-network.png');

// 收尾：清掉测试留下的历史
out.historyCleared = await evalJs(`window.api.historyClear().then((r) => (r.items || []).length)`);

console.log(JSON.stringify(out, null, 2));
ws.close();
process.exit(0);
