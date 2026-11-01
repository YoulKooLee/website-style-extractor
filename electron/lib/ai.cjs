'use strict';

/**
 * 调用「兼容 OpenAI 格式」的大模型接口。不引入任何 SDK，直接用 fetch。
 *
 * 只做两件事：
 *   1. testConnection —— 让用户在设置里确认地址 / Key / 模型是通的；
 *   2. enrichBrand —— 把「实测到的素材」交给模型，产出品牌语气、文案与配色命名。
 *
 * 所有失败都翻成大白话，并把原始错误塞进 detail 便于排查。
 */

const DEFAULT_TIMEOUT_MS = 60_000;

function endpointOf(baseUrl, suffix) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  return `${base}/${suffix.replace(/^\/+/, '')}`;
}

function describeNetworkError(err, timeoutMs) {
  const message = String((err && err.message) || '');
  if (err && (err.name === 'AbortError' || /aborted/i.test(message))) {
    return {
      code: 'TIMEOUT',
      error: `等了 ${Math.round(timeoutMs / 1000)} 秒还没回应。可能是网络太慢、地址不通，或者这个模型排队很严重。`,
      detail: message,
    };
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return { code: 'DNS', error: '找不到这个接口地址对应的服务器，检查一下地址有没有写错。', detail: message };
  }
  if (/ECONNREFUSED/i.test(message)) {
    return {
      code: 'REFUSED',
      error: '对方拒绝了连接。如果填的是本机地址（127.0.0.1），确认 Ollama 之类的服务已经启动。',
      detail: message,
    };
  }
  if (/CERT|SSL|TLS/i.test(message)) {
    return { code: 'TLS', error: '安全连接建立失败，可能是网络中间有代理拦截，或者系统证书有问题。', detail: message };
  }
  return {
    code: 'NETWORK',
    error: '连不上这个接口。检查网络、代理设置，以及接口地址是否完整（通常要带 /v1）。',
    detail: message,
  };
}

function describeHttpError(status, bodyText) {
  let hint = '';
  const body = String(bodyText || '').slice(0, 400);
  try {
    const parsed = JSON.parse(bodyText);
    hint = (parsed && parsed.error && (parsed.error.message || parsed.error.code)) || parsed.message || '';
  } catch {
    hint = body;
  }
  if (status === 401 || status === 403) {
    return {
      code: 'AUTH',
      error: 'Key 不对，或者这个账号没有调用该模型的权限。重新复制一次 Key 试试。',
      detail: `HTTP ${status} ${hint}`,
    };
  }
  if (status === 404) {
    return {
      code: 'NOT_FOUND',
      error: '接口地址或模型名不对。多数服务商的地址要以 /v1 结尾，模型名要用它文档里写的那个。',
      detail: `HTTP 404 ${hint}`,
    };
  }
  if (status === 402) {
    return { code: 'BILLING', error: '账户余额不足，充值后再试。', detail: `HTTP 402 ${hint}` };
  }
  if (status === 429) {
    return {
      code: 'RATE_LIMIT',
      error: '调用太频繁，或者免费额度用完了。等一会儿再试，或者换个模型。',
      detail: `HTTP 429 ${hint}`,
    };
  }
  if (status >= 500) {
    return { code: 'SERVER', error: '对方服务端出错了，等几分钟再试。', detail: `HTTP ${status} ${hint}` };
  }
  return { code: 'HTTP', error: `调用失败（HTTP ${status}）。`, detail: hint || `HTTP ${status}` };
}

