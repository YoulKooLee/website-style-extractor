"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// vendor/od-engine/entry.ts
var entry_exports = {};
__export(entry_exports, {
  CSS_VAR_PREFIX: () => CSS_VAR_PREFIX,
  buildBrandSystem: () => buildBrandSystem,
  defaultSeed: () => defaultSeed,
  defaultThemeAlgorithm: () => defaultThemeAlgorithm,
  deriveTokens: () => deriveTokens,
  flattenTokens: () => flattenTokens,
  renderArtifact: () => renderArtifact,
  renderArtifactGallery: () => renderArtifactGallery,
  renderKitPage: () => renderKitPage,
  seedFromBrand: () => seedFromBrand,
  seedFromMaterial: () => seedFromMaterial,
  slugify: () => slugify,
  tokensToCssVars: () => tokensToCssVars,
  tokensToJson: () => tokensToJson,
  tokensToThemeJson: () => tokensToThemeJson,
  varRef: () => varRef,
  writeBrandSystem: () => writeBrandSystem
});
module.exports = __toCommonJS(entry_exports);

// vendor/od-engine/engine/build.ts
var import_node_fs = __toESM(require("node:fs"));
var import_node_path = __toESM(require("node:path"));

// vendor/od-engine/html-injection-points.ts
var HTML_RAW_TEXT_ELEMENTS = [
  "script",
  "style",
  "textarea",
  "title",
  "iframe",
  "noembed",
  "noframes",
  "noscript",
  "plaintext",
  "xmp"
];
function asciiLower(value2) {
  return value2.replace(/[A-Z]/g, (c) => c.toLowerCase());
}
function endOfComment(html, from) {
  let i = from + 4;
  if (html.startsWith(">", i)) return i + 1;
  if (html.startsWith("->", i)) return i + 2;
  while (i < html.length) {
    const dash = html.indexOf("--", i);
    if (dash < 0) return -1;
    let j = dash;
    while (html.charCodeAt(j) === 45) j += 1;
    if (html.startsWith(">", j)) return j + 1;
    if (html.startsWith("!>", j)) return j + 2;
    i = j > dash ? j : dash + 2;
  }
  return -1;
}
function scanTag(html, from) {
  const attrs = /* @__PURE__ */ new Map();
  const unterminated = { end: -1, selfClosing: false, attrs };
  let i = from;
  let selfClosing = false;
  while (i < html.length) {
    const ch = html.charCodeAt(i);
    if (isHtmlWhitespace(ch)) {
      selfClosing = false;
      i += 1;
      continue;
    }
    if (ch === 47) {
      selfClosing = true;
      i += 1;
      continue;
    }
    if (ch === 62) return { end: i, selfClosing, attrs };
    selfClosing = false;
    const nameStart = i;
    if (html.charCodeAt(i) === 61) i += 1;
    while (i < html.length) {
      const c = html.charCodeAt(i);
      if (isHtmlWhitespace(c) || c === 47 || c === 61 || c === 62) break;
      i += 1;
    }
    const name = asciiLower(html.slice(nameStart, i)).replace(/\0/g, "\uFFFD");
    while (i < html.length && isHtmlWhitespace(html.charCodeAt(i))) i += 1;
    if (i >= html.length) return unterminated;
    let value2 = "";
    if (html.charCodeAt(i) === 61) {
      i += 1;
      while (i < html.length && isHtmlWhitespace(html.charCodeAt(i))) i += 1;
      if (i >= html.length) return unterminated;
      const quote = html.charCodeAt(i);
      if (quote === 34 || quote === 39) {
        const close = html.indexOf(String.fromCharCode(quote), i + 1);
        if (close < 0) return unterminated;
        value2 = html.slice(i + 1, close);
        i = close + 1;
      } else if (quote === 62) {
        if (name && !attrs.has(name)) attrs.set(name, "");
        return { end: i, selfClosing: false, attrs };
      } else {
        const valueStart = i;
        while (i < html.length) {
          const c = html.charCodeAt(i);
          if (isHtmlWhitespace(c) || c === 62) break;
          i += 1;
        }
        value2 = html.slice(valueStart, i);
      }
    }
    if (name && !attrs.has(name)) attrs.set(name, value2);
  }
  return unterminated;
}
function endOfTag(html, from) {
  return scanTag(html, from).end;
}
function isHtmlWhitespace(code) {
  return code === 9 || code === 10 || code === 12 || code === 13 || code === 32;
}
function isEndTagBoundary(code) {
  return isHtmlWhitespace(code) || code === 47 || code === 62;
}
function findRawTextClose(lowerHtml, tagName, from) {
  if (tagName === "plaintext") return -1;
  if (tagName === "script") return findScriptClose(lowerHtml, from);
  const needle = `</${tagName}`;
  let at = lowerHtml.indexOf(needle, from);
  while (at >= 0) {
    if (isEndTagBoundary(lowerHtml.charCodeAt(at + needle.length))) return at;
    at = lowerHtml.indexOf(needle, at + needle.length);
  }
  return -1;
}
function findScriptClose(lowerHtml, from) {
  let i = from;
  let escaped = false;
  let doubleEscaped = false;
  while (i < lowerHtml.length) {
    if (!escaped && lowerHtml.startsWith("<!--", i)) {
      escaped = true;
      i += 4;
      continue;
    }
    if (escaped && lowerHtml.startsWith("-->", i)) {
      escaped = false;
      doubleEscaped = false;
      i += 3;
      continue;
    }
    if (escaped && !doubleEscaped && lowerHtml.startsWith("<script", i) && isEndTagBoundary(lowerHtml.charCodeAt(i + 7))) {
      doubleEscaped = true;
      i += 7;
      continue;
    }
    if (lowerHtml.startsWith("</script", i) && isEndTagBoundary(lowerHtml.charCodeAt(i + 8))) {
      if (!doubleEscaped) return i;
      doubleEscaped = false;
      i += 8;
      continue;
    }
    i += 1;
  }
  return -1;
}
function skipTemplateContent(html, lowerHtml, from) {
  const tagOpen = /<(\/?)([a-z][^\t\n\f\r \/>]*)/iy;
  const modes = [newSelectModeState()];
  let i = from;
  while (i < html.length && modes.length > 0) {
    if (html.charCodeAt(i) !== 60) {
      i += 1;
      continue;
    }
    if (html.startsWith("<!--", i)) {
      const end = endOfComment(html, i);
      if (end < 0) return -1;
      i = end;
      continue;
    }
    if (html.startsWith("</", i) && !/[a-z]/i.test(html.charAt(i + 2))) {
      const end = html.indexOf(">", i + 2);
      if (end < 0) return -1;
      i = end + 1;
      continue;
    }
    if (html.startsWith("<!", i) || html.startsWith("<?", i)) {
      const end = html.indexOf(">", i + 2);
      if (end < 0) return -1;
      i = end + 1;
      continue;
    }
    tagOpen.lastIndex = i;
    const open = tagOpen.exec(html);
    if (!open) {
      i += 1;
      continue;
    }
    const tag2 = scanTag(html, i + open[0].length);
    const tagEnd = tag2.end;
    if (tagEnd < 0) return -1;
    const tagName = (open[2] ?? "").toLowerCase();
    const selectMode = modes[modes.length - 1];
    if (!observeSelectMode(selectMode, tagName, !!open[1], tag2.selfClosing)) return -1;
    if (!open[1] && HTML_RAW_TEXT_ELEMENTS.includes(tagName)) {
      const contentEnd = findRawTextClose(lowerHtml, tagName, tagEnd + 1);
      if (contentEnd < 0) return -1;
      i = contentEnd;
      continue;
    }
    if (!open[1] && !selectMode.inSelect && (tagName === "svg" || tagName === "math") && !tag2.selfClosing) {
      const contentEnd = skipForeignContent(html, lowerHtml, tagName, tagEnd + 1);
      if (contentEnd < 0) return -1;
      i = contentEnd;
      continue;
    }
    if (tagName === "template") {
      if (open[1]) {
        modes.pop();
        if (modes.length === 0) return tagEnd + 1;
      } else if (!tag2.selfClosing) {
        modes.push(newSelectModeState());
      }
    }
    i = tagEnd + 1;
  }
  return -1;
}
function newSelectModeState() {
  return { inSelect: false, tableDepth: 0 };
}
function observeSelectMode(state, tagName, isEndTag, selfClosing) {
  const wasInSelect = state.inSelect;
  const tableDepthBefore = state.tableDepth;
  let determinate = true;
  if (tagName === "select") state.inSelect = !isEndTag && !state.inSelect;
  else if (state.inSelect && !isEndTag && SELECT_CLOSING_START_TAGS.includes(tagName)) {
    state.inSelect = false;
  } else if (state.inSelect && tableDepthBefore > 0 && SELECT_IN_TABLE_CLOSING_TAGS.includes(tagName)) {
    determinate = false;
  }
  if (!(wasInSelect && tableDepthBefore === 0)) {
    if (!isEndTag && tagName === "table" && !selfClosing) state.tableDepth += 1;
    else if (isEndTag && tagName === "table" && state.tableDepth > 0) state.tableDepth -= 1;
  }
  return determinate;
}
var REPROCESSED_END_TAGS = ["p", "br"];
var SELECT_CLOSING_START_TAGS = ["input", "keygen", "textarea"];
var SELECT_IN_TABLE_CLOSING_TAGS = [
  "caption",
  "table",
  "tbody",
  "tfoot",
  "thead",
  "tr",
  "td",
  "th"
];
var PREVIEW_VOID_ELEMENTS = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr"
];
var HTML_INTEGRATION_POINTS = ["foreignobject", "desc", "title"];
var MATHML_TEXT_INTEGRATION_POINTS = ["mi", "mo", "mn", "ms", "mtext"];
var MATHML_TEXT_INTEGRATION_EXCEPTIONS = ["mglyph", "malignmark"];
var FOREIGN_BREAKOUT_TAGS = [
  "b",
  "big",
  "blockquote",
  "body",
  "br",
  "center",
  "code",
  "dd",
  "div",
  "dl",
  "dt",
  "em",
  "embed",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "hr",
  "i",
  "img",
  "li",
  "listing",
  "menu",
  "meta",
  "nobr",
  "ol",
  "p",
  "pre",
  "ruby",
  "s",
  "small",
  "span",
  "strong",
  "strike",
  "sub",
  "sup",
  "table",
  "tt",
  "u",
  "ul",
  "var"
];
var HTML_ANNOTATION_ENCODINGS = ["text/html", "application/xhtml+xml"];
var ATTRIBUTE_NAMED_REFERENCES = /* @__PURE__ */ new Map([
  ["sol", "/"],
  ["plus", "+"],
  ["period", "."]
]);
function decodeAttributeValue(value2) {
  if (!value2.includes("&")) return value2;
  return value2.replace(
    /&(?:#([0-9]+);?|#[xX]([0-9a-fA-F]+);?|([a-zA-Z][a-zA-Z0-9]*);)/g,
    (whole, dec, hex, name) => {
      if (dec !== void 0 || hex !== void 0) {
        const code = dec !== void 0 ? Number.parseInt(dec, 10) : Number.parseInt(hex, 16);
        if (!Number.isFinite(code)) return whole;
        if (code === 0 || code > 1114111 || code >= 55296 && code <= 57343) return "\uFFFD";
        return String.fromCodePoint(code);
      }
      return ATTRIBUTE_NAMED_REFERENCES.get(name ?? "") ?? whole;
    }
  );
}
function isForeignBreakoutTag(tagName, attrs) {
  if (tagName === "font") {
    return attrs.has("color") || attrs.has("face") || attrs.has("size");
  }
  return FOREIGN_BREAKOUT_TAGS.includes(tagName);
}
function annotationXmlEncodingIsHtml(value2) {
  if (value2 === void 0) return false;
  return HTML_ANNOTATION_ENCODINGS.includes(asciiLower(decodeAttributeValue(value2)));
}
function foreignChildNamespace(tagName, elementNs, attrs) {
  if (elementNs === "svg" && HTML_INTEGRATION_POINTS.includes(tagName)) return "html";
  if (elementNs === "math") {
    if (MATHML_TEXT_INTEGRATION_POINTS.includes(tagName)) return "html";
    if (tagName === "annotation-xml" && annotationXmlEncodingIsHtml(attrs.get("encoding"))) {
      return "html";
    }
  }
  return elementNs;
}
function skipForeignContent(html, lowerHtml, rootName, from) {
  const tagOpen = /<(\/?)([a-z][^\t\n\f\r \/>]*)/iy;
  const nsStack = [
    { name: rootName, childNs: rootName, mathmlText: false }
  ];
  let i = from;
  while (i < html.length && nsStack.length > 0) {
    if (html.charCodeAt(i) !== 60) {
      i += 1;
      continue;
    }
    const currentNs = nsStack[nsStack.length - 1]?.childNs ?? rootName;
    if (html.startsWith("<!--", i)) {
      const end = endOfComment(html, i);
      if (end < 0) return -1;
      i = end;
      continue;
    }
    if (html.startsWith("</", i) && !/[a-z]/i.test(html.charAt(i + 2))) {
      const end = html.indexOf(">", i + 2);
      if (end < 0) return -1;
      i = end + 1;
      continue;
    }
    if (currentNs !== "html" && lowerHtml.startsWith("<![cdata[", i)) {
      const end = html.indexOf("]]>", i + 9);
      if (end < 0) return -1;
      i = end + 3;
      continue;
    }
    if (html.startsWith("<!", i) || html.startsWith("<?", i)) {
      const end = html.indexOf(">", i + 2);
      if (end < 0) return -1;
      i = end + 1;
      continue;
    }
    tagOpen.lastIndex = i;
    const open = tagOpen.exec(html);
    if (!open) {
      i += 1;
      continue;
    }
    const tag2 = scanTag(html, i + open[0].length);
    const tagEnd = tag2.end;
    if (tagEnd < 0) return -1;
    const tagName = (open[2] ?? "").toLowerCase();
    if (open[1]) {
      let matched = false;
      for (let frame = nsStack.length - 1; frame >= 0; frame -= 1) {
        if (nsStack[frame]?.name === tagName) {
          nsStack.length = frame;
          matched = true;
          break;
        }
      }
      if (!matched && REPROCESSED_END_TAGS.includes(tagName)) return -1;
      i = tagEnd + 1;
      if (nsStack.length === 0) return i;
      continue;
    }
    if (currentNs !== "html" && isForeignBreakoutTag(tagName, tag2.attrs)) {
      while (nsStack.length > 0 && nsStack[nsStack.length - 1].childNs !== "html") {
        nsStack.pop();
      }
      if (nsStack.length === 0) return i;
      continue;
    }
    const selfClosing = tag2.selfClosing && (currentNs !== "html" || PREVIEW_VOID_ELEMENTS.includes(tagName));
    if (!selfClosing && currentNs === "html" && HTML_RAW_TEXT_ELEMENTS.includes(tagName)) {
      const contentEnd = findRawTextClose(lowerHtml, tagName, tagEnd + 1);
      if (contentEnd < 0) return -1;
      i = contentEnd;
      continue;
    }
    if (!selfClosing && !PREVIEW_VOID_ELEMENTS.includes(tagName)) {
      const parent = nsStack[nsStack.length - 1];
      const underMathmlText = parent?.mathmlText ?? false;
      const elementNs = currentNs === "html" ? underMathmlText && MATHML_TEXT_INTEGRATION_EXCEPTIONS.includes(tagName) ? "math" : tagName === "svg" ? "svg" : tagName === "math" ? "math" : "html" : currentNs === "math" && tagName === "svg" && parent?.name === "annotation-xml" ? "svg" : currentNs;
      nsStack.push({
        name: tagName,
        childNs: foreignChildNamespace(tagName, elementNs, tag2.attrs),
        mathmlText: elementNs === "math" && MATHML_TEXT_INTEGRATION_POINTS.includes(tagName)
      });
    }
    i = tagEnd + 1;
  }
  return -1;
}
function findRealTagOffset(html, pattern) {
  const anchored = new RegExp(pattern.source, `${pattern.flags.replace(/[gy]/g, "")}y`);
  const tagOpen = /<(\/?)([a-z][^\t\n\f\r \/>]*)/iy;
  const lower = asciiLower(html);
  const selectMode = newSelectModeState();
  let i = 0;
  while (i < html.length) {
    if (html.charCodeAt(i) !== 60) {
      i += 1;
      continue;
    }
    if (html.startsWith("<!--", i)) {
      const end = endOfComment(html, i);
      if (end < 0) return -1;
      i = end;
      continue;
    }
    if (html.startsWith("</", i) && !/[a-z]/i.test(html.charAt(i + 2))) {
      const end = html.indexOf(">", i + 2);
      if (end < 0) return -1;
      i = end + 1;
      continue;
    }
    if (html.startsWith("<!", i) || html.startsWith("<?", i)) {
      const end = html.indexOf(">", i + 2);
      if (end < 0) return -1;
      i = end + 1;
      continue;
    }
    anchored.lastIndex = i;
    if (anchored.test(html)) return i;
    tagOpen.lastIndex = i;
    const open = tagOpen.exec(html);
    if (!open) {
      i += 1;
      continue;
    }
    const tag2 = scanTag(html, i + open[0].length);
    const tagEnd = tag2.end;
    if (tagEnd < 0) return -1;
    const tagName = (open[2] ?? "").toLowerCase();
    if (!observeSelectMode(selectMode, tagName, !!open[1], tag2.selfClosing)) return -1;
    if (!open[1] && HTML_RAW_TEXT_ELEMENTS.includes(tagName)) {
      const contentEnd = findRawTextClose(lower, tagName, tagEnd + 1);
      if (contentEnd < 0) return -1;
      i = contentEnd;
      continue;
    }
    if (!open[1] && !selectMode.inSelect && (tagName === "svg" || tagName === "math") && !tag2.selfClosing) {
      const contentEnd = skipForeignContent(html, lower, tagName, tagEnd + 1);
      if (contentEnd < 0) return -1;
      i = contentEnd;
      continue;
    }
    if (!open[1] && tagName === "template") {
      const contentEnd = skipTemplateContent(html, lower, tagEnd + 1);
      if (contentEnd < 0) return -1;
      i = contentEnd;
      continue;
    }
    i = tagEnd + 1;
  }
  return -1;
}
function findRealTagEnd(html, pattern) {
  const start = findRealTagOffset(html, pattern);
  if (start < 0) return -1;
  const end = endOfTag(html, start);
  return end < 0 ? -1 : end + 1;
}
var HTML_TAG_PATTERNS = {
  htmlOpen: /<html(?=[\t\n\f\r />])/i,
  headOpen: /<head(?=[\t\n\f\r />])/i,
  headClose: /<\/head(?=[\t\n\f\r >])/i,
  bodyOpen: /<body(?=[\t\n\f\r />])/i,
  bodyClose: /<\/body(?=[\t\n\f\r >])/i,
  baseOpen: /<base(?=[\t\n\f\r />])/i,
  titleOpen: /<title(?=[\t\n\f\r >])/i
};

// vendor/od-engine/fonts.ts
function fontFaceCss(files, urlPrefix) {
  return files.map(
    (f) => [
      "@font-face {",
      `  font-family: "${f.family.replace(/"/g, "")}";`,
      `  src: url("${urlPrefix}${f.file}") format("${f.format}");`,
      `  font-weight: ${f.weight};`,
      `  font-style: ${f.style};`,
      ...f.unicodeRange ? [`  unicode-range: ${f.unicodeRange};`] : [],
      "  font-display: swap;",
      "}"
    ].join("\n")
  ).join("\n");
}
function injectFontFaces(html, files, urlPrefix) {
  if (!files || files.length === 0) return html;
  const css = fontFaceCss(files, urlPrefix);
  const tag2 = `<style data-brand-fonts>
${css}
</style>`;
  const headEnd = findRealTagEnd(html, HTML_TAG_PATTERNS.headOpen);
  if (headEnd >= 0) return `${html.slice(0, headEnd)}
${tag2}${html.slice(headEnd)}`;
  return tag2 + html;
}

// vendor/od-engine/engine/palette.ts
var hueStep = 2;
var saturationStep = 0.16;
var saturationStep2 = 0.05;
var brightnessStep1 = 0.05;
var brightnessStep2 = 0.15;
var lightColorCount = 5;
var darkColorCount = 4;
var darkColorMap = [
  { index: 7, opacity: 0.15 },
  { index: 6, opacity: 0.25 },
  { index: 5, opacity: 0.3 },
  { index: 5, opacity: 0.45 },
  { index: 5, opacity: 0.65 },
  { index: 5, opacity: 0.85 },
  { index: 4, opacity: 0.9 },
  { index: 3, opacity: 0.95 },
  { index: 2, opacity: 0.97 },
  { index: 1, opacity: 0.98 }
];
function clampHex(component) {
  return Math.max(0, Math.min(255, Math.round(component)));
}
function parseHex(input2) {
  let hex = input2.trim().replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  const num = parseInt(hex, 16);
  return {
    r: num >> 16 & 255,
    g: num >> 8 & 255,
    b: num & 255
  };
}
function rgbToHex({ r, g, b }) {
  const toHex2 = (c) => clampHex(c).toString(16).padStart(2, "0");
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
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
    switch (max) {
      case rr:
        h = (gg - bb) / d + (gg < bb ? 6 : 0);
        break;
      case gg:
        h = (bb - rr) / d + 2;
        break;
      default:
        h = (rr - gg) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s, v };
}
function hsvToRgb({ h, s, v }) {
  const hh = h / 360 * 6;
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
function mix(back, front, amount) {
  return {
    r: front.r * amount + back.r * (1 - amount),
    g: front.g * amount + back.g * (1 - amount),
    b: front.b * amount + back.b * (1 - amount)
  };
}
function getHue(hsv, i, light) {
  let hue2;
  if (hsv.h >= 60 && hsv.h <= 240) {
    hue2 = light ? hsv.h - hueStep * i : hsv.h + hueStep * i;
  } else {
    hue2 = light ? hsv.h + hueStep * i : hsv.h - hueStep * i;
  }
  if (hue2 < 0) {
    hue2 += 360;
  } else if (hue2 >= 360) {
    hue2 -= 360;
  }
  return hue2;
}
function getSaturation(hsv, i, light) {
  if (hsv.h === 0 && hsv.s === 0) {
    return hsv.s;
  }
  let saturation2;
  if (light) {
    saturation2 = hsv.s - saturationStep * i;
  } else if (i === darkColorCount) {
    saturation2 = hsv.s + saturationStep;
  } else {
    saturation2 = hsv.s + saturationStep2 * i;
  }
  if (saturation2 > 1) {
    saturation2 = 1;
  }
  if (light && i === lightColorCount && saturation2 > 0.1) {
    saturation2 = 0.1;
  }
  if (saturation2 < 0.06) {
    saturation2 = 0.06;
  }
  return Number(saturation2.toFixed(2));
}
function getValue(hsv, i, light) {
  let value2;
  if (light) {
    value2 = hsv.v + brightnessStep1 * i;
  } else {
    value2 = hsv.v - brightnessStep2 * i;
  }
  if (value2 > 1) {
    value2 = 1;
  }
  return Number(value2.toFixed(2));
}
function generate(baseColor, opts = {}) {
  const patterns = [];
  const baseHsv = rgbToHsv(parseHex(baseColor));
  for (let i = lightColorCount; i > 0; i -= 1) {
    const hsv = {
      h: getHue(baseHsv, i, true),
      s: getSaturation(baseHsv, i, true),
      v: getValue(baseHsv, i, true)
    };
    patterns.push(rgbToHex(hsvToRgb(hsv)));
  }
  patterns.push(rgbToHex(hsvToRgb(baseHsv)));
  for (let i = 1; i <= darkColorCount; i += 1) {
    const hsv = {
      h: getHue(baseHsv, i, false),
      s: getSaturation(baseHsv, i, false),
      v: getValue(baseHsv, i, false)
    };
    patterns.push(rgbToHex(hsvToRgb(hsv)));
  }
  if (opts.theme === "dark") {
    const bg = parseHex(opts.backgroundColor || "#141414");
    return darkColorMap.map(
      ({ index, opacity }) => rgbToHex(mix(bg, parseHex(patterns[index - 1]), opacity))
    );
  }
  return patterns;
}
var presetSeeds = {
  red: "#F5222D",
  volcano: "#FA541C",
  orange: "#FA8C16",
  gold: "#FAAD14",
  yellow: "#FADB14",
  lime: "#A0D911",
  green: "#52C41A",
  cyan: "#13C2C2",
  blue: "#1677FF",
  geekblue: "#2F54EB",
  purple: "#722ED1",
  magenta: "#EB2F96",
  grey: "#666666"
};
var presets = Object.fromEntries(
  Object.entries(presetSeeds).map(([name, seed]) => [name, generate(seed)])
);

// vendor/od-engine/engine/derive.ts
function parseHex2(input2) {
  let hex = input2.trim().replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}
function clamp255(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function toHex({ r, g, b }) {
  const h = (n) => clamp255(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
function alphaOver(fg, bg, alpha) {
  return toHex({
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha)
  });
}
function luminance(rgb) {
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}
function lightThemeBgBase(input2) {
  const hex = input2 || "#ffffff";
  return luminance(parseHex2(hex)) >= 0.72 ? hex : "#ffffff";
}
function lightThemeTextBase(input2) {
  const hex = input2 || "#000000";
  return luminance(parseHex2(hex)) <= 0.45 ? hex : "#000000";
}
function seedPrefersDark(seed) {
  return luminance(parseHex2(seed.colorBgBase || "#ffffff")) <= 0.3 && luminance(parseHex2(seed.colorTextBase || "#000000")) >= 0.6;
}
function defaultThemeAlgorithm(seed) {
  return seedPrefersDark(seed) ? "dark" : "default";
}
function darkThemeTextBase(input2) {
  const hex = input2 || "#ffffff";
  return luminance(parseHex2(hex)) >= 0.6 ? hex : "#ffffff";
}
function statesFromPalette(palette, algorithm) {
  const at = (i) => palette[i] ?? palette[palette.length - 1] ?? "#000000";
  if (algorithm === "dark") {
    return {
      bg: at(0),
      bgHover: at(1),
      border: at(2),
      borderHover: at(3),
      hover: at(6),
      base: at(5),
      active: at(4),
      text: at(8)
    };
  }
  return {
    bg: at(0),
    bgHover: at(1),
    border: at(2),
    borderHover: at(3),
    hover: at(4),
    base: at(5),
    active: at(6),
    text: at(8)
  };
}
function toEven(n) {
  const r = Math.round(n);
  return r % 2 === 0 ? r : r + 1;
}
function fontSizeLadder(base) {
  const out = [];
  for (let i = 0; i < 10; i++) {
    if (i === 1) {
      out.push(base);
    } else {
      out.push(toEven(base * Math.E ** ((i - 1) / 5)));
    }
  }
  return out;
}
function durationStr(seconds) {
  const rounded = Math.round(seconds * 100) / 100;
  return `${rounded}s`;
}
function neutralAlphas(algorithm) {
  if (algorithm === "dark") {
    return {
      text: [0.85, 0.65, 0.45, 0.25],
      fill: [0.18, 0.12, 0.08, 0.04],
      border: 0.18,
      borderSecondary: 0.12,
      layout: 0.04
    };
  }
  return {
    text: [0.88, 0.65, 0.45, 0.25],
    fill: [0.15, 0.06, 0.04, 0.02],
    border: 0.15,
    borderSecondary: 0.06,
    layout: 0.04
  };
}
function deriveTokens(seed, algorithm = "default") {
  const isDark = algorithm === "dark";
  const isCompact = algorithm === "compact";
  const darkFirst = seedPrefersDark(seed);
  const canvasDark = isDark || darkFirst;
  const textBaseHex = canvasDark ? darkThemeTextBase(darkFirst ? seed.colorTextBase : void 0) : lightThemeTextBase(seed.colorTextBase);
  const bgBaseHex = darkFirst ? seed.colorBgBase : isDark ? "#141414" : lightThemeBgBase(seed.colorBgBase);
  const textBase = parseHex2(textBaseHex);
  const bgBase = parseHex2(bgBaseHex);
  const stateAlgorithm = canvasDark ? "dark" : algorithm;
  const paletteOpts = canvasDark ? { theme: "dark", backgroundColor: bgBaseHex } : void 0;
  const primaryPalette = generate(seed.colorPrimary, paletteOpts);
  const primary = statesFromPalette(primaryPalette, stateAlgorithm);
  const successStates = statesFromPalette(generate(seed.colorSuccess, paletteOpts), stateAlgorithm);
  const warningStates = statesFromPalette(generate(seed.colorWarning, paletteOpts), stateAlgorithm);
  const errorStates = statesFromPalette(generate(seed.colorError, paletteOpts), stateAlgorithm);
  const infoStates = statesFromPalette(generate(seed.colorInfo, paletteOpts), stateAlgorithm);
  const linkSeed = seed.colorLink && seed.colorLink.length > 0 ? seed.colorLink : seed.colorInfo;
  const linkStates = statesFromPalette(generate(linkSeed, paletteOpts), stateAlgorithm);
  const na = neutralAlphas(stateAlgorithm);
  const text = (a) => alphaOver(textBase, bgBase, a);
  const colorText = text(na.text[0]);
  const colorTextSecondary = text(na.text[1]);
  const colorTextTertiary = text(na.text[2]);
  const colorTextQuaternary = text(na.text[3]);
  const colorFill = text(na.fill[0]);
  const colorFillSecondary = text(na.fill[1]);
  const colorFillTertiary = text(na.fill[2]);
  const colorFillQuaternary = text(na.fill[3]);
  const colorBorder = text(na.border);
  const colorBorderSecondary = text(na.borderSecondary);
  const colorBgLayout = text(na.layout);
  const colorBgContainer = bgBaseHex;
  const colorBgElevated = canvasDark ? alphaOver(textBase, bgBase, 0.08) : bgBaseHex;
  const fontSize = seed.fontSize;
  const sizes = fontSizeLadder(fontSize);
  const lineHeight = (fontSize + 8) / fontSize;
  const lineHeightHeading = (sizes[5] + 8) / sizes[5];
  const unit = seed.sizeUnit;
  const step = isCompact ? Math.max(2, seed.sizeStep - 2) : seed.sizeStep;
  const spacingOffsets = isCompact ? [-1, 0, 0, 1, 2, 2, 4, 6] : [-3, -2, -1, 0, 1, 2, 4, 8];
  const [sizeXXS, sizeXS, sizeSM, size, sizeMD, sizeLG, sizeXL, sizeXXL] = spacingOffsets.map(
    (n) => unit * (step + n)
  );
  const borderRadius = seed.borderRadius;
  const borderRadiusXS = Math.max(1, Math.round(borderRadius / 3));
  const borderRadiusSM = Math.max(2, Math.round(borderRadius * 2 / 3));
  const borderRadiusLG = borderRadius + 2;
  const controlHeight = isCompact ? 28 : seed.controlHeight;
  const controlHeightXS = Math.round(controlHeight * 0.5);
  const controlHeightSM = Math.round(controlHeight * 0.75);
  const controlHeightLG = Math.round(controlHeight * 1.25);
  const mu = seed.motionUnit;
  const mb = seed.motionBase;
  const motionDurationFast = durationStr(mb + mu * 1);
  const motionDurationMid = durationStr(mb + mu * 2);
  const motionDurationSlow = durationStr(mb + mu * 3);
  const motionEaseInOut = "cubic-bezier(0.645, 0.045, 0.355, 1)";
  const motionEaseOut = "cubic-bezier(0.215, 0.61, 0.355, 1)";
  return {
    algorithm,
    // primary
    colorPrimary: primary.base,
    colorPrimaryBg: primary.bg,
    colorPrimaryBgHover: primary.bgHover,
    colorPrimaryBorder: primary.border,
    colorPrimaryBorderHover: primary.borderHover,
    colorPrimaryHover: primary.hover,
    colorPrimaryActive: primary.active,
    colorPrimaryText: primary.text,
    // functional — success / warning / error / info / link
    colorSuccess: successStates.base,
    colorSuccessBg: successStates.bg,
    colorSuccessBorder: successStates.border,
    colorSuccessHover: successStates.hover,
    colorSuccessActive: successStates.active,
    colorWarning: warningStates.base,
    colorWarningBg: warningStates.bg,
    colorWarningBorder: warningStates.border,
    colorWarningHover: warningStates.hover,
    colorWarningActive: warningStates.active,
    colorError: errorStates.base,
    colorErrorBg: errorStates.bg,
    colorErrorBorder: errorStates.border,
    colorErrorHover: errorStates.hover,
    colorErrorActive: errorStates.active,
    colorInfo: infoStates.base,
    colorInfoBg: infoStates.bg,
    colorInfoBorder: infoStates.border,
    colorLink: linkStates.base,
    colorLinkHover: linkStates.hover,
    colorLinkActive: linkStates.active,
    // neutral text (alpha ladder over colorTextBase)
    colorText,
    colorTextSecondary,
    colorTextTertiary,
    colorTextQuaternary,
    // neutral fill
    colorFill,
    colorFillSecondary,
    colorFillTertiary,
    colorFillQuaternary,
    // backgrounds & borders
    colorBgLayout,
    colorBgContainer,
    colorBgElevated,
    colorBorder,
    colorBorderSecondary,
    // typography
    fontFamily: seed.fontFamily,
    fontFamilyCode: seed.fontFamilyCode,
    fontSize,
    fontSizeSM: sizes[0],
    fontSizeLG: sizes[2],
    fontSizeXL: sizes[3],
    fontSizeHeading1: sizes[6],
    fontSizeHeading2: sizes[5],
    fontSizeHeading3: sizes[4],
    fontSizeHeading4: sizes[3],
    fontSizeHeading5: sizes[2],
    lineHeight,
    lineHeightHeading,
    fontWeightStrong: 600,
    // spacing scale
    sizeXXS,
    sizeXS,
    sizeSM,
    size,
    sizeMD,
    sizeLG,
    sizeXL,
    sizeXXL,
    // geometry
    borderRadiusXS,
    borderRadiusSM,
    borderRadius,
    borderRadiusLG,
    lineWidth: seed.lineWidth,
    controlHeightXS,
    controlHeightSM,
    controlHeight,
    controlHeightLG,
    // motion
    motionDurationFast,
    motionDurationMid,
    motionDurationSlow,
    motionEaseInOut,
    motionEaseOut,
    // raw palettes (for swatches / charts / sub-brands)
    primaryPalette,
    presets
  };
}

// vendor/od-engine/engine/types.ts
var CSS_VAR_PREFIX = "brand";
function cssVar(tokenKey) {
  const kebab = tokenKey.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Za-z])([0-9])/g, "$1-$2").toLowerCase();
  return `--${CSS_VAR_PREFIX}-${kebab}`;
}
function varRef(tokenKey, fallback) {
  return fallback ? `var(${cssVar(tokenKey)}, ${fallback})` : `var(${cssVar(tokenKey)})`;
}
function isRenderableFontFamily(raw) {
  const fam = raw.trim().replace(/^["']|["']$/g, "").trim();
  if (!fam) return false;
  if (fam.startsWith("--")) return false;
  return !/[(){}[\];:,"'\\/<>=@!]/.test(fam);
}
var PX_TOKEN = /^(fontSize|size|borderRadius|lineWidth|controlHeight)/;
var UNITLESS_TOKEN = /^(lineHeight|fontWeight)/;
function formatTokenValue(key, value2) {
  if (typeof value2 === "string") return value2;
  if (UNITLESS_TOKEN.test(key)) return String(value2);
  if (PX_TOKEN.test(key)) return `${value2}px`;
  return String(value2);
}
function flattenTokens(tokens) {
  const out = [];
  for (const [key, value2] of Object.entries(tokens)) {
    if (key === "algorithm" || value2 == null) continue;
    if (Array.isArray(value2)) {
      value2.forEach((v, i) => out.push({ name: `${cssVar(key)}-${i + 1}`, value: String(v) }));
    } else if (typeof value2 === "object") {
      for (const [sub, arr] of Object.entries(value2)) {
        (arr ?? []).forEach(
          (v, i) => out.push({ name: `${cssVar(key)}-${sub}-${i + 1}`, value: String(v) })
        );
      }
    } else {
      out.push({ name: cssVar(key), value: formatTokenValue(key, value2) });
    }
  }
  return out;
}

// vendor/od-engine/engine/seed.ts
var SYSTEM_UI_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'";
var CODE_STACK = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace";
var defaultSeed = {
  colorPrimary: "#1677ff",
  colorSuccess: "#52c41a",
  colorWarning: "#faad14",
  colorError: "#ff4d4f",
  colorInfo: "#1677ff",
  colorLink: "",
  colorTextBase: "#000000",
  colorBgBase: "#ffffff",
  fontFamily: SYSTEM_UI_STACK,
  fontFamilyCode: CODE_STACK,
  fontSize: 14,
  borderRadius: 6,
  sizeUnit: 4,
  sizeStep: 4,
  controlHeight: 32,
  lineWidth: 1,
  motionUnit: 0.1,
  motionBase: 0,
  wireframe: false,
  motion: true
};
function normalizeHex(raw) {
  const v = raw.trim().toLowerCase();
  const m = /^#?([0-9a-f]{3,8})$/.exec(v);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3 || h.length === 4) {
    h = h.slice(0, 3).split("").map((c) => c + c).join("");
  } else if (h.length === 8) {
    h = h.slice(0, 6);
  } else if (h.length !== 6) {
    return null;
  }
  return `#${h}`;
}
function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}
function luminance2(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
function saturation(hex) {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}
function value(hex) {
  const { r, g, b } = hexToRgb(hex);
  return Math.max(r, g, b) / 255;
}
function hue(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === rn) h = (gn - bn) / d % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
function isExtreme(hex) {
  const l = luminance2(hex);
  return l > 0.92 || l < 0.06;
}
function isGreenish(hex) {
  const h = hue(hex);
  return h >= 75 && h <= 165 && saturation(hex) > 0.25;
}
function lightThemeBackground(...rawColors) {
  for (const raw of rawColors) {
    const hex = normalizeHex(raw ?? "");
    if (hex && luminance2(hex) >= 0.72) return hex;
  }
  return defaultSeed.colorBgBase;
}
function lightThemeForeground(raw) {
  const hex = normalizeHex(raw ?? "");
  return hex && luminance2(hex) <= 0.45 ? hex : defaultSeed.colorTextBase;
}
var DARK_CANVAS_MAX_LUMINANCE = 0.3;
var LIGHT_FOREGROUND_MIN_LUMINANCE = 0.6;
function neutralBases(background, surface, foreground) {
  const bgHex = normalizeHex(background ?? "") ?? normalizeHex(surface ?? "");
  const fgHex = normalizeHex(foreground ?? "");
  const darkFirst = bgHex !== null && fgHex !== null && luminance2(bgHex) <= DARK_CANVAS_MAX_LUMINANCE && luminance2(fgHex) >= LIGHT_FOREGROUND_MIN_LUMINANCE;
  if (darkFirst) {
    return { colorTextBase: fgHex, colorBgBase: bgHex };
  }
  return {
    colorTextBase: lightThemeForeground(foreground),
    colorBgBase: lightThemeBackground(background, surface)
  };
}
function findRole(colors, role) {
  return colors.find((c) => c.role === role);
}
function fontStack(primaryFamily, fallbacks) {
  const parts = [];
  const seen = /* @__PURE__ */ new Set();
  const push = (raw) => {
    const fam = raw.trim();
    if (!fam || !isRenderableFontFamily(fam)) return;
    const key = fam.toLowerCase().replace(/^["']|["']$/g, "");
    if (seen.has(key)) return;
    seen.add(key);
    const needsQuote = /\s/.test(fam) && !/^["'].*["']$/.test(fam);
    parts.push(needsQuote ? `'${fam}'` : fam);
  };
  if (primaryFamily) push(primaryFamily);
  for (const f of fallbacks) push(f);
  const lead = parts.join(", ");
  return lead ? `${lead}, ${SYSTEM_UI_STACK}` : SYSTEM_UI_STACK;
}
function seedFromBrand(brand) {
  const colors = brand.colors ?? [];
  const NEUTRAL_ROLES = /* @__PURE__ */ new Set([
    "background",
    "surface",
    "foreground",
    "muted",
    "border"
  ]);
  const accent = findRole(colors, "accent");
  const accentSecondary = findRole(colors, "accent-secondary");
  const foreground = findRole(colors, "foreground");
  const background = findRole(colors, "background");
  const surface = findRole(colors, "surface");
  const primaryHex = normalizeHex(accent?.hex ?? "") ?? normalizeHex(colors.find((c) => !NEUTRAL_ROLES.has(c.role))?.hex ?? "") ?? defaultSeed.colorPrimary;
  const linkHex = normalizeHex(accentSecondary?.hex ?? "");
  const successHex = linkHex && isGreenish(linkHex) ? linkHex : defaultSeed.colorSuccess;
  const radius = parseInt(brand.layout?.radius ?? "", 10);
  return {
    ...defaultSeed,
    colorPrimary: primaryHex,
    colorInfo: primaryHex,
    colorLink: linkHex ?? "",
    colorSuccess: successHex,
    ...neutralBases(background?.hex, surface?.hex, foreground?.hex),
    fontFamily: fontStack(brand.typography?.body?.family, brand.typography?.body?.fallbacks ?? []),
    borderRadius: Number.isFinite(radius) && radius > 0 ? radius : defaultSeed.borderRadius
  };
}
function primaryScore(hex, count) {
  if (isExtreme(hex)) return -Infinity;
  const sat = saturation(hex);
  const val = value(hex);
  if (sat < 0.18) return -Infinity;
  const valPenalty = val < 0.2 ? (0.2 - val) * 3 : val > 0.95 ? (val - 0.95) * 4 : 0;
  const freq = Math.log2(Math.max(1, count) + 1);
  return sat * 2 + freq * 0.6 - valPenalty;
}
function seedFromMaterial(material) {
  const candidates = (material.colors ?? []).map((c) => ({ hex: normalizeHex(c.hex), count: c.count })).filter((c) => c.hex !== null);
  let primaryHex = defaultSeed.colorPrimary;
  let best = -Infinity;
  for (const c of candidates) {
    const s = primaryScore(c.hex, c.count);
    if (s > best) {
      best = s;
      primaryHex = c.hex;
    }
  }
  const primaryFamily = material.fonts?.[0]?.family ?? material.fontFaceFamilies?.[0];
  return {
    ...defaultSeed,
    colorPrimary: primaryHex,
    colorInfo: primaryHex,
    colorTextBase: defaultSeed.colorTextBase,
    colorBgBase: defaultSeed.colorBgBase,
    fontFamily: fontStack(primaryFamily, [])
  };
}

// vendor/od-engine/engine/export.ts
function tokensToJson(tokens) {
  return JSON.stringify(tokens, null, 2);
}
function tokensToCssVars(tokens, selector = ":root") {
  const lines = flattenTokens(tokens).map(({ name, value: value2 }) => `  ${name}: ${value2};`);
  return `${selector} {
${lines.join("\n")}
}
`;
}
function tokensToThemeJson(seed, algorithm = "default") {
  const token = {
    colorPrimary: seed.colorPrimary,
    colorSuccess: seed.colorSuccess,
    colorWarning: seed.colorWarning,
    colorError: seed.colorError,
    colorInfo: seed.colorInfo,
    colorTextBase: seed.colorTextBase,
    colorBgBase: seed.colorBgBase,
    fontFamily: seed.fontFamily,
    fontFamilyCode: seed.fontFamilyCode,
    fontSize: seed.fontSize,
    borderRadius: seed.borderRadius,
    sizeUnit: seed.sizeUnit,
    sizeStep: seed.sizeStep,
    controlHeight: seed.controlHeight,
    lineWidth: seed.lineWidth,
    motionUnit: seed.motionUnit,
    motionBase: seed.motionBase,
    wireframe: seed.wireframe,
    motion: seed.motion
  };
  if (seed.colorLink) token.colorLink = seed.colorLink;
  return JSON.stringify({ token, algorithm }, null, 2);
}

// vendor/od-engine/engine/kit.ts
function esc(value2) {
  return value2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function style(decls) {
  return decls.filter(Boolean).join(";");
}
var BTN_HEIGHT = {
  sm: varRef("controlHeightSM"),
  md: varRef("controlHeight"),
  lg: varRef("controlHeightLG")
};
var BTN_FONT = {
  sm: varRef("fontSizeSM"),
  md: varRef("fontSize"),
  lg: varRef("fontSizeLG")
};
var BTN_PAD = {
  sm: varRef("sizeXS"),
  md: varRef("size"),
  lg: varRef("sizeLG")
};
function button(opts) {
  const type = opts.type ?? "default";
  const size = opts.size ?? "md";
  const base = [
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "box-sizing:border-box",
    "cursor:pointer",
    "white-space:nowrap",
    "user-select:none",
    "font-family:" + varRef("fontFamily"),
    "font-weight:" + varRef("fontWeightStrong"),
    "line-height:1",
    "text-decoration:none",
    "transition:all " + varRef("motionDurationMid") + " " + varRef("motionEaseInOut"),
    "height:" + BTN_HEIGHT[size],
    "padding:0 " + BTN_PAD[size],
    "font-size:" + BTN_FONT[size],
    "border-radius:" + varRef("borderRadius"),
    "border:" + varRef("lineWidth") + " solid transparent"
  ];
  let skin;
  switch (type) {
    case "primary":
      skin = [
        "background:" + varRef("colorPrimary"),
        "color:#fff",
        "border-color:" + varRef("colorPrimary"),
        "box-shadow:0 2px 0 " + varRef("colorPrimaryBg")
      ];
      break;
    case "dashed":
      skin = [
        "background:" + varRef("colorBgContainer"),
        "color:" + varRef("colorText"),
        "border-color:" + varRef("colorBorder"),
        "border-style:dashed"
      ];
      break;
    case "text":
      skin = ["background:transparent", "color:" + varRef("colorText"), "border-color:transparent"];
      break;
    case "link":
      skin = ["background:transparent", "color:" + varRef("colorLink"), "border-color:transparent"];
      break;
    default:
      skin = [
        "background:" + varRef("colorBgContainer"),
        "color:" + varRef("colorText"),
        "border-color:" + varRef("colorBorder")
      ];
  }
  return `<a role="button" tabindex="0" style="${style([...base, ...skin])}">${esc(opts.label)}</a>`;
}
function card(opts) {
  const wrap = style([
    "display:flex",
    "flex-direction:column",
    "background:" + varRef("colorBgContainer"),
    "border:" + varRef("lineWidth") + " solid " + varRef("colorBorderSecondary"),
    "border-radius:" + varRef("borderRadiusLG"),
    "overflow:hidden",
    "font-family:" + varRef("fontFamily"),
    "color:" + varRef("colorText"),
    "box-shadow:0 1px 2px " + varRef("colorFillQuaternary")
  ]);
  const head = opts.title ? `<div style="${style([
    "padding:" + varRef("sizeMD") + " " + varRef("sizeLG"),
    "border-bottom:" + varRef("lineWidth") + " solid " + varRef("colorBorderSecondary"),
    "font-size:" + varRef("fontSizeLG"),
    "font-weight:" + varRef("fontWeightStrong"),
    "color:" + varRef("colorText")
  ])}">${esc(opts.title)}</div>` : "";
  const body = `<div style="${style([
    "padding:" + varRef("sizeLG"),
    "font-size:" + varRef("fontSize"),
    "line-height:" + varRef("lineHeight"),
    "color:" + varRef("colorTextSecondary"),
    "flex:1"
  ])}">${opts.body}</div>`;
  const foot = opts.footer ? `<div style="${style([
    "padding:" + varRef("sizeMD") + " " + varRef("sizeLG"),
    "border-top:" + varRef("lineWidth") + " solid " + varRef("colorBorderSecondary"),
    "background:" + varRef("colorFillQuaternary")
  ])}">${opts.footer}</div>` : "";
  return `<div style="${wrap}">${head}${body}${foot}</div>`;
}
function input(opts) {
  const field2 = style([
    "box-sizing:border-box",
    "width:100%",
    "height:" + varRef("controlHeight"),
    "padding:0 " + varRef("sizeSM"),
    "font-family:" + varRef("fontFamily"),
    "font-size:" + varRef("fontSize"),
    "line-height:" + varRef("lineHeight"),
    "color:" + varRef("colorText"),
    "background:" + varRef("colorBgContainer"),
    "border:" + varRef("lineWidth") + " solid " + varRef("colorBorder"),
    "border-radius:" + varRef("borderRadius"),
    "outline:none",
    "transition:border-color " + varRef("motionDurationMid") + " " + varRef("motionEaseInOut")
  ]);
  const label = opts.label ? `<label style="${style([
    "display:block",
    "margin-bottom:" + varRef("sizeXXS"),
    "font-family:" + varRef("fontFamily"),
    "font-size:" + varRef("fontSizeSM"),
    "color:" + varRef("colorTextSecondary")
  ])}">${esc(opts.label)}</label>` : "";
  const placeholder = opts.placeholder ? ` placeholder="${esc(opts.placeholder)}"` : "";
  const value2 = opts.value ? ` value="${esc(opts.value)}"` : "";
  return `<div>${label}<input type="text"${placeholder}${value2} style="${field2}"></div>`;
}
function tag(opts) {
  const accent = opts.color ? /^(#|rgb|hsl|oklch)/i.test(opts.color) ? opts.color : varRef(opts.color) : varRef("colorPrimary");
  const bg = opts.color && /^(#|rgb|hsl|oklch)/i.test(opts.color) ? accent + "1f" : varRef("colorPrimaryBg");
  const border = opts.color && /^(#|rgb|hsl|oklch)/i.test(opts.color) ? accent + "55" : varRef("colorPrimaryBorder");
  return `<span style="${style([
    "display:inline-flex",
    "align-items:center",
    "height:" + varRef("controlHeightSM"),
    "padding:0 " + varRef("sizeXS"),
    "font-family:" + varRef("fontFamily"),
    "font-size:" + varRef("fontSizeSM"),
    "line-height:1",
    "color:" + accent,
    "background:" + bg,
    "border:" + varRef("lineWidth") + " solid " + border,
    "border-radius:" + varRef("borderRadiusSM")
  ])}">${esc(opts.label)}</span>`;
}
var ALERT_FACE = {
  success: {
    bg: varRef("colorSuccessBg"),
    border: varRef("colorSuccessBorder"),
    accent: varRef("colorSuccess"),
    icon: "&#10003;"
  },
  info: {
    bg: varRef("colorInfoBg"),
    border: varRef("colorInfoBorder"),
    accent: varRef("colorInfo"),
    icon: "&#8505;"
  },
  warning: {
    bg: varRef("colorWarningBg"),
    border: varRef("colorWarningBorder"),
    accent: varRef("colorWarning"),
    icon: "&#9888;"
  },
  error: {
    bg: varRef("colorErrorBg"),
    border: varRef("colorErrorBorder"),
    accent: varRef("colorError"),
    icon: "&#10005;"
  }
};
function alert(opts) {
  const face = ALERT_FACE[opts.type ?? "info"];
  const icon = `<span style="${style([
    "flex:0 0 auto",
    "margin-top:2px",
    "color:" + face.accent,
    "font-size:" + varRef("fontSizeLG"),
    "line-height:1"
  ])}">${face.icon}</span>`;
  const desc = opts.description ? `<div style="${style([
    "margin-top:" + varRef("sizeXXS"),
    "font-size:" + varRef("fontSize"),
    "color:" + varRef("colorTextSecondary"),
    "line-height:" + varRef("lineHeight")
  ])}">${esc(opts.description)}</div>` : "";
  return `<div style="${style([
    "display:flex",
    "gap:" + varRef("sizeSM"),
    "align-items:flex-start",
    "padding:" + varRef("sizeSM") + " " + varRef("size"),
    "font-family:" + varRef("fontFamily"),
    "background:" + face.bg,
    "border:" + varRef("lineWidth") + " solid " + face.border,
    "border-radius:" + varRef("borderRadiusLG")
  ])}">${icon}<div style="flex:1"><div style="${style([
    "font-size:" + varRef("fontSize"),
    "font-weight:" + (opts.description ? varRef("fontWeightStrong") : "inherit"),
    "color:" + varRef("colorText"),
    "line-height:" + varRef("lineHeight")
  ])}">${esc(opts.message)}</div>${desc}</div></div>`;
}
var KIT_CSS = `
a[role="button"]{transition:filter .15s ease,transform .15s ease}
a[role="button"]:hover{filter:brightness(1.07)}
a[role="button"]:active{filter:brightness(.95);transform:translateY(0.5px)}
input:focus,textarea:focus,select:focus{border-color:var(--brand-color-primary)!important;box-shadow:0 0 0 3px var(--brand-color-primary-bg);outline:none}
details.kit-acc>summary{list-style:none;cursor:pointer}
details.kit-acc>summary::-webkit-details-marker{display:none}
details.kit-acc .kit-acc-icon{transition:transform .18s ease}
details.kit-acc[open] .kit-acc-icon{transform:rotate(45deg)}
`.trim();
function avatar(opts) {
  const px = {
    sm: varRef("controlHeightSM"),
    md: varRef("controlHeight"),
    lg: varRef("controlHeightLG")
  };
  const size = opts.size ?? "md";
  const initials2 = opts.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  return `<span style="${style([
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "flex:0 0 auto",
    "width:" + px[size],
    "height:" + px[size],
    "border-radius:50%",
    "background:" + varRef("colorPrimaryBg"),
    "color:" + varRef("colorPrimaryText"),
    "font-family:" + varRef("fontFamily"),
    "font-size:" + varRef("fontSizeSM"),
    "font-weight:" + varRef("fontWeightStrong"),
    "letter-spacing:0.02em",
    "user-select:none"
  ])}">${esc(initials2 || "?")}</span>`;
}
function stat(opts) {
  return `<div style="${style(["font-family:" + varRef("fontFamily"), "min-width:0"])}">
    <div style="${style([
    "font-size:" + varRef("fontSizeHeading2"),
    "font-weight:" + varRef("fontWeightStrong"),
    "line-height:1.1",
    "color:" + varRef("colorText"),
    "letter-spacing:-0.01em"
  ])}">${esc(opts.value)}</div>
    <div style="${style([
    "margin-top:" + varRef("sizeXXS"),
    "font-size:" + varRef("fontSizeSM"),
    "color:" + varRef("colorTextTertiary")
  ])}">${esc(opts.label)}</div>
  </div>`;
}
function fieldLabel(text) {
  if (!text) return "";
  return `<label style="${style([
    "display:block",
    "margin-bottom:" + varRef("sizeXXS"),
    "font-family:" + varRef("fontFamily"),
    "font-size:" + varRef("fontSizeSM"),
    "color:" + varRef("colorTextSecondary")
  ])}">${esc(text)}</label>`;
}
function textarea(opts) {
  const field2 = style([
    "box-sizing:border-box",
    "display:block",
    "width:100%",
    "padding:" + varRef("sizeXS") + " " + varRef("sizeSM"),
    "font-family:" + varRef("fontFamily"),
    "font-size:" + varRef("fontSize"),
    "line-height:" + varRef("lineHeight"),
    "color:" + varRef("colorText"),
    "background:" + varRef("colorBgContainer"),
    "border:" + varRef("lineWidth") + " solid " + varRef("colorBorder"),
    "border-radius:" + varRef("borderRadius"),
    "resize:vertical",
    "outline:none"
  ]);
  const placeholder = opts.placeholder ? ` placeholder="${esc(opts.placeholder)}"` : "";
  return `<div>${fieldLabel(opts.label)}<textarea rows="${opts.rows ?? 4}"${placeholder} style="${field2}"></textarea></div>`;
}
function select(opts) {
  const field2 = style([
    "box-sizing:border-box",
    "width:100%",
    "height:" + varRef("controlHeight"),
    "padding:0 " + varRef("sizeSM"),
    "font-family:" + varRef("fontFamily"),
    "font-size:" + varRef("fontSize"),
    "color:" + varRef("colorText"),
    "background:" + varRef("colorBgContainer"),
    "border:" + varRef("lineWidth") + " solid " + varRef("colorBorder"),
    "border-radius:" + varRef("borderRadius"),
    "outline:none"
  ]);
  const options = opts.options.map((o) => `<option${o === opts.value ? " selected" : ""}>${esc(o)}</option>`).join("");
  return `<div>${fieldLabel(opts.label)}<select style="${field2}">${options}</select></div>`;
}
function checkbox(opts) {
  return `<label style="${style([
    "display:inline-flex",
    "align-items:flex-start",
    "gap:" + varRef("sizeXS"),
    "font-family:" + varRef("fontFamily"),
    "font-size:" + varRef("fontSize"),
    "line-height:" + varRef("lineHeight"),
    "color:" + varRef("colorTextSecondary"),
    "cursor:pointer"
  ])}"><input type="checkbox"${opts.checked ? " checked" : ""} style="${style([
    "accent-color:" + varRef("colorPrimary"),
    "width:16px",
    "height:16px",
    "margin:3px 0 0",
    "flex:0 0 auto"
  ])}"><span>${esc(opts.label)}</span></label>`;
}
function switchToggle(opts) {
  const on = opts?.on ?? true;
  const track = style([
    "display:inline-flex",
    "align-items:center",
    "flex:0 0 auto",
    "width:44px",
    "height:24px",
    "padding:2px",
    "border-radius:12px",
    "box-sizing:border-box",
    "transition:background " + varRef("motionDurationMid") + " " + varRef("motionEaseInOut"),
    "background:" + (on ? varRef("colorPrimary") : varRef("colorFill")),
    "justify-content:" + (on ? "flex-end" : "flex-start")
  ]);
  const knob = `<span style="width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.2);"></span>`;
  const label = opts?.label ? `<span style="font-family:${varRef("fontFamily")};font-size:${varRef("fontSize")};color:${varRef(
    "colorTextSecondary"
  )};">${esc(opts.label)}</span>` : "";
  return `<span style="display:inline-flex;align-items:center;gap:${varRef("sizeXS")};"><span style="${track}">${knob}</span>${label}</span>`;
}
function tabs(opts) {
  const active = opts.active ?? 0;
  const items = opts.items.map((label, i) => {
    const is = i === active;
    return `<span style="${style([
      "padding:" + varRef("sizeXS") + " 2px",
      "margin-bottom:calc(-1 * " + varRef("lineWidth") + ")",
      "font-family:" + varRef("fontFamily"),
      "font-size:" + varRef("fontSize"),
      "cursor:pointer",
      "white-space:nowrap",
      "color:" + (is ? varRef("colorPrimary") : varRef("colorTextSecondary")),
      is ? "font-weight:" + varRef("fontWeightStrong") : "",
      "border-bottom:2px solid " + (is ? varRef("colorPrimary") : "transparent")
    ])}">${esc(label)}</span>`;
  }).join("");
  return `<div style="${style([
    "display:flex",
    "gap:" + varRef("sizeLG"),
    "border-bottom:" + varRef("lineWidth") + " solid " + varRef("colorBorderSecondary")
  ])}">${items}</div>`;
}
function breadcrumb(opts) {
  const last = opts.items.length - 1;
  const parts = opts.items.map((label, i) => {
    const item = `<span style="color:${i === last ? varRef("colorText") : varRef("colorTextTertiary")};">${esc(label)}</span>`;
    const sep = i < last ? `<span style="color:${varRef("colorTextQuaternary")};">/</span>` : "";
    return item + sep;
  }).join("");
  return `<nav style="display:inline-flex;align-items:center;gap:${varRef(
    "sizeXS"
  )};font-family:${varRef("fontFamily")};font-size:${varRef("fontSize")};">${parts}</nav>`;
}
function pagination(opts) {
  const total = Math.max(1, opts.total);
  const current = Math.min(Math.max(1, opts.current), total);
  const cell = (content, active = false, muted = false) => `<span style="${style([
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "min-width:" + varRef("controlHeightSM"),
    "height:" + varRef("controlHeightSM"),
    "padding:0 " + varRef("sizeXXS"),
    "border-radius:" + varRef("borderRadiusSM"),
    "font-family:" + varRef("fontFamily"),
    "font-size:" + varRef("fontSizeSM"),
    "cursor:pointer",
    "user-select:none",
    "box-sizing:border-box",
    "border:" + varRef("lineWidth") + " solid " + (active ? varRef("colorPrimary") : varRef("colorBorderSecondary")),
    "background:" + (active ? varRef("colorPrimary") : varRef("colorBgContainer")),
    "color:" + (active ? "#fff" : muted ? varRef("colorTextQuaternary") : varRef("colorTextSecondary"))
  ])}">${content}</span>`;
  const pages = Array.from({ length: total }, (_, i) => cell(String(i + 1), i + 1 === current)).join("");
  return `<div style="display:inline-flex;gap:${varRef("sizeXXS")};align-items:center;">${cell(
    "&lsaquo;",
    false,
    current === 1
  )}${pages}${cell("&rsaquo;", false, current === total)}</div>`;
}
function progress(opts) {
  const pct = Math.min(100, Math.max(0, Math.round(opts.percent)));
  const done = pct >= 100;
  return `<div style="display:flex;align-items:center;gap:${varRef("sizeSM")};font-family:${varRef(
    "fontFamily"
  )};">
    <div style="${style([
    "flex:1",
    "height:8px",
    "border-radius:4px",
    "background:" + varRef("colorFillSecondary"),
    "overflow:hidden"
  ])}"><div style="${style([
    "width:" + pct + "%",
    "height:100%",
    "border-radius:4px",
    "background:" + (done ? varRef("colorSuccess") : varRef("colorPrimary")),
    "transition:width " + varRef("motionDurationSlow") + " " + varRef("motionEaseOut")
  ])}"></div></div>
    <span style="${style([
    "flex:0 0 auto",
    "font-size:" + varRef("fontSizeSM"),
    "color:" + (done ? varRef("colorSuccess") : varRef("colorTextSecondary"))
  ])}">${done ? "&#10003;" : pct + "%"}</span>
  </div>`;
}
function steps(opts) {
  const current = opts.current ?? 0;
  const connector = `<div style="${style([
    "flex:1 1 " + varRef("sizeXL"),
    "min-width:" + varRef("sizeMD"),
    "height:" + varRef("lineWidth"),
    "background:" + varRef("colorBorderSecondary"),
    "margin-top:14px"
  ])}"></div>`;
  const cells = opts.items.map((item, i) => {
    const state = i < current ? "done" : i === current ? "active" : "todo";
    const disc = `<span style="${style([
      "display:inline-flex",
      "align-items:center",
      "justify-content:center",
      "flex:0 0 auto",
      "width:28px",
      "height:28px",
      "border-radius:50%",
      "font-size:" + varRef("fontSizeSM"),
      "font-weight:" + varRef("fontWeightStrong"),
      "box-sizing:border-box",
      "border:" + varRef("lineWidth") + " solid " + (state === "todo" ? varRef("colorBorder") : varRef("colorPrimary")),
      "background:" + (state === "todo" ? varRef("colorBgContainer") : varRef("colorPrimary")),
      "color:" + (state === "todo" ? varRef("colorTextTertiary") : "#fff")
    ])}">${state === "done" ? "&#10003;" : String(i + 1)}</span>`;
    const desc = item.description ? `<div style="${style([
      "margin-top:2px",
      "font-size:" + varRef("fontSizeSM"),
      "color:" + varRef("colorTextTertiary"),
      "line-height:" + varRef("lineHeight")
    ])}">${esc(item.description)}</div>` : "";
    return `<div style="${style([
      "flex:0 1 auto",
      "min-width:140px",
      "display:flex",
      "gap:" + varRef("sizeSM"),
      "align-items:flex-start"
    ])}">${disc}<div style="min-width:0;padding-top:4px;"><div style="${style([
      "font-weight:" + varRef("fontWeightStrong"),
      "font-size:" + varRef("fontSize"),
      "color:" + varRef("colorText"),
      "line-height:1.3"
    ])}">${esc(item.title)}</div>${desc}</div></div>`;
  }).join(connector);
  return `<div style="display:flex;gap:${varRef(
    "sizeSM"
  )};align-items:flex-start;flex-wrap:wrap;font-family:${varRef("fontFamily")};">${cells}</div>`;
}
function table(opts) {
  const th = opts.columns.map(
    (c) => `<th style="${style([
      "text-align:left",
      "padding:" + varRef("sizeSM") + " " + varRef("sizeMD"),
      "font-size:" + varRef("fontSizeSM"),
      "font-weight:" + varRef("fontWeightStrong"),
      "color:" + varRef("colorTextSecondary"),
      "background:" + varRef("colorFillQuaternary"),
      "border-bottom:" + varRef("lineWidth") + " solid " + varRef("colorBorderSecondary"),
      "white-space:nowrap"
    ])}">${esc(c)}</th>`
  ).join("");
  const trs = opts.rows.map(
    (row, ri) => `<tr>${row.map(
      (cellText) => `<td style="${style([
        "padding:" + varRef("sizeSM") + " " + varRef("sizeMD"),
        "font-size:" + varRef("fontSize"),
        "color:" + varRef("colorText"),
        ri < opts.rows.length - 1 ? "border-bottom:" + varRef("lineWidth") + " solid " + varRef("colorBorderSecondary") : ""
      ])}">${esc(cellText)}</td>`
    ).join("")}</tr>`
  ).join("");
  return `<div style="${style([
    "border:" + varRef("lineWidth") + " solid " + varRef("colorBorderSecondary"),
    "border-radius:" + varRef("borderRadiusLG"),
    "overflow:hidden",
    "background:" + varRef("colorBgContainer")
  ])}"><table style="width:100%;border-collapse:collapse;font-family:${varRef(
    "fontFamily"
  )};"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
}
function accordion(opts) {
  const open = opts.open ?? 0;
  const items = opts.items.map(
    (item, i) => `<details class="kit-acc"${i === open ? " open" : ""} style="${style([
      "border-bottom:" + varRef("lineWidth") + " solid " + varRef("colorBorderSecondary")
    ])}">
    <summary style="${style([
      "display:flex",
      "align-items:center",
      "justify-content:space-between",
      "gap:" + varRef("sizeMD"),
      "padding:" + varRef("sizeMD") + " 0",
      "font-family:" + varRef("fontFamily"),
      "font-size:" + varRef("fontSizeLG"),
      "font-weight:" + varRef("fontWeightStrong"),
      "color:" + varRef("colorText")
    ])}"><span style="min-width:0;">${esc(item.title)}</span><span class="kit-acc-icon" style="${style([
      "flex:0 0 auto",
      "color:" + varRef("colorPrimary"),
      "font-size:" + varRef("fontSizeXL"),
      "line-height:1",
      "font-weight:400"
    ])}">+</span></summary>
    <div style="${style([
      "padding:0 0 " + varRef("sizeMD"),
      "font-family:" + varRef("fontFamily"),
      "font-size:" + varRef("fontSize"),
      "line-height:" + varRef("lineHeight"),
      "color:" + varRef("colorTextSecondary"),
      "max-width:70ch"
    ])}">${esc(item.body)}</div>
  </details>`
  ).join("\n");
  return `<div>${items}</div>`;
}
function testimonial(opts) {
  const body = `<p style="${style([
    "margin:0 0 " + varRef("sizeLG"),
    "font-size:" + varRef("fontSizeLG"),
    "line-height:1.6",
    "color:" + varRef("colorText")
  ])}">&ldquo;${esc(opts.quote)}&rdquo;</p>
  <div style="display:flex;align-items:center;gap:${varRef("sizeSM")};">
    ${avatar({ name: opts.name })}
    <div style="min-width:0;">
      <div style="font-weight:${varRef("fontWeightStrong")};color:${varRef(
    "colorText"
  )};font-size:${varRef("fontSize")};">${esc(opts.name)}</div>
      <div style="font-size:${varRef("fontSizeSM")};color:${varRef("colorTextTertiary")};">${esc(
    opts.role
  )}</div>
    </div>
  </div>`;
  return card({ body });
}
function pricingCard(opts) {
  const hl = opts.highlighted ?? false;
  const features = opts.features.map(
    (f) => `<li style="${style([
      "display:flex",
      "gap:" + varRef("sizeXS"),
      "align-items:flex-start",
      "padding:" + varRef("sizeXXS") + " 0",
      "font-size:" + varRef("fontSize"),
      "line-height:" + varRef("lineHeight"),
      "color:" + varRef("colorTextSecondary")
    ])}"><span style="color:${varRef("colorSuccess")};font-weight:${varRef(
      "fontWeightStrong"
    )};flex:0 0 auto;">&#10003;</span><span>${esc(f)}</span></li>`
  ).join("");
  return `<div style="${style([
    "display:flex",
    "flex-direction:column",
    "position:relative",
    "background:" + varRef("colorBgContainer"),
    "border:" + (hl ? "2px solid " + varRef("colorPrimary") : varRef("lineWidth") + " solid " + varRef("colorBorderSecondary")),
    "border-radius:" + varRef("borderRadiusLG"),
    "padding:" + varRef("sizeXL"),
    "font-family:" + varRef("fontFamily"),
    hl ? "box-shadow:0 12px 32px " + varRef("colorPrimaryBg") : "box-shadow:0 1px 2px " + varRef("colorFillQuaternary")
  ])}">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:${varRef(
    "sizeSM"
  )};margin-bottom:${varRef("sizeXS")};">
      <span style="font-weight:${varRef("fontWeightStrong")};font-size:${varRef(
    "fontSizeLG"
  )};color:${varRef("colorText")};">${esc(opts.plan)}</span>
      ${hl ? tag({ label: "Most popular" }) : ""}
    </div>
    ${opts.blurb ? `<p style="margin:0 0 ${varRef("sizeMD")};font-size:${varRef("fontSizeSM")};color:${varRef(
    "colorTextTertiary"
  )};">${esc(opts.blurb)}</p>` : ""}
    <div style="display:flex;align-items:baseline;gap:${varRef("sizeXXS")};margin-bottom:${varRef(
    "sizeLG"
  )};">
      <span style="font-size:${varRef("fontSizeHeading2")};font-weight:${varRef(
    "fontWeightStrong"
  )};color:${varRef("colorText")};line-height:1;letter-spacing:-0.01em;">${esc(opts.price)}</span>
      ${opts.period ? `<span style="color:${varRef("colorTextTertiary")};font-size:${varRef(
    "fontSizeSM"
  )};">${esc(opts.period)}</span>` : ""}
    </div>
    <ul style="list-style:none;margin:0 0 ${varRef("sizeXL")};padding:0;flex:1;">${features}</ul>
    <div style="display:flex;flex-direction:column;">${button({
    label: opts.cta,
    type: hl ? "primary" : "default",
    size: "md"
  })}</div>
  </div>`;
}
function chip(label, value2) {
  return `<div style="${style([
    "display:flex",
    "flex-direction:column",
    "gap:" + varRef("sizeXXS")
  ])}">
    <div style="${style([
    "height:48px",
    "border-radius:" + varRef("borderRadiusSM"),
    "border:" + varRef("lineWidth") + " solid " + varRef("colorBorderSecondary"),
    "background:" + value2
  ])}"></div>
    <span style="${style([
    "font-size:11px",
    "font-family:" + varRef("fontFamilyCode"),
    "color:" + varRef("colorTextTertiary")
  ])}">${esc(label)}</span>
  </div>`;
}
function swatchRow(title, chips) {
  return `<div style="${style(["margin-bottom:" + varRef("sizeLG")])}">
    <div style="${style([
    "margin-bottom:" + varRef("sizeSM"),
    "font-size:" + varRef("fontSizeSM"),
    "font-weight:" + varRef("fontWeightStrong"),
    "letter-spacing:0.04em",
    "text-transform:uppercase",
    "color:" + varRef("colorTextTertiary")
  ])}">${esc(title)}</div>
    <div style="${style([
    "display:grid",
    "grid-template-columns:repeat(auto-fill,minmax(64px,1fr))",
    "gap:" + varRef("sizeSM")
  ])}">${chips}</div>
  </div>`;
}
function swatches(tokens) {
  const primary = tokens.primaryPalette.map((hex, i) => chip(String((i + 1) * 100 - (i === 0 ? 50 : i === 9 ? -50 : 0)), hex)).join("");
  const functional = [
    chip("primary", tokens.colorPrimary),
    chip("success", tokens.colorSuccess),
    chip("warning", tokens.colorWarning),
    chip("error", tokens.colorError),
    chip("info", tokens.colorInfo)
  ].join("");
  const neutralText = [
    chip("text", tokens.colorText),
    chip("text/2", tokens.colorTextSecondary),
    chip("text/3", tokens.colorTextTertiary),
    chip("text/4", tokens.colorTextQuaternary)
  ].join("");
  const neutralSurface = [
    chip("layout", tokens.colorBgLayout),
    chip("container", tokens.colorBgContainer),
    chip("elevated", tokens.colorBgElevated),
    chip("border", tokens.colorBorder),
    chip("border/2", tokens.colorBorderSecondary)
  ].join("");
  return [
    swatchRow("Primary palette", primary),
    swatchRow("Functional", functional),
    swatchRow("Neutral text", neutralText),
    swatchRow("Surfaces & borders", neutralSurface)
  ].join("");
}
function typeScale(tokens) {
  const rows = [
    { name: "Heading 1", size: tokens.fontSizeHeading1, weight: varRef("fontWeightStrong"), lh: varRef("lineHeightHeading") },
    { name: "Heading 2", size: tokens.fontSizeHeading2, weight: varRef("fontWeightStrong"), lh: varRef("lineHeightHeading") },
    { name: "Heading 3", size: tokens.fontSizeHeading3, weight: varRef("fontWeightStrong"), lh: varRef("lineHeightHeading") },
    { name: "Heading 4", size: tokens.fontSizeHeading4, weight: varRef("fontWeightStrong"), lh: varRef("lineHeightHeading") },
    { name: "Heading 5", size: tokens.fontSizeHeading5, weight: varRef("fontWeightStrong"), lh: varRef("lineHeightHeading") },
    { name: "Large", size: tokens.fontSizeLG, weight: "inherit", lh: varRef("lineHeight") },
    { name: "Body", size: tokens.fontSize, weight: "inherit", lh: varRef("lineHeight") },
    { name: "Small", size: tokens.fontSizeSM, weight: "inherit", lh: varRef("lineHeight") }
  ];
  return rows.map(
    (r) => `<div style="${style([
      "display:flex",
      "align-items:baseline",
      "gap:" + varRef("sizeLG"),
      "padding:" + varRef("sizeSM") + " 0",
      "border-bottom:" + varRef("lineWidth") + " solid " + varRef("colorBorderSecondary")
    ])}">
      <span style="${style([
      "flex:0 0 96px",
      "font-family:" + varRef("fontFamilyCode"),
      "font-size:" + varRef("fontSizeSM"),
      "color:" + varRef("colorTextTertiary")
    ])}">${esc(r.name)} \xB7 ${r.size}px</span>
      <span style="${style([
      "font-family:" + varRef("fontFamily"),
      "font-size:" + r.size + "px",
      "font-weight:" + r.weight,
      "line-height:" + r.lh,
      "color:" + varRef("colorText")
    ])}">The quick brown fox</span>
    </div>`
  ).join("");
}
function rootVars(tokens) {
  const decls = flattenTokens(tokens).map(({ name, value: value2 }) => `  ${name}: ${value2};`).join("\n");
  return `:root{
${decls}
}`;
}
function section(title, caption, content) {
  return `<section style="${style(["margin-bottom:" + varRef("sizeXXL")])}">
    <h2 style="${style([
    "margin:0",
    "font-size:" + varRef("fontSizeHeading4"),
    "font-weight:" + varRef("fontWeightStrong"),
    "line-height:" + varRef("lineHeightHeading"),
    "color:" + varRef("colorText")
  ])}">${esc(title)}</h2>
    <p style="${style([
    "margin:" + varRef("sizeXXS") + " 0 " + varRef("sizeLG"),
    "font-size:" + varRef("fontSize"),
    "color:" + varRef("colorTextTertiary")
  ])}">${esc(caption)}</p>
    ${content}
  </section>`;
}
function renderKitPage(tokens, opts) {
  const title = opts?.title ?? "Brand component kit";
  const brandName = opts?.brandName ?? "Brand";
  const flexRow = style(["display:flex", "flex-wrap:wrap", "gap:" + varRef("size"), "align-items:center"]);
  const grid3 = style([
    "display:grid",
    "grid-template-columns:repeat(auto-fit,minmax(220px,1fr))",
    "gap:" + varRef("sizeLG")
  ]);
  const buttons = `<div style="${flexRow}">
    ${button({ label: "Primary", type: "primary" })}
    ${button({ label: "Default", type: "default" })}
    ${button({ label: "Dashed", type: "dashed" })}
    ${button({ label: "Text", type: "text" })}
    ${button({ label: "Link", type: "link" })}
  </div>
  <div style="${style([flexRow, "margin-top:" + varRef("size")])}">
    ${button({ label: "Small", type: "primary", size: "sm" })}
    ${button({ label: "Medium", type: "primary", size: "md" })}
    ${button({ label: "Large", type: "primary", size: "lg" })}
  </div>`;
  const cards = `<div style="${grid3}">
    ${card({
    title: "Overview",
    body: "Cards group related content on an elevated surface. Radius, border and shadow all read from the derived tokens.",
    footer: button({ label: "Learn more", type: "link", size: "sm" })
  })}
    ${card({
    title: "Usage",
    body: "Drop the same component into a dark or compact theme and it re-skins automatically \u2014 no per-variant markup."
  })}
    ${card({
    body: "A bodyonly card. " + tag({ label: "live" }) + " " + tag({ label: "beta" })
  })}
  </div>`;
  const inputs = `<div style="${style([
    "display:grid",
    "grid-template-columns:repeat(auto-fit,minmax(240px,1fr))",
    "gap:" + varRef("sizeLG"),
    "max-width:720px"
  ])}">
    ${input({ label: "Email", placeholder: "you@example.com" })}
    ${input({ label: "Project name", value: brandName })}
    ${select({ label: "Team size", options: ["Just me", "2\u201310", "11\u201350", "50+"], value: "2\u201310" })}
    ${textarea({ label: "Message", placeholder: "Tell us what you're building\u2026", rows: 3 })}
  </div>
  <div style="${style([flexRow, "margin-top:" + varRef("sizeLG"), "gap:" + varRef("sizeLG")])}">
    ${checkbox({ label: "Email me product updates", checked: true })}
    ${checkbox({ label: "I agree to the terms" })}
    ${switchToggle({ on: true, label: "Notifications" })}
    ${switchToggle({ on: false, label: "Public profile" })}
  </div>`;
  const navigation = `${tabs({ items: ["Overview", "Analytics", "Reports", "Settings"], active: 0 })}
  <div style="${style([
    flexRow,
    "margin-top:" + varRef("sizeLG"),
    "justify-content:space-between",
    "gap:" + varRef("sizeLG")
  ])}">
    ${breadcrumb({ items: [brandName, "Projects", "Brand system"] })}
    ${pagination({ total: 5, current: 2 })}
  </div>
  <div style="margin-top:${varRef("sizeXL")};">
    ${steps({
    current: 1,
    items: [
      { title: "Connect", description: "Point at a source" },
      { title: "Derive", description: "Seed to tokens" },
      { title: "Ship", description: "Export everywhere" }
    ]
  })}
  </div>`;
  const dataDisplay = `${table({
    columns: ["Token", "Role", "Value"],
    rows: [
      ["colorPrimary", "Brand accent", "seed"],
      ["fontSize", "Body type base", "derived"],
      ["borderRadius", "Corner rounding", "derived"]
    ]
  })}
  <div style="${style([
    "display:grid",
    "grid-template-columns:repeat(auto-fit,minmax(140px,1fr))",
    "gap:" + varRef("sizeLG"),
    "margin-top:" + varRef("sizeXL")
  ])}">
    ${stat({ value: "10k+", label: "Teams onboard" })}
    ${stat({ value: "99.9%", label: "Uptime SLA" })}
    ${stat({ value: "4.9/5", label: "Average rating" })}
  </div>
  <div style="${style([flexRow, "margin-top:" + varRef("sizeXL")])}">
    ${avatar({ name: brandName, size: "lg" })}
    ${avatar({ name: "Ada Lovelace" })}
    ${avatar({ name: "Tim B", size: "sm" })}
    ${tag({ label: "design" })} ${tag({ label: "ops", color: "colorSuccess" })}
  </div>
  <div style="margin-top:${varRef("sizeXL")};">
    ${accordion({
    open: 0,
    items: [
      { title: "What is a seed token?", body: "The ~20-field input every other token is derived from. Change one field and the whole system follows." },
      { title: "Can I theme dark mode separately?", body: "No need \u2014 dark is the same seed run through a different algorithm, so it can never drift from the light theme." }
    ]
  })}
  </div>`;
  const marketing = `<div style="${grid3}">
    ${testimonial({
    quote: "We replaced three hand-maintained style guides with one generated system.",
    name: "Ada Lovelace",
    role: "Design lead"
  })}
    ${pricingCard({
    plan: "Pro",
    price: "$29",
    period: "/ mo",
    blurb: "For growing teams.",
    features: ["Unlimited brands", "Dark & compact themes", "Priority support"],
    cta: "Start free trial",
    highlighted: true
  })}
    ${card({
    title: "Composable",
    body: "Marketing blocks (testimonials, pricing, stats) compose the same primitives \u2014 so a landing page is just kit pieces in the right order.",
    footer: button({ label: "View artifacts", type: "link", size: "sm" })
  })}
  </div>`;
  const tags = `<div style="${flexRow}">
    ${tag({ label: "Primary" })}
    ${tag({ label: "Success", color: "colorSuccess" })}
    ${tag({ label: "Warning", color: "colorWarning" })}
    ${tag({ label: "Error", color: "colorError" })}
    ${tag({ label: "Info", color: "colorInfo" })}
  </div>`;
  const alerts = `<div style="${style(["display:flex", "flex-direction:column", "gap:" + varRef("size")])}">
    ${alert({ type: "success", message: "Brand system generated", description: "All design tokens were derived from a single seed color." })}
    ${alert({ type: "info", message: "Tokens map 1:1 onto CSS custom properties." })}
    ${alert({ type: "warning", message: "Wireframe mode is off", description: "Filled surfaces are in use for this theme." })}
    ${alert({ type: "error", message: "Could not reach the source URL." })}
  </div>
  <div style="${style([
    "display:flex",
    "flex-direction:column",
    "gap:" + varRef("sizeSM"),
    "margin-top:" + varRef("sizeXL"),
    "max-width:480px"
  ])}">
    ${progress({ percent: 72 })}
    ${progress({ percent: 100 })}
  </div>`;
  const palette = swatches(tokens);
  const scale = typeScale(tokens);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${opts?.fontLinks ?? ""}
<style>
${rootVars(tokens)}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  font-family:${varRef("fontFamily")};
  font-size:${varRef("fontSize")};
  line-height:${varRef("lineHeight")};
  color:${varRef("colorText")};
  background:${varRef("colorBgLayout")};
  -webkit-font-smoothing:antialiased;
}
h1,h2,h3{font-family:${opts?.displayFamily ?? varRef("fontFamily")}}
a{color:inherit}
${KIT_CSS}
.wrap{max-width:960px;margin:0 auto;padding:${varRef("sizeXXL")} ${varRef("sizeLG")}}
.panel{
  background:${varRef("colorBgContainer")};
  border:${varRef("lineWidth")} solid ${varRef("colorBorderSecondary")};
  border-radius:${varRef("borderRadiusLG")};
  padding:${varRef("sizeXL")};
  margin-bottom:${varRef("sizeXL")};
}
</style>
</head>
<body>
<div class="wrap">
  <header style="${style(["margin-bottom:" + varRef("sizeXXL")])}">
    <div style="${style([
    "display:inline-flex",
    "align-items:center",
    "gap:" + varRef("sizeXS"),
    "padding:" + varRef("sizeXXS") + " " + varRef("sizeSM"),
    "border-radius:" + varRef("borderRadius"),
    "background:" + varRef("colorPrimaryBg"),
    "color:" + varRef("colorPrimary"),
    "font-size:" + varRef("fontSizeSM"),
    "font-weight:" + varRef("fontWeightStrong")
  ])}">${esc(brandName)} \xB7 ${esc(tokens.algorithm)} theme</div>
    <h1 style="${style([
    "margin:" + varRef("size") + " 0 " + varRef("sizeXXS"),
    "font-size:" + varRef("fontSizeHeading1"),
    "font-weight:" + varRef("fontWeightStrong"),
    "line-height:" + varRef("lineHeightHeading"),
    "color:" + varRef("colorText")
  ])}">${esc(title)}</h1>
    <p style="${style([
    "margin:0",
    "max-width:60ch",
    "font-size:" + varRef("fontSizeLG"),
    "color:" + varRef("colorTextSecondary")
  ])}">Every component below is colored only by <code style="font-family:${varRef("fontFamilyCode")}">var(--brand-*)</code> custom properties derived from one seed.</p>
  </header>

  <div class="panel">${section("Buttons", "Five types across three sizes.", buttons)}</div>
  <div class="panel">${section(
    "Form controls",
    "Inputs, selects, textareas, checkboxes and switches share control height, radius and focus ring.",
    inputs
  )}</div>
  <div class="panel">${section(
    "Navigation",
    "Tabs, breadcrumbs, pagination and steps for app shells and flows.",
    navigation
  )}</div>
  <div class="panel">${section("Cards", "Elevated content surfaces with optional header & footer.", cards)}</div>
  <div class="panel">${section(
    "Data display",
    "Tables, stats, avatars and a no-JS accordion for structured content.",
    dataDisplay
  )}</div>
  <div class="panel">${section(
    "Marketing blocks",
    "Testimonials and pricing compose the primitives \u2014 landing pages are these in the right order.",
    marketing
  )}</div>
  <div class="panel">${section("Tags", "Compact labels keyed to functional colors.", tags)}</div>
  <div class="panel">${section("Alerts & progress", "Semantic feedback states.", alerts)}</div>
  <div class="panel">${section("Color", "The full derived palette and neutrals.", palette)}</div>
  <div class="panel">${section("Type scale", "A modular ramp derived from the base font size.", scale)}</div>
</div>
</body>
</html>`;
}

