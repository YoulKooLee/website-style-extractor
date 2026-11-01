import { useEffect, useRef, useState } from 'react';
import type { BrandDoc, ExtractResult, FilePreview } from '../global';
import { copyText } from '../lib/ui';

type CodeKind = 'tokens' | 'brand' | 'tokensJson' | 'tailwind' | 'design' | 'guide' | 'brandSystem';

const CODE_TABS: { key: CodeKind; label: string; hint: string }[] = [
  {
    key: 'brand',
    label: 'brand.json',
    hint: '品牌本体：七个语义色角色、字体、语气、素材清单、版式。这里可以直接改，改完点「应用并重新生成」，整套设计体系会跟着重算。',
  },
  {
    key: 'design',
    label: 'DESIGN.md',
    hint: '给人看的品牌说明：色板表、字体、语气、素材、版式，带 frontmatter，可以当设计体系的说明书。',
  },
  {
    key: 'guide',
    label: 'guide.md',
    hint: '一页纸品牌指南：色角色 + 字体 + 文案支柱，适合直接发给同事。',
  },
  {
    key: 'tokens',
    label: 'tokens.css',
    hint: '能直接放进项目里的 CSS 变量：色阶、文字色、背景色、正文字体，自带字体时还会带上 @font-face。',
  },
  {
    key: 'tokensJson',
    label: 'tokens.json',
    hint: '标准设计令牌格式（Design Tokens），Figma 插件、样式字典这类工具都能直接读。',
  },
  {
    key: 'tailwind',
    label: 'tailwind.config.js',
    hint: '用 Tailwind 的话，把这几个颜色和字体直接合并进自己的配置就能用（brand-0 ~ brand-9）。',
  },
  {
    key: 'brandSystem',
    label: 'BRAND-SYSTEM.md',
    hint: '设计体系的技术说明：每个文件是什么、怎么换主色、怎么切深色、怎么调密度。',
  },
];

const PREVIEW_ITEMS: { key: string; label: string; note: string }[] = [
  { key: 'kit.html', label: '组件 kit · 浅色', note: '按钮/表单/导航/卡片/数据/营销/标签/提示/色板/字号，十组组件全在这' },
  { key: 'kit.dark.html', label: '组件 kit · 深色', note: '同一颗种子跑 dark 算法，颜色关系完全一致' },
  { key: 'index.html', label: '总览页', note: '把所有产物串起来的画廊页' },
  { key: 'artifacts/landing.html', label: 'Landing 落地页', note: 'hero → 特性 → 定价 → 常见问题 → CTA' },
  { key: 'artifacts/deck.html', label: 'Deck 幻灯片', note: '9 张 16:9，支持键盘左右键翻页' },
  { key: 'artifacts/poster.html', label: 'Poster 海报', note: '3:4 印刷比例' },
  { key: 'artifacts/email.html', label: 'Email 营销邮件', note: '正文宽度按邮件客户端收紧' },
  { key: 'artifacts/newsletter.html', label: 'Newsletter 简报', note: '多条目摘要版式' },
  { key: 'artifacts/form.html', label: 'Form 表单页', note: '左右分栏的联系/注册页' },
];

interface Props {
  result: ExtractResult;
  brandOverride: BrandDoc | null;
  onApplyBrand: (brand: BrandDoc) => void;
  onResetBrand: () => void;
  aiConfigured: boolean;
  aiBusy: boolean;
  onAiEnrich: () => void;
  onOpenAiSettings: () => void;
}

