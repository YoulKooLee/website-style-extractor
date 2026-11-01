'use strict';

/**
 * AI 接口配置的本机存储。
 *
 * - 只存一个文件：userData/ai-config.json
 * - API Key 优先用系统凭据加密（Windows 上是 DPAPI，macOS 是钥匙串，Linux 是 libsecret），
 *   加密不可用时降级为 base64（只是不让人一眼看到，不是真正的加密，会在界面上如实标注）。
 * - 渲染层永远拿不到明文 Key，只能拿到「是否已配置」和尾号。
 */

const fs = require('node:fs');
const path = require('node:path');

const FILE_NAME = 'ai-config.json';
const ENC_PREFIX = 'enc:v1:';
const RAW_PREFIX = 'raw:v1:';

/** 常见服务商预设，选完自动填地址和模型，也可以自己改。 */
const PROVIDERS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    note: '国内直连，便宜，写中文文案效果好',
  },
  {
    id: 'qwen',
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    note: '阿里云百炼，兼容 OpenAI 格式',
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    note: '月之暗面，长文本稳定',
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    note: '有免费额度，适合先试',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    note: '需要能访问外网',
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-7B-Instruct',
    note: '聚合多种开源模型',
  },
  {
    id: 'ollama',
    name: '本机 Ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'qwen2.5:7b',
    note: '完全离线，不花钱，需要有显卡或等久一点',
  },
  {
    id: 'custom',
    name: '自定义',
    baseUrl: '',
    model: '',
    note: '任何兼容 OpenAI /chat/completions 的接口',
  },
];

function configPath(baseDir) {
  return path.join(baseDir, FILE_NAME);
}

/** 只有 Electron 主进程里才拿得到 safeStorage；纯 node 测试时返回 null。 */
function encryptionModule() {
  try {
    const electron = require('electron');
    const safeStorage = electron && electron.safeStorage;
    if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
      return safeStorage;
    }
  } catch {
    /* 不在 Electron 里，或者系统没提供凭据服务 */
  }
  return null;
}

function encodeSecret(plain) {
  const text = String(plain || '');
  if (!text) return { stored: '', encryption: 'none' };
  const safeStorage = encryptionModule();
  if (safeStorage) {
    try {
      return {
        stored: ENC_PREFIX + safeStorage.encryptString(text).toString('base64'),
        encryption: 'system',
      };
    } catch {
      /* 加密失败就退回 base64 */
    }
  }
  return { stored: RAW_PREFIX + Buffer.from(text, 'utf8').toString('base64'), encryption: 'base64' };
}

function decodeSecret(stored) {
  const text = String(stored || '');
  if (!text) return '';
  if (text.startsWith(ENC_PREFIX)) {
    const safeStorage = encryptionModule();
    if (!safeStorage) return '';
    try {
      return safeStorage.decryptString(Buffer.from(text.slice(ENC_PREFIX.length), 'base64'));
    } catch {
      // 换了电脑或系统账户变了，旧密文解不开——当成没配置，让用户重填。
      return '';
    }
  }
  if (text.startsWith(RAW_PREFIX)) {
    try {
      return Buffer.from(text.slice(RAW_PREFIX.length), 'base64').toString('utf8');
    } catch {
      return '';
    }
  }
  return '';
}

function readFile(baseDir) {
  try {
    const raw = fs.readFileSync(configPath(baseDir), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeBaseUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  // 有人会把完整地址粘进来，这里削成根地址。
  return text
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/completions$/i, '');
}

function isValidBaseUrl(value) {
  if (!/^https?:\/\/[^\s]+$/i.test(String(value || ''))) return false;
  try {
    const parsed = new URL(value);
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

/** 给界面看的配置（绝不含明文 Key）。 */
function load(baseDir) {
  const saved = readFile(baseDir);
  const secret = decodeSecret(saved.key);
  const provider = PROVIDERS.some((p) => p.id === saved.provider) ? saved.provider : 'custom';
  return {
    provider,
    baseUrl: saved.baseUrl || '',
    model: saved.model || '',
    temperature: typeof saved.temperature === 'number' ? saved.temperature : 0.4,
    configured: Boolean(secret && saved.baseUrl && saved.model),
    hasKey: Boolean(secret),
    keyMasked: secret ? maskKey(secret) : '',
    encryption: saved.encryption === 'system' ? 'system' : saved.key ? 'base64' : 'none',
    updatedAt: saved.updatedAt || '',
  };
}

function maskKey(secret) {
  const text = String(secret || '');
  if (!text) return '';
  if (text.length <= 8) return '••••';
  return `${text.slice(0, 3)}••••${text.slice(-4)}`;
}

/**
 * 保存配置。patch.apiKey 不传表示「不改 Key」，传空字符串表示「清掉 Key」。
 * 返回给界面看的配置 + 是否有实际写入。
 */
function save(baseDir, patch = {}) {
  const saved = readFile(baseDir);
  const next = { ...saved };

  if (patch.provider !== undefined) {
    next.provider = PROVIDERS.some((p) => p.id === patch.provider) ? patch.provider : 'custom';
  }
  if (patch.baseUrl !== undefined) {
    const baseUrl = normalizeBaseUrl(patch.baseUrl);
    if (baseUrl && !isValidBaseUrl(baseUrl)) {
      return { ok: false, error: '接口地址要写成 http:// 或 https:// 开头，比如 https://api.deepseek.com/v1' };
    }
    next.baseUrl = baseUrl;
  }
  if (patch.model !== undefined) next.model = String(patch.model || '').trim().slice(0, 120);
  if (typeof patch.temperature === 'number' && Number.isFinite(patch.temperature)) {
    next.temperature = Math.max(0, Math.min(1.5, patch.temperature));
  }
  if (patch.apiKey !== undefined) {
    const plain = String(patch.apiKey || '').trim();
    if (!plain) {
      next.key = '';
      next.encryption = 'none';
    } else {
      const encoded = encodeSecret(plain);
      next.key = encoded.stored;
      next.encryption = encoded.encryption;
    }
  }

  next.updatedAt = new Date().toISOString();
  try {
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(configPath(baseDir), JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
  } catch (e) {
    return { ok: false, error: `配置写不进去：${(e && e.message) || '磁盘可能只读'}` };
  }
  return { ok: true, config: load(baseDir) };
}

function clear(baseDir) {
  try {
    fs.rmSync(configPath(baseDir), { force: true });
  } catch {
    return { ok: false, error: '删除配置文件失败' };
  }
  return { ok: true, config: load(baseDir) };
}

/** 主进程内部用：拿到可调用的完整参数（含明文 Key），不给渲染层。 */
function resolve(baseDir) {
  const saved = readFile(baseDir);
  const apiKey = decodeSecret(saved.key);
  return {
    provider: saved.provider || 'custom',
    baseUrl: normalizeBaseUrl(saved.baseUrl),
    model: String(saved.model || '').trim(),
    temperature: typeof saved.temperature === 'number' ? saved.temperature : 0.4,
    apiKey,
    configured: Boolean(apiKey && saved.baseUrl && saved.model),
    encryption: saved.encryption || 'none',
  };
}

module.exports = {
  PROVIDERS,
  load,
  save,
  clear,
  resolve,
  normalizeBaseUrl,
  isValidBaseUrl,
  maskKey,
  configPath,
};
