// 引擎打包入口：只导出本应用用得到的部分。
export { buildBrandSystem, writeBrandSystem, slugify } from './engine/build.js';
export { deriveTokens, defaultThemeAlgorithm } from './engine/derive.js';
export { seedFromBrand, seedFromMaterial, defaultSeed } from './engine/seed.js';
export { tokensToJson, tokensToCssVars, tokensToThemeJson } from './engine/export.js';
export { renderKitPage } from './engine/kit.js';
export { renderArtifact, renderArtifactGallery } from './engine/artifacts/index.js';
export { CSS_VAR_PREFIX, varRef, flattenTokens } from './engine/types.js';
