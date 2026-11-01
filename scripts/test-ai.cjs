'use strict';
// AI 配置、提示词、错误映射、brand.json 校验与 finalize 的离线测试（不联网）。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const settings = require('../electron/lib/settings.cjs');
const ai = require('../electron/lib/ai.cjs');
const { finalizeBrand, parseBrandText, applyBrandPatch } = require('../electron/lib/brand-finalize.cjs');
const { buildBrandKit } = require('../electron/lib/brand-kit.cjs');
const { buildSystem } = require('../electron/lib/export-bundle.cjs');

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log('PASS', msg);
  } else {
    fail++;
    console.log('FAIL', msg);
  }
}

// ── 1. 配置存储：Key 不明文、留空不改、非法地址拒绝 ──
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-cfg-'));
const saved = settings.save(dir, {
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com/v1/chat/completions',
  model: 'deepseek-chat',
  apiKey: 'sk-test-1234567890',
});
assert(saved.ok === true, '配置能保存');
assert(saved.config.baseUrl === 'https://api.deepseek.com/v1', 'Base URL 末尾的 /chat/completions 被削掉');
assert(saved.config.configured === true, '有地址+模型+Key 视为已配置');
assert(saved.config.keyMasked.startsWith('sk-') && !saved.config.keyMasked.includes('1234567890'), '界面只看到尾号');
const rawFile = fs.readFileSync(settings.configPath(dir), 'utf8');
assert(!rawFile.includes('sk-test-1234567890'), '磁盘文件里没有明文 Key');
assert(settings.resolve(dir).apiKey === 'sk-test-1234567890', '主进程能解出原始 Key');

settings.save(dir, { model: 'deepseek-reasoner' });
assert(settings.load(dir).hasKey === true, '只改模型时不会丢 Key');
assert(settings.load(dir).model === 'deepseek-reasoner', '模型名已更新');

assert(settings.save(dir, { baseUrl: 'api.deepseek.com' }).ok === false, '没有 http 前缀的地址被拒绝');
settings.save(dir, { apiKey: '' });
assert(settings.load(dir).hasKey === false, '传空 Key 表示清除');
assert(settings.clear(dir).config.configured === false, '清除配置后回到未配置');

assert(providers_custom_last(), '服务商列表里自定义排在最后');
function providers_custom_last() {
  const list = settings.PROVIDERS;
  return list[list.length - 1].id === 'custom' && list.length >= 7;
}

// ── 2. 请求与错误映射 ──
assert(ai.endpointOf('https://api.x.com/v1', 'chat/completions') === 'https://api.x.com/v1/chat/completions', '拼接 chat/completions 地址正确');
assert(ai.endpointOf('https://api.x.com/v1/', '/chat/completions') === 'https://api.x.com/v1/chat/completions', '多余斜杠不会拼坏');

const auth = ai.describeHttpError(401, '{"error":{"message":"invalid api key"}}');
assert(auth.code === 'AUTH' && auth.error.includes('Key'), '401 翻成「Key 不对」');
assert(ai.describeHttpError(404, '').code === 'NOT_FOUND', '404 翻成「地址或模型名不对」');
assert(ai.describeHttpError(429, '').code === 'RATE_LIMIT', '429 翻成「太频繁/额度用完」');
assert(ai.describeHttpError(503, '').code === 'SERVER', '5xx 翻成「对方服务端出错」');
assert(ai.describeHttpError(418, 'teapot').code === 'HTTP', '其它状态码有兜底');
assert(ai.describeHttpError(402, '').code === 'BILLING', '402 提示余额不足');
const timeout = ai.describeNetworkError({ name: 'AbortError', message: 'aborted' }, 60000);
assert(timeout.code === 'TIMEOUT' && timeout.error.includes('60'), '超时给出秒数');
assert(ai.describeNetworkError({ message: 'getaddrinfo ENOTFOUND' }, 1000).code === 'DNS', '域名解析失败能识别');
assert(ai.describeNetworkError({ message: 'connect ECONNREFUSED' }, 1000).error.includes('Ollama'), '连接被拒时提示本机服务');