async function postJson(url, apiKey, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await resp.text();
    return { status: resp.status, ok: resp.ok, text };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 发一次对话请求。
 * 返回 { ok, text, usage } 或 { ok:false, code, error, detail }。
 */
async function chat(config, messages, opts = {}) {
  if (!config || !config.baseUrl) return { ok: false, code: 'NO_BASE_URL', error: '还没有填接口地址' };
  if (!config.apiKey) return { ok: false, code: 'NO_KEY', error: '还没有填 API Key' };
  if (!config.model) return { ok: false, code: 'NO_MODEL', error: '还没有填模型名' };

  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const body = {
    model: config.model,
    messages,
    temperature: typeof opts.temperature === 'number' ? opts.temperature : config.temperature ?? 0.4,
    stream: false,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;

  let response;
  try {
    response = await postJson(endpointOf(config.baseUrl, 'chat/completions'), config.apiKey, body, timeoutMs);
  } catch (e) {
    return { ok: false, ...describeNetworkError(e, timeoutMs) };
  }

  if (!response.ok) {
    // 有些服务商不接受 max_tokens，去掉再试一次，避免因为参数问题完全不可用。
    if (response.status === 400 && body.max_tokens) {
      const retryBody = { ...body };
      delete retryBody.max_tokens;
      try {
        const retry = await postJson(
          endpointOf(config.baseUrl, 'chat/completions'),
          config.apiKey,
          retryBody,
          timeoutMs,
        );
        if (retry.ok) response = retry;
        else return { ok: false, ...describeHttpError(retry.status, retry.text) };
      } catch (e) {
        return { ok: false, ...describeNetworkError(e, timeoutMs) };
      }
    } else {
      return { ok: false, ...describeHttpError(response.status, response.text) };
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(response.text);
  } catch {
    return {
      ok: false,
      code: 'BAD_RESPONSE',
      error: '接口返回的不是标准格式，确认这个地址是兼容 OpenAI 的 /chat/completions。',
      detail: String(response.text || '').slice(0, 200),
    };
  }

  const choice = parsed && Array.isArray(parsed.choices) ? parsed.choices[0] : null;
  const content = choice && choice.message ? choice.message.content : '';
  const text = Array.isArray(content)
    ? content.map((part) => (part && part.text) || '').join('')
    : String(content || '');

  if (!text.trim()) {
    return {
      ok: false,
      code: 'EMPTY',
      error: '模型没有返回内容，可能被内容策略拦了，换个模型或再试一次。',
      detail: JSON.stringify(parsed).slice(0, 200),
    };
  }
  return { ok: true, text, usage: parsed.usage || null, model: parsed.model || config.model };
}

/** 设置页的「测试连接」：先用一句最短的对话确认整条链路通。 */
async function testConnection(config) {
  const result = await chat(
    config,
    [
      { role: 'system', content: '你是一个连通性测试助手，只回答用户要求的内容。' },
      { role: 'user', content: '只回复两个字：通了' },
    ],
    { timeoutMs: 30_000, maxTokens: 16, temperature: 0 },
  );
  if (!result.ok) return result;
  return {
    ok: true,
    model: result.model,
    reply: result.text.trim().slice(0, 40),
    usage: result.usage || null,
  };
}

// ─────────────────────────── 品牌文案补全 ───────────────────────────

const ROLE_LABEL = {
  background: '页面底色',
  surface: '卡片/浮层底色',
  foreground: '正文文字色',
  muted: '次要文字色',
  border: '分隔线色',
  accent: '品牌主色',
  'accent-secondary': '次要品牌色',
};

function clip(value, max) {
  const text = String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function stringList(value, max, eachMax) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => clip(item, eachMax))
    .filter(Boolean)
    .slice(0, max);
}

/** 把提取结果压成一段给模型看的「素材」，控制长度，别把整页 HTML 塞进去。 */
function buildMaterial(result, brand) {
  const colors = (brand.colors || []).map((c) => {
    const roleHint = ROLE_LABEL[c.role] || c.role;
    return `- ${c.role}（${roleHint}）：${c.hex}${c.name ? ` 现名「${c.name}」` : ''}`;
  });
  const measured = (result.colors || [])
    .slice(0, 10)
    .map((c) => `${c.hex}×${c.count}${c.sources && c.sources.length ? `（${c.sources[0]}）` : ''}`);
  const fonts = (result.fonts || []).slice(0, 4).map((f) => `${f.family}×${f.count}`);
  const headings = (result.headings || []).slice(0, 8).map((h) => `- ${clip(h, 80)}`);
  const paragraphs = (result.paragraphs || []).slice(0, 3).map((p) => `- ${clip(p, 240)}`);
  const nav = (result.navLabels || []).slice(0, 10);

  return [
    `站点：${brand.name}`,
    `网址：${brand.sourceUrl || result.finalUrl || result.url}`,
    `页面标题：${clip(result.title, 120)}`,
    `页面简介：${clip(result.description, 300)}`,
    '',
    '语义色角色（已按 CSS 信号推断）：',
    colors.join('\n') || '- （无）',
    '',
    `实测高频色：${measured.join('、') || '（无）'}`,
    `字体：${fonts.join('、') || '（无）'}`,
    `圆角：${brand.layout && brand.layout.radius}；描边：${brand.layout && brand.layout.borderWeight}`,
    '',
    '页面大标题：',
    headings.join('\n') || '- （无）',
    '',
    '页面正文段落：',
    paragraphs.join('\n') || '- （无）',
    '',
    `导航词：${nav.join(' / ') || '（无）'}`,
  ].join('\n');
}

function buildMessages(result, brand, opts = {}) {
  const lang = opts.language || 'zh';
  const langRule =
    lang === 'zh'
      ? '全部用简体中文写（专有名词、产品名保留原文）。'
      : 'Write everything in English.';

  const system = [
    '你是一位资深品牌策略师兼设计系统顾问，擅长从网站的实际素材里提炼品牌语言。',
    '用户会给你一个网站实测到的配色、字体、标题、正文和导航词。你要据此写出这套品牌的「使用说明」。',
    '要求：',
    '1. 只依据给到的素材推断，不要编造该网站不存在的产品、客户、数据或荣誉；素材不足时用中性、克制的表达。',
    '2. 文案要具体、可落地，避免「赋能」「闭环」「引领未来」这类空话。',
    `3. ${langRule}`,
    '4. 严格只输出一个 JSON 对象，不要代码块标记，不要任何解释文字。',
  ].join('\n');

  const schema = `{
  "name": "品牌名（沿用素材里的站点名，除非明显是域名）",
  "tagline": "一句话标语，中文≤20字/英文≤60字符，直接可用作落地页大标题",
  "description": "品牌简介，中文60~110字/英文30~60词，说清它提供什么、给谁用",
  "voice": {
    "adjectives": ["3 个英文形容词，如 clear/confident/warm"],
    "tone": "一句话描述语气，英文，如 direct and product-led",
    "messagingPillars": ["3 条核心信息点，每条中文≤16字/英文≤10词"],
    "vocabulary": { "use": ["4~6 个页面里值得复用的词"], "avoid": ["2~3 个和这个品牌调性不合的词"] }
  },
  "imagery": {
    "style": "影像风格一句话，英文",
    "subjects": ["2~3 个画面主体，英文"],
    "treatment": "处理手法一句话，英文",
    "avoid": ["1~2 个该避免的画面，英文"]
  },
  "colorNames": [{ "role": "accent", "name": "2~3字的中文色名" }],
  "postureRules": ["2~3 条排版/版式上的落地规矩，中文≤24字"]
}`;

  const user = [
    '下面是抓到的品牌素材：',
    '"""',
    buildMaterial(result, brand),
    '"""',
    '',
    '请输出符合这个结构的 JSON：',
    schema,
    '',
    '补充：colorNames 只需要给 accent / accent-secondary / background / surface 这几个角色起中文色名（用了什么色相就用什么词，例如「雾蓝」「石墨」「暖沙」），没有把握的角色可以不写。',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/** 模型偶尔会套 ```json 或前后加解释，这里尽量把 JSON 抠出来。 */
function parseJsonLoose(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const direct = tryParse(unfenced);
  if (direct) return direct;

  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start >= 0 && end > start) return tryParse(unfenced.slice(start, end + 1));
  return null;
}

function tryParse(text) {
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value;
  } catch {
    return null;
  }
}

/**
 * 把模型输出收敛成可合并的补丁：
 * 长度、条数都夹紧，字体/颜色角色按已有角色过滤，避免模型乱加键把导出搞崩。
 */
function normalizePatch(payload, brand) {
  const patch = {};
  const notes = [];
  if (!payload) return { patch, notes: ['模型没有返回可解析的 JSON'] };

  if (typeof payload.name === 'string' && payload.name.trim()) {
    patch.name = clip(payload.name, 60);
  }
  if (typeof payload.tagline === 'string' && payload.tagline.trim()) {
    patch.tagline = clip(payload.tagline, 80);
  }
  if (typeof payload.description === 'string' && payload.description.trim()) {
    patch.description = clip(payload.description, 400);
  }

  const voice = payload.voice && typeof payload.voice === 'object' ? payload.voice : null;
  if (voice) {
    const adjectives = stringList(voice.adjectives, 5, 24);
    const pillars = stringList(voice.messagingPillars, 4, 60);
    const tone = clip(voice.tone, 80);
    const vocab = voice.vocabulary && typeof voice.vocabulary === 'object' ? voice.vocabulary : {};
    if (adjectives.length || pillars.length || tone) {
      patch.voice = {
        adjectives: adjectives.length ? adjectives : brand.voice.adjectives,
        tone: tone || brand.voice.tone,
        messagingPillars: pillars.length ? pillars : brand.voice.messagingPillars,
        vocabulary: {
          use: stringList(vocab.use, 8, 24).length
            ? stringList(vocab.use, 8, 24)
            : brand.voice.vocabulary.use,
          avoid: stringList(vocab.avoid, 6, 24),
        },
      };
      notes.push('语气与文案支柱已重写');
    }
  }

  const imagery = payload.imagery && typeof payload.imagery === 'object' ? payload.imagery : null;
  if (imagery) {
    const subjects = stringList(imagery.subjects, 4, 40);
    const avoid = stringList(imagery.avoid, 3, 40);
    const style = clip(imagery.style, 120);
    const treatment = clip(imagery.treatment, 120);
    if (style || subjects.length || treatment) {
      patch.imagery = {
        style: style || brand.imagery.style,
        subjects: subjects.length ? subjects : brand.imagery.subjects,
        treatment: treatment || brand.imagery.treatment,
        avoid: avoid.length ? avoid : brand.imagery.avoid,
      };
      notes.push('影像风格已补全');
    }
  }

  if (Array.isArray(payload.colorNames)) {
    const known = new Set((brand.colors || []).map((c) => c.role));
    const colorNames = {};
    for (const item of payload.colorNames) {
      if (!item || typeof item !== 'object') continue;
      const role = String(item.role || '');
      if (!known.has(role)) continue;
      const name = clip(item.name, 12);
      if (name) colorNames[role] = name;
    }
    if (Object.keys(colorNames).length) {
      patch.colorNames = colorNames;
      notes.push(`给 ${Object.keys(colorNames).length} 个颜色起了名字`);
    }
  }

  const posture = stringList(payload.postureRules, 4, 40);
  if (posture.length) {
    patch.postureRules = posture;
    notes.push('补了排版规矩');
  }

  return { patch, notes };
}

/**
 * 让模型补全品牌语言。
 * 返回 { ok, patch, notes, raw, usage } —— patch 由调用方合并进 brand，再走 finalize 重生成。
 */
async function enrichBrand(config, { result, brand, language } = {}) {
  if (!brand) return { ok: false, code: 'NO_BRAND', error: '还没有可用的品牌数据' };
  const messages = buildMessages(result || {}, brand, { language });
  const response = await chat(config, messages, { timeoutMs: 90_000, maxTokens: 1400, temperature: 0.5 });
  if (!response.ok) return response;

  const payload = parseJsonLoose(response.text);
  if (!payload) {
    return {
      ok: false,
      code: 'BAD_JSON',
      error: '模型返回的内容不是合法 JSON，再点一次通常就好了；也可以用更擅长遵循格式的模型。',
      detail: String(response.text || '').slice(0, 300),
    };
  }
  const { patch, notes } = normalizePatch(payload, brand);
  if (!Object.keys(patch).length) {
    return { ok: false, code: 'EMPTY_PATCH', error: '模型没有给出可用的内容，换个模型或再试一次。' };
  }
  return { ok: true, patch, notes, raw: response.text, usage: response.usage || null };
}

// ─────────────────────────── 分渠道文案 ───────────────────────────

/** 三个渠道各自的语气要求，提示词与界面共用这一份。 */
const COPY_CHANNELS = [
  {
    id: 'landing',
    label: '官网首页',
    brief: '面向第一次来的访客：把「这是做什么的、好在哪」说清楚，动作导向，落到一个明确的 CTA 上。',
  },
  {
    id: 'wechat',
    label: '公众号文章',
    brief: '面向已经关注的人：用讲道理/讲故事的方式展开，标题要有信息量但不标题党，结尾自然引导行动。',
  },
  {
    id: 'app',
    label: 'App 商店',
    brief: '面向应用商店的浏览者：一句话说清价值，商店描述按「核心功能 → 适合谁 → 亮点列表」组织。',
  },
];

function buildCopyMessages(result, brand, opts = {}) {
  const lang = opts.language || 'zh';
  const langRule =
    lang === 'zh'
      ? '全部用简体中文写（专有名词、产品名保留原文）。'
      : 'Write everything in English.';

  const voice = brand.voice || {};
  const pillars = (voice.messagingPillars || []).map((p, i) => `${i + 1}. ${p}`).join('\n');
  const useWords = (voice.vocabulary && voice.vocabulary.use) || [];
  const avoidWords = (voice.vocabulary && voice.vocabulary.avoid) || [];

  const system = [
    '你是一位资深品牌文案策划，擅长把同一个品牌讲给不同渠道、不同心态的读者听。',
    '用户会给你一个品牌的素材（配色、字体、标语、语气、信息点）和它官网上的原文。你要为三个渠道各写一套可直接使用的文案。',
    '要求：',
    '1. 三个渠道的内容不能互相照抄，语气和展开方式要有明显区分。',
    '2. 只依据给到的素材，不编造该品牌不存在的功能、数据、客户或荣誉；素材不足就用克制的通用表达。',
    `3. ${langRule}`,
    '4. 文案要具体、可落地，避免「赋能」「闭环」「引领未来」这类空话。',
    '5. 严格只输出一个 JSON 对象，不要代码块标记，不要任何解释文字。',
  ].join('\n');

  const schema = `{
  "landing": {
    "heroTitle": "首页大标题，≤16字，说清核心价值",
    "heroSubtitle": "副标题，≤34字，补充「给谁用、怎么用」",
    "sections": [{ "title": "卖点小标题，≤12字", "body": "卖点说明，≤56字" }],
    "cta": "按钮文字，2~6字，动词开头",
    "ctaNote": "按钮旁的辅助句，≤18字，如「免费试用，无需绑卡」"
  },
  "wechat": {
    "titles": ["2~3 个备选文章标题，每个≤24字"],
    "excerpt": "公众号摘要，40~64字，读者在会话列表里看到的那句",
    "opening": "正文开头，80~140字，从一个具体场景或问题切入",
    "closing": "结尾引导，≤40字，自然引导读者行动"
  },
  "app": {
    "oneLiner": "一句话介绍，≤20字",
    "storeTitle": "商店标题，≤20字",
    "storeSubtitle": "商店副标题，≤30字",
    "storeDescription": "商店描述，120~200字，核心功能→适合谁→亮点",
    "whatsNew": "版本更新公告，40~80字"
  }
}`;

  const user = [
    '下面是品牌的素材：',
    '"""',
    buildMaterial(result, brand),
    '"""',
    '',
    '品牌的语气与信息点（写文案时贴着这些走）：',
    `- 语气：${voice.tone || '（未确定，按素材自行判断）'}`,
    `- 核心信息点：\n${pillars || '- （未确定，从页面大标题里提炼）'}`,
    `- 建议复用的词：${useWords.join('、') || '（无）'}`,
    `- 不要用的词：${avoidWords.join('、') || '（无）'}`,
    '',
    '为以下三个渠道各写一套文案：',
    COPY_CHANNELS.map((c) => `- ${c.id}（${c.label}）：${c.brief}`).join('\n'),
    '',
    '请输出符合这个结构的 JSON（sections 固定给 3 条）：',
    schema,
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/** 模型输出的文案逐字段夹紧长度，坏结构整块丢弃，绝不让烂 JSON 混进 copy.json。 */
function normalizeCopy(payload, brand) {
  const notes = [];
  const copy = {};

  if (!payload || typeof payload !== 'object') {
    return { copy, notes: ['模型没有返回可解析的 JSON'] };
  }

  const landing = payload.landing && typeof payload.landing === 'object' ? payload.landing : null;
  if (landing) {
    const sections = (Array.isArray(landing.sections) ? landing.sections : [])
      .filter((s) => s && typeof s === 'object')
      .map((s) => ({ title: clip(s.title, 16), body: clip(s.body, 70) }))
      .filter((s) => s.title && s.body)
      .slice(0, 3);
    const heroTitle = clip(landing.heroTitle, 24);
    const cta = clip(landing.cta, 10);
    if (heroTitle || sections.length) {
      copy.landing = {
        heroTitle,
        heroSubtitle: clip(landing.heroSubtitle, 48),
        sections,
        cta,
        ctaNote: clip(landing.ctaNote, 24),
      };
      notes.push('官网首页文案已生成');
    }
  }

  const wechat = payload.wechat && typeof payload.wechat === 'object' ? payload.wechat : null;
  if (wechat) {
    const titles = stringList(wechat.titles, 3, 30);
    const excerpt = clip(wechat.excerpt, 80);
    const opening = clip(wechat.opening, 200);
    if (titles.length || excerpt || opening) {
      copy.wechat = {
        titles,
        excerpt,
        opening,
        closing: clip(wechat.closing, 60),
      };
      notes.push('公众号文案已生成');
    }
  }

  const app = payload.app && typeof payload.app === 'object' ? payload.app : null;
  if (app) {
    const oneLiner = clip(app.oneLiner, 28);
    const storeDescription = clip(app.storeDescription, 300);
    if (oneLiner || storeDescription) {
      copy.app = {
        oneLiner,
        storeTitle: clip(app.storeTitle, 28),
        storeSubtitle: clip(app.storeSubtitle, 40),
        storeDescription,
        whatsNew: clip(app.whatsNew, 120),
      };
      notes.push('App 商店文案已生成');
    }
  }

  return { copy, notes };
}

/**
 * 让模型为三个渠道各写一套文案。
 * 返回 { ok, copy, notes, raw, usage } —— copy 是收敛后的对象，直接进 copy.json。
 */
async function generateCopy(config, { result, brand, language } = {}) {
  if (!brand) return { ok: false, code: 'NO_BRAND', error: '还没有可用的品牌数据' };
  const messages = buildCopyMessages(result || {}, brand, { language });
  const response = await chat(config, messages, { timeoutMs: 90_000, maxTokens: 1600, temperature: 0.6 });
  if (!response.ok) return response;

  const payload = parseJsonLoose(response.text);
  if (!payload) {
    return {
      ok: false,
      code: 'BAD_JSON',
      error: '模型返回的内容不是合法 JSON，再点一次通常就好了；也可以用更擅长遵循格式的模型。',
      detail: String(response.text || '').slice(0, 300),
    };
  }
  const { copy, notes } = normalizeCopy(payload, brand);
  if (!Object.keys(copy).length) {
    return { ok: false, code: 'EMPTY_PATCH', error: '模型没有给出可用的文案，换个模型或再试一次。' };
  }
  return { ok: true, copy, notes, raw: response.text, usage: response.usage || null };
}

module.exports = {
  chat,
  testConnection,
  enrichBrand,
  generateCopy,
  buildMessages,
  buildCopyMessages,
  buildMaterial,
  parseJsonLoose,
  normalizePatch,
  normalizeCopy,
  COPY_CHANNELS,
  describeHttpError,
  describeNetworkError,
  endpointOf,
};
