'use strict';

// 忠实移植 @ant-design/colors generate() 的 HSV 十阶算法（无外部依赖）。
// 输入一个种子色，返回 10 阶：上 5 阶浅、index 5 ≈ 种子、下 4 阶深。

const hueStep = 2;
const saturationStep = 0.16;
const saturationStep2 = 0.05;
const brightnessStep1 = 0.05;
const brightnessStep2 = 0.15;
const lightColorCount = 5;
const darkColorCount = 4;

function clampHex(c) {
  return Math.max(0, Math.min(255, Math.round(c)));
}

function parseHex(input) {
  let hex = (input || '').trim().replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const num = parseInt(hex, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex({ r, g, b }) {
  const to = (c) => clampHex(c).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function rgbToHsv({ r, g, b }) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (d !== 0) {
    if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
  }
  return { h, s, v };
}

function hsvToRgb({ h, s, v }) {
  const hh = (h / 360) * 6;
  const i = Math.floor(hh);
  const f = hh - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const mod = i % 6;
  const r = [v, q, p, p, t, v][mod];
  const g = [t, v, v, q, p, p][mod];
  const b = [p, p, t, v, v, q][mod];
  return { r: r * 255, g: g * 255, b: b * 255 };
}

function getHue(hsv, i, light) {
  let hue;
  if (hsv.h >= 60 && hsv.h <= 240) {
    hue = light ? hsv.h - hueStep * i : hsv.h + hueStep * i;
  } else {
    hue = light ? hsv.h + hueStep * i : hsv.h - hueStep * i;
  }
  if (hue < 0) hue += 360;
  else if (hue >= 360) hue -= 360;
  return hue;
}

function getSaturation(hsv, i, light) {
  if (hsv.h === 0 && hsv.s === 0) return hsv.s;
  let saturation;
  if (light) saturation = hsv.s - saturationStep * i;
  else if (i === darkColorCount) saturation = hsv.s + saturationStep;
  else saturation = hsv.s + saturationStep2 * i;
  if (saturation > 1) saturation = 1;
  if (light && i === lightColorCount && saturation > 0.1) saturation = 0.1;
  if (saturation < 0.06) saturation = 0.06;
  return Number(saturation.toFixed(2));
}

function getValue(hsv, i, light) {
  let value;
  if (light) value = hsv.v + brightnessStep1 * i;
  else value = hsv.v - brightnessStep2 * i;
  if (value > 1) value = 1;
  return Number(value.toFixed(2));
}

function generate(baseColor) {
  const patterns = [];
  const baseHsv = rgbToHsv(parseHex(baseColor));
  for (let i = lightColorCount; i > 0; i -= 1) {
    patterns.push(rgbToHex(hsvToRgb({ h: getHue(baseHsv, i, true), s: getSaturation(baseHsv, i, true), v: getValue(baseHsv, i, true) })));
  }
  patterns.push(rgbToHex(hsvToRgb(baseHsv)));
  for (let i = 1; i <= darkColorCount; i += 1) {
    patterns.push(rgbToHex(hsvToRgb({ h: getHue(baseHsv, i, false), s: getSaturation(baseHsv, i, false), v: getValue(baseHsv, i, false) })));
  }
  return patterns;
}

module.exports = { generate, parseHex, rgbToHex };
