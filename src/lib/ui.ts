import type { CSSProperties } from 'react';
import type { ExtractedLogo } from '../global';

export const KIND_LABEL: Record<string, string> = {
  'inline-svg': '页面内标志',
  favicon: '网站图标',
  'apple-touch-icon': '桌面图标',
  'og-image': '分享图',
  'header-img': '头部图片',
  'favicon-service': '通用图标服务',
};

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] || '其他图片';
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url || '';
  }
}

export function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return `今天 ${hh}:${mm}`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (window.api?.copyText) {
      const r = await window.api.copyText(text);
      if (r?.ok) return true;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// 主展示用的标志：先按来源类型排优先级，同类里取体积更大的（通常更清晰）。
const MAIN_PRIORITY: Record<string, number> = {
  'inline-svg': 60,
  favicon: 50,
  'apple-touch-icon': 45,
  'header-img': 40,
  'og-image': 30,
  'favicon-service': 20,
};

export function pickMainLogo(logos: ExtractedLogo[]): ExtractedLogo | null {
  if (!logos || logos.length === 0) return null;
  const scored = logos.map((logo) => ({
    logo,
    score: (MAIN_PRIORITY[logo.kind] ?? 10) * 1000 + Math.min(logo.bytes || 0, 900),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].logo;
}

// 网站信息卡左侧的小图标：优先真正的网站图标。
export function pickIcon(logos: ExtractedLogo[]): string {
  const order = ['favicon', 'apple-touch-icon', 'inline-svg', 'favicon-service', 'header-img', 'og-image'];
  for (const kind of order) {
    const hit = (logos || []).find((l) => l.kind === kind && l.dataUrl);
    if (hit?.dataUrl) return hit.dataUrl;
  }
  return (logos || []).find((l) => l.dataUrl)?.dataUrl || '';
}

// 白底标志放在纯白卡片里会「消失」，用浅格子底衬出来。
export const checkerBackground: CSSProperties = {
  backgroundImage:
    'conic-gradient(#eef2f6 25%, transparent 0 50%, #eef2f6 0 75%, transparent 0)',
  backgroundSize: '8px 8px',
};

// 色块上的文字用黑还是白：按相对亮度取对比更强的那个。
export function readableOn(hex: string): string {
  const h = (hex || '').replace('#', '');
  if (h.length < 6) return '#ffffff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.62 ? '#1f2937' : '#ffffff';
}
