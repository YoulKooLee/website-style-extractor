import type { HistoryItem } from '../global';
import { formatSavedAt, checkerBackground } from '../lib/ui';

interface Props {
  items: HistoryItem[];
  activeId: string;
  onPick: (item: HistoryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export default function HistoryRail({ items, activeId, onPick, onRemove, onClear }: Props) {
  return (
    <section className="self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">最近提取</h2>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md px-1.5 py-0.5 text-[11px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            清空
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="px-1 py-3 text-[11px] leading-relaxed text-slate-400">
          还没有记录。提取成功的网站会按时间排在这里，下次可以直接点回来查看，不用联网。
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <li key={item.id}>
                <div
                  className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${
                    active ? 'bg-blue-50 ring-1 ring-blue-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onPick(item)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    title={item.finalUrl || item.url}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-100"
                      style={checkerBackground}
                    >
                      {item.icon ? (
                        <img src={item.icon} alt="" className="max-h-5 max-w-5 object-contain" />
                      ) : (
                        <span
                          className="h-3 w-3 rounded-sm"
                          style={{ backgroundColor: item.primary || '#cbd5e1' }}
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-slate-700">
                        {item.siteName || item.host}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400">
                        {item.host} · {formatSavedAt(item.savedAt)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    title="删除这条记录"
                    className="shrink-0 rounded px-1 text-xs text-slate-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
