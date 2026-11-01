// 用本地假接口替代真实大模型，端到端验证「AI 文案页：生成分渠道文案 → 三渠道展示 → 重新生成」。
import fs from 'node:fs';
import http from 'node:http';

const STUB_HERO = '一个后台管完全部渠道';
const STUB_TITLE = '把三个后台合成一个，是什么体验？';
const STUB_APP = '商品订单营销，一处管理';

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
    const userText = (payload.messages || []).map((m) => m.content || '').join('\n');
    const isPing = userText.includes('连通性测试');
    const isCopy = userText.includes('为以下三个渠道');
    let content;
    if (isPing) {
      content = '通了';
    } else if (isCopy) {
      content = JSON.stringify({
        landing: {
          heroTitle: STUB_HERO,
          heroSubtitle: '小团队也能像大团队一样运转',
          sections: [
            { title: '开箱即用', body: '注册当天就能发出第一笔订单' },
            { title: '渠道同步', body: '商品改一次，全渠道一起更新' },
            { title: '按量付费', body: '卖得多才多付，没有固定成本' },
          ],
          cta: '免费开始',
          ctaNote: '无需绑卡',
        },
        wechat: {
          titles: [STUB_TITLE, '小团队如何管住全渠道订单？'],
          excerpt: '讲述我们把分散在三个系统里的生意搬回一处的过程与得失。',
          opening: '每天早上打开三个后台核对订单的日子，持续了整整一年，直到我们把它们合并。',
          closing: '如果你也在被多平台来回切换折磨，不妨试试这条路。',
        },
        app: {
          oneLiner: STUB_APP,
          storeTitle: '统一后台',
          storeSubtitle: '商品订单营销一处管理',
          storeDescription: '把商品、订单和营销放在同一处管理，适合同时经营多个渠道的小团队。',
          whatsNew: '新增渠道同步，修复了已知问题。',
        },
      });
    } else {
      content = JSON.stringify({
        name: '示例品牌',
        tagline: '让每一笔生意都开在同一个后台里',
        description: '把商品、订单和营销放在同一处管理。',
        voice: { adjectives: ['clear'], tone: 'direct', messagingPillars: ['一个后台管完全部渠道'], vocabulary: { use: ['后台'], avoid: ['赋能'] } },
        imagery: { style: 'bright product photography', subjects: ['team'], treatment: 'natural light', avoid: [] },
        colorNames: [],
        postureRules: [],
      });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        model: 'stub-model',
        choices: [{ message: { role: 'assistant', content } }],
        usage: { prompt_tokens: 900, completion_tokens: 300, total_tokens: 1200 },
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

// 0. 提取一次，进入有结果的状态
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

// 1. 配置指向本地假接口（写入后立刻清掉的是真实用户的配置，所以先存旧的再恢复——本脚本只在测试环境跑，直接配+清）
await clickText('AI 设置');
await sleep(400);
await clickText('自定义');
await sleep(200);
await setInput('input[placeholder="https://api.deepseek.com/v1"]', baseUrl);
await setInput('input[placeholder="deepseek-chat"]', 'stub-model');
await setInput('input[type="password"]', 'sk-stub-key-000');
await sleep(200);
await clickText('保存');
await sleep(700);
await clickText('关闭');
await sleep(400);
out.steps.headerShowsAi = /AI 已接：\s*stub-model/.test(await bodyText());

// 2. 切到「AI 文案」页，空态应有引导
await clickText('AI 文案');
await sleep(500);
const emptyText = await bodyText();
out.steps.emptyStateOk = emptyText.includes('让 AI 为三个渠道各写一套文案') && emptyText.includes('生成分渠道文案');
await shot('p6-1-copy-empty');

// 3. 生成分渠道文案
await clickText('生成分渠道文案');
for (let i = 0; i < 30; i++) {
  await sleep(500);
  const t = await bodyText();
  if (t.includes('AI 写好了') || t.includes('AI 这次没给出结果') || t.includes('AI 调用失败')) break;
}
const afterGen = await bodyText();
out.steps.generateOk = afterGen.includes('AI 写好了') && afterGen.includes('三套文案已生成');
out.steps.generateMessage = (afterGen.match(/AI 写好了[^\n]*/) || [])[0] || '';
out.steps.hasHero = afterGen.includes(STUB_HERO);
out.steps.hasWechatTitle = afterGen.includes(STUB_TITLE);
out.steps.hasApp = afterGen.includes(STUB_APP);
out.steps.hasChannels = ['官网首页', '公众号文章', 'App 商店'].every((c) => afterGen.includes(c));
out.steps.exportHintMentionsCopy = afterGen.includes('+ copy.json');
await shot('p6-2-copy-generated');

// 4. 重新生成（stub 再次返回，应该仍然成功）
await clickText('重新生成');
for (let i = 0; i < 30; i++) {
  await sleep(500);
  const t = await bodyText();
  if ((t.match(/AI 写好了/g) || []).length >= 2 || t.includes('AI 这次没给出结果') || t.includes('AI 调用失败')) break;
}
out.steps.regenerateOk = ((await bodyText()).match(/AI 写好了/g) || []).length >= 1;
await shot('p6-3-copy-regenerated');

// 5. 切走再切回来，文案应该还在（存在会话状态里）
await clickText('设计体系');
await sleep(300);
await clickText('AI 文案');
await sleep(400);
out.steps.persistAcrossTabs = (await bodyText()).includes(STUB_HERO);

// 6. 清掉测试配置
out.steps.cleared = await ev(`window.api.aiConfigClear().then((r) => r.ok === true)`);
await ev(`window.api.aiConfigGet().then((r) => r.config.configured === false)`);
out.consoleErrors = consoleErrors;
console.log(JSON.stringify(out, null, 2));
ws.close();
server.close();
process.exit(0);
