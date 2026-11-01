// 通过调试端口驱动界面做一次真实提取，并截图留证。
// 用法：node scripts/verify-ui.mjs [网址]

import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:9222';
const TARGET_URL = process.argv[2] || 'https://www.baidu.com';
const OUT_DIR = path.resolve(process.cwd(), '.workbuddy');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findTarget() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const list = await fetch(`${BASE}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {
      /* 端口还没起来 */
    }
    await sleep(500);
  }
  throw new Error('没有找到可调试的窗口');
}

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
  }

  async open() {
    await new Promise((res, rej) => {
      this.ws.addEventListener('open', res, { once: true });
      this.ws.addEventListener('error', rej, { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text || '页面脚本报错');
    }
    return r.result.value;
  }

  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const full = path.join(OUT_DIR, file);
    fs.writeFileSync(full, Buffer.from(r.data, 'base64'));
    return full;
  }
}

function errorsFrom(cdp) {
  const out = [];
  for (const e of cdp.events) {
    if (e.method === 'Runtime.exceptionThrown') {
      out.push(`exception: ${e.params.exceptionDetails?.exception?.description || e.params.exceptionDetails?.text}`);
    }
    if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') {
      out.push(`log: ${e.params.entry.text}`);
    }
  }
  return out;
}

const report = {};
const target = await findTarget();
const cdp = new CDP(target.webSocketDebuggerUrl);
await cdp.open();
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
await cdp.send('Log.enable');

report.title = await cdp.eval('document.title');
report.bridge = await cdp.eval('typeof window.api === "object" ? Object.keys(window.api).join(",") : "MISSING"');
report.initialShot = await cdp.shot('verify-1-empty.png');

report.started = await cdp.eval(`(() => {
  const input = document.querySelector('input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, ${JSON.stringify(TARGET_URL)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('开始提取'));
  if (!btn) return 'NO_BUTTON';
  btn.click();
  return 'clicked';
})()`);

// 抓一次中间进度，证明进度条在动
await sleep(1200);
report.progressMid = await cdp.eval(`(() => {
  const t = document.body.innerText;
  const m = t.match(/正在[^\\n]{0,20}/g);
  const pct = t.match(/\\d{1,3}%/);
  return (m ? m[0] : '') + ' ' + (pct ? pct[0] : '');
})()`);

// 等结果出来（最多 40 秒）
let done = false;
for (let i = 0; i < 80; i += 1) {
  await sleep(500);
  done = await cdp.eval(`document.body.innerText.includes('导出配色与字体文件') || document.body.innerText.includes('这次没有提取到内容') || document.body.innerText.includes('出错了')`);
  if (done) break;
}
report.resultRendered = done;

report.summary = await cdp.eval(`(() => {
  const t = document.body.innerText;
  return {
    hasError: t.includes('这次没有提取到内容') || t.includes('提取过程中出错了'),
    hasSiteCard: t.includes('复制网址'),
    hasLogoSection: t.includes('网站标志'),
    hasPalette: t.includes('配色'),
    hasPreview: t.includes('实际用起来是什么样'),
    hasFonts: t.includes('字体样例'),
    hasHistory: t.includes('最近提取'),
    tabs: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((x) => ['设计体系', '设计文件'].includes(x)),
    primary: (t.match(/主色 (#[0-9a-f]{6})/) || [])[1] || '',
    swatchCount: document.querySelectorAll('button[title^="点击复制 #"]').length,
    logoThumbs: document.querySelectorAll('.grid.grid-cols-4 button img').length,
  };
})()`);

report.designShot = await cdp.shot('verify-2-design.png');

// 切到「设计文件」预览
report.filesTab = await cdp.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '设计文件');
  if (!b) return 'NO_TAB';
  b.click();
  return 'ok';
})()`);
await sleep(900);
report.filesPreview = await cdp.eval(`(() => {
  const pre = document.querySelector('pre');
  const text = pre ? pre.innerText : '';
  return { chars: text.length, head: text.split('\\n').slice(0, 4).join(' | ') };
})()`);
report.filesShot = await cdp.shot('verify-3-files.png');

// brand.json 也看一眼
await cdp.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'brand.json')?.click()`);
await sleep(700);
report.brandPreview = await cdp.eval(`(() => {
  const pre = document.querySelector('pre');
  const text = pre ? pre.innerText : '';
  return { chars: text.length, hasPrimary: text.includes('"primary"') };
})()`);

report.history = await cdp.eval(`window.api.historyList().then((r) => (r.items || []).map((i) => i.host + ' / ' + (i.siteName || i.title || '') + ' / ' + i.primary))`);

// 回看历史：点第一条，看是否能还原
report.historyRestore = await cdp.eval(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('title') || '').includes('http'));
  if (!btn) return 'NO_HISTORY_ITEM';
  btn.click();
  return 'clicked';
})()`);
await sleep(1500);
report.afterRestore = await cdp.eval(`(() => {
  const t = document.body.innerText;
  return { hasResult: t.includes('导出配色与字体文件'), hasSiteCard: t.includes('复制网址') };
})()`);

report.consoleErrors = errorsFrom(cdp);

console.log(JSON.stringify(report, null, 2));
cdp.ws.close();
process.exit(0);