// ── 3. 没有 Key 时不发请求，直接给可读原因 ──
(async () => {
  const noKey = await ai.chat({ baseUrl: 'https://api.x.com/v1', model: 'm', apiKey: '' }, []);
  assert(noKey.ok === false && noKey.code === 'NO_KEY', '没有 Key 时不联网直接提示');
  const noEnrich = await ai.enrichBrand({}, {});
  assert(noEnrich.ok === false && noEnrich.code === 'NO_BRAND', '没有品牌数据时不调用模型');

  // ── 4. 提示词与 JSON 容错 ──
  const site = {
    url: 'https://example.com/',
    finalUrl: 'https://www.example.com/',
    siteName: 'Example',
    title: 'Example — 让事情更简单',
    description: '一个示例站点',
    headings: ['让事情更简单', '为团队而生', '开箱即用'],
    paragraphs: ['我们帮团队把流程收敛到一处，减少来回确认。'],
    navLabels: ['产品', '定价'],
    colors: [
      { hex: '#ffffff', count: 12, extreme: true, sources: ['prop:background-color selector:body'] },
      { hex: '#111827', count: 9, extreme: true, sources: ['prop:color selector:body'] },
      { hex: '#2563eb', count: 7, sources: ['prop:background-color selector:.btn-primary'] },
      { hex: '#f9fafb', count: 6, sources: ['prop:background-color selector:.card'] },
      { hex: '#6b7280', count: 5, sources: ['prop:color selector:.muted'] },
      { hex: '#e5e7eb', count: 4, sources: ['prop:border-color selector:.card'] },
      { hex: '#f97316', count: 3, sources: ['prop:color selector:.promo'] },
    ],
    fonts: [{ family: 'Inter', count: 9 }],
    fontFaceFamilies: ['Inter'],
    logos: [],
    layoutHints: { radius: 12, borderWidth: 1 },
    primaryLadder: { seed: '#2563eb', steps: Array.from({ length: 10 }, (_, i) => `#00000${i}`) },
  };
  const auto = buildBrandKit(site);

  const messages = ai.buildMessages(site, auto.brand, { language: 'zh' });
  const userPrompt = messages[1].content;
  assert(messages.length === 2 && messages[0].role === 'system', '提示词是 system + user 两条');
  assert(userPrompt.includes('Example') && userPrompt.includes('accent'), '素材里带站点名与语义角色');
  assert(userPrompt.includes('让事情更简单'), '素材里带页面大标题');
  assert(messages[0].content.includes('简体中文'), '中文模式下要求用中文');
  assert(ai.buildMessages(site, auto.brand, { language: 'en' })[0].content.includes('Write everything in English'), '英文模式可切换');

  assert(ai.parseJsonLoose('```json\n{"tagline":"x"}\n```').tagline === 'x', '能剥掉 ```json 代码块');
  assert(ai.parseJsonLoose('好的，结果如下：{"tagline":"x"} 以上').tagline === 'x', '能从解释文字里抠出 JSON');
  assert(ai.parseJsonLoose('抱歉我做不到') === null, '没有 JSON 时返回 null');
  assert(ai.parseJsonLoose('[1,2]') === null, '顶层是数组时不当成对象');

  const noisy = {
    name: '超长名字'.repeat(30),
    tagline: '标语'.repeat(80),
    voice: {
      adjectives: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      tone: 'calm',
      messagingPillars: [],
      vocabulary: { use: ['词1'], avoid: ['空话', '套话'] },
    },
    imagery: { style: 'editorial photography', subjects: ['team'], treatment: 'natural light', avoid: [] },
    colorNames: [
      { role: 'accent', name: '雾蓝' },
      { role: 'brand-unknown', name: '瞎写的' },
    ],
    postureRules: ['标题不超过两行'],
  };
  const patch = ai.normalizePatch(noisy, auto.brand);
  assert(patch.patch.name.length <= 60, '超长品牌名被截断');
  assert(patch.patch.tagline.length <= 80, '超长标语被截断');
  assert(patch.patch.voice.adjectives.length === 5, '形容词最多留 5 个');
  assert(patch.patch.voice.messagingPillars === auto.brand.voice.messagingPillars, '模型没给信息点时沿用自动结果');
  assert(patch.patch.colorNames.accent === '雾蓝', '配色命名按 role 落位');
  assert(patch.patch.colorNames['brand-unknown'] === undefined, '不认识的 role 被忽略');
  assert(patch.patch.postureRules.length === 1, '排版规矩被保留');
  assert(patch.notes.length >= 2, '给出改了什么的说明');

  // ── 5. brand.json 校验与修补 ──
  const edited = JSON.parse(JSON.stringify(auto.brand));
  edited.name = '改过的名字';
  edited.colors = edited.colors.map((c) => (c.role === 'accent' ? { ...c, hex: '#F60' } : c));
  edited.colors = edited.colors.filter((c) => c.role !== 'border');
  edited.colors.push({ role: 'shadow', hex: '#000000' });
  edited.layout = { ...edited.layout, radius: 14 };
  const fixed = finalizeBrand(auto.brand, edited);
  const roleOf = (brand, role) => brand.colors.find((c) => c.role === role)?.hex;
  assert(fixed.brand.name === '改过的名字', '手改的品牌名生效');
  assert(roleOf(fixed.brand, 'accent') === '#ff6600', '三位简写色值被补全成六位');
  assert(roleOf(fixed.brand, 'border') === roleOf(auto.brand, 'border'), '删掉的角色用自动结果补回');
  assert(fixed.notes.some((n) => n.includes('border')), '补回角色会写进说明');
  assert(fixed.notes.some((n) => n.includes('shadow')), '不认识的角色会写进说明');
  assert(fixed.brand.layout.radius === '14px', '数字圆角补上 px');
  assert(fixed.changed.includes('colors') && fixed.changed.includes('name'), '记录了变了哪些字段');

  const badHex = finalizeBrand(auto.brand, {
    ...auto.brand,
    colors: auto.brand.colors.map((c) => (c.role === 'accent' ? { ...c, hex: 'blue' } : c)),
  });
  assert(roleOf(badHex.brand, 'accent') === roleOf(auto.brand, 'accent'), '非法色值退回自动结果');
  assert(badHex.notes.some((n) => n.includes('不是合法')), '非法色值有提示');

  const parsedBad = parseBrandText('{\n  "name": "x",\n  "colors": [\n}');
  assert(parsedBad.ok === false && /第 \d+ 行/.test(parsedBad.error), '语法错误能指到行号');
  assert(parseBrandText('[]').ok === false, '顶层数组被拒绝');
  assert(parseBrandText('  ').ok === false, '空内容被拒绝');

  // ── 6. AI 补丁合并 ──
  const merged = applyBrandPatch(auto.brand, {
    tagline: 'AI 写的标语',
    voice: { tone: 'warm and direct' },
    colorNames: { accent: '品牌蓝' },
    postureRules: ['留白优先'],
  });
  assert(merged.tagline === 'AI 写的标语', '标语被覆盖');
  assert(merged.voice.tone === 'warm and direct' && merged.voice.messagingPillars.length === 3, '语气合并后仍保留原有信息点');
  assert(merged.colors.find((c) => c.role === 'accent').name === '品牌蓝', '颜色名被替换');
  assert(JSON.stringify(merged.imagery.samples) === JSON.stringify(auto.brand.imagery.samples), '素材清单不被 AI 改坏');
  assert(auto.brand.tagline !== 'AI 写的标语', '原对象未被就地修改');

  // ── 7. finalize 后整套产物真的变了 ──
  const override = JSON.parse(JSON.stringify(auto.brand));
  override.colors = override.colors.map((c) => (c.role === 'accent' ? { ...c, hex: '#e0245e', name: '玫红' } : c));
  const system = buildSystem(site, override);
  const tokens = JSON.parse(system.files['tokens.default.json']);
  assert(system.notes.length === 0, '合法改动不会产生修补说明');
  assert(String(tokens.colorPrimary).toLowerCase() === '#e0245e', '主色改了以后 tokens 跟着变');
  assert(system.brand.colors.find((c) => c.role === 'accent').name === '玫红', '配色名字进了 brand');
  assert(Object.keys(system.files).length === 18, '重生成后仍是 18 个体系文件');

  const autoSystem = buildSystem(site);
  assert(JSON.parse(autoSystem.files['tokens.default.json']).colorPrimary !== '#e0245e', '不传 override 时用自动识别结果');

  // ── 8. 分渠道文案 ──
  assert(ai.COPY_CHANNELS.length === 3 && ai.COPY_CHANNELS.map((c) => c.id).join(',') === 'landing,wechat,app', '渠道清单是官网/公众号/App 三家');
  const copyMessages = ai.buildCopyMessages(site, auto.brand, { language: 'zh' });
  assert(copyMessages.length === 2 && copyMessages[0].role === 'system', '文案提示词也是 system + user 两条');
  const copyPrompt = copyMessages[1].content;
  assert(copyPrompt.includes('landing') && copyPrompt.includes('wechat') && copyPrompt.includes('app'), '提示词里点名了三个渠道');
  assert(copyPrompt.includes('Example'), '文案提示词里带了站点素材');
  assert(copyMessages[0].content.includes('不能互相照抄'), '系统提示要求三套语气有区分');

  const copyNoKey = await ai.generateCopy({ baseUrl: 'https://api.x.com/v1', model: 'm', apiKey: '' }, { brand: auto.brand });
  assert(copyNoKey.ok === false && copyNoKey.code === 'NO_KEY', '没有 Key 时不联网直接提示');
  const copyNoBrand = await ai.generateCopy({}, {});
  assert(copyNoBrand.ok === false && copyNoBrand.code === 'NO_BRAND', '没有品牌数据时不调用模型');

  const noisyCopy = ai.normalizeCopy(
    {
      landing: {
        heroTitle: '标'.repeat(40),
        heroSubtitle: '副'.repeat(60),
        sections: [
          { title: '卖点一', body: '说明一' },
          null,
          { title: '', body: '没标题的丢弃' },
          { title: '卖点三', body: '说明三' },
          { title: '卖点四', body: '超出的丢弃' },
        ],
        cta: '立即开始'.repeat(10),
        ctaNote: '免费试用',
      },
      wechat: {
        titles: ['标题一', '标题二', '标题三', '标题四'],
        excerpt: '摘'.repeat(100),
        opening: '开'.repeat(400),
        closing: '结',
      },
      app: {
        oneLiner: '一'.repeat(50),
        storeTitle: '商店标题',
        storeSubtitle: '副标题',
        storeDescription: '描'.repeat(500),
        whatsNew: '更新',
      },
      junk: { heroTitle: '野字段' },
    },
    auto.brand,
  );
  assert(noisyCopy.copy.landing.heroTitle.length <= 24, '超长大标题被截断');
  assert(noisyCopy.copy.landing.sections.length === 3, '坏卖点被丢弃、有效卖点最多留 3 条');
  assert(noisyCopy.copy.landing.cta.length <= 10, '按钮文字被夹紧');
  assert(noisyCopy.copy.wechat.titles.length === 3, '备选标题最多 3 个');
  assert(noisyCopy.copy.wechat.opening.length <= 200, '正文开头被截断');
  assert(noisyCopy.copy.app.storeDescription.length <= 300, '商店描述被截断');
  assert(noisyCopy.copy.junk === undefined, '野渠道整体丢弃');
  assert(noisyCopy.notes.length === 3, '三个渠道都给出说明');

  const emptyCopy = ai.normalizeCopy({ landing: null, wechat: {}, app: {} }, auto.brand);
  assert(Object.keys(emptyCopy.copy).length === 0, '全空输出不给可用文案');
  assert(ai.normalizeCopy(null, auto.brand).notes.length === 1, '没有 JSON 时给出说明');

  console.log(`\n结果：${pass} 通过，${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();
