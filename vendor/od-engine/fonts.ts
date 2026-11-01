// @ts-nocheck
/**
 * 垫片：只有「把 @font-face 注进 HTML」这一件事，逻辑与原版 brands/fonts.ts 保持一致
 * （连 <head> 的定位都复用同一套结构扫描，避免把脚本字符串里的 <head> 当成真 head）。
 * 字体文件的下载在本应用由 webfonts.cjs 负责。
 */

import { findRealTagEnd, HTML_TAG_PATTERNS } from './html-injection-points.js';

export type FontFile = {
  family: string;
  /** 原始 CSS font-weight 值："400"、"700"，或可变字体的 "100 900"。 */
  weight: string;
  style: string;
  /** 字体文件名（位于字体目录内）。 */
  file: string;
  format: string;
  sourceUrl: string;
  bytes: number;
  unicodeRange?: string;
};

export type FontManifest = { format: 'brand-fonts/1'; files: FontFile[] };

/** 按 manifest 重新生成 @font-face，url 前缀由调用方给（相对各自文档位置）。 */
export function fontFaceCss(files: FontFile[], urlPrefix: string): string {
  return files
    .map((f) =>
      [
        '@font-face {',
        `  font-family: "${f.family.replace(/"/g, '')}";`,
        `  src: url("${urlPrefix}${f.file}") format("${f.format}");`,
        `  font-weight: ${f.weight};`,
        `  font-style: ${f.style};`,
        ...(f.unicodeRange ? [`  unicode-range: ${f.unicodeRange};`] : []),
        '  font-display: swap;',
        '}',
      ].join('\n'),
    )
    .join('\n');
}

/** 把自托管字体注入渲染后的文档。 */
export function injectFontFaces(html: string, files: FontFile[], urlPrefix: string): string {
  if (!files || files.length === 0) return html;
  const css = fontFaceCss(files, urlPrefix);
  const tag = `<style data-brand-fonts>\n${css}\n</style>`;
  const headEnd = findRealTagEnd(html, HTML_TAG_PATTERNS.headOpen);
  if (headEnd >= 0) return `${html.slice(0, headEnd)}\n${tag}${html.slice(headEnd)}`;
  return tag + html;
}
