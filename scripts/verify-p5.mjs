// 用本地假接口替代真实大模型，端到端验证「配置 → 测试连接 → AI 补全文案 → 整套重生成」。
import fs from 'node:fs';
import http from 'node:http';

const STUB_TAGLINE = '让每一笔生意都开在同一个后台里';
const STUB_PILLAR = '一个后台管完全部渠道';

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    let payload = {};
    try {
      payload = JSON.parse(body || '{}');
    } catch {
      payload = {};
    }
    const isPing = JSON.stringify(payload.messages || []).includes('连通性测试');
    const content = isPing
      ? '通了'
      : JSON.stringify({
          name: '示例品牌',
          tagline: STUB_TAGLINE,
          description: '把商品、订单和营销放在同一处管理，小团队也能像大团队一样运转。',
          voice: {
            adjectives: ['clear', 'practical', 'confident'],
            tone: 'direct and product-led',
            messagingPillars: [STUB_PILLAR, '开箱就能用', '按用量付费'],
            vocabulary: { use: ['后台', '订单', '渠道'], avoid: ['赋能', '闭环'] },
          },
          imagery: {
            style: 'bright product photography',
            subjects: ['small team at work'],
            treatment: 'natural light, no heavy filters',
            avoid: ['stock handshake photos'],
          },
          colorNames: [
            { role: 'accent', name: '靛蓝' },
            { role: 'background', name: '雪白' },
          ],
          postureRules: ['标题不超过两行', '正文行高 1.6'],
        });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        model: 'stub-model',
        choices: [{ message: { role: 'assistant', content } }],
        usage: { prompt_tokens: 860, completion_tokens: 240, total_tokens: 1100 },
      }),
    );
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}/v1`;

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
const setInput = (selector, value) =>
  ev(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
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

const out = { steps: {}, baseUrl };

// 0. 重新提取一次，确保从干净状态开始
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

// 1. 配置指向本地假接口
await clickText('AI 设置');
await sleep(400);
await clickText('自定义');
await sleep(200);
await setInput('input[placeholder="https://api.deepseek.com/v1"]', baseUrl);
await setInput('input[placeholder="deepseek-chat"]', 'stub-model');
await setInput('input[type="password"]', 'sk-stub-key-000');
await sleep(200);
await clickText('测试连接');
for (let i = 0; i < 20; i++) {
  await sleep(400);
  if ((await bodyText()).includes('连通了')) break;
}
const pingText = await bodyText();
out.steps.pingOk = pingText.includes('连通了');
out.steps.pingText = (pingText.match(/连通了[^\n]*/) || [])[0] || '';
await shot('p5-1-ping-ok');

await clickText('保存');
await sleep(700);
await clickText('关闭');
await sleep(400);
out.steps.headerShowsAi = /AI 已接：\s*stub-model/.test(await bodyText());

// 2. 点「AI 补全文案」
out.steps.enrichClicked = await clickText('AI 补全文案');
for (let i = 0; i < 30; i++) {
  await sleep(500);
  const t = await bodyText();
  if (t.includes('AI 写好了') || t.includes('AI 这次没给出结果') || t.includes('AI 调用失败')) break;
}
const afterEnrich = await bodyText();
out.steps.enrichOk = afterEnrich.includes('AI 写好了');
out.steps.enrichMessage = (afterEnrich.match(/AI 写好了[^\n]*/) || [])[0] || '';
out.steps.bannerNearTop = out.steps.enrichOk && afterEnrich.indexOf('AI 写好了') < afterEnrich.indexOf('组件 kit');
await shot('p5-2-ai-enriched');

// 3. brand.json 里应该出现本地假接口写的内容
await clickText('源码');
await sleep(900);
const draft = await ev(`document.querySelector('textarea') ? document.querySelector('textarea').value : ''`);
out.steps.hasTagline = draft.includes(STUB_TAGLINE);
out.steps.hasPillar = draft.includes(STUB_PILLAR);
out.steps.hasColorName = draft.includes('靛蓝') && draft.includes('雪白');
out.steps.hasPosture = draft.includes('标题不超过两行');
out.steps.hasTone = draft.includes('direct and product-led');
out.steps.kitUsesAccentName = draft.includes('"role": "accent"');
await shot('p5-3-brand-after-ai');

// 4. 预览页跟着变（tagline 进了 hero）
await clickText('成品预览');
await sleep(1200);
await clickText('Landing 落地页');
await sleep(1500);
const iframeText = await ev(`(() => {
  const f = document.querySelector('iframe');
  if (!f) return '';
  try { return f.contentDocument ? f.contentDocument.body.innerText : ''; } catch (e) { return ''; }
})()`);
const srcDoc = await ev(`(() => { const f = document.querySelector('iframe'); return f ? f.getAttribute('srcdoc') : ''; })()`);
out.steps.heroHasTagline = String(srcDoc).includes(STUB_TAGLINE) || String(iframeText).includes(STUB_TAGLINE);
await shot('p5-4-landing-ai');

// 5. 清掉测试配置
out.steps.cleared = await ev(`window.api.aiConfigClear().then((r) => r.ok === true)`);
await ev(`window.api.aiConfigGet().then((r) => r.config.configured === false)`);
out.consoleErrors = consoleErrors;
console.log(JSON.stringify(out, null, 2));
ws.close();
server.close();
process.exit(0);
