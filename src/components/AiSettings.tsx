import { useEffect, useState } from 'react';
import type { AiConfig, AiProvider } from '../global';

interface Props {
  config: AiConfig | null;
  onClose: () => void;
  onSaved: (config: AiConfig) => void;
}

interface FormState {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

const EMPTY_FORM: FormState = { provider: 'deepseek', baseUrl: '', model: '', apiKey: '' };

export default function AiSettings({ config, onClose, onSaved }: Props) {
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean; detail?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    window.api
      .aiProviders()
      .then((r) => {
        if (alive && r.ok) setProviders(r.providers);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!config) return;
    setForm({
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: '',
    });
  }, [config]);

  function pickProvider(id: string) {
    const preset = providers.find((p) => p.id === id);
    setForm((prev) => ({
      ...prev,
      provider: id,
      // 已经有自定义地址时不覆盖，只有换服务商才带出预设
      baseUrl: preset && preset.baseUrl ? preset.baseUrl : prev.baseUrl,
      model: preset && preset.model ? preset.model : prev.model,
    }));
    setMsg(null);
  }

  async function test() {
    setTesting(true);
    setMsg(null);
    try {
      const r = await window.api.aiTest({ baseUrl: form.baseUrl, model: form.model, apiKey: form.apiKey });
      if (r.ok) {
        const tokens = r.usage && r.usage.total_tokens ? `，这次用了 ${r.usage.total_tokens} 个 token` : '';
        setMsg({ text: `连通了：${r.model || form.model} 回了「${r.reply || 'OK'}」${tokens}`, ok: true });
      } else {
        setMsg({ text: r.error || '连接失败', ok: false, detail: r.detail });
      }
    } catch {
      setMsg({ text: '连接失败，检查网络后重试。', ok: false });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const patch: Record<string, string> = {
        provider: form.provider,
        baseUrl: form.baseUrl,
        model: form.model,
      };
      // Key 留空表示「不动已保存的那把」，避免每次打开设置框都得重新粘一遍。
      if (form.apiKey.trim()) patch.apiKey = form.apiKey.trim();
      const r = await window.api.aiConfigSave(patch);
      if (r.ok && r.config) {
        onSaved(r.config);
        setForm((prev) => ({ ...prev, apiKey: '' }));
        setMsg({ text: '已保存，现在可以用「AI 补全文案」了。', ok: true });
      } else {
        setMsg({ text: r.error || '保存失败', ok: false });
      }
    } catch {
      setMsg({ text: '保存失败，请再试一次。', ok: false });
    } finally {
      setSaving(false);
    }
  }

  async function clearAll() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await window.api.aiConfigClear();
      if (r.ok && r.config) {
        onSaved(r.config);
        setForm((prev) => ({ ...prev, apiKey: '' }));
        setMsg({ text: '已清除，本机不再保存任何 Key。', ok: true });
      } else {
        setMsg({ text: r.error || '清除失败', ok: false });
      }
    } finally {
      setSaving(false);
    }
  }

  const encryptionText =
    config && config.hasKey
      ? config.encryption === 'system'
        ? '已用系统凭据加密（Windows 上是 DPAPI）'
        : '这台机器没有可用的凭据服务，Key 以 base64 存放（只是不显示明文）'
      : '还没有保存 Key';

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/30 px-4 py-10 backdrop-blur-sm">
      <div className="w-full max-w-[600px] rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">AI 设置</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              填你自己申请的接口就行，本工具不自带账号、也不代付费用。不填也能正常用，只是没有 AI 能力。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            关闭
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <div className="mb-1.5 text-[11px] font-medium text-slate-600">服务商</div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickProvider(p.id)}
                  title={p.note}
                  className={`rounded-lg border px-2 py-1.5 text-[11px] transition ${
                    form.provider === p.id
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
              {providers.find((p) => p.id === form.provider)?.note || '选一个服务商，地址和模型会自动填好，也可以手动改。'}
            </p>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-600">接口地址（Base URL）</span>
            <input
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://api.deepseek.com/v1"
              spellCheck={false}
              className="h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-[12px] text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <span className="mt-1 block text-[10px] text-slate-400">
              要兼容 OpenAI 的 /chat/completions 格式；多数服务商地址以 /v1 结尾。
            </span>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-600">模型名</span>
              <input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="deepseek-chat"
                spellCheck={false}
                className="h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-[12px] text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-600">
                API Key
                {config && config.hasKey && (
                  <span className="ml-1 font-normal text-slate-400">已存 {config.keyMasked}</span>
                )}
              </span>
              <div className="relative">
                <input
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  type={showKey ? 'text' : 'password'}
                  placeholder={config && config.hasKey ? '留空表示不修改' : 'sk-...'}
                  spellCheck={false}
                  autoComplete="off"
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 pr-12 font-mono text-[12px] text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-1.5 top-1 rounded-md px-1.5 py-1 text-[10px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  {showKey ? '隐藏' : '显示'}
                </button>
              </div>
            </label>
          </div>

          <div className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] leading-relaxed text-slate-500">
            <div className="font-medium text-slate-600">Key 怎么存的</div>
            <div className="mt-0.5">
              {encryptionText}。文件在系统应用数据目录下的 ai-config.json，界面永远只显示尾号；
              只有你点「测试连接」或「AI 补全文案」时，才会把这个 Key 发给你自己填的那个接口。
            </div>
          </div>

          {msg && (
            <div
              className={`rounded-lg px-3 py-2 text-[11px] leading-relaxed ${
                msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}
            >
              <div>{msg.text}</div>
              {msg.detail && <div className="mt-1 break-all font-mono text-[10px] opacity-70">{msg.detail}</div>}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={test}
            disabled={testing || saving}
            className="rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {testing ? '正在测试…' : '测试连接'}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || testing}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? '正在保存…' : '保存'}
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={saving || testing}
            className="rounded-xl px-3 py-2 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            清除配置
          </button>
          <span className="ml-auto text-[10px] text-slate-400">
            也可以用本机 Ollama，完全离线不花钱
          </span>
        </div>
      </div>
    </div>
  );
}