// vendor/od-engine/engine/artifacts/_shared.ts
function esc2(value2) {
  return value2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function rootVars2(tokens) {
  const lines = flattenTokens(tokens).map((d) => `      ${d.name}: ${d.value};`).join("\n");
  return `:root {
${lines}
    }`;
}
function brandFontAssets(brand) {
  const urls = [
    brand.typography?.display?.googleFontsUrl,
    brand.typography?.body?.googleFontsUrl,
    brand.typography?.mono?.googleFontsUrl
  ].filter((u) => Boolean(u && /^https:\/\//.test(u)));
  const unique = [...new Set(urls)];
  const links = unique.length ? [
    `<link rel="preconnect" href="https://fonts.googleapis.com" />`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`,
    ...unique.map((u) => `<link rel="stylesheet" href="${esc2(u)}" />`)
  ].join("\n    ") : "";
  const quote = (f) => /[^a-zA-Z0-9-]/.test(f) ? `'${f.replace(/'/g, "")}'` : f;
  const families = [
    brand.typography?.display?.family,
    ...brand.typography?.display?.fallbacks ?? []
  ].filter((f) => Boolean(f && f.trim()) && isRenderableFontFamily(f));
  const displayFamily = families.length ? [...new Set(families)].map(quote).join(", ") + ", " + varRef("fontFamily") : varRef("fontFamily");
  return { links, displayFamily };
}
function document(opts) {
  const { title, tokens, brand, body } = opts;
  const fonts = brandFontAssets(brand);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc2(title)}</title>
    ${fonts.links}
    <style>
    ${rootVars2(tokens)}
      :root { --display-family: ${fonts.displayFamily}; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: ${varRef("fontFamily")};
        font-size: ${varRef("fontSize")};
        line-height: ${varRef("lineHeight")};
        color: ${varRef("colorText")};
        background: ${varRef("colorBgLayout")};
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      a { color: ${varRef("colorLink")}; text-decoration: none; }
      h1, h2, h3, h4 {
        margin: 0;
        font-family: var(--display-family);
        line-height: ${varRef("lineHeightHeading")};
        font-weight: ${varRef("fontWeightStrong")};
        color: ${varRef("colorText")};
        overflow-wrap: break-word;
      }
      p { margin: 0; overflow-wrap: break-word; }
      img, svg { max-width: 100%; display: block; }
      .wrap { max-width: 1120px; margin: 0 auto; padding-left: clamp(20px, 4vw, 40px); padding-right: clamp(20px, 4vw, 40px); }
      .kicker {
        display: block;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: ${varRef("fontSizeSM")};
        font-weight: ${varRef("fontWeightStrong")};
        color: ${varRef("colorPrimary")};
        margin-bottom: ${varRef("sizeSM")};
      }
      .clamp-2, .clamp-3 { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
      .clamp-2 { -webkit-line-clamp: 2; }
      .clamp-3 { -webkit-line-clamp: 3; }
      ${KIT_CSS}
      ${opts.css ?? ""}
    </style>
  </head>
  <body>
${body}
${opts.script ? `    <script>${opts.script}</script>` : ""}
  </body>
</html>`;
}
var fallbackTagline = "Built from your brand, in one command.";
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function brandTagline(brand) {
  return brand.tagline?.trim() || brand.voice.messagingPillars[0] || fallbackTagline;
}
function brandBlurb(brand) {
  return brand.description?.trim() || brand.voice.tone?.trim() || `${brand.name} \u2014 a brand system derived from a single source.`;
}
function sourceHost(brand) {
  try {
    return new URL(brand.sourceUrl).host || brand.name.toLowerCase();
  } catch {
    return brand.sourceUrl?.trim() || brand.name.toLowerCase();
  }
}
function pillarList(brand) {
  return brand.voice.messagingPillars.map((p) => p.trim()).filter(Boolean);
}
function splitPillar(pillar) {
  const m = pillar.match(/^(.{2,60}?)\s*(?:—|–|:|·)\s+(.{12,})$/);
  if (m) return { title: cap(m[1].trim()), body: cap(m[2].trim()) };
  return { title: cap(pillar) };
}
function pillarTitles(brand) {
  return pillarList(brand).map((p) => splitPillar(p).title);
}
var FEATURE_FALLBACKS = [
  { title: "Set up in minutes", body: "Connect your existing stack and go live without a migration project." },
  { title: "Designed for teams", body: "One shared source of truth, so everyone ships from the same page." },
  { title: "Fast by default", body: "Every interaction is tuned to feel instant, even at scale." },
  { title: "Secure from day one", body: "SSO, audit logs and granular permissions are built in, not bolted on." },
  { title: "Works where you work", body: "Integrates with the tools your team already relies on every day." },
  { title: "Insight you can act on", body: "Reporting that reads like a story, not a spreadsheet." }
];
function featureCards(brand) {
  const pillars = pillarList(brand);
  const adjectives = brand.voice.adjectives.map((a) => a.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < 6; i++) {
    if (pillars[i]) {
      const split = splitPillar(pillars[i]);
      const adj = adjectives[i % Math.max(1, adjectives.length)];
      out.push({
        title: split.title,
        body: split.body ?? (adj ? `${cap(adj)} by design \u2014 and built into every surface ${brand.name} ships.` : FEATURE_FALLBACKS[i].body)
      });
    } else {
      out.push(FEATURE_FALLBACKS[i]);
    }
  }
  return out;
}
function howSteps(brand) {
  return [
    { title: "Connect", body: `Point ${brand.name} at what you already have \u2014 no rebuild required.` },
    { title: "Make it yours", body: "Adjust the defaults until they fit the way your team works." },
    { title: "Launch", body: "Go live with confidence, then iterate from real feedback." }
  ];
}
function faqItems(brand) {
  return [
    { title: `What is ${brand.name}?`, body: brandBlurb(brand) },
    {
      title: "How long does it take to get started?",
      body: "Most teams are up and running in under an hour. There is nothing to install and no migration to plan \u2014 connect, customize, launch."
    },
    {
      title: "Can I try it before committing?",
      body: "Yes. Start on the free plan, invite your team, and upgrade only when you need more. No credit card required."
    },
    {
      title: "How does pricing work?",
      body: "Plans scale with your team. Start free, move to Pro when you need unlimited usage, and talk to us about Enterprise for custom needs."
    },
    {
      title: "What about security and privacy?",
      body: "Your data stays yours. Access is encrypted in transit and at rest, and granular permissions keep the right things with the right people."
    }
  ];
}
function pricingTiers(brand) {
  const pillars = pillarTitles(brand);
  const named = (i, fallback) => pillars[i] ?? fallback;
  return [
    {
      plan: "Starter",
      price: "$0",
      period: "/ mo",
      blurb: "For trying things out.",
      features: ["Up to 3 projects", named(0, "Core features included"), "Community support"],
      cta: "Start for free"
    },
    {
      plan: "Pro",
      price: "$29",
      period: "/ mo",
      blurb: "For growing teams.",
      features: [
        "Unlimited projects",
        named(1, "Everything in Starter"),
        named(2, "Advanced controls"),
        "Priority support"
      ],
      cta: "Start free trial",
      highlighted: true
    },
    {
      plan: "Enterprise",
      price: "Custom",
      blurb: "For organizations at scale.",
      features: ["SSO & audit logs", "Dedicated success manager", "Custom contracts & SLA"],
      cta: "Talk to sales"
    }
  ];
}
function quoteCards(brand) {
  const adj = brand.voice.adjectives.map((a) => a.trim()).filter(Boolean);
  const a0 = adj[0] ?? "polished";
  const a1 = adj[1] ?? "fast";
  return [
    {
      quote: `${brand.name} is the first tool in this space that actually feels ${a0}. It became part of our daily flow within a week.`,
      name: "Maya Chen",
      role: "Head of Design, Northwind"
    },
    {
      quote: `We were skeptical, then we shipped our first project ${a1 ? `\u2014 genuinely ${a1} \u2014 ` : ""}in a single afternoon. The team never looked back.`,
      name: "Jonas Weber",
      role: "Engineering Lead, Lumen Labs"
    },
    {
      quote: `The quality bar out of the box is what sold us. ${brandTagline(brand).replace(/\.$/, "")} is not just a slogan here.`,
      name: "Priya Natarajan",
      role: "Founder, Fieldnote"
    }
  ];
}
function partnerNames(brand) {
  const fromVocab = brand.voice.vocabulary.use.map((w) => w.trim()).filter((w) => w.length > 2);
  const fallbacks = ["Northwind", "Lumen Labs", "Fieldnote", "Arcadia", "Helios"];
  return [...fromVocab.slice(0, 2).map(cap), ...fallbacks].slice(0, 5);
}
function statItems() {
  return [
    { value: "10k+", label: "Teams onboard" },
    { value: "99.9%", label: "Uptime SLA" },
    { value: "4.9/5", label: "Average rating" },
    { value: "120+", label: "Integrations" }
  ];
}
function wordmark(brand, opts) {
  const color = opts?.color ?? varRef("colorText");
  return `<span style="font-family:var(--display-family);font-weight:${varRef(
    "fontWeightStrong"
  )};font-size:${varRef("fontSizeLG")};letter-spacing:-0.01em;color:${color};white-space:nowrap;">${esc2(
    brand.name
  )}</span>`;
}
function inverseButton(label) {
  return `<a role="button" tabindex="0" style="display:inline-flex;align-items:center;justify-content:center;cursor:pointer;white-space:nowrap;user-select:none;font-family:${varRef(
    "fontFamily"
  )};font-weight:${varRef("fontWeightStrong")};line-height:1;text-decoration:none;height:${varRef(
    "controlHeightLG"
  )};padding:0 ${varRef("sizeLG")};font-size:${varRef("fontSizeLG")};border-radius:${varRef(
    "borderRadius"
  )};background:#fff;color:${varRef("colorPrimary")};border:none;">${esc2(label)}</a>`;
}
function sectionHead(kicker, title, lede) {
  return `<div class="section-head">
        <span class="kicker">${esc2(kicker)}</span>
        <h2 style="font-size:clamp(26px, 3.2vw, 38px);letter-spacing:-0.015em;margin-bottom:${varRef(
    "sizeSM"
  )};">${esc2(title)}</h2>
        ${lede ? `<p style="color:${varRef("colorTextSecondary")};font-size:${varRef("fontSizeLG")};">${esc2(lede)}</p>` : ""}
      </div>`;
}
function emailFooter(brand) {
  const link = (label) => `<a href="#" style="color:${varRef("colorTextTertiary")};text-decoration:underline;">${esc2(label)}</a>`;
  return `<div style="padding:${varRef("sizeLG")} ${varRef("sizeXL")};background:${varRef(
    "colorFillQuaternary"
  )};color:${varRef("colorTextTertiary")};font-size:${varRef("fontSizeSM")};border-top:${varRef(
    "lineWidth"
  )} solid ${varRef("colorBorderSecondary")};text-align:center;">
        <p style="margin-bottom:${varRef("sizeXS")};">You're receiving this because you follow ${esc2(
    brand.name
  )}.</p>
        <p>${link("View in browser")} &nbsp;&middot;&nbsp; ${link("Preferences")} &nbsp;&middot;&nbsp; ${link(
    "Unsubscribe"
  )}</p>
        <p style="margin-top:${varRef("sizeXS")};">&copy; ${esc2(brand.name)} &middot; ${esc2(
    sourceHost(brand)
  )}</p>
      </div>`;
}

