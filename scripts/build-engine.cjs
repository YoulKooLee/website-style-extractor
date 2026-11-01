/**
 * 把 vendor/od-engine 的原版设计体系引擎打成一个 CJS 文件，
 * 供 Electron 主进程直接 require（主进程不跑 TS 编译）。
 */
const esbuild = require('esbuild');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

async function main() {
  const outfile = path.join(root, 'electron', 'lib', 'od-engine.cjs');
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'vendor', 'od-engine', 'entry.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    outfile,
    legalComments: 'none',
    logLevel: 'warning',
    metafile: true,
  });
  const bytes = Object.values(result.metafile.outputs)[0]?.bytes ?? 0;
  console.log(`od-engine.cjs 生成完成：${(bytes / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error('引擎打包失败：', err.message || err);
  process.exit(1);
});
