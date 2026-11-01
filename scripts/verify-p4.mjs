// 驱动界面实测：AI 设置（错误态）→ 保存 → brand.json 手改 → finalize 重生成。
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

const url = process.argv[2] || 'https://www.baidu.com';
const out = { steps: {} };

// 1. 提取
await ev(`(() => {
  const input = document.querySelector('input[placeholder]');
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(url)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(200);
await clickText('开始提取');
for (let i = 0; i < 60; i++) {
  await sleep(1000);
  const t = await bodyText();
  if (t.includes('导出整套设计体系')) break;
}
out.steps.extracted = (await bodyText()).includes('导出整套设计体系');

// 2. 打开 AI 设置
out.steps.openedSettings = await clickText('AI 设置');
await sleep(500);
const settingsText = await bodyText();
out.steps.providerCount = await ev(`[...document.querySelectorAll('button')].filter((b) => ['DeepSeek','通义千问','OpenAI','本机 Ollama'].includes(b.textContent.trim())).length`);
out.steps.hasSecurityNote = settingsText.includes('Key 怎么存的');
out.steps.hasBaseUrlField = await ev(`!!document.querySelector('input[placeholder="https://api.deepseek.com/v1"]')`);
await shot('p4-1-ai-settings');

// 3. 填一个不通的地址，测错误提示是不是人话
await setInput('input[placeholder="https://api.deepseek.com/v1"]', 'http://127.0.0.1:9/v1');
await setInput('input[placeholder="deepseek-chat"]', 'test-model');
await setInput('input[placeholder="sk-..."]', 'sk-fake-key-123456');
await sleep(200);
await clickText('测试连接');
for (let i = 0; i < 25; i++) {
  await sleep(500);
  const t = await bodyText();
  if (t.includes('连不上') || t.includes('拒绝') || t.includes('失败')) break;
}
const afterTest = await bodyText();
out.steps.testErrorShown = /连不上|拒绝|失败/.test(afterTest);
out.steps.testErrorText = (afterTest.match(/(连不上这个接口[^\n]*|对方拒绝了连接[^\n]*)/) || [])[1] || '';
await shot('p4-2-ai-error');

// 4. 保存配置，看顶栏是否变成已接
await clickText('保存');
await sleep(800);
out.steps.savedOk = (await bodyText()).includes('已保存');
await shot('p4-3-ai-saved');
await clickText('关闭');
await sleep(400);
const headerText = await bodyText();
out.steps.headerShowsAi = /AI 已接：\s*test-model/.test(headerText);

// 5. 切到设计文件 → 源码 → 改 brand.json 的 accent
await clickText('设计文件');
await sleep(1200);
await clickText('源码');
await sleep(800);
out.steps.brandEditorVisible = await ev(`!!document.querySelector('textarea')`);
const brandText = await ev(`document.querySelector('textarea') ? document.querySelector('textarea').value : ''`);
out.steps.brandJsonLen = brandText.length;

let edited = brandText;
try {
  const parsed = JSON.parse(brandText);
  parsed.colors = parsed.colors.map((c) => (c.role === 'accent' ? { ...c, hex: '#E0245E', name: '玫红' } : c));
  parsed.tagline = '手改过的标语，用来验证重生成';
  edited = JSON.stringify(parsed, null, 2);
} catch {
  out.steps.brandParseFail = true;
}
await setInput('textarea', edited);
await sleep(300);
out.steps.applyEnabled = await ev(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /应用并重新生成/.test(b.textContent));
  return !!btn && !btn.disabled;
})()`);
await clickText('应用并重新生成');
for (let i = 0; i < 20; i++) {
  await sleep(400);
  if ((await bodyText()).includes('已按这份 brand.json 重新生成')) break;
}
const afterApply = await bodyText();
out.steps.finalizeMessage = (afterApply.match(/已按这份 brand\.json 重新生成[^\n]*/) || [])[0] || '';
out.steps.badgeShown = afterApply.includes('已按修改后的 brand.json 生成');
const newDraft = await ev(`document.querySelector('textarea') ? document.querySelector('textarea').value : ''`);
out.steps.newAccent = (newDraft.match(/"role": "accent",\s*\n\s*"hex": "(#[0-9a-f]{6})"/) || [])[1] || '';
out.steps.newTagline = newDraft.includes('手改过的标语');
await shot('p4-4-finalize');

// 6. 预览是否跟着变（kit 里应出现新主色）
await clickText('成品预览');
await sleep(1500);
const frame = await ev(`(() => {
  const f = document.querySelector('iframe');
  return f ? f.getAttribute('srcdoc').slice(0, 400000) : '';
})()`);
out.steps.kitHasNewAccent = /#e0245e/i.test(String(frame));

// 7. AI 补全文案走错误路径，确认是提示不是崩
await clickText('AI 补全文案');
for (let i = 0; i < 40; i++) {
  await sleep(500);
  const t = await bodyText();
  if (t.includes('连不上') || t.includes('AI 调用失败') || t.includes('没给出结果')) break;
}
const aiText = await bodyText();
out.steps.aiErrorShown = /连不上|AI 调用失败|没给出结果|拒绝了连接/.test(aiText);
out.steps.aiErrorText = (aiText.match(/(连不上这个接口[^\n]*|对方拒绝了连接[^\n]*|AI 调用失败[^\n]*)/) || [])[1] || '';
await shot('p4-5-ai-enrich-error');

// 8. 清掉测试用的假配置，别留在用户机器上
out.steps.cleared = await ev(`window.api.aiConfigClear().then((r) => r.ok === true)`);

out.consoleErrors = consoleErrors;
console.log(JSON.stringify(out, null, 2));
ws.close();
process.exit(0);
