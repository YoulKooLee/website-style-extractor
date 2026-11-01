import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'node:path';

// 渲染层 Vite + React；主进程 / preload 为 CommonJS，由 vite-plugin-electron
// 原样复制进入产物，不做打包，便于直接 require ./lib 下的提取模块。
export default defineConfig({
  plugins: [
    react(),
    electron({
      // 关闭主进程/preload 的文件监听自动重启：本机环境缺 taskkill，
      // 自动重启会直接崩退；主进程改动后手动重启 dev 即可，渲染层仍热更新。
      main: { entry: 'electron/main.cjs', vite: { build: { watch: null } } },
      preload: { entry: 'electron/preload.cjs', vite: { build: { watch: null } } },
    }),
  ],
  base: './',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: { port: 5188, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
