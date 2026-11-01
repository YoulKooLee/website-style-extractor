export interface ExtractedLogo {
  file?: string;
  sourceUrl: string;
  kind: string;
  bytes: number;
  dataUrl?: string;
}

export interface ExtractedColor {
  hex: string;
  count: number;
  extreme?: boolean;
  sources?: string[];
}

export interface FontFileMeta {
  family: string;
  weight: string;
  style: string;
  file: string;
  format: string;
  bytes: number;
  sourceUrl: string;
  unicodeRange?: string;
  dataUrl?: string;
}

export interface FontSourceFamily {
  family: string;
  kind: 'google' | 'self' | 'system';
  cssUrl: string;
  weight: string;
  style: string;
  format: string;
  sourceUrl: string;
  bytes: number;
  file: string;
  previewDataUrl: string;
}

export interface FontSources {
  families: FontSourceFamily[];
  files: FontFileMeta[];
}

export type FetchMode = 'auto' | 'static' | 'render';

export interface ExtractedImagery {
  kind: string;
  caption?: string;
  sourceUrl: string;
  bytes: number;
  dataUrl?: string;
}

export interface LayoutHints {
  radius: number;
  borderWidth: number;
  radiusSamples?: { value: number; count: number }[];
}

export interface ExtractResult {
  url: string;
  finalUrl: string;
  siteName: string;
  title: string;
  description: string;
  colors: ExtractedColor[];
  fonts: { family: string; count: number }[];
  fontFaceFamilies: string[];
  logos: ExtractedLogo[];
  imagery?: ExtractedImagery[];
  layoutHints?: LayoutHints;
  headings: string[];
  paragraphs?: string[];
  navLabels?: string[];
  blocked: boolean;
  thin: boolean;
  primaryLadder: { seed: string; steps: string[] } | null;
  fetchMode?: 'static' | 'render';
  screenshot?: string | null;
  renderError?: string;
  fontSources?: FontSources;
  googleFontsUrls?: string[];
  extractedAt?: string;
}

export interface ProgressPayload {
  id: string;
  label: string;
  percent: number;
}

export interface HistoryItem {
  id: string;
  savedAt: string;
  siteName: string;
  title: string;
  description: string;
  host: string;
  url: string;
  finalUrl: string;
  primary: string;
  blocked: boolean;
  icon: string;
}

export interface FilePreview {
  tokensCss: string;
  brandJson: string;
  tailwindConfig: string;
  tokensJson: string;
  designMd?: string;
  guideMd?: string;
  slug?: string;
  files?: { path: string; bytes: number }[];
  notes?: string[];
}

/** brand.json 的结构（只需覆盖本应用会读会写的字段）。 */
export interface BrandColor {
  role: string;
  hex: string;
  name?: string;
  usage?: string;
  oklch?: string;
}

export interface BrandFontSpec {
  family: string;
  fallbacks?: string[];
  weights?: number[];
}

export interface BrandDoc {
  name: string;
  tagline?: string;
  description?: string;
  sourceUrl?: string;
  colors: BrandColor[];
  typography: { display: BrandFontSpec; body: BrandFontSpec; mono?: BrandFontSpec };
  voice?: {
    adjectives?: string[];
    tone?: string;
    messagingPillars?: string[];
    vocabulary?: { use?: string[]; avoid?: string[] };
  };
  imagery?: { style?: string; subjects?: string[]; treatment?: string; avoid?: string[] };
  layout?: { radius?: string; borderWeight?: string; spacing?: string; postureRules?: string[] };
  [key: string]: unknown;
}

export interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  note: string;
}

export interface AiConfig {
  provider: string;
  baseUrl: string;
  model: string;
  temperature: number;
  configured: boolean;
  hasKey: boolean;
  keyMasked: string;
  encryption: 'system' | 'base64' | 'none';
  updatedAt: string;
}

export interface AiCallResult {
  ok: boolean;
  code?: string;
  error?: string;
  detail?: string;
  model?: string;
  reply?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
}

