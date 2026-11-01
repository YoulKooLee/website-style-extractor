import type { ExtractResult } from '../global';
import { hostOf, pickIcon, checkerBackground } from '../lib/ui';

interface Props {
  result: ExtractResult;
  onCapture?: () => Promise<void> | void;
  capturing?: boolean;
}

export default function SiteCard({ result, onCapture, capturing }: Props) {
  const icon = pickIcon(result.logos || []);
  const name = result.siteName || result.title || hostOf(result.finalUrl || result.url);
  const host = hostOf(result.finalUrl || result.url);
  const fullUrl = result.finalUrl || result.url;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100"
          style={checkerBackground}
        >
          {icon ? (
            <img src={icon} alt="网站图标" className="max-h-9 max-w-9 object-contain" />
          ) : (
            <span className="text-[10px] text-slate-400">无图标</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-slate-900" title={name}>
            {name}
          </h2>
          <button
            type="button"
            onClick={() => window.api.openExternal(fullUrl)}
            className="mt-0.5 block max-w-full truncate text-left text-xs text-blue-600 hover:underline"
            title="在浏览器里打开这个网站"
          >
            {host}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${
            result.fetchMode === 'render'
              ? 'bg-violet-50 text-violet-600 ring-violet-100'
              : 'bg-slate-50 text-slate-500 ring-slate-200'
          }`}
          title={
            result.fetchMode === 'render'
              ? '用内置浏览器真正打开了页面，脚本生成的内容也能拿到'
              : '只读取了网页源码，没执行页面脚本'
          }
        >
          {result.fetchMode === 'render' ? '浏览器渲染' : '只读源码'}
        </span>
        {result.blocked && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 ring-1 ring-amber-200">
            有访问保护
          </span>
        )}
        {result.thin && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">内容偏少</span>
        )}
      </div>

      <dl className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">
        <div>
          <dt className="text-slate-400">页面标题</dt>
          <dd className="mt-0.5 line-clamp-2 text-slate-700">{result.title || '没读到标题'}</dd>
        </div>
        <div>
          <dt className="text-slate-400">网站简介</dt>
          <dd className="mt-0.5 line-clamp-3 text-slate-700">{result.description || '这个页面没写简介'}</dd>
        </div>
      </dl>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">网站缩略图</span>
          {!result.screenshot && onCapture && (
            <button
              type="button"
              onClick={onCapture}
              disabled={capturing}
              className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              {capturing ? '正在截图…' : '补一张'}
            </button>
          )}
        </div>
        {result.screenshot ? (
          <button
            type="button"
            onClick={() => window.api.openExternal(fullUrl)}
            className="block w-full overflow-hidden rounded-lg border border-slate-200"
            title="在浏览器里打开这个网站"
          >
            <img src={result.screenshot} alt="网站缩略图" className="h-32 w-full object-cover object-top" />
          </button>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] leading-relaxed text-slate-400">
            {capturing ? '正在用内置浏览器打开页面截图…' : '没拿到缩略图；点「补一张」会用内置浏览器打开页面拍一张。'}
          </div>
        )}
      </div>
    </section>
  );
}
