'use strict';

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
}

function stripTags(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  ).trim();
}

function matchAll1(html, re) {
  const out = [];
  for (const m of html.matchAll(re)) {
    const t = stripTags(m[1]).trim();
    if (t) out.push(t);
  }
  return out;
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

function extractMeta(html, baseUrl) {
  const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').trim();
  const description = metaContent(html, 'description') || metaContent(html, 'og:description');
  const siteName = metaContent(html, 'og:site_name') || metaContent(html, 'og:title');

  const headings = [
    ...matchAll1(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi),
    ...matchAll1(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi),
    ...matchAll1(html, /<h3[^>]*>([\s\S]*?)<\/h3>/gi),
  ].slice(0, 20);

  const paragraphs = matchAll1(html, /<p[^>]*>([\s\S]*?)<\/p>/gi)
    .filter((p) => p.length > 40)
    .slice(0, 12);

  const navLabels = [];
  const navScope = /<nav[\s\S]{0,12000}?<\/nav>/i.exec(html)?.[0] ?? html.slice(0, 30000);
  for (const m of navScope.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
    const label = stripTags(m[2]);
    if (label && label.length <= 40) navLabels.push(label);
  }

  return { title, description, siteName, headings, paragraphs, navLabels: [...new Set(navLabels)].slice(0, 20) };
}

module.exports = { extractMeta };
