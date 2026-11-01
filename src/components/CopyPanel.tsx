import { useState } from 'react';
import type { CopyDoc, CopySection } from '../global';
import { copyText } from '../lib/ui';

interface Props {
  copy: CopyDoc | null;
  busy: boolean;
  msg: { text: string; ok: boolean } | null;
  aiConfigured: boolean;
  onGenerate: () => void;
  onOpenAiSettings: () => void;
}

/** 单条文案：内容 + 单独复制按钮。 */
function Field({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="group flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div
          className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-700"
        >
          {value}
        </div>
      </div>
      <button
        type="button"
        onClick={async () => {
          if (await copyText(value)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
        className="mt-0.5 shrink-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
      >
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  );
}

/** 把一个渠道的文案拼成一段纯文本，方便整块贴走。 */
function channelText(doc: CopyDoc, id: 'landing' | 'wechat' | 'app'): string {
  const labels: Record<string, string> = {
    heroTitle: '大标题',
    heroSubtitle: '副标题',
    cta: '按钮文字',
    ctaNote: '按钮辅助句',
    excerpt: '摘要',
    opening: '正文开头',
    closing: '结尾引导',
    oneLiner: '一句话介绍',
    storeTitle: '商店标题',
    storeSubtitle: '商店副标题',
    storeDescription: '商店描述',
    whatsNew: '版本更新',
  };
  const lines: string[] = [];
  const push = (key: string, value?: string) => {
    if (value) lines.push(`${labels[key] || key}：${value}`);
  };
  const block = doc[id] as Record<string, unknown> | undefined;
  if (!block) return '';
  if (id === 'landing') {
    push('heroTitle', doc.landing?.heroTitle);
    push('heroSubtitle', doc.landing?.heroSubtitle);
    (doc.landing?.sections || []).forEach((s: CopySection, i) => {
      if (s.title || s.body) lines.push(`卖点${i + 1}：${s.title} — ${s.body}`);
    });
    push('cta', doc.landing?.cta);
    push('ctaNote', doc.landing?.ctaNote);
  } else if (id === 'wechat') {
    (doc.wechat?.titles || []).forEach((t, i) => lines.push(`标题${i + 1}：${t}`));
    push('excerpt', doc.wechat?.excerpt);
    push('opening', doc.wechat?.opening);
    push('closing', doc.wechat?.closing);
  } else {
    push('oneLiner', doc.app?.oneLiner);
    push('storeTitle', doc.app?.storeTitle);
    push('storeSubtitle', doc.app?.storeSubtitle);
    push('storeDescription', doc.app?.storeDescription);
    push('whatsNew', doc.app?.whatsNew);
  }
  return lines.join('\n');
}

const CHANNEL_META: { id: 'landing' | 'wechat' | 'app'; label: string; brief: string }[] = [
  { id: 'landing', label: '官网首页', brief: '面向第一次来的访客，说清价值，落到一个明确的按钮上' },
  { id: 'wechat', label: '公众号文章', brief: '面向已关注的人，从场景切入讲展开，结尾自然引导' },
  { id: 'app', label: 'App 商店', brief: '一句话说清价值，描述按「功能 → 适合谁 → 亮点」组织' },
];

export default function CopyPanel({ copy, busy, msg, aiConfigured, onGenerate, onOpenAiSettings }: Props) {
  if (!copy) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
          <h3 className="text-sm font-semibold text-slate-900">让 AI 为三个渠道各写一套文案</h3>
          <p className="mx-auto mt-2 max-w-[460px] text-xs leading-relaxed text-slate-500">
            读完抓到的品牌语气和信息点后，分别为「官网首页 / 公众号文章 / App
            商店」写可直接使用的文案。三个渠道语气有区分，写完可以逐条复制，导出时也会带上 copy.json。
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            {aiConfigured ? (
              <button
                type="button"
                onClick={onGenerate}
                disabled={busy}
                className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:from-indigo-600 hover:to-blue-700 disabled:opacity-60"
              >
                {busy ? 'AI 正在写…' : '生成分渠道文案'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAiSettings}
                className="rounded-xl border border-dashed border-slate-300 px-5 py-2 text-sm text-slate-500 transition hover:bg-white"
              >
                先接入 AI（右上角「AI 设置」里填 Key）
              </button>
            )}
          </div>
          {msg && (
            <p className={`mt-4 text-[11px] ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-600 ring-1 ring-emerald-100">
            三套文案已生成
          </span>
          {copy.brand && <span>品牌：{copy.brand}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={async () => {
              const all = CHANNEL_META.map((c) => `【${c.label}】\n${channelText(copy, c.id)}`)
                .filter((t) => !t.endsWith('】'))
                .join('\n\n');
              await copyText(all);
            }}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            复制全部
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={busy}
            className="rounded-md bg-gradient-to-r from-indigo-500 to-blue-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:from-indigo-600 hover:to-blue-700 disabled:opacity-50"
          >
            {busy ? 'AI 正在写…' : '重新生成'}
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`rounded-2xl px-4 py-3 text-[11px] leading-relaxed ${
            msg.ok ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.text}
        </div>
      )}

      {CHANNEL_META.map((channel) => {
        const text = channelText(copy, channel.id);
        if (!text) return null;
        return (
          <div key={channel.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">{channel.label}</h4>
                <p className="mt-0.5 text-[11px] text-slate-400">{channel.brief}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await copyText(`【${channel.label}】\n${text}`);
                }}
                className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                复制此渠道
              </button>
            </div>

            <div className="space-y-2">
              {channel.id === 'landing' && (
                <>
                  <Field label="大标题" value={copy.landing?.heroTitle || ''} />
                  <Field label="副标题" value={copy.landing?.heroSubtitle || ''} />
                  {(copy.landing?.sections || []).map((s, i) => (
                    <Field key={i} label={`卖点 ${i + 1}`} value={s.body ? `${s.title} — ${s.body}` : s.title} />
                  ))}
                  <Field
                    label="按钮"
                    value={[copy.landing?.cta, copy.landing?.ctaNote].filter(Boolean).join('（') + (copy.landing?.cta && copy.landing?.ctaNote ? '）' : '')}
                  />
                </>
              )}
              {channel.id === 'wechat' && (
                <>
                  {(copy.wechat?.titles || []).map((t, i) => (
                    <Field key={i} label={`备选标题 ${i + 1}`} value={t} />
                  ))}
                  <Field label="摘要" value={copy.wechat?.excerpt || ''} />
                  <Field label="正文开头" value={copy.wechat?.opening || ''} />
                  <Field label="结尾引导" value={copy.wechat?.closing || ''} />
                </>
              )}
              {channel.id === 'app' && (
                <>
                  <Field label="一句话介绍" value={copy.app?.oneLiner || ''} />
                  <Field label="商店标题" value={copy.app?.storeTitle || ''} />
                  <Field label="商店副标题" value={copy.app?.storeSubtitle || ''} />
                  <Field label="商店描述" value={copy.app?.storeDescription || ''} />
                  <Field label="版本更新" value={copy.app?.whatsNew || ''} />
                </>
              )}
            </div>
          </div>
        );
      })}

      <p className="text-[11px] text-slate-400">
        点「导出整套设计体系」时，这套文案会作为 copy.json 一起保存，可以留给开发或运营直接取用。
      </p>
    </section>
  );
}
