'use strict';

/**
 * 从 CSS 里猜两件「版式口味」的事：圆角多大、描边多粗。
 * 原版引擎的 Brand.layout 需要它（只有 borderRadius 会进 seed，其余进文档），
 * 这里用出现次数最多的值当结论，比取第一条更稳。
 */

function topValue(map) {
  let best = null;
  let bestCount = -1;
  for (const [value, count] of map.entries()) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function collectLayoutHints(css) {
  const radiusCounts = new Map();
  const widthCounts = new Map();
  const text = String(css || '');

  for (const m of text.matchAll(/border-radius\s*:\s*([^;}{!]+)/gi)) {
    const raw = m[1].trim();
    // 只认单一像素值：12px / 0.5rem / 9999px 这类，多值（12px 4px）跳过。
    const px = /^(\d+(?:\.\d+)?)px$/.exec(raw);
    const rem = /^(\d+(?:\.\d+)?)rem$/.exec(raw);
    let value = null;
    if (px) value = Math.round(Number(px[1]));
    else if (rem) value = Math.round(Number(rem[1]) * 16);
    if (value === null) continue;
    if (value > 40) value = 40; // 9999px 这类"全圆"归到 40，避免算成胶囊
    radiusCounts.set(value, (radiusCounts.get(value) || 0) + 1);
  }

  for (const m of text.matchAll(/border(?:-top|-right|-bottom|-left)?(?:-width)?\s*:\s*([^;}{!]+)/gi)) {
    const px = /(\d+(?:\.\d+)?)px/.exec(m[1]);
    if (!px) continue;
    const value = Math.round(Number(px[1]));
    if (value < 1 || value > 6) continue;
    widthCounts.set(value, (widthCounts.get(value) || 0) + 1);
  }

  const radius = topValue(radiusCounts);
  const borderWidth = topValue(widthCounts);

  return {
    radius: radius === null ? 6 : radius,
    borderWidth: borderWidth === null ? 1 : borderWidth,
    radiusSamples: [...radiusCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({ value, count })),
  };
}

module.exports = { collectLayoutHints };