// vendor/od-engine/engine/artifacts/landing.ts
var CTA_PRIMARY = "Get started free";
var CTA_GHOST = "See how it works";
var MICRO_TRUST = "Free plan \xB7 No credit card \xB7 2-minute setup";
var LANDING_CSS = `
      .nav-links { display: flex; gap: 28px; align-items: center; color: var(--brand-color-text-secondary); }
      .nav-links a { color: var(--brand-color-text-secondary); transition: color .15s ease; }
      .nav-links a:hover { color: var(--brand-color-text); }
      @media (max-width: 820px) { .nav-links { display: none; } }
      .section { padding: clamp(64px, 9vw, 104px) 0; }
      .section-head { max-width: 680px; margin: 0 auto 48px; text-align: center; }
      .pillars { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(16px, 2vw, 24px); }
      @media (max-width: 880px) { .pillars { grid-template-columns: 1fr; } }
      .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; align-items: stretch; }
      .problem-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(14px, 1.8vw, 20px); }
      @media (max-width: 880px) { .problem-grid { grid-template-columns: 1fr; } }
      .zig { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(32px, 5vw, 72px); align-items: center; }
      .zig + .zig { margin-top: clamp(48px, 7vw, 96px); }
      @media (max-width: 880px) { .zig { grid-template-columns: 1fr; gap: 28px; } .zig .zig-visual { order: -1; } }
      .footer-cols { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 32px; }
      @media (max-width: 760px) { .footer-cols { grid-template-columns: 1fr 1fr; } }
      .mock-grid { display: grid; grid-template-columns: 200px minmax(0, 1fr); min-height: 300px; }
      @media (max-width: 720px) { .mock-grid { grid-template-columns: minmax(0, 1fr); } .mock-side { display: none; } }
      .hero-trust { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; }
`;
function lineIcon(index) {
  const stroke = `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;
  const paths = [
    `<path d="M5 12l4 4 10-10" ${stroke}/>`,
    // check
    `<path d="M12 3v18M3 12h18" ${stroke}/>`,
    // plus / build
    `<circle cx="11" cy="11" r="6" ${stroke}/><path d="M20 20l-4-4" ${stroke}/>`,
    // search / insight
    `<path d="M4 13l5 5L20 6" ${stroke}/><path d="M4 7l3 3" ${stroke}/>`,
    // double-check / speed
    `<rect x="4" y="4" width="16" height="16" rx="3" ${stroke}/><path d="M9 12h6M12 9v6" ${stroke}/>`,
    // module
    `<path d="M12 2l3 6 7 .9-5 4.7 1.3 6.9L12 18l-6.3 3.5L7 14.6 2 9.9 9 9z" ${stroke}/>`,
    // star / quality
    `<path d="M4 12a8 8 0 1116 0 8 8 0 01-16 0z" ${stroke}/><path d="M12 8v4l3 2" ${stroke}/>`,
    // clock / time
    `<path d="M3 12h4l3 8 4-16 3 8h4" ${stroke}/>`
    // pulse / scale
  ];
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style="display:block;">${paths[index % paths.length]}</svg>`;
}
function stepGlyph(index) {
  const c = varRef("colorPrimary");
  const faint = varRef("colorBorderSecondary");
  const bars = [
    `<rect x="14" y="40" width="92" height="9" rx="4.5" fill="${faint}"/><rect x="14" y="58" width="58" height="9" rx="4.5" fill="${faint}"/><rect x="14" y="80" width="40" height="14" rx="7" fill="${c}"/>`,
    `<rect x="14" y="38" width="44" height="38" rx="6" fill="none" stroke="${faint}" stroke-width="2"/><rect x="66" y="38" width="44" height="38" rx="6" fill="none" stroke="${c}" stroke-width="2"/><rect x="14" y="84" width="96" height="9" rx="4.5" fill="${faint}"/>`,
    `<path d="M16 70l20 16 28-44" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><rect x="72" y="44" width="38" height="9" rx="4.5" fill="${faint}"/><rect x="72" y="64" width="26" height="9" rx="4.5" fill="${faint}"/>`
  ];
  return `<svg viewBox="0 0 124 108" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${bars[index % bars.length]}</svg>`;
}
function productMock(brand) {
  const bars = [42, 68, 54, 82, 64, 96, 72, 58].map(
    (h, i) => `<div style="flex:1;height:${h}%;border-radius:4px 4px 0 0;background:var(--brand-primary-palette-${i % 4 + 4});"></div>`
  ).join("");
  const skel = (w, h = "10px") => `<div style="width:${w};height:${h};border-radius:5px;background:${varRef("colorFillSecondary")};"></div>`;
  const navRow = (active = false) => `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:${varRef(
    "borderRadiusSM"
  )};${active ? `background:${varRef("colorPrimaryBg")};` : ""}">
      <div style="width:14px;height:14px;border-radius:4px;background:${active ? varRef("colorPrimary") : varRef("colorFill")};"></div>
      ${skel(active ? "64%" : "52%", "8px")}
    </div>`;
  return `<div style="border:${varRef("lineWidth")} solid ${varRef(
    "colorBorderSecondary"
  )};border-radius:14px;overflow:hidden;background:${varRef(
    "colorBgContainer"
  )};box-shadow:0 32px 80px -24px ${varRef("colorFillSecondary")};">
        <div style="display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:${varRef(
    "lineWidth"
  )} solid ${varRef("colorBorderSecondary")};background:${varRef("colorFillQuaternary")};">
          <span style="width:10px;height:10px;border-radius:50%;background:${varRef("colorError")};opacity:.55;"></span>
          <span style="width:10px;height:10px;border-radius:50%;background:${varRef("colorWarning")};opacity:.55;"></span>
          <span style="width:10px;height:10px;border-radius:50%;background:${varRef("colorSuccess")};opacity:.55;"></span>
          <span style="flex:1;max-width:380px;margin-left:12px;height:22px;border-radius:11px;background:${varRef(
    "colorFillTertiary"
  )};display:flex;align-items:center;padding:0 12px;font-size:11px;color:${varRef(
    "colorTextQuaternary"
  )};overflow:hidden;white-space:nowrap;">${esc2(sourceHost(brand))}</span>
        </div>
        <div class="mock-grid">
          <div class="mock-side" style="border-right:${varRef("lineWidth")} solid ${varRef(
    "colorBorderSecondary"
  )};padding:16px 12px;display:flex;flex-direction:column;gap:4px;">
            ${navRow(true)}${navRow()}${navRow()}${navRow()}
          </div>
          <div style="padding:20px;display:flex;flex-direction:column;gap:16px;min-width:0;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
              ${skel("180px", "14px")}
              <div style="width:96px;height:28px;border-radius:${varRef("borderRadius")};background:${varRef(
    "colorPrimary"
  )};"></div>
            </div>
            <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px;flex:1;">
              <div style="border:${varRef("lineWidth")} solid ${varRef(
    "colorBorderSecondary"
  )};border-radius:${varRef(
    "borderRadiusLG"
  )};padding:16px;display:flex;align-items:flex-end;gap:8px;min-height:160px;">${bars}</div>
              <div style="display:flex;flex-direction:column;gap:12px;">
                <div style="border:${varRef("lineWidth")} solid ${varRef(
    "colorBorderSecondary"
  )};border-radius:${varRef(
    "borderRadiusLG"
  )};padding:14px;display:flex;flex-direction:column;gap:8px;">${skel("40%", "8px")}${skel("70%", "14px")}</div>
                <div style="border:${varRef("lineWidth")} solid ${varRef(
    "colorBorderSecondary"
  )};border-radius:${varRef(
    "borderRadiusLG"
  )};padding:14px;display:flex;flex-direction:column;gap:8px;">${skel("46%", "8px")}${skel("60%", "14px")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
}
function adjective(brand, i, fallback) {
  const list = brand.voice.adjectives.map((a) => a.trim().toLowerCase()).filter(Boolean);
  return list.length ? list[i % list.length] : fallback;
}
function heroHeadline(brand) {
  const tagline = brand.tagline?.trim();
  if (tagline) return tagline;
  const pillar = pillarTitles(brand)[0];
  if (pillar) return pillar;
  return `Ship ${adjective(brand, 0, "polished")} work from ${brand.name}, without the busywork`;
}
function heroSubhead(brand) {
  const desc = brand.description?.trim();
  if (desc) return desc;
  const tone = brand.voice.tone?.trim();
  if (tone) return tone;
  return `${brand.name} gives your team one place to go from idea to launch \u2014 ${adjective(
    brand,
    0,
    "fast"
  )}, ${adjective(brand, 1, "consistent")}, and built to scale with you.`;
}
function heroEyebrow(brand) {
  const adj = brand.voice.adjectives.slice(0, 3).map(cap).join(" \xB7 ");
  return adj || `Introducing ${brand.name}`;
}
function problemCards(brand) {
  const avoid = brand.voice.vocabulary.avoid.map((w) => w.trim()).filter(Boolean);
  const fromAvoid = avoid.slice(0, 3).map((w) => ({
    pain: `Stuck with ${w.toLowerCase()}`,
    cost: `Every week it costs you time, momentum and a little more trust from the team.`
  }));
  const fallbacks = [
    {
      pain: "Every deliverable starts from scratch",
      cost: "So the same work gets redone, the backlog grows, and shipping slips by days."
    },
    {
      pain: "The tools don't talk to each other",
      cost: "Context lives in five tabs, hand-offs break, and nobody trusts the source of truth."
    },
    {
      pain: "Quality drifts as you scale",
      cost: "What looked sharp at ten people looks inconsistent at fifty \u2014 and customers notice."
    }
  ];
  return [...fromAvoid, ...fallbacks].slice(0, 3);
}
function agitateLine(brand) {
  return `Sound familiar? The longer it goes unfixed, the more it quietly taxes everything ${brand.name} is supposed to make easy.`;
}
function valuePillars(brand) {
  return featureCards(brand).slice(0, 3);
}
function deepFeatures(brand) {
  const all = featureCards(brand);
  const rest = all.slice(3);
  return (rest.length >= 2 ? rest : all).slice(0, 3);
}
function renderLanding(brand, tokens) {
  const pillars = valuePillars(brand).map(
    (f, i) => `<div style="background:${varRef("colorBgContainer")};border:${varRef(
      "lineWidth"
    )} solid ${varRef("colorBorderSecondary")};border-radius:${varRef(
      "borderRadiusLG"
    )};padding:${varRef("sizeXL")};box-shadow:0 1px 2px ${varRef(
      "colorFillQuaternary"
    )};display:flex;flex-direction:column;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;background:${varRef(
      "colorPrimaryBg"
    )};color:${varRef("colorPrimary")};margin-bottom:${varRef(
      "sizeMD"
    )};">${lineIcon(i)}</div>
          <h3 class="clamp-2" style="font-size:${varRef("fontSizeHeading4")};margin-bottom:${varRef(
      "sizeXS"
    )};">${esc2(f.title)}</h3>
          <p class="clamp-3" style="color:${varRef("colorTextSecondary")};">${esc2(f.body)}</p>
        </div>`
  ).join("\n        ");
  const problems = problemCards(brand).map(
    (p) => `<div style="background:${varRef("colorBgContainer")};border:${varRef(
      "lineWidth"
    )} solid ${varRef("colorBorderSecondary")};border-radius:${varRef(
      "borderRadiusLG"
    )};padding:${varRef("sizeXL")};">
          <div style="display:flex;align-items:flex-start;gap:${varRef("sizeSM")};">
            <span style="flex:0 0 auto;width:8px;height:8px;border-radius:50%;margin-top:9px;background:${varRef(
      "colorError"
    )};"></span>
            <div>
              <h3 style="font-size:${varRef("fontSizeLG")};margin-bottom:${varRef(
      "sizeXXS"
    )};">${esc2(p.pain)}</h3>
              <p class="clamp-3" style="color:${varRef("colorTextTertiary")};font-size:${varRef(
      "fontSize"
    )};">${esc2(p.cost)}</p>
            </div>
          </div>
        </div>`
  ).join("\n        ");
  const how = howSteps(brand).map(
    (s, i) => `<div style="display:flex;flex-direction:column;gap:${varRef("sizeMD")};">
          <div style="aspect-ratio:124/108;border:${varRef("lineWidth")} solid ${varRef(
      "colorBorderSecondary"
    )};border-radius:${varRef("borderRadiusLG")};background:${varRef(
      "colorBgLayout"
    )};padding:${varRef("sizeLG")};">${stepGlyph(i)}</div>
          <div>
            <div style="display:flex;align-items:center;gap:${varRef("sizeSM")};margin-bottom:${varRef(
      "sizeXS"
    )};">
              <span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:${varRef(
      "colorPrimary"
    )};color:#fff;font-size:${varRef("fontSizeSM")};font-weight:${varRef(
      "fontWeightStrong"
    )};">${i + 1}</span>
              <h3 style="font-size:${varRef("fontSizeHeading4")};">${esc2(s.title)}</h3>
            </div>
            <p style="color:${varRef("colorTextSecondary")};max-width:34ch;">${esc2(s.body)}</p>
          </div>
        </div>`
  ).join("\n        ");
  const zig = deepFeatures(brand).map((f, i) => {
    const visual = `<div class="zig-visual" style="border:${varRef("lineWidth")} solid ${varRef(
      "colorBorderSecondary"
    )};border-radius:${varRef("borderRadiusLG")};background:${varRef(
      "colorBgContainer"
    )};box-shadow:0 8px 28px -16px ${varRef(
      "colorFillSecondary"
    )};padding:${varRef("sizeXL")};min-height:240px;display:flex;flex-direction:column;gap:${varRef(
      "sizeMD"
    )};">
            <div style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:${varRef(
      "colorPrimaryBg"
    )};color:${varRef("colorPrimary")};">${lineIcon(i + 3)}</div>
            <div style="height:12px;width:70%;border-radius:6px;background:${varRef(
      "colorFillSecondary"
    )};"></div>
            <div style="height:12px;width:52%;border-radius:6px;background:${varRef(
      "colorFillTertiary"
    )};"></div>
            <div style="margin-top:auto;display:flex;gap:${varRef("sizeSM")};">
              <div style="flex:1;height:64px;border-radius:${varRef(
      "borderRadius"
    )};background:${varRef("colorPrimaryBg")};"></div>
              <div style="flex:1;height:64px;border-radius:${varRef(
      "borderRadius"
    )};border:${varRef("lineWidth")} solid ${varRef("colorBorderSecondary")};"></div>
            </div>
          </div>`;
    const text = `<div>
            <span class="kicker">${esc2(`Capability 0${i + 1}`)}</span>
            <h3 style="font-size:clamp(22px,2.6vw,30px);letter-spacing:-0.015em;margin-bottom:${varRef(
      "sizeSM"
    )};">${esc2(f.title)}</h3>
            <p style="color:${varRef("colorTextSecondary")};font-size:${varRef(
      "fontSizeLG"
    )};max-width:46ch;">${esc2(f.body)}</p>
            <div style="margin-top:${varRef("sizeLG")};">
              ${button({ label: "Learn more", type: "link", size: "md" })}
            </div>
          </div>`;
    return `<div class="zig">${i % 2 === 0 ? text + visual : visual + text}</div>`;
  }).join("\n        ");
  const statsBand = statItems().map(
    (s) => `<div style="text-align:center;">
          <div style="font-family:var(--display-family);font-size:clamp(30px,3.6vw,46px);font-weight:${varRef(
      "fontWeightStrong"
    )};line-height:1.05;color:#fff;letter-spacing:-0.02em;">${esc2(s.value)}</div>
          <div style="margin-top:${varRef("sizeXXS")};font-size:${varRef(
      "fontSizeSM"
    )};color:rgba(255,255,255,0.78);">${esc2(s.label)}</div>
        </div>`
  ).join("\n        ");
  const testimonials = quoteCards(brand).map((q) => testimonial(q)).join("\n        ");
  const partners = partnerNames(brand).map(
    (n) => `<span style="font-family:var(--display-family);font-weight:${varRef(
      "fontWeightStrong"
    )};font-size:${varRef("fontSizeLG")};color:${varRef(
      "colorTextQuaternary"
    )};letter-spacing:0.02em;white-space:nowrap;">${esc2(n)}</span>`
  ).join("\n        ");
  const pricing = pricingTiers(brand).map((t) => pricingCard(t)).join("\n        ");
  const footerCol = (title, items) => `<div>
          <div style="font-weight:${varRef("fontWeightStrong")};font-size:${varRef(
    "fontSizeSM"
  )};text-transform:uppercase;letter-spacing:0.08em;color:${varRef(
    "colorTextTertiary"
  )};margin-bottom:${varRef("sizeMD")};">${esc2(title)}</div>
          <div style="display:flex;flex-direction:column;gap:${varRef("sizeXS")};">
            ${items.map((i) => `<a href="#" style="color:${varRef("colorTextSecondary")};">${esc2(i)}</a>`).join("\n            ")}
          </div>
        </div>`;
  const adjectivesLine = brand.voice.adjectives.slice(0, 3).map(cap).join(" \xB7 ");
  const stars = `<span style="color:${varRef("colorWarning")};letter-spacing:2px;">\u2605\u2605\u2605\u2605\u2605</span>`;
  const body = `    <header style="position:sticky;top:0;z-index:20;background:color-mix(in srgb, ${varRef(
    "colorBgContainer"
  )} 86%, transparent);backdrop-filter:blur(12px);border-bottom:${varRef("lineWidth")} solid ${varRef(
    "colorBorderSecondary"
  )};">
      <div class="wrap" style="display:flex;align-items:center;justify-content:space-between;height:64px;gap:${varRef(
    "sizeLG"
  )};">
        ${wordmark(brand)}
        <nav class="nav-links">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div style="display:flex;gap:${varRef("sizeSM")};align-items:center;">
          ${button({ label: "Sign in", type: "text", size: "sm" })}
          ${button({ label: CTA_PRIMARY, type: "primary", size: "sm" })}
        </div>
      </div>
    </header>

    <!-- 2 \xB7 HERO \u2014 the 5-piece value prop -->
    <main>
    <section class="wrap" style="padding-top:clamp(56px, 9vw, 108px);text-align:center;">
      <div style="max-width:860px;margin:0 auto;">
        ${tag({ label: heroEyebrow(brand) })}
        <h1 style="font-size:clamp(36px, 5.6vw, 64px);letter-spacing:-0.025em;line-height:1.06;margin:${varRef(
    "sizeLG"
  )} auto ${varRef("sizeMD")};max-width:18ch;">${esc2(heroHeadline(brand))}</h1>
        <p style="font-size:${varRef("fontSizeXL")};color:${varRef(
    "colorTextSecondary"
  )};max-width:62ch;margin:0 auto ${varRef("sizeXL")};line-height:1.5;">${esc2(
    heroSubhead(brand)
  )}</p>
        <div style="display:flex;gap:${varRef("sizeSM")};justify-content:center;flex-wrap:wrap;">
          ${button({ label: CTA_PRIMARY, type: "primary", size: "lg" })}
          ${button({ label: CTA_GHOST, type: "default", size: "lg" })}
        </div>
        <p style="margin-top:${varRef("sizeMD")};font-size:${varRef("fontSizeSM")};color:${varRef(
    "colorTextTertiary"
  )};">${esc2(MICRO_TRUST)}</p>
      </div>
      <div style="max-width:980px;margin:clamp(40px, 6vw, 68px) auto 0;">
      ${productMock(brand)}
      </div>
    </section>

    <!-- 3 \xB7 SOCIAL PROOF \u2014 hugs the hero -->
    <section class="wrap" style="padding:clamp(40px,6vw,64px) 0 8px;">
      <div class="hero-trust" style="margin-bottom:${varRef("sizeLG")};">
        ${stars}
        <span style="font-size:${varRef("fontSizeSM")};color:${varRef(
    "colorTextSecondary"
  )};">Rated 4.9/5 by 12,000+ teams</span>
      </div>
      <p style="text-align:center;text-transform:uppercase;letter-spacing:0.16em;font-size:${varRef(
    "fontSizeSM"
  )};color:${varRef("colorTextQuaternary")};margin-bottom:${varRef("sizeLG")};">Trusted by teams at</p>
      <div style="display:flex;justify-content:center;align-items:center;gap:clamp(24px,5vw,56px);flex-wrap:wrap;opacity:0.9;">
        ${partners}
      </div>
    </section>

    <!-- 4 \xB7 PROBLEM \u2014 PAS (P + A) -->
    <section class="section">
      <div class="wrap">
        ${sectionHead(
    "The problem",
    "You're not slow. Your setup is.",
    agitateLine(brand)
  )}
        <div class="problem-grid">
        ${problems}
        </div>
      </div>
    </section>

    <!-- 5 \xB7 VALUE PILLARS \u2014 PAS (S), FAB so each shows the benefit -->
    <section id="value" class="section" style="background:${varRef(
    "colorBgContainer"
  )};border-top:${varRef("lineWidth")} solid ${varRef(
    "colorBorderSecondary"
  )};border-bottom:${varRef("lineWidth")} solid ${varRef("colorBorderSecondary")};">
      <div class="wrap">
        ${sectionHead(
    "Why " + brand.name,
    "Here's how that changes",
    `Three ways ${brand.name} turns the daily grind into something you actually look forward to.`
  )}
        <div class="pillars">
        ${pillars}
        </div>
      </div>
    </section>

    <!-- 6 \xB7 HOW IT WORKS \u2014 3 steps -->
    <section id="how" class="section">
      <div class="wrap">
        ${sectionHead("How it works", "Up and running in three steps", "No migration project. No six-week rollout.")}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:clamp(24px,4vw,48px);">
        ${how}
        </div>
      </div>
    </section>

    <!-- recurring CTA (~every 1.5 screens) \u2014 calm, the loud one is reserved for module 11 -->
    <section class="wrap" style="padding:0 0 clamp(56px,8vw,88px);">
      <div style="border:${varRef("lineWidth")} solid ${varRef(
    "colorPrimaryBorder"
  )};background:${varRef("colorPrimaryBg")};border-radius:clamp(14px,2vw,20px);padding:clamp(24px,4vw,36px) clamp(24px,5vw,48px);display:flex;align-items:center;justify-content:space-between;gap:${varRef(
    "sizeLG"
  )};flex-wrap:wrap;">
        <div style="min-width:0;">
          <h3 style="font-size:clamp(20px,2.4vw,26px);letter-spacing:-0.01em;">See it on your own work in minutes</h3>
          <p style="color:${varRef("colorTextSecondary")};margin-top:${varRef(
    "sizeXXS"
  )};">${esc2(MICRO_TRUST)}</p>
        </div>
        ${button({ label: CTA_PRIMARY, type: "primary", size: "lg" })}
      </div>
    </section>

    <!-- 7 \xB7 FEATURES \u2014 zig-zag deep dive -->
    <section id="features" class="section" style="background:${varRef(
    "colorBgContainer"
  )};border-top:${varRef("lineWidth")} solid ${varRef(
    "colorBorderSecondary"
  )};border-bottom:${varRef("lineWidth")} solid ${varRef("colorBorderSecondary")};">
      <div class="wrap">
        ${sectionHead(
    "A closer look",
    "Built for the way real teams work",
    "Every capability earns its place \u2014 and translates to something you can feel."
  )}
        ${zig}
      </div>
    </section>

    <!-- 8 \xB7 PROOF \u2014 stat band + testimonials -->
    <section style="background:${varRef("colorPrimary")};padding:clamp(48px,6vw,64px) 0;">
      <div class="wrap" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:${varRef(
    "sizeXL"
  )};">
        ${statsBand}
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        ${sectionHead(
    "Proof",
    "Loved by the teams who use it daily",
    "Real results, in their words \u2014 not ours."
  )}
        <div class="grid-3">
        ${testimonials}
        </div>
      </div>
    </section>

    <!-- 9 \xB7 OBJECTION \u2014 FAQ -->
    <section id="faq" class="section" style="background:${varRef(
    "colorBgContainer"
  )};border-top:${varRef("lineWidth")} solid ${varRef(
    "colorBorderSecondary"
  )};border-bottom:${varRef("lineWidth")} solid ${varRef("colorBorderSecondary")};">
      <div class="wrap" style="max-width:780px;">
        ${sectionHead("Before you ask", "Your questions, answered")}
        ${accordion({ items: faqItems(brand), open: 0 })}
      </div>
    </section>

    <!-- 10 \xB7 PRICING \u2014 middle tier highlighted -->
    <section id="pricing" class="section">
      <div class="wrap">
        ${sectionHead("Pricing", "Plans that scale with you", "Start free. Upgrade only when it earns it.")}
        <div class="grid-3" style="max-width:1000px;margin:0 auto;">
        ${pricing}
        </div>
        <p style="text-align:center;margin-top:${varRef("sizeLG")};font-size:${varRef(
    "fontSizeSM"
  )};color:${varRef("colorTextTertiary")};">All prices in USD \xB7 Cancel anytime \xB7 No credit card to start.</p>
      </div>
    </section>
    </main>

    <!-- 11 \xB7 FINAL CTA \u2014 the page's strongest accent -->
    <section class="wrap" style="padding-bottom:clamp(64px,9vw,104px);">
      <div style="background:${varRef("colorPrimary")};border-radius:clamp(18px,2.4vw,28px);padding:clamp(48px,7vw,84px) clamp(24px,5vw,64px);text-align:center;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-100px;right:-90px;width:320px;height:320px;border-radius:50%;background:${varRef(
    "colorPrimaryHover"
  )};opacity:0.5;"></div>
        <div style="position:absolute;bottom:-120px;left:-80px;width:260px;height:260px;border-radius:50%;background:${varRef(
    "colorPrimaryActive"
  )};opacity:0.45;"></div>
        <div style="position:relative;">
          <h2 style="color:#fff;font-size:clamp(28px,4vw,46px);letter-spacing:-0.02em;line-height:1.08;margin-bottom:${varRef(
    "sizeMD"
  )};max-width:20ch;margin-left:auto;margin-right:auto;">Start building with ${esc2(
    brand.name
  )} today</h2>
          <p class="clamp-2" style="color:rgba(255,255,255,0.88);font-size:${varRef(
    "fontSizeLG"
  )};max-width:540px;margin:0 auto ${varRef("sizeXL")};">${esc2(brandTagline(brand))}</p>
          <div style="display:flex;gap:${varRef("sizeSM")};justify-content:center;flex-wrap:wrap;">
            ${inverseButton(CTA_PRIMARY)}
            <a href="#" style="display:inline-flex;align-items:center;height:${varRef(
    "controlHeightLG"
  )};color:rgba(255,255,255,0.92);font-weight:${varRef(
    "fontWeightStrong"
  )};padding:0 ${varRef("sizeMD")};">Talk to us &rarr;</a>
          </div>
          <p style="margin-top:${varRef("sizeMD")};font-size:${varRef(
    "fontSizeSM"
  )};color:rgba(255,255,255,0.72);">2-minute setup \xB7 Cancel anytime</p>
        </div>
      </div>
    </section>

    <!-- 12 \xB7 FOOTER \u2014 grey, small, restrained -->
    <footer style="background:${varRef("colorBgContainer")};border-top:${varRef(
    "lineWidth"
  )} solid ${varRef("colorBorderSecondary")};padding:clamp(48px,6vw,64px) 0 32px;">
      <div class="wrap">
        <div class="footer-cols">
          <div>
            ${wordmark(brand)}
            <p class="clamp-2" style="color:${varRef("colorTextTertiary")};max-width:36ch;margin-top:${varRef(
    "sizeSM"
  )};font-size:${varRef("fontSizeSM")};">${esc2(brandBlurb(brand))}</p>
          </div>
          ${footerCol("Product", ["How it works", "Features", "Pricing", "Changelog"])}
          ${footerCol("Company", ["About", "Blog", "Careers", "Contact"])}
          ${footerCol("Resources", ["Docs", "Support", "Status", "Privacy"])}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:${varRef(
    "sizeLG"
  )};flex-wrap:wrap;margin-top:48px;padding-top:${varRef("sizeLG")};border-top:${varRef(
    "lineWidth"
  )} solid ${varRef("colorBorderSecondary")};font-size:${varRef("fontSizeSM")};color:${varRef(
    "colorTextTertiary"
  )};">
          <span>&copy; ${esc2(brand.name)} &middot; ${esc2(sourceHost(brand))}</span>
          <span>${esc2(adjectivesLine || "Generated brand system")}</span>
        </div>
      </div>
    </footer>`;
  return document({
    title: `${brand.name} \u2014 ${brandTagline(brand)}`,
    tokens,
    brand,
    body,
    css: LANDING_CSS
  });
}

