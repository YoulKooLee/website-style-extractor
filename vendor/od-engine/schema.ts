// @ts-nocheck
/**
 * 垫片：从 @open-design/contracts 抄出来的 Brand 契约（字段与原版一一对应）。
 * 引擎只把它当类型用，运行时不需要真实实现，所以这里只保留类型与常量。
 */

export const BRAND_COLOR_ROLES = [
  'background',
  'surface',
  'foreground',
  'muted',
  'border',
  'accent',
  'accent-secondary',
] as const;

export type BrandColorRole = (typeof BRAND_COLOR_ROLES)[number];

export interface BrandColor {
  role: BrandColorRole;
  /** 小写 #rrggbb */
  hex: string;
  oklch: string;
  name: string;
  usage: string;
}

export interface BrandFontSpec {
  family: string;
  fallbacks: string[];
  weights: number[];
  googleFontsUrl?: string;
  notes?: string;
}

export interface BrandVoice {
  adjectives: string[];
  tone: string;
  messagingPillars: string[];
  vocabulary: { use: string[]; avoid: string[] };
}

export interface BrandImagerySample {
  file: string;
  kind?: string;
  caption?: string;
}

export interface BrandImagery {
  style: string;
  subjects: string[];
  treatment: string;
  avoid: string[];
  samples?: BrandImagerySample[];
}

export interface BrandLayout {
  radius: string;
  borderWeight: string;
  spacing: string;
  postureRules: string[];
}

export interface BrandSeedOverrides {
  colorPrimary?: string;
  colorSuccess?: string;
  colorWarning?: string;
  colorError?: string;
  colorInfo?: string;
  colorLink?: string;
  colorTextBase?: string;
  colorBgBase?: string;
  fontFamily?: string;
  fontFamilyCode?: string;
  fontSize?: number;
  borderRadius?: number;
  sizeUnit?: number;
  sizeStep?: number;
  controlHeight?: number;
  lineWidth?: number;
  motionUnit?: number;
  motionBase?: number;
  wireframe?: boolean;
  motion?: boolean;
}

export interface Brand {
  name: string;
  tagline: string;
  description: string;
  sourceUrl: string;
  logo: {
    primary: string | null;
    alternates: string[];
    notes: string;
  };
  colors: BrandColor[];
  typography: {
    display: BrandFontSpec;
    body: BrandFontSpec;
    mono?: BrandFontSpec;
  };
  voice: BrandVoice;
  imagery: BrandImagery;
  layout: BrandLayout;
  seed?: BrandSeedOverrides;
}

export const ASSET_KINDS = ['landing', 'deck', 'poster', 'email', 'newsletter', 'form'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];