/** 分渠道文案（AI 生成后进 copy.json）。 */
export interface CopySection {
  title: string;
  body: string;
}

export interface CopyDoc {
  format?: string;
  brand?: string;
  generatedAt?: string;
  landing?: {
    heroTitle?: string;
    heroSubtitle?: string;
    sections?: CopySection[];
    cta?: string;
    ctaNote?: string;
  };
  wechat?: { titles?: string[]; excerpt?: string; opening?: string; closing?: string };
  app?: {
    oneLiner?: string;
    storeTitle?: string;
    storeSubtitle?: string;
    storeDescription?: string;
    whatsNew?: string;
  };
}

export interface BrandResult {
  ok: boolean;
  error?: string;
  code?: string;
  brand?: BrandDoc;
  brandJson?: string;
  notes?: string[];
  changed?: string[];
  fileCount?: number;
  usage?: AiCallResult['usage'];
  model?: string;
}

export interface ApiBridge {
  platform: string;
  extract: (
    url: string,
    opts?: { mode?: FetchMode },
  ) => Promise<{ ok: boolean; code?: string; result?: ExtractResult; error?: string }>;
  onProgress: (cb: (p: ProgressPayload) => void) => () => void;
  exportBundle: (
    result: ExtractResult,
    opts?: { brand?: BrandDoc | null; copy?: CopyDoc | null },
  ) => Promise<{ ok: boolean; dir?: string; files?: string[]; error?: string }>;
  previewFiles: (
    result: ExtractResult,
    override?: BrandDoc | null,
  ) => Promise<{ ok: boolean; error?: string } & Partial<FilePreview>>;
  systemFile: (
    result: ExtractResult,
    relPath: string,
    override?: BrandDoc | null,
  ) => Promise<{ ok: boolean; content?: string; error?: string }>;
  finalizeBrand: (result: ExtractResult, brandText: string) => Promise<BrandResult>;
  autoBrand: (result: ExtractResult) => Promise<BrandResult>;
  aiProviders: () => Promise<{ ok: boolean; providers: AiProvider[] }>;
  aiConfigGet: () => Promise<{ ok: boolean; config?: AiConfig; error?: string }>;
  aiConfigSave: (
    patch: { provider?: string; baseUrl?: string; model?: string; apiKey?: string; temperature?: number },
  ) => Promise<{ ok: boolean; config?: AiConfig; error?: string }>;
  aiConfigClear: () => Promise<{ ok: boolean; config?: AiConfig; error?: string }>;
  aiTest: (draft: { baseUrl?: string; model?: string; apiKey?: string }) => Promise<AiCallResult>;
  aiEnrich: (result: ExtractResult, override?: BrandDoc | null) => Promise<BrandResult>;
  aiCopy: (
    result: ExtractResult,
    override?: BrandDoc | null,
  ) => Promise<{
    ok: boolean;
    error?: string;
    code?: string;
    copy?: CopyDoc;
    notes?: string[];
    usage?: AiCallResult['usage'];
    model?: string;
  }>;
  generatePalette: (seed: string) => Promise<{ ok: boolean; steps?: string[]; error?: string }>;
  captureThumbnail: (
    url: string,
  ) => Promise<{ ok: boolean; screenshot?: string; finalUrl?: string; error?: string }>;
  historyList: () => Promise<{ ok: boolean; items: HistoryItem[] }>;
  historyGet: (id: string) => Promise<{ ok: boolean; result?: ExtractResult; savedAt?: string; error?: string }>;
  historyRemove: (id: string) => Promise<{ ok: boolean; items: HistoryItem[] }>;
  historyClear: () => Promise<{ ok: boolean; items: HistoryItem[] }>;
  copyText: (text: string) => Promise<{ ok: boolean }>;
  openExternal: (url: string) => Promise<{ ok: boolean }>;
}

declare global {
  interface Window {
    api: ApiBridge;
  }
}

export {};