// vendor/od-engine/engine/artifacts/deck.ts
var DECK_CSS = `
      html, body { height: 100%; overflow: hidden; }
      .deck { height: 100vh; overflow-y: auto; scroll-snap-type: y mandatory; scroll-behavior: smooth; }
      .slide { height: 100vh; scroll-snap-align: start; scroll-snap-stop: always; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .frame {
        position: relative; aspect-ratio: 16 / 9;
        width: min(1280px, 94vw, calc((100vh - 48px) * 16 / 9));
        container-type: size;
        background: var(--brand-color-bg-container);
        border: var(--brand-line-width) solid var(--brand-color-border-secondary);
        border-radius: var(--brand-border-radius-lg);
        box-shadow: 0 24px 64px -24px var(--brand-color-fill-secondary), 0 2px 8px var(--brand-color-fill-quaternary);
        overflow: hidden; display: flex; flex-direction: column;
      }
      /* solid-accent slides (cover + traction + ask): restrained 3-page accent budget */
      .frame--accent { background: var(--brand-color-primary); border-color: transparent; }
      .frame--accent .s-kicker { color: rgba(255,255,255,0.72); }
      .frame--accent .s-kicker::before { background: rgba(255,255,255,0.85); }
      .frame--accent .s-title, .frame--accent .s-mega, .frame--accent .s-num { color: #fff; }
      .frame--accent .s-lede, .frame--accent .s-eyebrow { color: rgba(255,255,255,0.85); }
      .frame--accent .f-head, .frame--accent .f-foot { color: rgba(255,255,255,0.62); }
      .frame--accent .f-head .rule, .frame--accent .f-foot .rule { background: rgba(255,255,255,0.2); }
      /* surface slides (alternate bg per \xA73 \u89C6\u89C9\u4E00\u81F4) */
      .frame--surface { background: var(--brand-color-bg-layout); }

      .f-head { display: flex; justify-content: space-between; align-items: center; gap: 2cqi; padding: 3cqi 5cqi 0; color: var(--brand-color-text-quaternary); font-size: 1.35cqi; }
      .f-head .wm { font-family: var(--display-family); font-weight: var(--brand-font-weight-strong); font-size: 1.7cqi; letter-spacing: -0.01em; color: inherit; }
      .f-head .rule { flex: 1; height: var(--brand-line-width); background: var(--brand-color-border-secondary); }
      .f-head .ix { font-variant-numeric: tabular-nums; letter-spacing: 0.12em; }
      .f-body { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 0 5cqi; min-height: 0; overflow: hidden; }
      /* shrink-to-fit layer: the runtime scales this down about its centre when
         a slide's content would otherwise exceed the fixed frame (no-clip).
         flex:none keeps its natural (unshrunk) height so the runtime can
         measure the true overflow instead of a flex-shrunk box. */
      .f-fit { flex: none; width: 100%; transform-origin: center center; will-change: transform; }
      .f-foot { display: flex; justify-content: space-between; align-items: center; gap: 2cqi; padding: 0 5cqi 3cqi; color: var(--brand-color-text-quaternary); font-size: 1.25cqi; }
      .f-foot .rule { flex: 1; height: var(--brand-line-width); background: var(--brand-color-border-secondary); }

      .s-kicker { display: inline-flex; align-items: center; gap: 1.1cqi; text-transform: uppercase; letter-spacing: 0.18em; font-size: 1.3cqi; color: var(--brand-color-primary); font-weight: var(--brand-font-weight-strong); margin-bottom: 2cqi; }
      .s-kicker::before { content: ""; width: 2.6cqi; height: 0.32cqi; border-radius: 1cqi; background: var(--brand-color-primary); }
      .s-eyebrow { font-size: 1.7cqi; color: var(--brand-color-text-tertiary); margin: 0 0 1.6cqi; max-width: 70cqi; }
      .s-title { font-family: var(--display-family); font-size: 4.6cqi; line-height: 1.1; letter-spacing: -0.02em; margin: 0; color: var(--brand-color-text); max-width: 82cqi; }
      .s-mega { font-family: var(--display-family); font-size: 8cqi; line-height: 1.02; letter-spacing: -0.025em; margin: 0; color: var(--brand-color-text); }
      .s-lede { font-size: 1.95cqi; line-height: 1.5; color: var(--brand-color-text-secondary); max-width: 66cqi; margin: 2.4cqi 0 0; }
      .s-accent { color: var(--brand-color-primary); }
      .frame--accent .s-accent { color: #fff; }

      .s-grid { display: grid; gap: 2cqi; margin-top: 4cqi; }
      .s-card { position: relative; background: var(--brand-color-bg-container); border: var(--brand-line-width) solid var(--brand-color-border-secondary); border-radius: 1.4cqi; padding: 2.6cqi; min-width: 0; }
      .frame--surface .s-card { background: var(--brand-color-bg-container); }
      .s-card h3 { font-size: 2cqi; line-height: 1.22; margin: 0 0 1cqi; letter-spacing: -0.01em; }
      .s-card p { font-size: 1.55cqi; line-height: 1.5; color: var(--brand-color-text-secondary); margin: 0; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
      .s-card .tick { display: inline-flex; align-items: center; justify-content: center; width: 3.4cqi; height: 3.4cqi; border-radius: 1cqi; background: var(--brand-color-primary-bg); color: var(--brand-color-primary); margin-bottom: 1.6cqi; }
      .s-card .tick svg { width: 1.9cqi; height: 1.9cqi; }

      .s-num { font-family: var(--display-family); font-size: 3.4cqi; font-weight: var(--brand-font-weight-strong); line-height: 1; color: var(--brand-color-primary); margin-bottom: 1.4cqi; letter-spacing: -0.02em; }

      /* metric tiles (market / traction) */
      .s-metric { min-width: 0; }
      .s-metric .v { font-family: var(--display-family); font-size: 5cqi; font-weight: var(--brand-font-weight-strong); line-height: 1; letter-spacing: -0.03em; color: var(--brand-color-text); }
      .frame--accent .s-metric .v { color: #fff; }
      .s-metric .l { margin-top: 1.2cqi; font-size: 1.5cqi; line-height: 1.35; color: var(--brand-color-text-tertiary); }
      .frame--accent .s-metric .l { color: rgba(255,255,255,0.78); }

      /* market funnel bars \u2014 value labels live OUTSIDE the proportional track in
         their own auto column, so a long label can never wrap/clip the bar. */
      .s-bars { display: flex; flex-direction: column; gap: 1.8cqi; margin-top: 3.4cqi; max-width: 82cqi; }
      .s-bar { display: grid; grid-template-columns: 12cqi 1fr auto; align-items: center; gap: 2cqi; }
      .s-bar .tag { font-size: 1.5cqi; font-weight: var(--brand-font-weight-strong); color: var(--brand-color-text-secondary); letter-spacing: 0.04em; }
      .s-bar .lane { min-width: 0; }
      .s-bar .track { height: 4.2cqi; border-radius: 0.8cqi; }
      .s-bar .val { font-family: var(--display-family); font-weight: var(--brand-font-weight-strong); font-size: 1.9cqi; color: var(--brand-color-text); white-space: nowrap; }
      .frame--accent .s-bar .val { color: #fff; }

      /* competition matrix */
      .s-matrix { display: grid; gap: 1.6cqi; margin-top: 3.4cqi; }
      .s-matrix .row { display: grid; align-items: center; gap: 1.6cqi; padding: 1.8cqi 2.4cqi; border-radius: 1.2cqi; }
      .s-matrix .row.head { color: var(--brand-color-text-tertiary); font-size: 1.4cqi; letter-spacing: 0.08em; text-transform: uppercase; padding-top: 0; padding-bottom: 0; }
      .s-matrix .row.them { background: var(--brand-color-bg-container); border: var(--brand-line-width) solid var(--brand-color-border-secondary); }
      .s-matrix .row.us { background: var(--brand-color-primary-bg); border: 1.5px solid var(--brand-color-primary-border); }
      .s-matrix .cell { font-size: 1.6cqi; min-width: 0; }
      .s-matrix .who { font-family: var(--display-family); font-weight: var(--brand-font-weight-strong); font-size: 1.85cqi; letter-spacing: -0.01em; }
      .s-matrix .us .who { color: var(--brand-color-primary); }
      .s-matrix .mk { display: inline-flex; align-items: center; justify-content: center; width: 3cqi; height: 3cqi; border-radius: 50%; }
      .s-matrix .mk svg { width: 1.7cqi; height: 1.7cqi; }
      .s-matrix .yes { background: var(--brand-color-primary); color: #fff; }
      .s-matrix .no { background: var(--brand-color-fill-tertiary); color: var(--brand-color-text-quaternary); }

      /* team initials */
      .s-team { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2cqi; margin-top: 4cqi; }
      .s-avatar { display: inline-flex; align-items: center; justify-content: center; width: 7cqi; height: 7cqi; border-radius: 50%; font-family: var(--display-family); font-weight: var(--brand-font-weight-strong); font-size: 2.6cqi; background: var(--brand-color-primary-bg); color: var(--brand-color-primary); margin-bottom: 1.6cqi; letter-spacing: 0.02em; }

      /* quote / why-now */
      .s-quote { font-family: var(--display-family); font-size: 3.4cqi; line-height: 1.32; letter-spacing: -0.015em; color: var(--brand-color-text); max-width: 80cqi; margin: 0; }
      .s-byline { display: flex; align-items: center; gap: 1.8cqi; margin-top: 3.6cqi; }
      .s-byline .av { display: inline-flex; align-items: center; justify-content: center; width: 4.6cqi; height: 4.6cqi; border-radius: 50%; background: var(--brand-color-primary-bg); color: var(--brand-color-primary); font-weight: var(--brand-font-weight-strong); font-size: 1.7cqi; }
      .s-byline .n { font-weight: var(--brand-font-weight-strong); font-size: 1.75cqi; color: var(--brand-color-text); }
      .s-byline .r { font-size: 1.45cqi; color: var(--brand-color-text-tertiary); }

      /* ask checklist */
      .s-ask { display: flex; flex-direction: column; gap: 1.8cqi; margin-top: 3.6cqi; max-width: 70cqi; }
      .s-ask .item { display: flex; align-items: flex-start; gap: 1.8cqi; font-size: 2cqi; line-height: 1.4; color: #fff; }
      .s-ask .item .b { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 3.4cqi; height: 3.4cqi; border-radius: 0.9cqi; background: rgba(255,255,255,0.16); margin-top: 0.2cqi; }
      .s-ask .item .b svg { width: 1.9cqi; height: 1.9cqi; }
      .s-ask .item .k { font-family: var(--display-family); font-weight: var(--brand-font-weight-strong); }
      .s-cta { display: inline-flex; align-items: center; gap: 1.4cqi; margin-top: 4cqi; height: 6cqi; padding: 0 3.4cqi; border-radius: 1.2cqi; background: #fff; color: var(--brand-color-primary); font-family: var(--display-family); font-weight: var(--brand-font-weight-strong); font-size: 2.1cqi; letter-spacing: -0.01em; }
      .s-cta svg { width: 2cqi; height: 2cqi; }

      /* product wireframe motif (div/SVG, no screenshots) */
      .s-screen { margin-top: 3.6cqi; border-radius: 1.6cqi; border: var(--brand-line-width) solid var(--brand-color-border-secondary); background: var(--brand-color-bg-container); overflow: hidden; box-shadow: 0 12px 32px -16px var(--brand-color-fill-secondary); }
      .s-screen .bar { display: flex; align-items: center; gap: 1cqi; padding: 1.4cqi 1.8cqi; border-bottom: var(--brand-line-width) solid var(--brand-color-border-secondary); }
      .s-screen .bar i { width: 1.2cqi; height: 1.2cqi; border-radius: 50%; background: var(--brand-color-fill-tertiary); }
      .s-screen .bar .url { margin-left: 1cqi; height: 2.4cqi; flex: 1; max-width: 36cqi; border-radius: 1cqi; background: var(--brand-color-fill-quaternary); }
      .s-screen .canvas { display: grid; grid-template-columns: 16cqi 1fr; min-height: 22cqi; }
      .s-screen .nav { border-right: var(--brand-line-width) solid var(--brand-color-border-secondary); padding: 2cqi 1.6cqi; display: flex; flex-direction: column; gap: 1.4cqi; }
      .s-screen .nav span { height: 1.5cqi; border-radius: 1cqi; background: var(--brand-color-fill-quaternary); }
      .s-screen .nav span:first-child { background: var(--brand-color-primary); width: 70%; }
      .s-screen .main { padding: 2.4cqi; display: flex; flex-direction: column; gap: 1.6cqi; }
      .s-screen .main .h { height: 3cqi; width: 44%; border-radius: 0.8cqi; background: var(--brand-color-fill-tertiary); }
      .s-screen .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.6cqi; }
      .s-screen .tiles i { height: 9cqi; border-radius: 1.2cqi; background: var(--brand-color-fill-quaternary); border: var(--brand-line-width) solid var(--brand-color-border-secondary); }
      .s-screen .tiles i:first-child { background: var(--brand-color-primary-bg); border-color: var(--brand-color-primary-border); }

      /* solution: oversized signature line */
      .s-pillars { display: flex; flex-wrap: wrap; gap: 1.2cqi; margin-top: 3.6cqi; }
      .s-pill { display: inline-flex; align-items: center; gap: 1cqi; padding: 1.2cqi 2cqi; border-radius: 6cqi; border: var(--brand-line-width) solid var(--brand-color-border); font-size: 1.6cqi; font-weight: var(--brand-font-weight-strong); color: var(--brand-color-text-secondary); }
      .s-pill .dot { width: 1cqi; height: 1cqi; border-radius: 50%; background: var(--brand-color-primary); }

      /* pager UI */
      .deck-ui { position: fixed; right: 24px; bottom: 20px; z-index: 30; display: flex; align-items: center; gap: 10px; }
      .deck-ui button {
        width: 38px; height: 38px; border-radius: 50%; cursor: pointer;
        border: var(--brand-line-width) solid var(--brand-color-border);
        background: var(--brand-color-bg-container); color: var(--brand-color-text-secondary);
        font-size: 15px; line-height: 1; display: inline-flex; align-items: center; justify-content: center;
        transition: border-color .15s ease, color .15s ease;
      }
      .deck-ui button:hover { border-color: var(--brand-color-primary); color: var(--brand-color-primary); }
      .deck-counter { font-size: 12px; color: var(--brand-color-text-tertiary); font-variant-numeric: tabular-nums; min-width: 48px; text-align: center; letter-spacing: 0.04em; }
      .deck-dots { position: fixed; left: 50%; transform: translateX(-50%); bottom: 26px; z-index: 30; display: flex; gap: 8px; }
      .deck-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--brand-color-fill); cursor: pointer; transition: all .2s ease; }
      .deck-dot.on { background: var(--brand-color-primary); transform: scale(1.3); }
`;
var DECK_SCRIPT = `
(function () {
  /* od-deck-fit: shrink-to-fit guarantee \u2014 keep every slide's content inside
     the fixed 16:9 frame so brand copy of any length never clips. */
  function fitFrame(body) {
    var fit = body.querySelector('.f-fit');
    if (!fit) return;
    fit.style.transform = 'none';
    var availH = body.clientHeight;
    var availW = fit.clientWidth;
    if (availH <= 0 || availW <= 0) return;
    var naturalH = fit.offsetHeight;
    var naturalW = fit.scrollWidth;
    var scale = Math.min(1, availH / naturalH, availW / naturalW);
    if (scale < 1) {
      // small safety margin so descenders never touch the clip edge
      fit.style.transform = 'scale(' + (scale * 0.98) + ')';
    }
  }
  function fitAll() {
    [].forEach.call(document.querySelectorAll('.f-body'), fitFrame);
  }
  // Fit synchronously rather than via requestAnimationFrame: rAF callbacks are
  // throttled while the deck is offscreen/occluded, which would leave a slide
  // unscaled (and clipped) until first paint. A trailing settle pass catches
  // late reflow (web-font swap, image load).
  var fitTimer;
  function scheduleFit() {
    fitAll();
    if (fitTimer) clearTimeout(fitTimer);
    fitTimer = setTimeout(fitAll, 150);
  }
  window.addEventListener('resize', scheduleFit);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitAll).catch(function () {});
  }
  window.addEventListener('load', fitAll);
  scheduleFit();

  var deck = document.querySelector('.deck');
  var slides = [].slice.call(document.querySelectorAll('.slide'));
  var dots = [].slice.call(document.querySelectorAll('.deck-dot'));
  var counter = document.querySelector('.deck-counter');
  var idx = 0;
  function render() {
    if (counter) counter.textContent = (idx + 1) + ' / ' + slides.length;
    dots.forEach(function (d, n) { d.classList.toggle('on', n === idx); });
  }
  function go(i) {
    idx = Math.max(0, Math.min(slides.length - 1, i));
    slides[idx].scrollIntoView({ behavior: 'smooth' });
    render();
  }
  deck.addEventListener('scroll', function () {
    requestAnimationFrame(function () {
      var i = Math.round(deck.scrollTop / deck.clientHeight);
      if (i !== idx && i >= 0 && i < slides.length) { idx = i; render(); }
    });
  });
  window.addEventListener('keydown', function (e) {
    if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].indexOf(e.key) > -1) { e.preventDefault(); go(idx + 1); }
    else if (['ArrowUp', 'ArrowLeft', 'PageUp'].indexOf(e.key) > -1) { e.preventDefault(); go(idx - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(slides.length - 1); }
  });
  dots.forEach(function (d, n) { d.addEventListener('click', function () { go(n); }); });
  document.querySelector('.deck-prev').addEventListener('click', function () { go(idx - 1); });
  document.querySelector('.deck-next').addEventListener('click', function () { go(idx + 1); });
  render();
})();
`;
var ICON = {
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  dot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`
};
function initials(name) {
  return name.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}
function leadAdj(brand, fallback = "purposeful") {
  const a = brand.voice.adjectives.map((s) => s.trim()).filter(Boolean)[0];
  return cap(a || fallback);
}
function categoryWord(brand) {
  const v = brand.voice.vocabulary.use.map((w) => w.trim()).filter((w) => w.length > 2)[0];
  return v ? v.toLowerCase() : "this category";
}
function renderDeck(brand, tokens) {
  const name = brand.name;
  const host = sourceHost(brand);
  const tagline = brandTagline(brand);
  const blurb = brandBlurb(brand);
  const adjectives = brand.voice.adjectives.slice(0, 3).map(cap);
  const adjLine = adjectives.join(" \xB7 ") || "Brand introduction";
  const pillars = pillarTitles(brand);
  const feats = featureCards(brand);
  const tiers = pricingTiers(brand);
  const quotes = quoteCards(brand);
  const partners = partnerNames(brand);
  const stats = statItems();
  const category = categoryWord(brand);
  const cardGrid = (items, cols) => `<div class="s-grid" style="grid-template-columns:repeat(${cols},1fr);">
            ${items.map(
    (c) => `<div class="s-card">${c.icon ? `<span class="tick">${c.icon}</span>` : ""}<h3>${esc2(c.title)}</h3><p>${esc2(c.body)}</p></div>`
  ).join("\n            ")}
          </div>`;
  const slides = [
    // 1 — COVER (accent, most confident page)
    {
      kicker: adjLine,
      variant: "accent",
      body: `<span class="s-kicker">${esc2(adjLine)}</span>
          <h1 class="s-mega">${esc2(name)}</h1>
          <p class="s-lede" style="font-size:2.6cqi;color:rgba(255,255,255,0.92);">${esc2(tagline)}</p>`
    },
    // 2 — PROBLEM (assertion: the pain is real, big, costly)
    {
      kicker: "The problem",
      variant: "surface",
      body: `<span class="s-kicker">The problem</span>
          <h2 class="s-title">Getting ${esc2(category)} right is still painfully hard.</h2>
          <p class="s-lede">${esc2(blurb)}</p>
          ${cardGrid(
        [
          {
            title: "Tools don't talk",
            body: "Work scatters across apps that never share a source of truth, so context is lost on every handoff.",
            icon: ICON.x
          },
          {
            title: "Every loop costs a day",
            body: "Iteration stalls in coordination \u2014 approvals, exports, re-dos \u2014 long before anything ships.",
            icon: ICON.x
          },
          {
            title: "Quality is a coin flip",
            body: "Output depends on whoever happened to do the work, not on a standard you can rely on.",
            icon: ICON.x
          }
        ],
        3
      )}`
    },
    // 3 — SOLUTION (assertion: one different way to solve it)
    {
      kicker: "The solution",
      body: `<span class="s-kicker">The solution</span>
          <h2 class="s-title"><span class="s-accent">${esc2(name)}</span> ${esc2(
        taglineClause(tagline, name)
      )}</h2>
          <div class="s-pillars">
            ${(pillars.length ? pillars : adjectives).slice(0, 5).map((p) => `<span class="s-pill"><span class="dot"></span>${esc2(p)}</span>`).join("\n            ")}
          </div>`
    },
    // 4 — WHY NOW (golden-line slide, §3 金句页 — inflection point)
    {
      kicker: "Why now",
      body: `<span class="s-kicker">Why now</span>
          <p class="s-quote">The shift toward <span class="s-accent">${esc2(
        leadAdj(brand).toLowerCase()
      )}</span>, accountable ${esc2(category)} is happening now \u2014 and the teams that move first set the standard.</p>
          <div class="s-byline">
            <span class="av">${esc2(initials(name))}</span>
            <div><div class="n">${esc2(name)}</div><div class="r">${esc2(host)}</div></div>
          </div>`
    },
    // 5 — MARKET (assertion: the pool is big enough to bet on)
    {
      kicker: "Market",
      variant: "surface",
      body: `<span class="s-kicker">Market</span>
          <h2 class="s-title">The opportunity is large and still wide open.</h2>
          <div class="s-bars">
            ${marketBars()}
          </div>`
    },
    // 6 — PRODUCT (assertion: it exists and it's good — div/SVG wireframe)
    {
      kicker: "Product",
      body: `<span class="s-kicker">Product</span>
          <h2 class="s-title">${esc2(name)} is real, shipping, and good to use today.</h2>
          <div class="s-screen">
            <div class="bar"><i></i><i></i><i></i><span class="url"></span></div>
            <div class="canvas">
              <div class="nav"><span></span><span></span><span></span><span></span><span></span></div>
              <div class="main"><div class="h"></div><div class="tiles"><i></i><i></i><i></i></div></div>
            </div>
          </div>`
    },
    // 7 — BUSINESS MODEL (assertion: the unit economics work)
    {
      kicker: "Business model",
      variant: "surface",
      body: `<span class="s-kicker">Business model</span>
          <h2 class="s-title">We make money the moment we create value.</h2>
          <div class="s-grid" style="grid-template-columns:repeat(3,1fr);">
            ${tiers.map(
        (t) => `<div class="s-card"${t.highlighted ? ` style="border-color:var(--brand-color-primary);border-width:1.5px;"` : ""}>
              <h3>${esc2(t.plan)}</h3>
              <div style="font-family:var(--display-family);font-size:3.4cqi;font-weight:var(--brand-font-weight-strong);letter-spacing:-0.02em;color:var(--brand-color-text);margin:0.6cqi 0 1.4cqi;">${esc2(
          t.price
        )}<span style="font-size:1.3cqi;color:var(--brand-color-text-tertiary);font-weight:400;"> ${esc2(
          t.period ?? ""
        )}</span></div>
              <p style="-webkit-line-clamp:3;">${esc2(t.features.slice(0, 3).join(" \xB7 "))}</p>
            </div>`
      ).join("\n            ")}
          </div>`
    },
    // 8 — COMPETITION & MOAT (assertion: we're different, with a moat)
    {
      kicker: "Competition & moat",
      body: `<span class="s-kicker">Competition &amp; moat</span>
          <h2 class="s-title">Only ${esc2(name)} is built ${esc2(
        leadAdj(brand).toLowerCase()
      )} from the ground up.</h2>
          <div class="s-matrix" style="grid-template-columns:1fr;">
            <div class="row head" style="grid-template-columns:18cqi repeat(3,1fr);">
              <span></span><span class="cell">${esc2(competeAxes()[0])}</span><span class="cell">${esc2(
        competeAxes()[1]
      )}</span><span class="cell">${esc2(competeAxes()[2])}</span>
            </div>
            ${competeRows(name, partners)}
          </div>`
    },
    // 9 — TRACTION (accent, strongest page — §1-A note: most valuable slide)
    {
      kicker: "Traction",
      variant: "accent",
      body: `<span class="s-kicker">Traction</span>
          <h2 class="s-title" style="font-size:5cqi;">People already want this \u2014 and the line is going up.</h2>
          <div class="s-grid" style="grid-template-columns:repeat(4,1fr);margin-top:5cqi;">
            ${stats.map(
        (s) => `<div class="s-metric"><div class="v">${esc2(s.value)}</div><div class="l">${esc2(
          s.label
        )}</div></div>`
      ).join("\n            ")}
          </div>
          <p class="s-lede" style="color:rgba(255,255,255,0.78);font-size:1.5cqi;max-width:64cqi;margin-top:3.4cqi;">Illustrative figures \u2014 replace with your live numbers before pitching.</p>`
    },
    // 10 — TEAM (assertion: this team can pull it off)
    {
      kicker: "Team",
      variant: "surface",
      body: `<span class="s-kicker">Team</span>
          <h2 class="s-title">The people behind ${esc2(name)} have done this before.</h2>
          <div class="s-team">
            ${quotes.map(
        (q) => `<div class="s-card" style="background:transparent;border:none;padding:0;">
              <span class="s-avatar">${esc2(initials(q.name))}</span>
              <h3 style="font-size:1.9cqi;margin:0 0 0.4cqi;">${esc2(q.name)}</h3>
              <p style="-webkit-line-clamp:2;">${esc2(q.role)}</p>
            </div>`
      ).join("\n            ")}
          </div>`
    },
    // 11 — THE ASK (accent, unambiguous close — §2 诉求页)
    {
      kicker: "The ask",
      variant: "accent",
      body: `<span class="s-kicker">The ask</span>
          <h2 class="s-mega" style="font-size:6.4cqi;">Let's build the future of ${esc2(
        category
      )} together.</h2>
          <div class="s-ask">
            ${askItems(brand).map(
        (a) => `<div class="item"><span class="b">${ICON.check}</span><span><span class="k">${esc2(
          a.k
        )}</span> \u2014 ${esc2(a.v)}</span></div>`
      ).join("\n            ")}
          </div>
          <a class="s-cta">Talk to us &middot; ${esc2(host)} ${ICON.arrow}</a>`
    }
  ];
  const total = slides.length;
  const slideHtml = slides.map((s, i) => {
    const variant = s.variant ? ` frame--${s.variant}` : "";
    const ix = String(i + 1).padStart(2, "0");
    return `      <section class="slide">
        <div class="frame${variant}">
          <div class="f-head"><span class="wm">${esc2(name)}</span><span class="rule"></span><span class="ix">${esc2(
      s.kicker.toUpperCase()
    )}</span></div>
          <div class="f-body">
            <div class="f-fit">
          ${s.body}
            </div>
          </div>
          <div class="f-foot"><span>${esc2(host)}</span><span class="rule"></span><span class="ix">${ix} / ${String(
      total
    ).padStart(2, "0")}</span></div>
        </div>
      </section>`;
  }).join("\n");
  const dots = slides.map(() => `<span class="deck-dot"></span>`).join("");
  const body = `    <main class="deck">
