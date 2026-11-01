'use strict';

/**
 * 抓站点上的「素材图」：原版的 imagery/ 就是这个用途——让生成的
 * landing / poster / email 模板里有真图可放，而不是清一色色块。
 *
 * 取舍：只取页面自己声明的图（og:image、srcset、<img>），单张 ≤ 600KB、
 * 合计 ≤ 2.4MB、最多 8 张；文件名里带 logo/icon 的一律跳过。
 */

const { fetchBinary } = require('./fetch-http.cjs');

const MAX_IMAGES = 8;
const MAX_ONE_BYTES = 600_000;
const MAX_TOTAL_BYTES = 2_400_000;

const SKIP_URL_RE = /logo|icon|sprite|avatar|favicon|badge|placeholder|spinner|loader|pixel|tracking/i;
const OK_TYPE_RE = /^image\/(jpeg|jpg|png|webp|avif|gif)/i;

function absolutize(raw, baseUrl) {
  if (!raw) return null;
  // HTML 里的图片地址常带 &amp; 实体，直接当 URL 用会 404。
  const value = raw.trim().replace(/^["']|["']$/g, '').replace(/&amp;/gi, '&');
  if (!value || value.startsWith('data:') || value.startsWith('blob:')) return null;
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

/** 从 srcset 里挑声称最大的那张（last 一般最宽，但也按 w 描述符排一下）。 */
function pickFromSrcset(srcset) {
  if (!srcset) return null;
  const parts = srcset
    .split(',')
    .map((entry) => {
      const [url, descriptor] = entry.trim().split(/\s+/);
      const width = /(\d+)w/.exec(descriptor || '')?.[1];
      const density = /([\d.]+)x/.exec(descriptor || '')?.[1];
      const score = width ? Number(width) : density ? Number(density) * 1000 : 0;
      return { url, score };
    })
    .filter((entry) => entry.url);
  parts.sort((a, b) => b.score - a.score);
  return parts[0] ? parts[0].url : null;
}

function collectImageRefs(html, baseUrl) {
  const refs = [];
  const seen = new Set();
  const push = (raw, kind, caption) => {
    const url = absolutize(raw, baseUrl);
    if (!url || seen.has(url)) return;
    if (SKIP_URL_RE.test(url)) return;
    seen.add(url);
    refs.push({ url, kind, caption });
  };

  // og:image 优先，通常就是站点主视觉
  for (const m of html.matchAll(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*>/gi)) {
    const content = /content=["']([^"']+)["']/i.exec(m[0])?.[1];
    if (content) push(content, 'cover', 'OG cover');
  }
  for (const m of html.matchAll(/<meta[^>]+name=["']twitter:image["'][^>]*>/gi)) {
    const content = /content=["']([^"']+)["']/i.exec(m[0])?.[1];
    if (content) push(content, 'cover', 'Social cover');
  }

  // <img> / <picture><source>
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const srcset = /srcset=["']([^"']+)["']/i.exec(tag)?.[1];
    const src = /src=["']([^"']+)["']/i.exec(tag)?.[1];
    const chosen = pickFromSrcset(srcset) || src;
    const alt = /alt=["']([^"']*)["']/i.exec(tag)?.[1] || '';
    if (chosen) push(chosen, 'hero', alt.slice(0, 60) || 'Content image');
  }
  for (const m of html.matchAll(/<source\b[^>]*srcset=["']([^"']+)["'][^>]*>/gi)) {
    const chosen = pickFromSrcset(m[1]);
    if (chosen) push(chosen, 'hero', 'Content image');
  }

  return refs;
}

/** 下载前先用 HEAD/GET 拿到类型与体积，超限的直接跳过。 */
async function fetchImage(url, referer) {
  const bin = await fetchBinary(url, referer);
  if (!bin || !bin.buf || bin.buf.length === 0) return null;
  const type = (bin.contentType || '').split(';')[0].trim().toLowerCase();
  if (!OK_TYPE_RE.test(type)) return null;
  if (bin.buf.length > MAX_ONE_BYTES) return null;
  return {
    contentType: type,
    bytes: bin.buf.length,
    dataUrl: `data:${type};base64,${bin.buf.toString('base64')}`,
  };
}

/**
 * 返回 [{kind, caption, sourceUrl, bytes, dataUrl}]。
 * 单张失败不影响其它，全部失败就返回空数组（模板会自动退回色块版式）。
 */
async function harvestImagery(html, baseUrl) {
  if (!html) return [];
  const refs = collectImageRefs(html, baseUrl).slice(0, 24); // 候选别排太长，后面还要下载
  const out = [];
  let total = 0;
  const deadline = Date.now() + 12_000; // 整体封顶，别让一张慢图拖死整次提取

  // 3 张并发：比串行快得多，又不至于把对方站点压垮。
  const CONCURRENCY = 3;
  let cursor = 0;

  async function worker() {
    while (cursor < refs.length) {
      if (out.length >= MAX_IMAGES) return;
      if (total >= MAX_TOTAL_BYTES) return;
      if (Date.now() > deadline) return;
      const ref = refs[cursor];
      cursor += 1;
      let image = null;
      try {
        image = await fetchImage(ref.url, baseUrl);
      } catch {
        image = null;
      }
      if (!image) continue;
      if (out.length >= MAX_IMAGES) return;
      if (total + image.bytes > MAX_TOTAL_BYTES) continue;
      total += image.bytes;
      const index = out.filter((item) => item.kind === ref.kind).length + 1;
      out.push({
        kind: ref.kind,
        caption: ref.caption || `${ref.kind} ${index}`,
        sourceUrl: ref.url,
        bytes: image.bytes,
        dataUrl: image.dataUrl,
      });
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // 并发完成顺序不定，这里按 refs 原始顺序还原，保证 cover 始终排第一。
  const orderOf = new Map(refs.map((ref, index) => [ref.url, index]));
  out.sort((a, b) => (orderOf.get(a.sourceUrl) ?? 0) - (orderOf.get(b.sourceUrl) ?? 0));
  return out;
}

module.exports = { harvestImagery, collectImageRefs };
