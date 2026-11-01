'use strict';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 8000;

// 只允许公网域名，拒绝内网/本机/云元数据地址，避免把内网服务当品牌抓取。
function isPrivateHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '::1' || h === '[::1]') return true;
  if (/^(127\.|0\.|10\.|192\.168\.|169\.254\.|169\.254\.|fc|fd|fe80)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
}

function normalizeUrl(input) {
  let u = (input || '').trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    if (isPrivateHost(parsed.hostname)) {
      return { error: '出于安全限制，不抓取本机与内网地址', code: 'PRIVATE' };
    }
    return { url: parsed.href, host: parsed.hostname, origin: parsed.origin };
  } catch {
    return { error: '网址格式无法识别，请输入完整网址（如 https://example.com）', code: 'BAD_URL' };
  }
}

async function fetchText(url, cap, allowHttpError = false) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,text/css,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok && !allowHttpError) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      text: buf.subarray(0, cap).toString('utf8'),
      finalUrl: res.url || url,
      contentType: res.headers.get('content-type') || '',
      ok: res.ok,
    };
  } catch {
    return null;
  }
}

async function fetchBinary(url, referer) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        ...(referer ? { Referer: referer } : {}),
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 5_000_000) return null;
    return { buf, contentType: res.headers.get('content-type') || '' };
  } catch {
    return null;
  }
}

module.exports = { normalizeUrl, fetchText, fetchBinary, isPrivateHost, UA };