${slideHtml}
    </main>
    <div class="deck-dots">${dots}</div>
    <div class="deck-ui">
      <button class="deck-prev" aria-label="Previous slide">&larr;</button>
      <span class="deck-counter">1 / ${total}</span>
      <button class="deck-next" aria-label="Next slide">&rarr;</button>
    </div>`;
  return document({
    title: `${name} \u2014 Pitch deck`,
    tokens,
    brand,
    body,
    css: DECK_CSS,
    script: DECK_SCRIPT
  });
}
function taglineClause(tagline, name) {
  let t = tagline.trim().replace(/\.$/, "");
  const lead = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[\\s\u2014\u2013:-]*`, "i");
  t = t.replace(lead, "").trim();
  if (/^[a-z]/.test(t) || /^(is|makes|turns|helps|gives|brings|lets)\b/i.test(t)) {
    return t;
  }
  return `is how teams get ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
}
function marketBars() {
  const rows = [
    { tag: "TAM", w: 100, v: "$48B total market", color: `var(--brand-color-primary)` },
    { tag: "SAM", w: 64, v: "$12B reachable today", color: `var(--brand-color-primary-hover)` },
    { tag: "SOM", w: 30, v: "$1.4B near-term wedge", color: `var(--brand-color-primary-active)` }
  ];
  return rows.map(
    (r) => `<div class="s-bar"><span class="tag">${esc2(r.tag)}</span>
              <div class="lane"><div class="track" style="width:${r.w}%;background:${r.color};"></div></div>
              <span class="val">${esc2(r.v)}</span></div>`
  ).join("\n            ");
}
function competeAxes() {
  return ["Built for teams", "Fast to value", "On-brand by default"];
}
function competeRows(name, partners) {
  const yes = `<span class="mk yes">${ICON.check}</span>`;
  const no = `<span class="mk no">${ICON.x}</span>`;
  const them = (label, marks) => `<div class="row them" style="grid-template-columns:18cqi repeat(3,1fr);">
              <span class="cell who" style="color:var(--brand-color-text);">${esc2(label)}</span>
              ${marks.map((m) => `<span class="cell">${m ? yes : no}</span>`).join("")}
            </div>`;
  const a = partners[2] ?? "Legacy suite";
  const b = partners[3] ?? "Point tool";
  return [
    them(a, [false, false, true]),
    them(b, [true, false, false]),
    `<div class="row us" style="grid-template-columns:18cqi repeat(3,1fr);">
              <span class="cell who">${esc2(name)}</span>
              <span class="cell">${yes}</span><span class="cell">${yes}</span><span class="cell">${yes}</span>
            </div>`
  ].join("\n            ");
}
function askItems(brand) {
  const adj = brand.voice.adjectives.map((s) => s.trim()).filter(Boolean)[0] ?? "category-defining";
  return [
    { k: "Partner with us", v: `back the team building the ${adj.toLowerCase()} standard for this market.` },
    { k: "Fuel the next phase", v: "scale the product, the go-to-market motion, and the team." },
    { k: "Hit the milestone", v: "reach the next tier of customers and revenue within 12 months." }
  ];
}

// vendor/od-engine/engine/artifacts/poster.ts
var POSTER_CSS = `
      .poster-stage { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: clamp(20px, 4vw, 48px); background: var(--brand-color-bg-layout); }
      .poster {
        position: relative;
        aspect-ratio: 3 / 4;
        width: min(720px, 92vw, calc((100vh - 96px) * 3 / 4));
        container-type: inline-size;
        background: var(--brand-color-bg-elevated);
        color: var(--brand-color-text);
        border: var(--brand-line-width) solid var(--brand-color-border-secondary);
        border-radius: 1.4cqi;
        overflow: hidden;
        box-shadow: 0 36px 90px var(--brand-color-fill-secondary), 0 4px 12px var(--brand-color-fill-quaternary);
        display: grid;
        grid-template-rows: auto 1fr auto;
        padding: 9cqi;
      }
      /* hairline frame inset \u2014 quiet print-mark, not a banner */
      .poster::after {
        content: "";
        position: absolute; inset: 4cqi;
        border: var(--brand-line-width) solid var(--brand-color-border-secondary);
        border-radius: 0.8cqi;
        pointer-events: none;
      }
      .poster > * { position: relative; z-index: 1; }

      /* \u2500\u2500 three type-size roles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      .p-focal {
        font-family: var(--display-family);
        font-weight: var(--brand-font-weight-strong);
        line-height: 1.02;
        letter-spacing: -0.025em;
        margin: 0;
        text-wrap: balance;
        color: var(--brand-color-text);
      }
      .p-focal .accent { color: var(--brand-color-primary); }
      .p-sub {
        font-size: 3cqi; line-height: 1.42; margin: 0;
        color: var(--brand-color-text-secondary); max-width: 56cqi;
      }
      .p-meta {
        font-size: 1.9cqi; line-height: 1.4; letter-spacing: 0.02em;
        color: var(--brand-color-text-tertiary);
      }
      .p-kicker {
        text-transform: uppercase; letter-spacing: 0.28em;
        font-size: 1.8cqi; font-weight: var(--brand-font-weight-strong);
        color: var(--brand-color-text-tertiary); margin: 0;
      }

      /* the single accent mark that sits on the focal */
      .p-rule { width: 12cqi; height: 0.7cqi; background: var(--brand-color-primary); border-radius: 0.4cqi; }

      /* header band: tiny wordmark + edition tag, like a print masthead */
      .p-head { display: flex; align-items: center; justify-content: space-between; gap: 3cqi; }
      .p-wordmark { font-family: var(--display-family); font-weight: var(--brand-font-weight-strong); font-size: 2.4cqi; letter-spacing: -0.01em; color: var(--brand-color-text); }

      /* signature footer: logo small & confident, like a signature */
      .p-sign { display: flex; align-items: flex-end; justify-content: space-between; gap: 3cqi; }
      .p-sign-mark { display: flex; align-items: center; gap: 1.6cqi; }
      .p-sign-dot { width: 2.6cqi; height: 2.6cqi; border-radius: 50%; background: var(--brand-color-primary); flex: 0 0 auto; }
      .p-sign-name { font-family: var(--display-family); font-weight: var(--brand-font-weight-strong); font-size: 2.8cqi; letter-spacing: -0.01em; color: var(--brand-color-text); }

      /* \u2500\u2500 Event 5W grid \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      .p-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 4cqi 5cqi; margin: 0; }
      .p-fact { display: flex; flex-direction: column; gap: 1cqi; min-width: 0; }
      .p-fact-k { text-transform: uppercase; letter-spacing: 0.2em; font-size: 1.6cqi; font-weight: var(--brand-font-weight-strong); color: var(--brand-color-text-tertiary); }
      .p-fact-v { font-family: var(--display-family); font-weight: var(--brand-font-weight-strong); font-size: 3.4cqi; line-height: 1.12; color: var(--brand-color-text); letter-spacing: -0.01em; }
      /* When + Where are the most-looked-up facts \u2192 give them more weight */
      .p-fact--lead .p-fact-v { font-size: 4cqi; }

      /* CTA block \u2014 one action, scan / short link, with a line-drawn code mark */
      .p-cta { display: flex; align-items: center; gap: 3.4cqi; padding-top: 4cqi; border-top: var(--brand-line-width) solid var(--brand-color-border-secondary); }
      .p-cta-copy { min-width: 0; }
      .p-cta-action { font-family: var(--display-family); font-weight: var(--brand-font-weight-strong); font-size: 3cqi; color: var(--brand-color-text); margin: 0 0 0.6cqi; letter-spacing: -0.01em; }
      .p-cta-link { font-size: 2cqi; color: var(--brand-color-primary); font-weight: var(--brand-font-weight-strong); letter-spacing: 0.01em; }
      .p-code { flex: 0 0 auto; width: 17cqi; height: 17cqi; border: var(--brand-line-width) solid var(--brand-color-border); border-radius: 1cqi; padding: 1.8cqi; background: var(--brand-color-bg-container); }
