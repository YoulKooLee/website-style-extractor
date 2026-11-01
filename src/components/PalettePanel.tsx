import { useState } from 'react';
import type { ExtractResult } from '../global';
import { copyText, readableOn } from '../lib/ui';

interface Props {
  result: ExtractResult;
  onSeedChange?: (seed: string) => Promise<void> | void;
}

export default function PalettePanel({ result, onSeedChange }: Props) {
  const [copied, setCopied] = useState('');
  const [busySeed, setBusySeed] = useState('');

  const ladder = result.primaryLadder;
  const steps = ladder?.steps || [];
  const seed = ladder?.seed || '';
  const others = (result.colors || []).filter((c) => c.hex !== seed);

  async function copy(hex: string) {
    const ok = await copyText(hex);
    if (ok) {
      setCopied(hex);
      setTimeout(() => setCopied(''), 1200);
    }
  }

  async function copyAll() {
    const text = steps.map((hex, i) => `--brand-${i}: ${hex};`).join('\n');
    const ok = await copyText(text);
    if (ok) {
      setCopied('__all__');
      setTimeout(() => setCopied(''), 1500);
    }
  }

  async function applySeed(next: string) {
    if (!onSeedChange) return;
    const hex = next.toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(hex) || hex === seed) return;
    setBusySeed(hex);
    try {
      await onSeedChange(hex);
    } finally {
      setBusySeed('');
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">配色</h2>
        <div className="flex flex-wrap items-center gap-2">
          {seed && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 py-1 pl-1 pr-2.5 text-[11px] text-slate-600 ring-1 ring-slate-200">
              <span className="h-4 w-4 rounded-full border border-black/5" style={{ backgroundColor: seed }} />
              主色 {seed}
            </span>
          )}
          {onSeedChange && (
            <label
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
              title="手动选一个颜色当主色，色阶会立刻重算"
            >
              <input
                type="color"
                value={seed || '#4e6ef2'}
                onChange={(e) => applySeed(e.target.value)}
                className="h-4 w-5 cursor-pointer rounded border border-slate-300 bg-white p-0"
                title={seed || ''}
              />
              {busySeed ? '正在重算…' : '换个主色'}
            </label>
          )}
          <button
            type="button"
            onClick={copyAll}
            className="rounded-md px-2 py-1 text-[11px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            {copied === '__all__' ? '已复制全部' : '复制全部色值'}
          </button>
        </div>
      </div>

      {steps.length > 0 ? (
        <>
          <div className="grid grid-cols-10 gap-1.5">
            {steps.map((hex, i) => (
              <button
                key={`${hex}-${i}`}
                type="button"
                onClick={() => copy(hex)}
                title={`点击复制 ${hex}`}
                className="group text-left"
              >
                <span
                  className={`block h-14 w-full rounded-lg border border-slate-900/10 transition group-hover:-translate-y-0.5 group-hover:shadow-md ${
                    i === 5 ? 'ring-2 ring-slate-400 ring-offset-1' : ''
                  }`}
                  style={{ backgroundColor: hex }}
                />
                <span className="mt-1 block truncate text-center text-[10px] text-slate-500">
                  {copied === hex ? '已复制' : hex}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] text-slate-400">
            最中间带圈的是当前主色，左右两侧是自动展开的浅色和深色。点色块复制色值，想换主色用右上角「换个主色」。
          </p>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="mb-2 text-[11px] font-medium text-slate-500">实际用起来是什么样</div>
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="text-sm font-semibold" style={{ color: steps[8] }}>
                这是一个示例标题
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                用这家网站的颜色直接做出来的效果，方便判断这套配色能不能用在自己的页面上。
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-md px-3 py-1.5 text-xs font-medium shadow-sm"
                  style={{ backgroundColor: steps[5], color: readableOn(steps[5]) }}
                >
                  主要按钮
                </span>
                <span
                  className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium"
                  style={{ borderColor: steps[3], color: steps[6] }}
                >
                  次要按钮
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: steps[1], color: readableOn(steps[1]) }}
                >
                  标签
                </span>
                <span className="text-xs underline underline-offset-2" style={{ color: steps[6] }}>
                  文字链接
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-400">没有识别到可用主色。这个网站可能没有写颜色样式，或者本身是黑白的。</p>
      )}

      {others.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-xs font-medium text-slate-500">
            页面上出现较多的其他颜色
            {onSeedChange && <span className="ml-1.5 text-[10px] font-normal text-slate-400">（鼠标移上去可以设为主色）</span>}
          </h3>
          <div className="flex flex-wrap gap-2">
            {others.slice(0, 14).map((c) => (
              <div key={c.hex} className="group relative w-16">
                <button
                  type="button"
                  onClick={() => copy(c.hex)}
                  title={`点击复制 ${c.hex}`}
                  className="flex w-full flex-col items-center gap-1"
                >
                  <span
                    className="h-9 w-full rounded-md border border-slate-900/10 transition group-hover:-translate-y-0.5 group-hover:shadow-md"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="w-full truncate text-center text-[10px] text-slate-500">
                    {copied === c.hex ? '已复制' : c.hex}
                  </span>
                </button>
                {onSeedChange && (
                  <button
                    type="button"
                    onClick={() => applySeed(c.hex)}
                    title="设为主色"
                    className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white shadow group-hover:flex hover:bg-blue-600"
                  >
                    {busySeed === c.hex ? '…' : '★'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
