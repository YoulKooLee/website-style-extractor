# 网站风格提取器（Website Style Extractor）

粘贴一个网址，软件就在你自己电脑上把这个网站的**配色、字体、标志、素材**整理出来，并生成一整套可直接使用的设计体系（色板、CSS 变量、组件示例、成品模板、品牌说明文档）。

- 默认**不登录账号、不联网调用大模型**，基础提取全程在本机完成；抓过的结果存在本地，没网也能回看。
- 想让文案更像人写的，可在设置里**可选接入**兼容 OpenAI 格式的接口（DeepSeek、通义千问、Moonshot、OpenAI、硅基流动、本机 Ollama 等均可）。

## 功能亮点

- **自动配色**：挑出网站主色，展开成由浅到深的 10 阶色板，并列出高频辅助色；可一键换主色，十阶与预览同步重算。
- **字体识别**：列出页面在用字体与样例，区分在线字体（Google Fonts）、站点自带字体文件、系统字体。
- **标志与素材**：收集 favicon、头部 Logo、分享图等候选，挑出最像官方标志的一张；顺带整理站点图片。
- **三种抓取方式**：自动（默认）／只读源码／内置浏览器渲染，兼容 CSS-in-JS 等 JS 动态站点。
- **整套导出**：一键导出 `brand.json`、设计令牌、CSS 变量、深浅色组件示例、六张成品模板与品牌说明书。
- **历史记录**：成功结果留在本机左侧，可回看、删除。
- **可选 AI**：补全标语、简介、语气与分渠道文案，结果仍走本机重生成链路。

## 普通用户：下载安装（Windows 64 位）

1. 打开 [Releases 页面](https://github.com/YoulKooLee/website-style-extractor/releases/latest)；
2. 下载 `website-style-extractor-Setup-0.1.0.exe`（约 83 MB）；
3. 双击运行，按向导选择安装目录，自动创建桌面与开始菜单快捷方式；卸载时保留本地配置。

> 直链（当前版本）：<https://github.com/YoulKooLee/website-style-extractor/releases/download/v0.1.0/website-style-extractor-Setup-0.1.0.exe>
>
> 安装包尚未做代码签名，首次启动若提示「未知发布者」，选择「仍要运行」即可。安装版与免安装绿色版出自同一份代码，校验一致。

## 开发者：从源码运行

前置：Node.js 20+、Windows x64。

```bash
npm install          # 安装依赖
npm run dev          # 开发模式启动（先构建引擎，再启动 Electron + Vite）
npm test             # 离线逻辑自测（颜色 / 字体 / 引擎 / AI / 导出）
```

打包：

```bash
npm run pack:dir     # 免安装绿色目录（release/win-unpacked）
npm run pack:nsis    # NSIS 安装版 Setup.exe
```

改了 `vendor/od-engine` 里的引擎源码后，先执行 `npm run build:engine` 重新编译设计引擎。

## 技术栈与目录概览

- **技术栈**：Electron 33 + React 18 + Vite 5 + Tailwind 3；主进程用内置窗口抓页，不依赖外部浏览器；esbuild 把设计引擎打成单文件。
- `electron/`：主进程（抓取、渲染、提取、导出写盘、本地历史、可选 AI 接入）。
- `src/`：React + Tailwind 界面。
- `vendor/od-engine/`：从 OpenDesign 移植的设计体系引擎（见下许可说明）。
- `scripts/`：引擎构建脚本与离线自测脚本。

## 能力边界（避免误判为故障）

1. 只抓公开页面：内网、本机、云元数据地址一律拦截，不登录、不读取私密内容。
2. 需要登录、人机验证或点击才加载的深层内容可能抓不全；渲染窗口首屏约 20 秒超时。
3. 截图为视口首屏，不做整页长图；字体文件有大小与数量上限，中文字体常被跳过。
4. 抓取到的第三方品牌名、Logo、字体版权归原网站所有，仅供风格参考，商用请自行确认授权。
5. 语义色角色为规则推断，非大模型理解；深色版本单独输出在 `tokens.dark.json` 与 `kit.dark.html`。

## 许可与来源说明

- 颜色频次、字体、标志提取思路与十阶色板算法，以及 `vendor/od-engine/` 设计体系引擎，参考自开源项目 OpenDesign（Apache License 2.0）；`vendor` 仅补了少量垫片，同一份 `brand.json` 产物与原版对齐。
- 本仓库业务代码按学习与风格参考用途发布；第三方品牌素材版权归原网站。