`;
function kickerLine(brand) {
  const adjs = brand.voice.adjectives.map((a) => a.trim()).filter(Boolean).slice(0, 3);
  return (adjs.length ? adjs.map((a) => a.toUpperCase()).join("  \xB7  ") : "BRAND SYSTEM").trim();
}
function statementHeadline(brand) {
  const tagline = brand.tagline?.trim();
  if (tagline) return tagline;
  const pillars = pillarTitles(brand);
  if (pillars[0]) return pillars[0];
  return `This is ${brand.name}.`;
}
function statementSubhead(brand, headline) {
  const candidates = [
    brand.description?.trim(),
    brand.voice.messagingPillars[1] ? splitPillar(brand.voice.messagingPillars[1]).title : "",
    brand.voice.tone?.trim(),
    brandBlurb(brand)
  ].filter((c) => Boolean(c));
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const head = norm(headline);
  return candidates.find((c) => norm(c) !== head && norm(c).slice(0, 40) !== head.slice(0, 40)) ?? "";
}
function focalMarkup(headline) {
  const text = esc2(headline);
  const firstSpace = text.indexOf(" ");
  if (firstSpace === -1) return `<span class="accent">${text}</span>`;
  const first = text.slice(0, firstSpace);
  const rest = text.slice(firstSpace);
  return `<span class="accent">${first}</span>${rest}`;
}
function impliesEvent(brand) {
  const hay = [
    brand.name,
    brand.tagline,
    brand.description,
    brand.voice.tone,
    ...brand.voice.messagingPillars,
    ...brand.voice.vocabulary.use
  ].join(" ").toLowerCase();
  return /\b(event|conference|summit|meetup|workshop|webinar|launch|premiere|festival|expo|keynote|release party|live(?:stream)?|show(?:case)?|opening|gala|hackathon|demo day|tour|exhibition|screening)\b/.test(
    hay
  );
}
function eventFacts(brand) {
  const pillars = pillarTitles(brand);
  const what = brand.tagline?.trim() || pillars[0] || `${brand.name} Live`;
  const who = [brand.voice.vocabulary.use[0], brand.voice.vocabulary.use[1]].filter(Boolean).map((w) => cap(w.trim())).join(" \xB7 ") || `The ${brand.name} team`;
  return [
    { k: "What", v: what },
    { k: "When", v: "Save the date", lead: true },
    { k: "Where", v: sourceHost(brand), lead: true },
    { k: "Who", v: who }
  ];
}
function codeMotif() {
  const ROWS = [
    "1111111",
    "1001011",
    "1011101",
    "1010001",
    "1101011",
    "1000101",
    "1111011"
  ];
  const cells = [];
  const s = 100 / 7;
  ROWS.forEach((row, y) => {
    for (let x = 0; x < 7; x++) {
      if (row[x] === "1") {
        cells.push(
          `<rect x="${(x * s).toFixed(2)}" y="${(y * s).toFixed(2)}" width="${s.toFixed(2)}" height="${s.toFixed(2)}" rx="${(s * 0.14).toFixed(2)}" />`
        );
      }
    }
  });
  return `<svg viewBox="0 0 100 100" width="100%" height="100%" fill="${varRef(
    "colorText"
  )}" aria-hidden="true" focusable="false">${cells.join("")}</svg>`;
}
function renderStatement(brand) {
  const headline = statementHeadline(brand);
  const subhead = statementSubhead(brand, headline);
  const host = sourceHost(brand);
  const len = headline.length;
  const focalSize = len <= 18 ? "16.5cqi" : len <= 34 ? "12.5cqi" : len <= 60 ? "9.5cqi" : "7.4cqi";
  return `    <div class="poster">
      <header class="p-head">
        <span class="p-wordmark">${esc2(brand.name)}</span>
        <span class="p-meta">${esc2(host)}</span>
      </header>

      <div style="display:flex;flex-direction:column;justify-content:center;gap:4cqi;padding:2cqi 0;">
        <p class="p-kicker">${esc2(kickerLine(brand))}</p>
        <h1 class="p-focal" style="font-size:${focalSize};">${focalMarkup(headline)}</h1>
        <div class="p-rule"></div>
        ${subhead ? `<p class="p-sub">${esc2(subhead)}</p>` : ""}
      </div>

      <footer class="p-sign">
        <span class="p-sign-mark">
          <span class="p-sign-dot"></span>
          <span class="p-sign-name">${esc2(brand.name)}</span>
        </span>
        <span class="p-meta" style="text-align:right;max-width:40cqi;">${esc2(
    brand.voice.adjectives.slice(0, 2).map(cap).join(" \xB7 ") || host
  )}</span>
      </footer>
    </div>`;
}
function renderEvent(brand) {
  const headline = statementHeadline(brand);
  const host = sourceHost(brand);
  const facts = eventFacts(brand);
  const len = headline.length;
  const focalSize = len <= 20 ? "11cqi" : len <= 40 ? "8.4cqi" : "6.4cqi";
  const factsHtml = facts.map(
    (f) => `<div class="p-fact${f.lead ? " p-fact--lead" : ""}">
          <span class="p-fact-k">${esc2(f.k)}</span>
          <span class="p-fact-v">${esc2(f.v)}</span>
        </div>`
  ).join("\n        ");
  return `    <div class="poster">
      <header class="p-head">
        <span class="p-wordmark">${esc2(brand.name)}</span>
        <span class="p-kicker">Event</span>
      </header>

      <div style="display:flex;flex-direction:column;justify-content:center;gap:5cqi;padding:1cqi 0;min-height:0;">
        <div style="display:flex;flex-direction:column;gap:2.6cqi;">
          <p class="p-kicker">${esc2(kickerLine(brand))}</p>
          <h1 class="p-focal" style="font-size:${focalSize};">${focalMarkup(headline)}</h1>
          <div class="p-rule"></div>
        </div>

        <div class="p-facts">
        ${factsHtml}
        </div>

        <div class="p-cta">
          <span class="p-code">${codeMotif()}</span>
          <div class="p-cta-copy">
            <p class="p-cta-action">Scan to RSVP</p>
            <span class="p-cta-link">${esc2(host)}</span>
          </div>
        </div>
      </div>

      <footer class="p-sign">
        <span class="p-sign-mark">
          <span class="p-sign-dot"></span>
          <span class="p-sign-name">${esc2(brand.name)}</span>
        </span>
        <span class="p-meta" style="text-align:right;max-width:40cqi;">${esc2(
    brand.voice.adjectives.slice(0, 2).map(cap).join(" \xB7 ") || host
  )}</span>
      </footer>
    </div>`;
}
function renderPoster(brand, tokens) {
  const body = `    <div class="poster-stage">
${impliesEvent(brand) ? renderEvent(brand) : renderStatement(brand)}
    </div>`;
  return document({
    title: `${brand.name} \u2014 Poster`,
    tokens,
    brand,
    body,
    css: POSTER_CSS
  });
}

