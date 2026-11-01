// @ts-nocheck
/**
 * 垫片：原版 prefetch 模块的替身。
 *
 * 原版 buildFromUrl 会调用 prefetchBrand() 自己抓页面、落临时目录。本应用的抓取
 * 链路已经有一套（fetch-http / render-page / extract-site），Brand 对象由
 * brand-kit.cjs 直接合成，所以这里只保留类型定义，prefetchBrand 一旦被调用就抛错，
 * 防止误走另一条网络路径。
 */

export interface PrefetchColor {
  hex: string;
  count: number;
}

export interface PrefetchFont {
  family: string;
  count?: number;
}

export interface PrefetchLogo {
  file: string;
  contentType?: string;
  sourceUrl?: string;
}

export interface PrefetchFontFile {
  file: string;
  family: string;
  weight?: string;
  style?: string;
  format?: string;
  bytes?: number;
}

export interface PrefetchResult {
  url: string;
  finalUrl: string;
  title: string;
  siteName: string;
  description: string;
  headings: string[];
  paragraphs: string[];
  colors: PrefetchColor[];
  fonts: PrefetchFont[];
  fontFaceFamilies: string[];
  logos: PrefetchLogo[];
  fontFiles?: PrefetchFontFile[];
}

export async function prefetchBrand(): Promise<PrefetchResult | null> {
  throw new Error('prefetchBrand 未被使用：本应用走自己的抓取链路（brand-kit.cjs）');
}
