'use strict';

const { fetchBinary } = require('./fetch-http.cjs');

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
}

function metaContent(html, nameOrProp) {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${nameOrProp.replace(/[:.]/g, '\\$&')}["'][^>]*>`,
    'i',
  );
  const tag = re.exec(html)?.[0];
  if (!tag) return '';
  return decodeEntities(/content=["']([^"']*)["']/i.exec(tag)?.[1] ?? '');
}

function findLogoRefs(html, baseUrl) {
  const refs = [];
  const push = (href, kind) => {
    if (!href || href.startsWith('data:')) return;
    try {
      refs.push({ url: new URL(decodeEntities(href), baseUrl).href, kind });
    } catch {
      /* skip */
    }
  };

  for (const m of html.matchAll(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/gi)) {
    const href = /href=["']([^"']+)["']/i.exec(m[0])?.[1];
    const isApple = /apple-touch/i.test(m[0]);
    push(href, isApple ? 'apple-touch-icon' : 'favicon');
  }
  const og = metaContent(html, 'og:image') || metaContent(html, 'twitter:image');
  if (og) push(og, 'og-image');

  const headerHtml =
    (/<header[\s\S]{0,8000}?<\/header>/i.exec(html)?.[0] ?? '') +
    (/<nav[\s\S]{0,8000}?<\/nav>/i.exec(html)?.[0] ?? '');
  for (const m of (headerHtml + html).matchAll(/<img[^>]+>/gi)) {
    const tag = m[0];
    const src = /src=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!src) continue;
    const inHeader = headerHtml.includes(tag);
    const looksLogo = /logo/i.test(tag);
    if (inHeader || looksLogo) push(src, 'header-img');
  }

  const seen = new Set();
  return refs.filter((r) => !seen.has(r.url) && (seen.add(r.url), true));
}

function extractInlineHeaderSvg(html) {
  const header =
    /<header[\s\S]{0,12000}?<\/header>/i.exec(html)?.[0] ??
    /<nav[\s\S]{0,12000}?<\/nav>/i.exec(html)?.[0];
  if (!header) return null;
  const svg = /<svg[\s\S]{0,20000}?<\/svg>/i.exec(header)?.[0];
  if (!svg || svg.length < 80) return null;
  const withNs = svg.includes('xmlns') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  return withNs;
}

function svgDataUrl(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

async function fetchServiceFavicons(host) {
  const out = [];
  const services = [
    { url: `https://www.google.com/s2/favicons?domain=${host}&sz=256`, kind: 'favicon-service' },
    { url: `https://icons.duckduckgo.com/ip3/${host}.ico`, kind: 'favicon-service' },
  ];
  for (const svc of services) {
    const bin = await fetchBinary(svc.url);
    if (!bin) continue;
    if (bin.buf.length < 1_000) continue;
    out.push({
      kind: svc.kind,
      sourceUrl: svc.url,
      bytes: bin.buf.length,
      dataUrl: `data:${bin.contentType || 'image/png'};base64,${bin.buf.toString('base64')}`,
    });
  }
  return out;
}

async function harvestLogos(html, baseUrl) {
  const logos = [];

  const inlineSvg = extractInlineHeaderSvg(html);
  if (inlineSvg) {
    logos.push({ kind: 'inline-svg', sourceUrl: baseUrl, bytes: Buffer.byteLength(inlineSvg), dataUrl: svgDataUrl(inlineSvg) });
  }

  const refs = findLogoRefs(html, baseUrl);
  for (const ref of refs.slice(0, 6)) {
    const bin = await fetchBinary(ref.url, baseUrl);
    if (!bin) continue;
    logos.push({
      kind: ref.kind,
      sourceUrl: ref.url,
      bytes: bin.buf.length,
      dataUrl: `data:${bin.contentType || 'image/png'};base64,${bin.buf.toString('base64')}`,
    });
    if (logos.length >= 6) break;
  }

  if (logos.length === 0) {
    try {
      const host = new URL(baseUrl).hostname;
      logos.push(...(await fetchServiceFavicons(host)));
    } catch {
      /* ignore */
    }
  }
  return logos;
}

module.exports = { harvestLogos, findLogoRefs, extractInlineHeaderSvg };