// vendor/od-engine/engine/artifacts/email.ts
var trimmed = (s) => (s ?? "").trim();
function noDot(s) {
  return s.replace(/[.。]\s*$/, "");
}
function pick(...vals) {
  for (const v of vals) {
    const t = trimmed(v ?? void 0);
    if (t) return t;
  }
  return "";
}
function leadClaim(brand) {
  const tag2 = trimmed(brand.tagline);
  if (tag2) return tag2;
  const p0 = pillarList(brand)[0];
  if (p0) return cap(splitPillar(p0).title);
  return brandTagline(brand);
}
function subjectLine(brand) {
  const claim = noDot(leadClaim(brand));
  return `${claim} \u2014 from ${brand.name}`;
}
function preheader(brand) {
  const fromDesc = trimmed(brand.description);
  const fromTone = trimmed(brand.voice.tone);
  const adj = brand.voice.adjectives.map(trimmed).filter(Boolean);
  return pick(
    fromDesc,
    fromTone,
    adj.length >= 2 ? `${cap(adj[0])} and ${adj[1]} \u2014 the short version is inside.` : "",
    `A two-minute read on what ${brand.name} changes for your team.`
  );
}
function heroSupport(brand) {
  const blurb = brandBlurb(brand);
  if (noDot(blurb) === noDot(leadClaim(brand))) {
    const adj = brand.voice.adjectives.map(trimmed).filter(Boolean);
    if (adj.length) {
      return `Built to be ${adj.slice(0, 2).join(" and ")}, ${brand.name} earns its place in your day from the very first run.`;
    }
    return `Here is the short version of what ${brand.name} does \u2014 and why it is worth two minutes of your inbox.`;
  }
  return blurb;
}
function ctaLabel(brand) {
  const verbs = brand.voice.vocabulary.use.map(trimmed).filter((w) => w.length > 2);
  const actiony = verbs.find((w) => /^(start|try|build|create|ship|launch|explore|discover|see)/i.test(w));
  if (actiony) return cap(actiony);
  return `Get started with ${brand.name}`;
}
function benefits(brand) {
  const pillars = pillarList(brand);
  const out = [];
  for (let i = 0; i < 3; i++) {
    const p = pillars[i];
    if (p) {
      const { title, body } = splitPillar(p);
      out.push({
        title,
        body: body ?? `${cap(noDot(title))} is built into ${brand.name} from day one \u2014 not bolted on later.`
      });
    } else {
      out.push(FEATURE_FALLBACKS[i]);
    }
  }
  return out;
}
function proof(brand) {
  const adj = brand.voice.adjectives.map(trimmed).filter(Boolean);
  const a0 = adj[0] ?? "useful";
  return {
    quote: `${brand.name} is the first tool here that actually feels ${a0}. It was part of our daily flow inside a week.`,
    name: "Maya Chen",
    role: "Head of Design, Northwind"
  };
}
function bulletproofButton(label, opts) {
  const inverse = opts?.inverse ?? false;
  const bg = inverse ? "#ffffff" : varRef("colorPrimary");
  const fg = inverse ? varRef("colorPrimary") : "#ffffff";
  const border = inverse ? "#ffffff" : varRef("colorPrimary");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;border-collapse:separate;line-height:100%;">
                    <tr>
                      <td align="center" bgcolor="${bg}" style="border-radius:${varRef(
    "borderRadiusLG"
  )};">
                        <a href="#" target="_blank" style="display:inline-block;min-width:200px;padding:16px ${varRef(
    "sizeXL"
  )};font-family:${varRef("fontFamily")};font-size:${varRef(
    "fontSizeLG"
  )};font-weight:${varRef(
    "fontWeightStrong"
  )};line-height:1.1;color:${fg};text-decoration:none;text-align:center;border-radius:${varRef(
    "borderRadiusLG"
  )};border:2px solid ${border};">${esc2(label)}</a>
                      </td>
                    </tr>
                  </table>`;
}
function checkGlyph(color) {
  return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;" aria-hidden="true"><circle cx="10" cy="10" r="9" stroke="${color}" stroke-width="1.5" opacity="0.45"/><path d="M6 10.2l2.6 2.6L14.2 7.4" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function benefitRow(b, accent) {
  return `<tr>
                <td valign="top" style="width:40px;padding:${varRef("sizeSM")} ${varRef(
    "sizeSM"
  )} ${varRef("sizeSM")} 0;">${checkGlyph(accent)}</td>
                <td valign="top" style="padding:${varRef("sizeSM")} 0;">
                  <p style="margin:0 0 4px;font-family:${varRef("fontFamily")};font-size:${varRef(
    "fontSizeLG"
  )};font-weight:${varRef("fontWeightStrong")};color:${varRef(
    "colorText"
  )};line-height:1.3;">${esc2(cap(b.title))}</p>
                  <p style="margin:0;font-family:${varRef("fontFamily")};font-size:16px;color:${varRef(
    "colorTextSecondary"
  )};line-height:1.55;">${esc2(cap(b.body))}</p>
                </td>
              </tr>`;
}
function compliantFooter(brand) {
  const muted = varRef("colorTextTertiary");
  const link = (label) => `<a href="#" target="_blank" style="color:${muted};text-decoration:underline;">${esc2(label)}</a>`;
  return `<tr>
            <td style="padding:${varRef("sizeXL")} ${varRef("sizeXL")};background:${varRef(
    "colorFillQuaternary"
  )};border-top:${varRef("lineWidth")} solid ${varRef(
    "colorBorderSecondary"
  )};text-align:center;">
              <p style="margin:0 0 ${varRef("sizeXS")};font-family:${varRef(
    "fontFamily"
  )};font-size:${varRef("fontSizeSM")};color:${varRef(
    "colorTextTertiary"
  )};line-height:1.5;">You are receiving this because you signed up to hear from ${esc2(
    brand.name
  )}.</p>
              <p style="margin:0 0 ${varRef("sizeXS")};font-family:${varRef(
    "fontFamily"
  )};font-size:${varRef("fontSizeSM")};color:${varRef(
    "colorTextTertiary"
  )};line-height:1.5;">${link("Update preferences")} &nbsp;&middot;&nbsp; ${link(
    "Unsubscribe"
  )}</p>
              <p style="margin:0;font-family:${varRef("fontFamily")};font-size:${varRef(
    "fontSizeSM"
  )};color:${varRef(
    "colorTextQuaternary"
  )};line-height:1.5;">${esc2(brand.name)} &middot; 100 Market Street, Suite 200 &middot; ${esc2(
    sourceHost(brand)
  )}</p>
            </td>
          </tr>`;
}
function renderEmail(brand, tokens) {
  const accent = varRef("colorPrimary");
  const cta = ctaLabel(brand);
  const rows = benefits(brand).map((b) => benefitRow(b, accent)).join("\n");
  const tip = proof(brand);
  const body = `    <!-- hidden preheader: earns the open, complements the subject, never repeats it -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${varRef(
    "colorBgLayout"
  )};opacity:0;">${esc2(preheader(brand))}</div>
    <!-- whitespace eater so the body copy does not leak into the inbox preview -->
    <div style="display:none;max-height:0;overflow:hidden;">&#847;&#8204;&#160;&#847;&#8204;&#160;&#847;&#8204;&#160;&#847;&#8204;&#160;&#847;&#8204;&#160;&#847;&#8204;&#160;&#847;&#8204;&#160;</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${varRef(
    "colorBgLayout"
  )};margin:0;padding:0;">
      <tr>
        <td align="center" style="padding:${varRef("sizeXL")} ${varRef("sizeMD")};">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${varRef(
    "colorBgContainer"
  )};border:${varRef("lineWidth")} solid ${varRef(
    "colorBorderSecondary"
  )};border-radius:${varRef("borderRadiusLG")};overflow:hidden;">

            <!-- Header: logo only, generous whitespace, no nav -->
            <tr>
              <td style="padding:${varRef("sizeLG")} ${varRef("sizeXL")};text-align:center;border-bottom:${varRef(
    "lineWidth"
  )} solid ${varRef("colorBorderSecondary")};">
                ${wordmark(brand)}
              </td>
            </tr>

            <!-- Hero: inverted pyramid \u2014 conclusion first, then why it matters, then the one CTA -->
            <tr>
              <td style="padding:${varRef("sizeXXL")} ${varRef("sizeXL")} ${varRef(
    "sizeLG"
  )};text-align:center;background:${varRef("colorPrimaryBg")};">
                <p style="margin:0 0 ${varRef(
    "sizeSM"
  )};font-family:${varRef("fontFamily")};text-transform:uppercase;letter-spacing:0.16em;font-size:${varRef(
    "fontSizeSM"
  )};font-weight:${varRef("fontWeightStrong")};color:${accent};">${esc2(
    cap(brand.voice.adjectives[0] ?? "Announcement")
  )}</p>
                <h1 style="margin:0 0 ${varRef(
    "sizeMD"
  )};font-family:var(--display-family);font-size:${varRef(
    "fontSizeHeading2"
  )};line-height:1.15;letter-spacing:-0.015em;color:${varRef("colorText")};">${esc2(
    cap(leadClaim(brand))
  )}</h1>
                <p style="margin:0 auto ${varRef(
    "sizeXL"
  )};max-width:46ch;font-family:${varRef("fontFamily")};font-size:${varRef(
    "fontSizeLG"
  )};line-height:1.55;color:${varRef("colorTextSecondary")};">${esc2(
    heroSupport(brand)
  )}</p>
                <!-- the one primary CTA, above the fold -->
                ${bulletproofButton(cta)}
              </td>
            </tr>

            <!-- Body: scannable, human, one idea per block -->
            <tr>
              <td style="padding:${varRef("sizeXL")} ${varRef("sizeXL")} ${varRef("sizeSM")};">
                <p style="margin:0 0 ${varRef(
    "sizeMD"
  )};font-family:${varRef("fontFamily")};font-size:16px;line-height:1.6;color:${varRef(
    "colorText"
  )};">Hi there,</p>
                <p style="margin:0 0 ${varRef(
    "sizeLG"
  )};font-family:${varRef("fontFamily")};font-size:16px;line-height:1.6;color:${varRef(
    "colorTextSecondary"
  )};">Here is what ${esc2(
    brand.name
  )} gives your team from the first day \u2014 no migration project, no setup tax:</p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
${rows}
                </table>
              </td>
            </tr>

            <!-- One named proof point: a person beats a paragraph of adjectives -->
            <tr>
              <td style="padding:0 ${varRef("sizeXL")} ${varRef("sizeLG")};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:${varRef("sizeLG")};background:${varRef(
    "colorFillQuaternary"
  )};border-left:3px solid ${accent};border-radius:${varRef("borderRadius")};">
                      <p style="margin:0 0 ${varRef(
    "sizeSM"
  )};font-family:${varRef("fontFamily")};font-size:${varRef(
    "fontSizeLG"
  )};line-height:1.55;color:${varRef("colorText")};">&ldquo;${esc2(
    tip.quote
  )}&rdquo;</p>
                      <p style="margin:0;font-family:${varRef("fontFamily")};font-size:${varRef(
    "fontSizeSM"
  )};color:${varRef("colorTextTertiary")};"><strong style="color:${varRef(
    "colorText"
  )};font-weight:${varRef("fontWeightStrong")};">${esc2(
    tip.name
  )}</strong> &middot; ${esc2(tip.role)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- CTA repeated once near the end \u2014 same single action -->
            <tr>
              <td style="padding:${varRef("sizeSM")} ${varRef("sizeXL")} ${varRef(
    "sizeXL"
  )};text-align:center;">
                ${bulletproofButton(cta)}
                <p style="margin:${varRef(
    "sizeMD"
  )} 0 0;font-family:${varRef("fontFamily")};font-size:${varRef(
    "fontSizeSM"
  )};color:${varRef(
    "colorTextTertiary"
  )};line-height:1.5;">Questions? Just reply to this email \u2014 a real person reads every message.</p>
              </td>
            </tr>

            <!-- Footer: working unsubscribe + physical address placeholder + brand -->
${compliantFooter(brand)}

          </table>
        </td>
      </tr>
    </table>`;
  return document({
    title: subjectLine(brand),
    tokens,
    brand,
    body,
    css: "img{border:0;outline:none;text-decoration:none;}table{border-spacing:0;}"
  });
}

// vendor/od-engine/engine/artifacts/newsletter.ts
function issueLabel(brand) {
  const adj = brand.voice.adjectives.map((a) => a.trim()).filter(Boolean)[0];
  const word = adj ? `${cap(adj)} reads` : "The digest";
  return `${word} \xB7 Issue 01`;
}
function ledeHeadline(brand) {
  const pillar = pillarTitles(brand)[0];
  if (pillar) return cap(pillar);
  const tag2 = brandTagline(brand).replace(/\.$/, "");
  return tag2 || `Three things worth your time from ${brand.name}`;
}
function ledeBlurb(brand) {
  return brandBlurb(brand);
}
function stories(brand) {
  const ctas = ["Read the full story", "See how it works", "Get the details"];
  return featureCards(brand).slice(0, 3).map((f, i) => ({
    headline: cap(f.title),
    blurb: twoSentences(f.body),
    cta: ctas[i] ?? "Keep reading"
  }));
}
function twoSentences(text) {
  const parts = text.match(/[^.!?]+[.!?]+/g);
  if (!parts || parts.length <= 2) return text.trim();
  return parts.slice(0, 2).join(" ").trim();
}
var PAD_X = varRef("sizeXXL");
function rule() {
  return `<div style="height:${varRef("lineWidth")};background:${varRef(
    "colorBorderSecondary"
  )};margin:0 ${PAD_X};"></div>`;
}
function ctaRow(label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
            <tr><td style="border-radius:${varRef("borderRadius")};">${button({
    label,
    type: "primary",
    size: "lg"
  })}</td></tr>
          </table>`;
}
function storyBlock(story, index) {
  const n = String(index + 1).padStart(2, "0");
  return `      <tr><td style="padding:${varRef("sizeXL")} ${PAD_X} ${varRef("sizeLG")};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
          <tr>
            <td valign="top" style="width:54px;padding-right:${varRef("sizeMD")};">
              <div style="font-family:var(--display-family);font-size:${varRef(
    "fontSizeHeading3"
  )};font-weight:${varRef("fontWeightStrong")};line-height:1;color:${varRef(
    "colorPrimary"
  )};letter-spacing:-0.02em;">${n}</div>
              <div style="margin-top:${varRef("sizeXS")};width:24px;height:${varRef(
    "lineWidth"
  )};background:${varRef("colorPrimaryBorder")};"></div>
            </td>
            <td valign="top">
              <h2 style="font-size:${varRef("fontSizeHeading4")};line-height:1.25;letter-spacing:-0.01em;margin:0 0 ${varRef(
    "sizeXS"
  )};color:${varRef("colorText")};">${esc2(story.headline)}</h2>
              <p style="margin:0 0 ${varRef("sizeMD")};color:${varRef(
    "colorTextSecondary"
  )};font-size:${varRef("fontSize")};line-height:${varRef("lineHeight")};">${esc2(
    story.blurb
  )}</p>
              <a href="#" style="font-weight:${varRef("fontWeightStrong")};font-size:${varRef(
    "fontSize"
  )};color:${varRef("colorLink")};text-decoration:none;">${esc2(
    story.cta
  )} &rarr;</a>
            </td>
          </tr>
        </table>
      </td></tr>`;
}
function renderNewsletter(brand, tokens) {
  const issue = issueLabel(brand);
  const headline = ledeHeadline(brand);
  const blurb = ledeBlurb(brand);
  const items = stories(brand);
  const storyMarkup = items.map((s, i) => `${i > 0 ? `      <tr><td>${rule()}</td></tr>
` : ""}${storyBlock(s, i)}`).join("\n");
  const preheader2 = brandTagline(brand);
  const inner = `      <!-- preheader: shown in the inbox preview, hidden in body -->
      <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${varRef(
    "colorBgContainer"
  )};">${esc2(preheader2)}</div>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
        <!-- masthead -->
        <tr><td style="padding:${varRef("sizeXL")} ${PAD_X} ${varRef(
    "sizeLG"
  )};text-align:center;border-bottom:${varRef("lineWidth")} solid ${varRef(
    "colorBorder"
  )};">
          <div style="display:inline-block;width:32px;height:${varRef(
    "lineWidth"
  )};background:${varRef("colorPrimary")};margin-bottom:${varRef("sizeMD")};"></div>
          <div style="font-family:var(--display-family);font-weight:${varRef(
    "fontWeightStrong"
  )};font-size:${varRef("fontSizeHeading3")};letter-spacing:-0.02em;color:${varRef(
    "colorText"
  )};">${esc2(brand.name)}</div>
          <div style="margin-top:${varRef("sizeXS")};font-size:${varRef(
    "fontSizeSM"
  )};color:${varRef(
    "colorTextTertiary"
  )};text-transform:uppercase;letter-spacing:0.2em;">${esc2(issue)}</div>
        </td></tr>

        <!-- lede: inverted pyramid \u2014 core line + why-relevant, above the fold -->
        <tr><td style="padding:${varRef("sizeXL")} ${PAD_X} ${varRef("sizeMD")};">
          <p style="margin:0 0 ${varRef("sizeXS")};text-transform:uppercase;letter-spacing:0.16em;font-size:${varRef(
    "fontSizeSM"
  )};font-weight:${varRef("fontWeightStrong")};color:${varRef(
    "colorPrimary"
  )};">In this issue</p>
          <h1 style="font-size:${varRef(
    "fontSizeHeading2"
  )};line-height:1.18;letter-spacing:-0.015em;margin:0 0 ${varRef(
    "sizeSM"
  )};color:${varRef("colorText")};">${esc2(headline)}</h1>
          <p style="margin:0;color:${varRef("colorTextSecondary")};font-size:${varRef(
    "fontSizeLG"
  )};line-height:1.6;">${esc2(blurb)}</p>
        </td></tr>

        <!-- primary CTA, surfaced above the fold (one job) -->
        <tr><td style="padding:0 ${PAD_X} ${varRef("sizeXL")};text-align:center;">
          ${ctaRow("Read this issue")}
        </td></tr>

        <tr><td>${rule()}</td></tr>

        <!-- numbered stories -->
${storyMarkup}

        <tr><td>${rule()}</td></tr>

        <!-- closing CTA: same action, echoed once (email.md) -->
        <tr><td style="padding:${varRef("sizeXL")} ${PAD_X} ${varRef(
    "sizeXXL"
  )};text-align:center;">
          <p style="margin:0 0 ${varRef("sizeMD")};color:${varRef(
    "colorTextSecondary"
  )};font-size:${varRef("fontSize")};">That's the issue. ${esc2(
    cap(brand.name)
  )} lands in your inbox next week.</p>
          ${ctaRow("Read this issue")}
        </td></tr>
      </table>
${emailFooter(brand)}`;
  const body = `    <div style="padding:${varRef("sizeXL")} ${varRef("sizeMD")};">
      <div style="max-width:600px;margin:0 auto;background:${varRef(
    "colorBgContainer"
  )};border:${varRef("lineWidth")} solid ${varRef("colorBorderSecondary")};border-radius:${varRef(
    "borderRadiusLG"
  )};overflow:hidden;">
