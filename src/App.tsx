import { useEffect, useState } from 'react';
import type { AiConfig, BrandDoc, CopyDoc, ExtractResult, FetchMode, HistoryItem, ProgressPayload } from './global';
import PalettePanel from './components/PalettePanel';
import FontPanel from './components/FontPanel';
import SiteCard from './components/SiteCard';
import LogoShowcase from './components/LogoShowcase';
import FilesPanel from './components/FilesPanel';
import CopyPanel from './components/CopyPanel';
import HistoryRail from './components/HistoryRail';
import AiSettings from './components/AiSettings';
import { hostOf } from './lib/ui';

const EXAMPLES = [
  { name: '百度', url: 'https://www.baidu.com' },
  { name: '苹果中国', url: 'https://www.apple.com.cn' },
  { name: 'Shopify', url: 'https://www.shopify.com' },
];

const MODES: { key: FetchMode; label: string; hint: string }[] = [
  { key: 'auto', label: '自动', hint: '先读网页源码；读不到东西时自动换成内置浏览器渲染' },
  { key: 'static', label: '只读源码', hint: '最快，但纯脚本渲染的网站可能拿不到内容' },
  { key: 'render', label: '浏览器渲染', hint: '用内置浏览器真正打开页面，慢一些但结果最全，还能顺便截图' },
];

