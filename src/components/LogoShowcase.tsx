import { useEffect, useState } from 'react';
import type { ExtractResult } from '../global';
import { kindLabel, pickMainLogo, checkerBackground } from '../lib/ui';

export default function LogoShowcase({ result }: { result: ExtractResult }) {
  const logos = result.logos || [];
  const [activeIdx, setActiveIdx] = useState(0);

  // 默认展示最像「官方标志」的那一个（图标优先，其次页头图、分享图）。
  useEffect(() => {
    const main = pickMainLogo(logos);
    const idx = main ? logos.indexOf(main) : 0;
    setActiveIdx(idx >= 0 ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.finalUrl]);

  const active = logos[activeIdx] || null;
  const kb = active ? Math.max(1, Math.round(active.bytes / 1024)) : 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">网站标志</h2>
        <span className="text-[11px] text-slate-400">{logos.length > 0 ? `共 ${logos.length} 个` : ''}</span>
      </div>

      {active ? (
        <>
          <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-slate-200 p-3" style={checkerBackground}>
            <img src={active.dataUrl} alt="网站标志" className="max-h-28 max-w-full object-contain" />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{kindLabel(active.kind)}</span>
            <span className="truncate text-slate-400" title={active.sourceUrl}>
              {kb} KB
            </span>
          </div>

          {logos.length > 1 && (
            <>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {logos.map((logo, i) => (
                  <button
                    key={`${logo.sourceUrl}-${i}`}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    title={kindLabel(logo.kind)}
                    className={`flex h-14 items-center justify-center overflow-hidden rounded-lg border bg-white p-1.5 transition ${
                      i === activeIdx
                        ? 'border-blue-400 ring-2 ring-blue-100'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <img src={logo.dataUrl} alt={kindLabel(logo.kind)} className="max-h-10 max-w-full object-contain" />
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">点小图切换上面的大图。</p>
            </>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-8 text-center text-xs text-slate-400">
          这个网站没找到可用的标志图片（既没放图标，也没有分享图）。
          <div className="mt-1">配色和字体仍然可以正常导出。</div>
        </div>
      )}
    </section>
  );
}