export default function FilesPanel({
  result,
  brandOverride,
  onApplyBrand,
  onResetBrand,
  aiConfigured,
  aiBusy,
  onAiEnrich,
  onOpenAiSettings,
}: Props) {
  const [mode, setMode] = useState<'preview' | 'code'>('preview');
  const [preview, setPreview] = useState<Partial<FilePreview>>({});
  const [error, setError] = useState('');
  const [codeKind, setCodeKind] = useState<CodeKind>('brand');
  const [previewKey, setPreviewKey] = useState('kit.html');
  const [frameHtml, setFrameHtml] = useState('');
  const [frameLoading, setFrameLoading] = useState(false);
  const [extraText, setExtraText] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState('');
  const [applying, setApplying] = useState(false);
  const [editMsg, setEditMsg] = useState<{ text: string; ok: boolean; notes?: string[] } | null>(null);
  const cache = useRef<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    setError('');
    setPreview({});
    cache.current = {};
    setExtraText({});
    window.api
      .previewFiles(result, brandOverride)
      .then((r) => {
        if (!alive) return;
        if (r.ok) {
          setPreview({
            tokensCss: r.tokensCss,
            brandJson: r.brandJson,
            tailwindConfig: r.tailwindConfig,
            tokensJson: r.tokensJson,
            designMd: r.designMd,
            guideMd: r.guideMd,
            slug: r.slug,
            files: r.files,
          });
          setDraft(r.brandJson || '');
        } else setError(r.error || '预览生成失败');
      })
      .catch(() => alive && setError('预览生成失败'));
    return () => {
      alive = false;
    };
  }, [result, brandOverride]);

  const loadFile = async (relPath: string): Promise<string> => {
    if (cache.current[relPath]) return cache.current[relPath];
    const r = await window.api.systemFile(result, relPath, brandOverride);
    const content = r.ok && r.content ? r.content : '';
    if (content) cache.current[relPath] = content;
    return content;
  };

  // 预览：切到哪个就现取哪个，几十上百 KB 的 HTML 不必一次全塞进内存。
  useEffect(() => {
    if (mode !== 'preview') return;
    let alive = true;
    setFrameLoading(true);
    loadFile(previewKey)
      .then((html) => {
        if (!alive) return;
        setFrameHtml(html);
      })
      .catch(() => alive && setFrameHtml(''))
      .finally(() => alive && setFrameLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, previewKey, result, brandOverride]);

  // 代码：BRAND-SYSTEM.md 不在预览包里，单独取。
  useEffect(() => {
    if (mode !== 'code' || codeKind !== 'brandSystem') return;
    let alive = true;
    loadFile('BRAND-SYSTEM.md')
      .then((text) => alive && setExtraText((prev) => ({ ...prev, brandSystem: text })))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, codeKind, result, brandOverride]);

  const codeText = (key: CodeKind): string => {
    if (key === 'tokens') return preview.tokensCss || '';
    if (key === 'brand') return preview.brandJson || '';
    if (key === 'tokensJson') return preview.tokensJson || '';
    if (key === 'tailwind') return preview.tailwindConfig || '';
    if (key === 'design') return preview.designMd || '';
    if (key === 'guide') return preview.guideMd || '';
    return extraText.brandSystem || '';
  };

  const currentTab = CODE_TABS.find((t) => t.key === codeKind) || CODE_TABS[0];
  const text = codeText(codeKind);
  const dirty = codeKind === 'brand' && draft.trim() !== '' && draft !== text;

  async function handleCopy() {
    const value = codeKind === 'brand' ? draft || text : text;
    if (!value) return;
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  async function applyDraft() {
    setApplying(true);
    setEditMsg(null);
    try {
      const r = await window.api.finalizeBrand(result, draft);
      if (!r.ok || !r.brand) {
        setEditMsg({ text: r.error || '重新生成失败', ok: false });
        return;
      }
      onApplyBrand(r.brand);
      if (r.brandJson) setDraft(r.brandJson);
      const repaired = r.notes && r.notes.length ? `；顺带修了 ${r.notes.length} 处` : '';
      setEditMsg({
        text: `已按这份 brand.json 重新生成 ${r.fileCount || 0} 个文件${repaired}`,
        ok: true,
        notes: r.notes,
      });
    } catch {
      setEditMsg({ text: '重新生成失败，请再试一次。', ok: false });
    } finally {
      setApplying(false);
    }
  }

  function formatDraft() {
    try {
      const parsed = JSON.parse(draft);
      setDraft(JSON.stringify(parsed, null, 2));
      setEditMsg({ text: '已整理缩进格式', ok: true });
    } catch {
      setEditMsg({ text: '现在这份 JSON 还有语法错误，先补齐逗号或括号再整理。', ok: false });
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`rounded-md px-2.5 py-1 text-[11px] transition ${
              mode === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            成品预览
          </button>
          <button
            type="button"
            onClick={() => setMode('code')}
            className={`rounded-md px-2.5 py-1 text-[11px] transition ${
              mode === 'code' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            源码
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {brandOverride && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-600 ring-1 ring-emerald-100">
              已按修改后的 brand.json 生成
            </span>
          )}
          {mode === 'code' ? (
            <button
              type="button"
              onClick={handleCopy}
              disabled={!(codeKind === 'brand' ? draft : text)}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
            >
              {copied ? '已复制全文' : '复制全文'}
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">
              共 {(preview.files || []).length || 0} 个设计体系文件 · slug {preview.slug || '—'}
            </span>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 px-3 py-4 text-xs text-red-600">{error}</div>
      ) : mode === 'preview' ? (
        <>
          <div className="mb-2 flex flex-wrap gap-1">
            {PREVIEW_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPreviewKey(item.key)}
                className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                  previewKey === item.key
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[11px] leading-relaxed text-slate-400">
            {(PREVIEW_ITEMS.find((i) => i.key === previewKey) || PREVIEW_ITEMS[0]).note}
          </p>
          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {frameLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-[11px] text-slate-500">
                正在生成页面…
              </div>
            )}
            {frameHtml ? (
              <iframe
                title={previewKey}
                srcDoc={frameHtml}
                sandbox="allow-scripts"
                className="h-[460px] w-full bg-white"
              />
            ) : (
              <div className="flex h-[460px] items-center justify-center text-[11px] text-slate-400">
                正在生成页面…
              </div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            这里看到的页面和导出后浏览器打开的效果一致；字体用的是站点自托管字体，本窗口内没有 fonts/ 目录时会退回系统字体。
          </p>
        </>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {CODE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setCodeKind(t.key)}
                className={`rounded-md px-2.5 py-1 text-[11px] transition ${
                  codeKind === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[11px] leading-relaxed text-slate-400">{currentTab.hint}</p>

          {codeKind === 'brand' ? (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={applyDraft}
                  disabled={applying || !dirty}
                  className="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] text-white transition hover:bg-slate-700 disabled:opacity-40"
                >
                  {applying ? '正在重生成…' : dirty ? '应用并重新生成' : '没有改动'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(text);
                    setEditMsg(null);
                  }}
                  disabled={!dirty}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  撤销修改
                </button>
                <button
                  type="button"
                  onClick={formatDraft}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 transition hover:bg-slate-50"
                >
                  整理格式
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResetBrand();
                    setEditMsg(null);
                  }}
                  disabled={!brandOverride}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  恢复自动识别
                </button>
                {aiConfigured ? (
                  <button
                    type="button"
                    onClick={onAiEnrich}
                    disabled={aiBusy}
                    className="rounded-md bg-gradient-to-r from-indigo-500 to-blue-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:from-indigo-600 hover:to-blue-700 disabled:opacity-50"
                  >
                    {aiBusy ? 'AI 正在写…' : 'AI 补全文案'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenAiSettings}
                    className="rounded-md border border-dashed border-slate-300 px-2.5 py-1 text-[11px] text-slate-500 transition hover:bg-slate-50"
                  >
                    启用 AI 文案…
                  </button>
                )}
                <span className="text-[10px] text-slate-400">改 role/hex 会连带色阶重算</span>
              </div>

              {editMsg && (
                <div
                  className={`mb-2 rounded-lg px-3 py-2 text-[11px] leading-relaxed ${
                    editMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  <div>{editMsg.text}</div>
                  {editMsg.notes && editMsg.notes.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] opacity-80">
                      {editMsg.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
                className="h-[420px] w-full resize-y rounded-lg bg-slate-900 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-100 outline-none ring-blue-400/60 focus:ring-2"
              />
            </>
          ) : (
            <pre className="max-h-[420px] overflow-auto rounded-lg bg-slate-900 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-100">
              {text || '正在生成预览…'}
            </pre>
          )}
        </>
      )}

      <p className="mt-2 text-[11px] text-slate-400">
        导出会生成一整套：system/（18 个设计体系文件）、brand.json、DESIGN.md、guide.md、logos/、imagery/、fonts/、prefetch/、screenshot.jpg，
        以及 tokens.css / tokens.json / tailwind.config.js 三个便利格式。
      </p>
    </section>
  );
}