function errorHint(code?: string): string {
  if (code === 'PRIVATE') return '这台电脑自己的地址、公司内网地址都不会被读取，换一个公开网站的地址试试。';
  if (code === 'BAD_URL') return '请粘贴完整网址，例如 https://www.example.com（只写域名也可以，会自动补上 https）。';
  if (code === 'NETWORK') {
    return '可能是网络不通、对方网站太慢，或者这个网站需要特殊网络环境才能打开。换一个网站试试，或者稍后再试一次。';
  }
  return '换一个网址再试一次；如果对方网站需要人机验证，这里一般抓不到内容。';
}

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [tab, setTab] = useState<'design' | 'files' | 'copy'>('design');
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeId, setActiveId] = useState('');
  const [mode, setMode] = useState<FetchMode>('auto');
  const [capturing, setCapturing] = useState(false);
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
  const [showAi, setShowAi] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ text: string; ok: boolean } | null>(null);
  // 分渠道文案（官网/公众号/App 商店），生成后随导出一起写成 copy.json。
  const [copyDoc, setCopyDoc] = useState<CopyDoc | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyMsg, setCopyMsg] = useState<{ text: string; ok: boolean } | null>(null);
  // 手改或 AI 补全后的 brand；为 null 表示用自动识别的结果。
  const [brandOverride, setBrandOverride] = useState<BrandDoc | null>(null);

  useEffect(() => {
    const off = window.api.onProgress((p) => setProgress(p));
    void refreshHistory();
    window.api
      .aiConfigGet()
      .then((r) => r.ok && r.config && setAiConfig(r.config))
      .catch(() => undefined);
    return off;
  }, []);

  async function refreshHistory(): Promise<HistoryItem[]> {
    try {
      const r = await window.api.historyList();
      if (r.ok) {
        setHistory(r.items);
        return r.items;
      }
    } catch {
      /* 历史读取失败不影响主流程 */
    }
    return [];
  }

  async function runExtract(target?: string) {
    const input = (target ?? url).trim();
    setError(null);
    setExportMsg(null);
    if (!input) {
      setError({ message: '先粘贴一个网址，再点「开始提取」。' });
      return;
    }

    setLoading(true);
    setResult(null);
    setActiveId('');
    setBrandOverride(null);
    setAiMsg(null);
    setCopyDoc(null);
    setCopyMsg(null);
    setProgress({ id: 'start', label: '正在准备…', percent: 4 });

    try {
      const resp = await window.api.extract(input, { mode });
      if (!resp.ok || !resp.result) {
        setError({ message: resp.error || '这次没有提取到内容。', code: resp.code });
      } else {
        setResult(resp.result);
        setUrl(input);
        setTab('design');
        const items = await refreshHistory();
        const host = hostOf(resp.result.finalUrl || resp.result.url);
        setActiveId(items.find((it) => it.host === host)?.id || '');
      }
    } catch {
      setError({ message: '提取过程中出错了，可以再试一次。' });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  async function pickHistory(item: HistoryItem) {
    try {
      const r = await window.api.historyGet(item.id);
      if (r.ok && r.result) {
        setResult(r.result);
        setUrl(item.url || item.finalUrl);
        setActiveId(item.id);
        setError(null);
        setExportMsg(null);
        setBrandOverride(null);
        setAiMsg(null);
        setCopyDoc(null);
        setCopyMsg(null);
        setTab('design');
      } else {
        setError({ message: r.error || '这条记录已经打不开了。' });
      }
    } catch {
      setError({ message: '这条记录已经打不开了。' });
    }
  }

  async function removeHistory(id: string) {
    const r = await window.api.historyRemove(id);
    if (r.ok) {
      setHistory(r.items);
      if (activeId === id) setActiveId('');
    }
  }

  async function clearHistory() {
    const r = await window.api.historyClear();
    if (r.ok) {
      setHistory(r.items);
      setActiveId('');
    }
  }

  async function runExport() {
    if (!result) return;
    setExporting(true);
    setExportMsg(null);
    try {
      const r = await window.api.exportBundle(result, { brand: brandOverride, copy: copyDoc });
      if (r.ok) {
        const extra = r.files && r.files.length ? `（${r.files.length} 项：${r.files.join('、')}）` : '';
        setExportMsg({ text: `已保存到：${r.dir}${extra}`, ok: true });
      } else setExportMsg({ text: r.error || '导出失败', ok: false });
    } catch {
      setExportMsg({ text: '导出失败，请再试一次。', ok: false });
    } finally {
      setExporting(false);
    }
  }

  // 让模型补全品牌语气、落地页文案和配色命名，结果合并进 brand 后整套重生成。
  async function runAiEnrich() {
    if (!result || aiBusy) return;
    setAiBusy(true);
    setAiMsg(null);
    try {
      const r = await window.api.aiEnrich(result, brandOverride);
      if (!r.ok || !r.brand) {
        setAiMsg({ text: r.error || 'AI 这次没给出结果，再点一次试试。', ok: false });
        if (r.code === 'NO_CONFIG') setShowAi(true);
        return;
      }
      setBrandOverride(r.brand);
      setTab('files');
      const notes = r.notes && r.notes.length ? `：${r.notes.join('、')}` : '';
      setAiMsg({ text: `AI 写好了（${r.model || '模型'}）${notes}。整套设计体系已重算，可继续手改 brand.json。`, ok: true });
    } catch {
      setAiMsg({ text: 'AI 调用失败，检查网络后再试一次。', ok: false });
    } finally {
      setAiBusy(false);
    }
  }

  // 让模型为官网/公众号/App 商店各写一套分渠道文案，展示在「AI 文案」页。
  async function runAiCopy() {
    if (!result || copyBusy) return;
    setCopyBusy(true);
    setCopyMsg(null);
    try {
      const r = await window.api.aiCopy(result, brandOverride);
      if (!r.ok || !r.copy) {
        setCopyMsg({ text: r.error || 'AI 这次没给出结果，再点一次试试。', ok: false });
        if (r.code === 'NO_CONFIG') setShowAi(true);
        return;
      }
      setCopyDoc(r.copy);
      const notes = r.notes && r.notes.length ? `：${r.notes.join('、')}` : '';
      setCopyMsg({ text: `AI 写好了（${r.model || '模型'}）${notes}。导出时会带上 copy.json。`, ok: true });
    } catch {
      setCopyMsg({ text: 'AI 调用失败，检查网络后再试一次。', ok: false });
    } finally {
      setCopyBusy(false);
    }
  }

  // 手动换主色：只重算十阶，不重新联网。
  async function changeSeed(seed: string) {
    if (!result) return;
    const r = await window.api.generatePalette(seed);
    if (!r.ok || !r.steps) return;
    setResult({ ...result, primaryLadder: { seed, steps: r.steps } });
  }

  async function captureShot() {
    if (!result) return;
    setCapturing(true);
    try {
      const r = await window.api.captureThumbnail(result.finalUrl || result.url);
      if (r.ok && r.screenshot) setResult((prev) => (prev ? { ...prev, screenshot: r.screenshot } : prev));
    } finally {
      setCapturing(false);
    }
  }

  // 提取完（或从历史打开）没有截图时，自动用内置浏览器补一张，缩略图默认就有。
  useEffect(() => {
    if (!result || result.screenshot || capturing) return;
    void captureShot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-sm">
              风
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-slate-900">网站风格提取器</h1>
              <p className="text-[11px] text-slate-500">粘贴网址，把这家的配色、字体和标志整理成能直接用的文件</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <span className="rounded-full bg-slate-100 px-2 py-0.5">只在你自己电脑上跑</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5">不用登录账号</span>
            {aiConfig && aiConfig.configured ? (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-600 ring-1 ring-indigo-100">
                AI 已接：{aiConfig.model}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5">AI 未启用</span>
            )}
            <button
              type="button"
              onClick={() => setShowAi(true)}
              className="rounded-full border border-slate-200 px-2.5 py-0.5 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              AI 设置
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-6 py-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && runExtract()}
              placeholder="粘贴网址，比如 https://www.shopify.com"
              className="h-11 flex-1 rounded-xl border border-slate-300 px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={() => runExtract()}
              disabled={loading}
              className="h-11 shrink-0 rounded-xl bg-blue-600 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? '正在提取…' : '开始提取'}
            </button>
          </div>

          {loading ? (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{progress?.label || '正在提取…'}</span>
                <span>{progress?.percent ?? 0}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500 ease-out"
                  style={{ width: `${progress?.percent ?? 5}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <div className="flex flex-wrap items-center gap-1.5">
                <span>试试：</span>
                {EXAMPLES.map((e) => (
                  <button
                    key={e.url}
                    type="button"
                    onClick={() => {
                      setUrl(e.url);
                      void runExtract(e.url);
                    }}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                  >
                    {e.name}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400">抓取方式</span>
                <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
                  {MODES.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMode(m.key)}
                      title={m.hint}
                      className={`rounded-md px-2 py-0.5 transition ${
                        mode === m.key
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/70 p-4">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
              !
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-red-700">{error.message}</div>
              <p className="mt-1 text-xs leading-relaxed text-red-600/80">{errorHint(error.code)}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="mt-5 space-y-4">
            {result.blocked && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                这个网站有访问保护（常见的是人机验证），所以只拿到了标志图片，配色和字体可能不全。换个页面或者过一会儿再试，结果通常会好一些。
              </div>
            )}
            {!result.blocked && result.thin && (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-relaxed text-slate-500">
                这个网站能读到的内容比较少（可能是首页很简洁，或者内容主要靠脚本现场生成）。下面的结果能看，但完整度有限。
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
              <div className="space-y-4">
                <SiteCard result={result} onCapture={captureShot} capturing={capturing} />
                <LogoShowcase result={result} />
                <HistoryRail
                  items={history}
                  activeId={activeId}
                  onPick={pickHistory}
                  onRemove={removeHistory}
                  onClear={clearHistory}
                />
              </div>

              <div className="space-y-4">
                <div className="flex w-fit items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                  {(
                    [
                      ['design', '设计体系'],
                      ['files', '设计文件'],
                      ['copy', 'AI 文案'],
                    ] as ['design' | 'files' | 'copy', string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={`rounded-lg px-4 py-1.5 text-xs font-medium transition ${
                        tab === key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {aiMsg && (
                  <div
                    className={`rounded-2xl px-4 py-3 text-[11px] leading-relaxed ${
                      aiMsg.ok ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {aiMsg.text}
                  </div>
                )}

                {tab === 'design' ? (
                  <>
                    <PalettePanel result={result} onSeedChange={changeSeed} />
                    <FontPanel result={result} />
                  </>
                ) : tab === 'files' ? (
                  <FilesPanel
                    result={result}
                    brandOverride={brandOverride}
                    onApplyBrand={(brand) => {
                      setBrandOverride(brand);
                      setAiMsg(null);
                    }}
                    onResetBrand={() => {
                      setBrandOverride(null);
                      setAiMsg(null);
                    }}
                    aiConfigured={Boolean(aiConfig && aiConfig.configured)}
                    aiBusy={aiBusy}
                    onAiEnrich={runAiEnrich}
                    onOpenAiSettings={() => setShowAi(true)}
                  />
                ) : (
                  <CopyPanel
                    copy={copyDoc}
                    busy={copyBusy}
                    msg={copyMsg}
                    aiConfigured={Boolean(aiConfig && aiConfig.configured)}
                    onGenerate={runAiCopy}
                    onOpenAiSettings={() => setShowAi(true)}
                  />
                )}

                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <button
                    type="button"
                    onClick={runExport}
                    disabled={exporting}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
                  >
                    {exporting ? '正在保存…' : '导出整套设计体系'}
                  </button>
                  {aiConfig && aiConfig.configured ? (
                    <button
                      type="button"
                      onClick={runAiEnrich}
                      disabled={aiBusy}
                      className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:from-indigo-600 hover:to-blue-700 disabled:opacity-60"
                    >
                      {aiBusy ? 'AI 正在写…' : 'AI 补全文案'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAi(true)}
                      className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 transition hover:bg-slate-50"
                    >
                      接入 AI（可选）
                    </button>
                  )}
                  <span className="text-[11px] text-slate-400">
                    system/（18 个文件）+ brand.json / DESIGN.md / guide.md + logos / imagery / fonts / prefetch
                    {copyDoc ? ' + copy.json' : ''}
                    {brandOverride ? '；当前用的是你改过的 brand.json' : ''}
                  </span>
                  {exportMsg && (
                    <span
                      className={`w-full break-all text-[11px] ${exportMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}
                    >
                      {exportMsg.text}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!result && (
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8">
              <h2 className="text-sm font-semibold text-slate-900">三步就能拿到一套现成的风格</h2>
              <ol className="mt-4 space-y-3">
                {[
                  ['粘贴网址', '把想参考的网站地址粘到上面的框里，只写域名也行。'],
                  ['等它自己整理', '工具会打开这个网页，把颜色、字体、标志挑出来，通常几秒钟。'],
                  ['导出拿走', '觉得合适就导出成文件，配色和字体可以直接放进自己的项目。'],
                ].map(([title, desc], i) => (
                  <li key={title} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-600">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-xs font-medium text-slate-800">{title}</div>
                      <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{desc}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
                说明：把样式直接写在网页里的站，读源码就够了；整站靠脚本现场生成的，把「抓取方式」切到「浏览器渲染」能拿到更多内容（也会更慢）。
                本工具只读公开页面，不会登录、也不会抓私密内容。
              </div>
            </section>

            <HistoryRail
              items={history}
              activeId={activeId}
              onPick={pickHistory}
              onRemove={removeHistory}
              onClear={clearHistory}
            />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 py-3 text-center text-[11px] text-slate-400">
        颜色、字体、标志全部在本机整理，结果只存在这台电脑上；AI 可选，接口和 Key 都由你自己填
      </footer>

      {showAi && (
        <AiSettings
          config={aiConfig}
          onClose={() => setShowAi(false)}
          onSaved={(config) => {
            setAiConfig(config);
            setAiMsg(null);
          }}
        />
      )}
    </div>
  );
}