${inner}
      </div>
    </div>`;
  return document({ title: `${brand.name} \u2014 Newsletter`, tokens, brand, body });
}

// vendor/od-engine/engine/artifacts/form.ts
function firstOf(values, fallback) {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return fallback;
}
var labelStyle = `display:flex;align-items:baseline;justify-content:space-between;gap:${varRef(
  "sizeSM"
)};margin-bottom:${varRef("sizeXXS")};font-size:${varRef("fontSizeSM")};font-weight:${varRef(
  "fontWeightStrong"
)};color:${varRef("colorText")};`;
var optionalStyle = `font-weight:400;font-size:${varRef("fontSizeSM")};color:${varRef(
  "colorTextQuaternary"
)};`;
var helpStyle = `margin:${varRef("sizeXXS")} 0 0;font-size:${varRef("fontSizeSM")};color:${varRef(
  "colorTextTertiary"
)};line-height:1.4;`;
var controlBase = `box-sizing:border-box;width:100%;font-family:${varRef(
  "fontFamily"
)};font-size:${varRef("fontSize")};color:${varRef("colorText")};background:${varRef(
  "colorBgContainer"
)};border:${varRef("lineWidth")} solid ${varRef("colorBorder")};border-radius:${varRef(
  "borderRadius"
)};outline:none;`;
var inputBase = `${controlBase}height:${varRef("controlHeightLG")};padding:0 ${varRef("size")};`;
function fieldLabel2(text, mark) {
  const tag2 = mark ? `<span style="${optionalStyle}">${mark === "optional" ? "Optional" : "Required"}</span>` : "";
  return `<label style="${labelStyle}"><span>${esc2(text)}</span>${tag2}</label>`;
}
function fieldHelp(text) {
  return text ? `<p style="${helpStyle}">${esc2(text)}</p>` : "";
}
function field(opts) {
  const type = opts.type ?? "text";
  const ph = opts.placeholder ? ` placeholder="${esc2(opts.placeholder)}"` : "";
  const im = opts.inputmode ? ` inputmode="${esc2(opts.inputmode)}"` : "";
  const ac = opts.autocomplete ? ` autocomplete="${esc2(opts.autocomplete)}"` : "";
  const err = opts.error ? `<p class="fld-err">${esc2(opts.error)}</p>` : "";
  return `<div class="fld">
            ${fieldLabel2(opts.label, opts.mark)}
            <input type="${esc2(type)}"${ph}${im}${ac} style="${inputBase}">
            ${err}
            ${fieldHelp(opts.help)}
          </div>`;
}
function selectField(opts) {
  const arrow = `background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23888' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right ${varRef(
    "size"
  )} center;`;
  const options = [
    `<option value="" disabled selected>${esc2(opts.prompt)}</option>`,
    ...opts.options.map((o) => `<option>${esc2(o)}</option>`)
  ].join("");
  return `<div class="fld">
            ${fieldLabel2(opts.label, opts.mark)}
            <select style="${inputBase}-webkit-appearance:none;-moz-appearance:none;appearance:none;cursor:pointer;padding-right:${varRef(
    "sizeXXL"
  )};${arrow}">${options}</select>
            ${fieldHelp(opts.help)}
          </div>`;
}
function textareaField(opts) {
  const taStyle = `${controlBase}display:block;min-height:${varRef("controlHeightLG")};padding:${varRef(
    "sizeSM"
  )} ${varRef("size")};line-height:${varRef("lineHeight")};resize:vertical;`;
  const ph = opts.placeholder ? ` placeholder="${esc2(opts.placeholder)}"` : "";
  return `<div class="fld">
            ${fieldLabel2(opts.label, opts.mark)}
            <textarea rows="${opts.rows ?? 4}"${ph} style="${taStyle}"></textarea>
            ${fieldHelp(opts.help)}
          </div>`;
}
function checkboxField(opts) {
  return `<label class="cbx" style="display:flex;align-items:flex-start;gap:${varRef(
    "sizeSM"
  )};font-size:${varRef("fontSize")};line-height:${varRef("lineHeight")};color:${varRef(
    "colorTextSecondary"
  )};cursor:pointer;">
            <input type="checkbox"${opts.checked ? " checked" : ""} style="accent-color:${varRef(
    "colorPrimary"
  )};width:18px;height:18px;margin:2px 0 0;flex:0 0 auto;cursor:pointer;">
            <span>${esc2(opts.label)}</span>
          </label>`;
}
var footerDot = `<span style="flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:${varRef(
  "borderRadiusSM"
)};background:${varRef("colorPrimaryBg")};"><svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 6h7M6 2.5L9.5 6 6 9.5" stroke="${varRef(
  "colorPrimary"
)}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
var PANEL_MOTIF = `<svg width="220" height="220" viewBox="0 0 220 220" fill="none" aria-hidden="true" style="position:absolute;top:-40px;right:-40px;opacity:0.18;color:#fff;"><defs><pattern id="fdot" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="currentColor"/></pattern></defs><rect width="220" height="220" fill="url(#fdot)"/></svg>`;
var FORM_CSS = `
      .form-split { display: grid; grid-template-columns: minmax(320px, 4.6fr) minmax(380px, 5.4fr); min-height: 100vh; }
      @media (max-width: 900px) { .form-split { grid-template-columns: 1fr; } .form-brand { min-height: 340px; } }
      .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: ${varRef("size")}; }
      @media (max-width: 540px) { .form-grid-2 { grid-template-columns: 1fr; } }
      .fld input:focus, .fld textarea:focus, .fld select:focus { border-color: ${varRef(
  "colorPrimary"
)} !important; box-shadow: 0 0 0 3px ${varRef("colorPrimaryBg")}; }
      .fld input:invalid:not(:placeholder-shown) { border-color: ${varRef("colorError")}; }
      .fld input:invalid:not(:placeholder-shown) ~ .fld-err { display: block; }
      .fld-err { display: none; margin: ${varRef("sizeXXS")} 0 0; font-size: ${varRef(
  "fontSizeSM"
)}; color: ${varRef("colorError")}; }
      .form-card { transition: box-shadow ${varRef("motionDurationMid")} ${varRef("motionEaseInOut")}; }
`;
function renderFormPage(brand, tokens) {
  const pillars = pillarTitles(brand);
  const reasons = (pillars.length >= 2 ? pillars : FEATURE_FALLBACKS.map((f) => f.title)).slice(0, 3).map(cap);
  const adjectives = brand.voice.adjectives.map((a) => a.trim()).filter(Boolean);
  const niceWord = adjectives[0] ? adjectives[0].toLowerCase() : "in good hands";
  const panelTitle = firstOf([brand.tagline], `Start with ${brand.name}`);
  const panelBlurb = brandBlurb(brand);
  const formTitle = `Tell us where to start`;
  const formSub = `A couple of details and ${esc2(
    brand.name
  )} takes it from there \u2014 no account needed yet.`;
  const topicOptions = (pillars.length >= 3 ? pillars.slice(0, 5) : [
    "Getting started",
    "Pricing & plans",
    "A partnership",
    "Something else"
  ]).map(cap);
  const reasonList = reasons.map(
    (r) => `<li style="display:flex;gap:${varRef(
      "sizeSM"
    )};align-items:flex-start;padding:${varRef("sizeXS")} 0;color:rgba(255,255,255,0.92);font-size:${varRef(
      "fontSizeLG"
    )};line-height:1.45;">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" style="flex:0 0 auto;margin-top:3px;"><path d="M3.5 9.5L7 13l7.5-8" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>${esc2(r)}</span>
          </li>`
  ).join("");
  const reassureLine = firstOf(
    [brand.voice.tone],
    `It's free to start, and you're ${niceWord} the whole way.`
  );
  const brandPanel = `<div class="form-brand" style="background:${varRef(
    "colorPrimary"
  )};color:#fff;padding:clamp(32px,5vw,64px);display:flex;flex-direction:column;justify-content:space-between;gap:${varRef(
    "sizeXL"
  )};position:relative;overflow:hidden;">
        ${PANEL_MOTIF}
        <div style="position:absolute;bottom:-140px;left:-100px;width:320px;height:320px;border-radius:50%;background:${varRef(
    "colorPrimaryActive"
  )};opacity:0.45;"></div>
        <div style="position:relative;display:flex;align-items:center;gap:${varRef("sizeSM")};">
          <span style="display:inline-flex;width:30px;height:30px;border-radius:${varRef(
    "borderRadius"
  )};background:rgba(255,255,255,0.16);align-items:center;justify-content:center;">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1.5 7l3.5 3.5L12.5 3" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          ${wordmark(brand, { color: "#fff" })}
        </div>
        <div style="position:relative;max-width:42ch;">
          <h1 style="color:#fff;font-size:clamp(28px,3.4vw,42px);letter-spacing:-0.02em;line-height:1.08;margin-bottom:${varRef(
    "sizeMD"
  )};">${esc2(panelTitle)}</h1>
          <p class="clamp-3" style="color:rgba(255,255,255,0.82);font-size:${varRef(
    "fontSizeLG"
  )};line-height:1.55;margin-bottom:${varRef("sizeLG")};">${esc2(panelBlurb)}</p>
          <ul style="list-style:none;margin:0;padding:0;">${reasonList}</ul>
        </div>
        <div style="position:relative;display:flex;align-items:center;gap:${varRef(
    "sizeSM"
  )};color:rgba(255,255,255,0.7);font-size:${varRef("fontSizeSM")};">
          <span style="display:inline-flex;width:8px;height:8px;border-radius:50%;background:${varRef(
    "colorSuccess"
  )};box-shadow:0 0 0 4px rgba(255,255,255,0.12);"></span>
          <span>${esc2(reassureLine)}</span>
        </div>
      </div>`;
  const formFields = `<div style="display:flex;flex-direction:column;gap:${varRef("sizeLG")};">
            <div class="form-grid-2">
              ${field({
    label: "First name",
    placeholder: "Ada",
    autocomplete: "given-name"
  })}
              ${field({
    label: "Last name",
    placeholder: "Lovelace",
    autocomplete: "family-name"
  })}
            </div>
            ${field({
    label: "Work email",
    type: "email",
    placeholder: "you@company.com",
    inputmode: "email",
    autocomplete: "email",
    help: "We'll send your next steps here.",
    error: "That doesn't look like an email yet \u2014 try name@company.com."
  })}
            ${selectField({
    label: "What can we help with?",
    prompt: "Choose one\u2026",
    options: topicOptions,
    help: "Pick the closest \u2014 you can change direction later."
  })}
            ${textareaField({
    label: "Anything we should know?",
    mark: "optional",
    rows: 4,
    placeholder: `A sentence or two about what you're trying to do with ${brand.name}\u2026`
  })}
            ${checkboxField({
    label: `Keep me posted on what's new at ${brand.name}. No noise, easy to turn off.`
  })}
          </div>`;
  const ctaBlock = `<div style="display:flex;flex-direction:column;gap:${varRef(
    "sizeSM"
  )};margin-top:${varRef("size")};">
            <div style="display:flex;flex-direction:column;">
              ${button({ label: `Get started with ${brand.name}`, type: "primary", size: "lg" })}
            </div>
            <p style="display:flex;align-items:center;justify-content:center;gap:${varRef(
    "sizeXS"
  )};font-size:${varRef("fontSizeSM")};color:${varRef("colorTextTertiary")};text-align:center;">
              <svg width="13" height="14" viewBox="0 0 13 14" fill="none" aria-hidden="true" style="flex:0 0 auto;"><path d="M2 6V4.5a4.5 4.5 0 019 0V6m-10 0h11v7H1.5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>No spam, ever. Unsubscribe in one click \u2014 your data stays yours.</span>
            </p>
          </div>`;
  const successState = `<div class="form-success" hidden style="display:none;flex-direction:column;align-items:center;text-align:center;gap:${varRef(
    "sizeMD"
  )};padding:${varRef("sizeXL")} 0;">
          <span style="display:inline-flex;width:56px;height:56px;border-radius:50%;background:${varRef(
    "colorSuccessBg"
  )};align-items:center;justify-content:center;">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true"><path d="M6 13.5l4.5 4.5L20 7" stroke="${varRef(
    "colorSuccess"
  )}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <h2 style="font-size:${varRef("fontSizeHeading4")};">You're in.</h2>
          <p style="color:${varRef("colorTextSecondary")};max-width:34ch;">Check your inbox for a note from ${esc2(
    brand.name
  )} \u2014 your next step is waiting there. We usually reply within one business day.</p>
        </div>`;
  const formCard = `<div style="display:flex;align-items:center;justify-content:center;padding:clamp(24px,4vw,64px);background:${varRef(
    "colorBgLayout"
  )};">
        <div class="form-card" style="width:100%;max-width:520px;background:${varRef(
    "colorBgContainer"
  )};border:${varRef("lineWidth")} solid ${varRef(
    "colorBorderSecondary"
  )};border-radius:${varRef("borderRadiusLG")};padding:clamp(28px,4vw,44px);box-shadow:0 24px 60px ${varRef(
    "colorFillQuaternary"
  )}, 0 2px 8px ${varRef("colorFillQuaternary")};">
          <header style="margin-bottom:${varRef("sizeLG")};">
            <h2 style="font-size:${varRef("fontSizeHeading3")};letter-spacing:-0.015em;margin-bottom:${varRef(
    "sizeXS"
  )};">${esc2(formTitle)}</h2>
            <p style="color:${varRef("colorTextTertiary")};font-size:${varRef(
    "fontSize"
  )};">${formSub}</p>
          </header>

          <form novalidate onsubmit="this.querySelector('.form-body').style.display='none';var s=this.querySelector('.form-success');s.hidden=false;s.style.display='flex';return false;">
            <div class="form-body" style="display:flex;flex-direction:column;gap:${varRef("sizeLG")};">
              ${formFields}
              ${ctaBlock}
            </div>
            ${successState}
          </form>

          <div style="margin-top:${varRef("sizeLG")};padding-top:${varRef(
    "sizeLG"
  )};border-top:${varRef("lineWidth")} solid ${varRef(
    "colorBorderSecondary"
  )};display:flex;align-items:center;justify-content:space-between;gap:${varRef(
    "sizeSM"
  )};color:${varRef("colorTextQuaternary")};font-size:${varRef("fontSizeSM")};">
            <span style="display:inline-flex;align-items:center;gap:${varRef(
    "sizeXS"
  )};">${footerDot}<span style="color:${varRef("colorTextTertiary")};">${esc2(
    cap(brandTagline(brand).replace(/\.$/, ""))
  )}</span></span>
            <span>${esc2(sourceHost(brand))}</span>
          </div>
        </div>
      </div>`;
  const body = `    <div class="form-split">
      ${brandPanel}
      ${formCard}
    </div>`;
  return document({
    title: `${brand.name} \u2014 Get started`,
    tokens,
    brand,
    body,
    css: FORM_CSS
  });
}

// vendor/od-engine/engine/artifacts/generic.ts
function renderGeneric(kind, brand, tokens) {
  const label = cap(kind);
  const inner = `<p style="color:${varRef("colorTextSecondary")};margin-bottom:${varRef(
    "sizeLG"
  )};">${esc2(brandBlurb(brand))}</p>
        <div style="display:flex;gap:${varRef("sizeSM")};align-items:center;">
          ${button({ label: "Open", type: "primary", size: "md" })}
          ${tag({ label })}
        </div>`;
  const body = `    <div style="max-width:680px;margin:0 auto;padding:${varRef("sizeXXL")} ${varRef(
    "sizeXL"
  )};">
      <h1 style="font-size:${varRef("fontSizeHeading2")};margin-bottom:${varRef("sizeSM")};">${esc2(
    brand.name
  )} ${esc2(label)}</h1>
      <p style="color:${varRef("colorTextTertiary")};margin-bottom:${varRef("sizeXL")};">${esc2(
    brandTagline(brand)
  )}</p>
      ${card({ title: label, body: inner })}
    </div>`;
  return document({ title: `${brand.name} \u2014 ${label}`, tokens, brand, body });
}

// vendor/od-engine/engine/artifacts/index.ts
function renderArtifact(kind, brand, tokens) {
  switch (kind) {
    case "landing":
      return renderLanding(brand, tokens);
    case "email":
      return renderEmail(brand, tokens);
    case "newsletter":
      return renderNewsletter(brand, tokens);
    case "deck":
      return renderDeck(brand, tokens);
    case "poster":
      return renderPoster(brand, tokens);
    case "form":
      return renderFormPage(brand, tokens);
    default:
      return renderGeneric(kind, brand, tokens);
  }
}
function renderArtifactGallery(brand, tokens, opts) {
  const kinds = ["landing", "deck", "poster", "email", "newsletter", "form"];
  const decorate = opts?.decorate ?? ((html) => html);
  const frames = kinds.map((kind) => {
    const srcdoc = esc2(decorate(renderArtifact(kind, brand, tokens)));
    return `      <figure style="margin:0;background:${varRef(
      "colorBgContainer"
    )};border:${varRef("lineWidth")} solid ${varRef("colorBorderSecondary")};border-radius:${varRef(
      "borderRadiusLG"
    )};overflow:hidden;">
        <figcaption style="padding:${varRef("sizeSM")} ${varRef("sizeMD")};font-weight:${varRef(
      "fontWeightStrong"
    )};border-bottom:${varRef("lineWidth")} solid ${varRef(
      "colorBorderSecondary"
    )};text-transform:capitalize;">${esc2(kind)}</figcaption>
        <div style="height:420px;overflow:hidden;background:${varRef("colorBgLayout")};">
          <iframe
            srcdoc="${srcdoc}"
            sandbox=""
            loading="lazy"
            title="${esc2(brand.name)} ${esc2(kind)} preview"
            style="width:200%;height:840px;border:0;transform:scale(0.5);transform-origin:top left;"
          ></iframe>
        </div>
      </figure>`;
  }).join("\n");
  const body = `    <header style="max-width:1120px;margin:0 auto;padding:${varRef("sizeXXL")} ${varRef(
    "sizeXL"
  )} ${varRef("sizeLG")};">
      <h1 style="font-size:${varRef("fontSizeHeading1")};margin-bottom:${varRef("sizeSM")};">${esc2(
    brand.name
  )}</h1>
      <p style="color:${varRef("colorTextSecondary")};font-size:${varRef("fontSizeLG")};">${esc2(
    brandTagline(brand)
  )}</p>
    </header>
    <section style="max-width:1120px;margin:0 auto;padding:0 ${varRef("sizeXL")} ${varRef(
    "sizeXXL"
  )};display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:${varRef(
    "sizeLG"
  )};">
${frames}
    </section>`;
  return document({ title: `${brand.name} \u2014 Artifacts`, tokens, brand, body });
}

// vendor/od-engine/engine/build.ts
function slugify(input2) {
  const s = input2.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "brand";
}
function normalizeBrandForAssembly(brand) {
  const voice = brand.voice ?? {};
  const imagery = brand.imagery ?? {};
  const layout = brand.layout ?? {};
  return {
    ...brand,
    logo: {
      primary: null,
      alternates: [],
      notes: "",
      ...brand.logo ?? {}
    },
    colors: Array.isArray(brand.colors) ? brand.colors : [],
    typography: brand.typography ?? {},
    voice: {
      adjectives: Array.isArray(voice.adjectives) ? voice.adjectives : [],
      tone: voice.tone ?? "",
      messagingPillars: Array.isArray(voice.messagingPillars) ? voice.messagingPillars : [],
      vocabulary: {
        use: Array.isArray(voice.vocabulary?.use) ? voice.vocabulary.use : [],
        avoid: Array.isArray(voice.vocabulary?.avoid) ? voice.vocabulary.avoid : []
      }
    },
    imagery: {
      style: imagery.style ?? "",
      subjects: Array.isArray(imagery.subjects) ? imagery.subjects : [],
      treatment: imagery.treatment ?? "",
      avoid: Array.isArray(imagery.avoid) ? imagery.avoid : [],
      samples: Array.isArray(imagery.samples) ? imagery.samples : []
    },
    layout: {
      radius: layout.radius ?? "",
      borderWeight: layout.borderWeight ?? "",
      spacing: layout.spacing ?? "",
      postureRules: Array.isArray(layout.postureRules) ? layout.postureRules : []
    }
  };
}
var ARTIFACT_KINDS = ["landing", "deck", "poster", "email", "newsletter", "form"];
function brandSystemDoc(slug, brand, seed, tokens, tokenCount) {
  return `# ${brand.name} \u2014 brand system

Generated by the branding-agent engine from a single **seed** (${Object.keys(seed).length} fields).
Everything below is *derived* \u2014 no token here was hand-authored.

- **slug:** \`${slug}\`
- **source:** ${brand.sourceUrl || "(none)"}
- **primary seed color:** \`${seed.colorPrimary}\`
- **derived tokens per theme:** ${tokenCount}
- **themes:** default \xB7 dark \xB7 compact (same seed, different algorithm)

## Files

| Path | What it is |
| --- | --- |
| \`seed.json\` | Generated snapshot of the effective seed; persistent overrides live in \`brand.json.seed\`. |
| \`tokens.default.json\` | Full derived DesignTokens (light). |
| \`tokens.dark.json\` | Same seed, dark algorithm. |
| \`tokens.compact.json\` | Same seed, compact (dense) algorithm. |
| \`variables.css\` | \`:root{}\` + \`.dark{}\` CSS custom properties (\`--brand-*\`). |
| \`variables.dark.css\` | Standalone \`:root{}\` for the dark theme. |
| \`theme.json\` | antd \`ConfigProvider\` theme (token + algorithm). |
| \`kit.html\` | Themed component showcase (light). |
| \`kit.dark.html\` | Themed component showcase (dark). |
| \`artifacts/landing.html\` | Full landing page (hero \u2192 features \u2192 pricing \u2192 FAQ \u2192 CTA). |
| \`artifacts/deck.html\` | 9-slide 16:9 pitch deck with keyboard navigation. |
| \`artifacts/poster.html\` | 3:4 print-style poster. |
| \`artifacts/email.html\` | A marketing email. |
| \`artifacts/newsletter.html\` | Multi-story digest email. |
| \`artifacts/form.html\` | Split-screen contact / signup page. |
| \`index.html\` | Gallery linking everything + live component preview. |

## How to re-theme

The whole system is regenerated from \`brand.json\` and optional
\`brand.json.seed\` overrides. Persist authored overrides there, then run
\`od brand finalize <brand-id>\` \u2014 every downstream token, component and artifact
follows. Do not edit \`system/seed.json\` directly; finalize replaces it.

- **Change the brand color:** edit the accent role or \`seed.colorPrimary\` in \`brand.json\`.
  The 10-step palette, all interaction states, the primary background/border and
  every component that references \`var(--brand-color-primary)\` update together.
- **Light \u2192 dark:** the dark theme is the same seed run through the \`"dark"\`
  algorithm \u2014 load \`variables.dark.css\` (or add the \`.dark\` class).
- **Density:** the \`"compact"\` algorithm tightens spacing & control heights
  while keeping colors identical.

## Add a new artifact type

\`renderArtifact(kind, brand, tokens)\` already accepts every \`AssetKind\`
(\`landing | deck | poster | email | newsletter | form\`). Add the kind to the
build's artifact list to ship it in the bundle; kinds without a bespoke layout
fall back to a sensible card+button page.
`;
}
function assemble({ slug, brand, seed, extraFiles, fontFiles, fontsBase = "../" }) {
  const themes = {
    default: deriveTokens(seed, "default"),
    dark: deriveTokens(seed, "dark"),
    compact: deriveTokens(seed, "compact")
  };
  const files = {};
  files["seed.json"] = JSON.stringify(seed, null, 2);
  files["tokens.default.json"] = tokensToJson(themes.default);
  files["tokens.dark.json"] = tokensToJson(themes.dark);
  files["tokens.compact.json"] = tokensToJson(themes.compact);
  files["variables.css"] = tokensToCssVars(themes.default, ":root") + "\n" + tokensToCssVars(themes.dark, ".dark");
  files["variables.dark.css"] = tokensToCssVars(themes.dark, ":root");
  files["scripts/apply-design-tokens.mjs"] = applyDesignTokensScript();
  files["theme.json"] = tokensToThemeJson(seed, defaultThemeAlgorithm(seed));
  const fontsPrefix = (depth) => depth === 1 ? `${fontsBase}fonts/` : `../${fontsBase}fonts/`;
  const withFonts = (html, depth) => injectFontFaces(html, fontFiles ?? [], fontsPrefix(depth));
  const fonts = brandFontAssets(brand);
  files["kit.html"] = withFonts(
    renderKitPage(themes.default, {
      title: `${brand.name} \u2014 component kit`,
      brandName: brand.name,
      fontLinks: fonts.links,
      displayFamily: fonts.displayFamily
    }),
    1
  );
  files["kit.dark.html"] = withFonts(
    renderKitPage(themes.dark, {
      title: `${brand.name} \u2014 component kit (dark)`,
      brandName: brand.name,
      fontLinks: fonts.links,
      displayFamily: fonts.displayFamily
    }),
    1
  );
  for (const kind of ARTIFACT_KINDS) {
    files[`artifacts/${kind}.html`] = withFonts(renderArtifact(kind, brand, themes.default), 2);
  }
  files["index.html"] = withFonts(
    buildIndexPage(slug, brand, themes.default, fontFiles, fontsPrefix(1)),
    1
  );
  const tokenCount = tokensToCssVars(themes.default).split("\n").filter((l) => l.includes("--brand-")).length;
  files["BRAND-SYSTEM.md"] = brandSystemDoc(slug, brand, seed, themes.default, tokenCount);
  if (extraFiles) Object.assign(files, extraFiles);
  return { slug, seed, themes, files };
}
function applyDesignTokensScript() {
  return `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/apply-design-tokens.mjs <target-css-path>');
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '..', 'variables.css');
const destination = path.resolve(process.cwd(), target);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(source, destination);
console.log(\`Copied design tokens to \${destination}\`);
`;
}
function buildIndexPage(slug, brand, tokens, fontFiles, fontsPrefix = "../fonts/") {
  const esc3 = (v) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const links = [
    ["kit.html", "Component kit (light)"],
    ["kit.dark.html", "Component kit (dark)"],
    ["artifacts/landing.html", "Landing page"],
    ["artifacts/email.html", "Email"],
    ["artifacts/poster.html", "Poster"],
    ["tokens.default.json", "tokens.default.json"],
    ["tokens.dark.json", "tokens.dark.json"],
    ["tokens.compact.json", "tokens.compact.json"],
    ["variables.css", "variables.css"],
    ["theme.json", "theme.json (antd)"],
    ["seed.json", "seed.json"],
    ["BRAND-SYSTEM.md", "BRAND-SYSTEM.md"]
  ].map(
    ([href, label]) => `<li><a href="${esc3(href)}" style="color:var(--brand-color-link);text-decoration:none;">${esc3(
      label
    )}</a></li>`
  ).join("\n");
  const gallery = renderArtifactGallery(brand, tokens, {
    decorate: (html) => injectFontFaces(html, fontFiles ?? [], fontsPrefix)
  });
  const fileIndex = `
    <section style="max-width:1120px;margin:0 auto;padding:0 var(--brand-size-xl) var(--brand-size-xl);">
      <h2 style="font-size:var(--brand-font-size-heading-3);margin-bottom:var(--brand-size-sm);color:var(--brand-color-text);">Files in this brand system</h2>
      <ul style="columns:2;gap:var(--brand-size-xl);font-size:var(--brand-font-size);line-height:1.9;list-style:none;padding:0;margin:0;">
${links}
      </ul>
      <p style="margin-top:var(--brand-size-lg);color:var(--brand-color-text-tertiary);font-size:var(--brand-font-size-sm);">slug: <code>${esc3(
    slug
  )}</code> \xB7 everything derived from <code>seed.json</code></p>
    </section>`;
  const bodyEnd = findRealTagEnd(gallery, HTML_TAG_PATTERNS.bodyOpen);
  if (bodyEnd < 0) return gallery;
  return `${gallery.slice(0, bodyEnd)}
${fileIndex}${gallery.slice(bodyEnd)}`;
}
function buildBrandSystem(brand, opts) {
  const normalizedBrand = normalizeBrandForAssembly(brand);
  const slug = opts?.slug ? slugify(opts.slug) : slugify(normalizedBrand.name);
  const seed = seedFromBrand(normalizedBrand);
  return assemble({ slug, brand: normalizedBrand, seed, fontFiles: opts?.fontFiles });
}
function writeBrandSystem(system, outDir) {
  const written = [];
  for (const [rel, content] of Object.entries(system.files)) {
    const isB64 = rel.endsWith(".b64");
    const targetRel = isB64 ? rel.slice(0, -4) : rel;
    const abs = import_node_path.default.join(outDir, targetRel);
    import_node_fs.default.mkdirSync(import_node_path.default.dirname(abs), { recursive: true });
    if (isB64) {
      import_node_fs.default.writeFileSync(abs, Buffer.from(content, "base64"));
    } else {
      import_node_fs.default.writeFileSync(abs, content, "utf8");
    }
    written.push(abs);
  }
  return written.sort();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CSS_VAR_PREFIX,
  buildBrandSystem,
  defaultSeed,
  defaultThemeAlgorithm,
  deriveTokens,
  flattenTokens,
  renderArtifact,
  renderArtifactGallery,
  renderKitPage,
  seedFromBrand,
  seedFromMaterial,
  slugify,
  tokensToCssVars,
  tokensToJson,
  tokensToThemeJson,
  varRef,
  writeBrandSystem
});
