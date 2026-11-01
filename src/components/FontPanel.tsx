import { useState } from 'react';
import type { ExtractResult, FontSourceFamily } from '../global';
import { copyText } from '../lib/ui';

const KIND_TEXT: Record<string, string> = {
  google: '在线字体 · Google Fonts',
  self: '网站自带字体',
  system: '系统字体',
};

const KIND_STYLE: Record<string, string> = {
  google: 'bg-blue-50 text-blue-600 ring-blue-100',
  self: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  system: 'bg-slate-100 text-slate-500 ring-slate-200',
};

export default function FontPanel({ result }: { result: ExtractResult }) {
  const [copied, setCopied] = useState('');
  const fonts = result.fonts || [];
  const faces = result.fontFaceFamilies || [];
  const sources: FontSourceFamily[] = result.fontSources?.families || [];
  const files = result.fontSources?.files || [];

  const sourceOf = (family: string) => sources.find((s) => s.family.toLowerCase() === family.toLowerCase());
  const previews = sources.filter((s) => s.previewDataUrl);

  async function copy(text: string, tag: string) {
    const ok = await copyText(text);
    if (ok) {
      setCopied(tag);
      setTimeout(() => setCopied(''), 1200);
    }
  }

  if (fonts.length === 0 && faces.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">字体</h2>
        <p className="text-sm text-slate-400">没有识别到自定义字体，这个网站大概率直接用了系统默认字体。</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {previews.length > 0 && (
        <style>
          {previews
            .map(
              (p) =>
                `@font-face{font-family:"${p.family}";src:url("${p.previewDataUrl}") format("${p.format}");font-weight:${p.weight};font-style:${p.style};font-display:swap;}`,
            )
            .join('\n')}
        </style>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">字体</h2>
        <span className="text-[11px] text-slate-400">
          按使用次数排序{files.length > 0 ? ` · 已下载 ${files.length} 个字体文件` : ''}
        </span>
      </div>

      <div className="space-y-2.5">
        {fonts.map((f) => {
          const src = sourceOf(f.family);
          return (
            <div key={f.family} className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-xs font-medium text-slate-700" title={f.family}>
                      {f.family}
                    </span>
                    {src && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] ring-1 ${
                          KIND_STYLE[src.kind] || KIND_STYLE.system
                        }`}
                      >
                        {src.kind === 'self' && src.bytes > 0
                          ? `${KIND_TEXT.self} · 已下载`
                          : src.kind === 'self'
                            ? `${KIND_TEXT.self} · 没下到`
                            : KIND_TEXT[src.kind] || '系统字体'}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    在样式里出现 {f.count} 次
                    {src && src.bytes > 0 ? ` · ${Math.max(1, Math.round(src.bytes / 1024))} KB` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {src?.cssUrl && (
                    <button
                      type="button"
                      onClick={() => copy(src.cssUrl, `${f.family}-url`)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    >
                      {copied === `${f.family}-url` ? '已复制' : '复制在线地址'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => copy(f.family, f.family)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                  >
                    {copied === f.family ? '已复制' : '复制字体名'}
                  </button>
                </div>
              </div>
              <div
                className="mt-2 truncate text-xl text-slate-900"
                style={{ fontFamily: `"${f.family}", system-ui, sans-serif` }}
                title="本机没装这个字体时，会显示成相近的系统字体"
              >
                字体样例 Aa 汉字 123
              </div>
            </div>
          );
        })}
      </div>

      {faces.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="mb-1.5 text-[11px] text-slate-400">网页里额外声明的字体</div>
          <div className="flex flex-wrap gap-1.5">
            {faces.map((name) => (
              <span key={name} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
          {files.some((f) => !f.dataUrl)
            ? '这条记录里的字体文件没有保留下来（只有名字和体积）。重新提取一次，导出时就能把字体文件一起带走。'
            : '导出时会把这些字体文件和 fonts.css 一起保存，别人打开你的页面就能看到一样的字形。'}
        </div>
      )}
    </section>
  );
}
