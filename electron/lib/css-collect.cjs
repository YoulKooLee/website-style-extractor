'use strict';

const { fetchText } = require('./fetch-http.cjs');

const MAX_CSS_FILES = 6;
const CSS_CAP = 400_000;

function decodeEntities(s) {
  return (s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function inlineStyleSelector(tagName, attrs) {
  const tag = tagName.toLowerCase();
  const cls = /class=["']([^"']+)["']/i.exec(attrs)?.[1] ?? '';
  const classes = cls.split(/\s+/).filter(Boolean).slice(0, 3).map((n) => `.${n.replace(/[^\w-]/g, '')}`).join('');
  return `${tag}${classes}`.slice(0, 220) || tag;
}

/**
 * 汇总页面样式。每条样式都带自己的来源地址，字体里的相对路径才能按「样式表所在地址」补全
 * （按页面地址补全会算错，比如 Next.js 的 ../media/...）。
 * 返回 { css, sheets:[{url,css}], googleSheets, googleFontsUrls }。
 */
async function collectCss(html, baseUrl, seedCss) {
  const sheets = [];
  if (seedCss && seedCss.trim()) sheets.push({ url: baseUrl, css: seedCss });

  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    sheets.push({ url: baseUrl, css: m[1] });
  }

  for (const m of html.matchAll(/<([a-z][\w:-]*)([^>]{0,2000}?)\sstyle=["']([^"']{1,2000})["'][^>]*>/gi)) {
    sheets.push({ url: baseUrl, css: `${inlineStyleSelector(m[1], m[2] || '')}{${m[3]};}` });
  }

  const cssLinks = [];
  const googleFonts = [];
  for (const m of html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>|<link[^>]+href=["'][^"']+["'][^>]+rel=["']stylesheet["'][^>]*>/gi)) {
    const href = /href=["']([^"']+)["']/i.exec(m[0])?.[1];
    if (!href) continue;
    try {
      const abs = new URL(decodeEntities(href), baseUrl).href;
      if (/fonts\.googleapis\.com/.test(abs)) googleFonts.push(abs);
      else cssLinks.push(abs);
    } catch {
      /* skip */
    }
  }

  const targets = cssLinks.slice(0, MAX_CSS_FILES);
  const cssResults = await Promise.all(targets.map((u) => fetchText(u, CSS_CAP)));
  cssResults.forEach((r, i) => {
    if (!r) return;
    sheets.push({ url: r.finalUrl || targets[i], css: r.text });
  });

  const gfTargets = googleFonts.slice(0, 2);
  const gfResults = await Promise.all(gfTargets.map((u) => fetchText(u, CSS_CAP)));
  const googleSheets = [];
  gfResults.forEach((r, i) => {
    if (!r) return;
    const entry = { url: r.finalUrl || gfTargets[i], css: r.text };
    sheets.push(entry);
    googleSheets.push(entry);
  });

  return {
    css: sheets.map((s) => s.css).join('\n'),
    sheets,
    googleSheets,
    googleFontsUrls: gfTargets,
  };
}

module.exports = { collectCss };
