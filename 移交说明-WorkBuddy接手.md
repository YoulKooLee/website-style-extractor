# 交接说明 · 网站风格提取器（给 WorkBuddy 接手执行）

> 本文档是上一个执行智能体留下的完整接手说明。请先通读，按「第 0 步必修 bug → 自测跑通 → 再按优先级补功能」的顺序执行。
> 项目根目录：`D:\Github开源项目\网站风格提取器`

---

## 一、这个项目是什么（背景，别跑偏）

把 OpenDesign 里「输入网址 → 提取品牌设计体系」的**本地抓取内核**剥离重做成的**独立本地桌面小工具**。

**三项不可变硬约束（用户已拍板，不要改方向）：**
1. 纯本地轻量工具：只抓公网网页的颜色/字体/Logo；不依赖账号、不接大模型、可离线查看历史结果。
2. 技术栈固定：**React + Vite + Tailwind**（渲染层）+ **Electron**（桌面壳）。
3. **先本地 dev 跑通验证，本轮不打包**（不装 electron-builder、不出安装包；等用户明确要求再打包）。

**刻意不做（原 OpenDesign 有、本工具不要）：** 账号登录、团队/项目绑定、LLM 综合文案、无头整页截图、字体文件下载注册、品牌库三件套（manifest/DESIGN.md/tokens.css 注册体系）。

---

## 二、第 0 步：必修阻塞 Bug（最高优先级，先修这个，否则点按钮全报错）

### 现象
界面点「开始提取」后红字报错：
```
Error invoking remote method 'extract:site': TypeError: extractSite is not a function
```

### 根因（已定位，不用再查）
文件 `electron/main.cjs` 第 52、53、55、56 行。
两个 lib 模块都是**命名导出对象**（`module.exports = { extractSite }` / `{ exportBundle, buildTokensCss, slugify }`），
但 main.cjs 直接 `require(...)` 拿到对象后又当函数调用，于是 `extractSite is not a function`。
`bundle:export`（导出按钮）有同样问题，修 `extract:site` 时一起修。

### 精确改法（推荐方案 A，改动最小）
`electron/main.cjs` 第 52–56 行改为解构取值：

```js
const { extractSite } = require('./lib/extract-site.cjs');
const { exportBundle } = require('./lib/export-bundle.cjs');

ipcMain.handle('extract:site', (_event, url) => extractSite(url));
ipcMain.handle('bundle:export', (_event, result) => exportBundle(result, BrowserWindow));
```

（备选方案 B：把 `extract-site.cjs` 改成 `module.exports = extractSite`；但 `export-bundle.cjs` 还导出了 `buildTokensCss/slugify`，不适合整体导出成函数，所以统一用方案 A。）

### 修完必做验证
1. 先停掉旧 dev 进程（见第五节），重新 `npm run dev` 冷启动。
2. 界面输入 `https://www.baidu.com` 点提取，应出结果（主色 `#315efb`、字体、Logo 2 个左右），不再红字报错。
3. 命令行回归：
   - `node scripts\test-logic.cjs` → 应 12 通过 0 失败
   - `node scripts\test-export.cjs` → 应 6 通过 0 失败
   - `node scripts\smoke-fetch.cjs https://example.com` → 正常打印摘要不报错
4. 点「导出配色与字体文件」，弹目录框选一个文件夹，确认生成 `brand.json`、`tokens.css`、`logos/`。

---

## 三、当前工程现状（已完成部分，不要重复造轮子）

### 数据流架构（已搭好）
- **主进程（Electron Node 侧，CommonJS `.cjs`，不编译）**：负责联网抓取、提取、导出写盘；渲染层只展示。
- **渲染层（`src/`，Vite + React + TS + Tailwind）**：只调 `window.api.*`，不直接联网、不碰 Node。
- **安全桥**：`electron/preload.cjs` 用 `contextBridge` 只暴露 `extract / exportBundle / platform`；`contextIsolation=true、sandbox=true、nodeIntegration=false`。
- **IPC 通道**：`extract:site`、`bundle:export`（在 main.cjs 注册）。

### 文件清单与职责
```
网站风格提取器/
├─ package.json                 依赖见下；scripts: dev / build:renderer / preview
├─ vite.config.ts              vite-plugin-electron 起主进程；主/preload 的 watch 已设 null（原因见第五节）
├─ tailwind.config.js / postcss.config.js / tsconfig.json
├─ index.html
├─ 启动-网站风格提取器.cmd       双击启动（自动补 node24 PATH、缺依赖先 npm install）
├─ README-大白话说明.md
├─ electron/
│  ├─ main.cjs                 窗口、单实例、IPC 注册（★第0步 bug 在这）
│  ├─ preload.cjs              contextBridge
│  └─ lib/
│     ├─ fetch-http.cjs        UA、8s 超时、私有地址(内网/本机)拦截、文本/二进制抓取
│     ├─ colors.cjs            normalizeColor / luma / extractColors / pickPrimary
│     ├─ palette.cjs           Ant Design HSV 十阶 generate()（忠实移植，已验证蓝色阶正确）
│     ├─ fonts.cjs             extractFonts（排除通用字体、图标字体）
│     ├─ logos.cjs             findLogoRefs / 内联SVG / favicon/og/header图 / 公共图标服务兜底
│     ├─ meta.cjs              title/description/siteName/headings/paragraphs/navLabels
│     ├─ css-collect.cjs       inline <style> + style="" 属性 + 外链 stylesheet(≤6) + google css(≤2)
│     ├─ extract-site.cjs      主编排：normalize→抓HTML→收集CSS→颜色/字体→Logo→meta→主色十阶
│     └─ export-bundle.cjs      dialog 选目录 → brand.json + tokens.css + logos/
├─ src/
│  ├─ main.tsx / App.tsx / index.css / global.d.ts(结果类型 ExtractResult)
│  └─ components/
│     ├─ PalettePanel.tsx      主色十阶 + 其他色（点色块复制 hex）
│     ├─ FontPanel.tsx          字体列表 + 样例
│     └─ LogoPanel.tsx          标志候选网格
└─ scripts/
   ├─ test-logic.cjs           离线算法 12 断言
   ├─ test-export.cjs          导出文本 6 断言
   └─ smoke-fetch.cjs          联网冒烟：node scripts/smoke-fetch.cjs <网址>
```

### 已验证事实（可直接采信，不必重查）
- 离线测试 18 项全过；`generate('#1677ff')` 十阶与 Ant 官方一致。
- 联网：example.com 链路通；baidu.com 抓到标题/简介/主色 `#315efb`/字体 PingFang SC/2 个 Logo。
- `tsc -p tsconfig.json --noEmit` 零错误；主进程全部 `.cjs` `node --check` 通过。
- 渲染层界面已能渲染（标题/输入框/按钮/空状态卡片/Tailwind 生效）。

### 关键依赖版本（package.json，勿随意大升）
electron ^33、vite ^5.4、@vitejs/plugin-react ^4.3、vite-plugin-electron ^0.28、
react/react-dom ^18.3、typescript ^5.6、tailwindcss ^3.4、postcss ^8.4、autoprefixer ^10.4。
`.npmrc` 已配 npmmirror 与 electron 镜像。

---

## 四、对照原界面（OpenDesign Shopify 抽取结果页）缺失的功能模块

原参考页特征（用户截图里看到的）：顶部输入后左侧是「官网缩略卡片（站名+favicon+链接）」；右侧是**品牌 Logo 主展示区**、提取完成状态提示、团队使用说明；下方分「设计体系 / 设计文件」两个 Tab；配色、字体、Logo 分组清晰；可查看/导出样式文件。

当前版本只做了基础三栏（配色/字体/Logo）+ 导出按钮。**建议按下面优先级补齐**（先 P0 修 bug 跑通，再 P1，P2 视时间）：

### P1 展示层补齐（跑通后优先做，纯前端为主，风险低）
1. **抓取进度反馈**：主进程各阶段（抓网页→合并样式→提颜色→提字体→找Logo）通过 `webContents.send` 或 IPC 事件推到界面，按钮旁显示「正在抓网页…/正在整理配色…」，避免用户以为卡死。
2. **官网信息卡**：站点 favicon + 站名 + 最终网址（可点击复制）+ 标题 + 简介，做成一张醒目卡片（对应原页左侧缩略卡）。
3. **Logo 主展示**：候选里挑最可能的一个放大居中展示，其余缩略排列；标注来源类型（网站图标/分享图/头部图/内联SVG）。
4. **配色应用示例**：用主色渲染几个真实小样（主按钮、链接、标签、卡片），让用户直观看到配色落地效果，而不只是色块。
5. **样式文件预览**：结果区加「tokens.css / brand.json」预览 Tab（只读展示 + 一键复制全文），导出按钮保留。
6. **空态/失败态文案细化**：被墙、内容单薄、抓取失败三种状态分别给大白话提示和建议（换个网址/该站有验证/网络不通）。
7. **结果历史**（可选）：把最近几次提取结果存到本地（如 `userData/history.json`），左侧列表可回看，不依赖账号。

### P2 能力增强（工作量较大，需先和用户确认再做）
1. **动态站点渲染**：当前纯 fetch 抓不到 JS 渲染内容；可在主进程用隐藏 BrowserWindow 加载页面、读取渲染后 DOM 与 computed style 再喂给现有提取器（注意仍要做公网地址限制）。
2. **字体文件下载与在线字体映射**（当前只识别 family 名，不下载字体文件）。
3. **更多导出格式**：Tailwind 配置片段、设计令牌 JSON、站点缩略图。
4. **主色可手动更换**：允许用户在候选色里点选一个作为新主色，实时重算十阶。

### UI 文案硬要求（用户长期偏好，务必遵守）
- 用户可见页面一律大白话，**禁止**出现 RBAC、SSRF、token、IPC、bundle、渲染进程等技术词；技术说明统一写进 README 或右侧「说明」卡片。
- 术语示例：界面写「配色/字体/标志」，不写「design tokens / font stack / logo candidates」。

---

## 五、环境与已知坑（踩过的，直接规避）

1. **本机缺 `taskkill`**：vite-plugin-electron 默认监听主进程文件变化并自动重启，重启时调 `taskkill` 会直接崩退（日志出现 `'taskkill' is not recognized`）。已在 `vite.config.ts` 把 main/preload 的 `build.watch` 设为 `null` 关闭自动重启。**不要重新打开它**；改完主进程 `.cjs` 后手动停 dev 再冷启动；改 `src/` 渲染层仍会热更新。
2. **Node 抓取不走系统代理**：浏览器挂代理能开、但 Node fetch 直连不上的境外站（如 wikipedia.org）会返回空；国内直连站点正常。不要误判为代码 bug。
3. **不抓内网/本机地址**：`fetch-http.cjs` 的 `isPrivateHost` 会拦截 127./10./192.168./172.16-31/169.254/localhost，属安全设计，保留。
4. **反爬墙站点**：`extract-site.cjs` 的 `looksBlocked` 命中 Cloudflare 等标记时跳过颜色/文案，只走图标兜底，界面会提示「有访问保护」。
5. **启动命令**：
   - 开发：项目目录下 `npm run dev`（先确保 `node_modules` 已装；没装先 `npm install`）。
   - 自带 Node24 路径：`D:\Github开源项目\tools\node-v24.22.1-win-x64`（系统 PATH 的 node 是 v22，也能跑；`启动-网站风格提取器.cmd` 会优先用 node24）。
   - 端口固定 `5188`（strictPort）。
6. **停旧进程再重启**：改主进程后，先结束 `npm run dev` 后台任务和残留 electron 进程，再重新启动，避免旧 `dist-electron/main.js` 缓存。
7. **不打包**：未安装 electron-builder；用户明确要求前不要引入打包配置。
8. **算法来源**：颜色/字体/Logo 提取思路与十阶色板移植自 `D:\Github开源项目\open-design\apps\daemon\src\brands\`（prefetch.ts、engine/palette.ts，Apache-2.0）；需要深挖算法时回读这两个文件，不要凭空重写。

---

## 六、交付与验收清单（完成后逐条核对）

- [ ] 第 0 步 bug 修复，百度/普通站点提取不再报错、出结果
- [ ] `node scripts/test-logic.cjs` 12 通过；`node scripts/test-export.cjs` 6 通过
- [ ] `npx tsc -p tsconfig.json --noEmit` 零错误
- [ ] 导出能落盘 `brand.json` + `tokens.css` + `logos/`，内容可读
- [ ] P1 各项按优先级完成并在界面自测；用户可见文案为大白话
- [ ] 更新 `README-大白话说明.md` 中实际能力与操作步骤
- [ ] 全程不引入打包工具、不接大模型、不加账号体系
- [ ] 完成后向用户汇报：改了什么、怎么启动、自测结果、仍存在的边界

## 七、给 WorkBuddy 的执行建议顺序
1. 先修第二节 bug → 冷启动 → 用 baidu.com 验证出结果（这一步不通，后面都免谈）。
2. 跑两份离线测试 + tsc，确认没改坏。
3. 按第四节 P1 顺序补展示层，每补一块就在界面点验一次。
4. P2 先列方案问用户，不要擅自开工。
5. 所有产物写在 `D:\Github开源项目\网站风格提取器` 内，不要新建 agent/session 命名目录。

---

## 八、WorkBuddy 接手执行记录（本轮已完成）

### 阻塞 bug
`electron/main.cjs` 按方案 A 解构取值，`extract:site` / `bundle:export` 均已修复，点按钮不再报 `extractSite is not a function`。

### 新踩到的坑（重要）
- **`ELECTRON_RUN_AS_NODE=1` 会让 electron 退化成普通 node**：在被 WorkBuddy/CodeBuddy 这类 Electron 应用拉起的终端里，`npm run dev` 会直接崩：
  `TypeError: Cannot read properties of undefined (reading 'requestSingleInstanceLock')`（因为 `require('electron')` 拿到的是 npm 包路径字符串，`app` 是 undefined）。
  解决：启动前 `set ELECTRON_RUN_AS_NODE=`、`set NODE_OPTIONS=`；`启动-网站风格提取器.cmd` 已加这两行清空。
- 截屏/`Add-Type`/`Invoke-Expression` 在本机 PowerShell 里被策略拦，改用 Electron 调试端口（`--remote-debugging-port=9222`）+ CDP 脚本驱动界面与截图（`scripts/verify-ui.mjs`、`scripts/verify-states.mjs`）。

### P1 展示层（全部完成）
1. 分阶段进度：主进程 `extract-site.cjs` 回调 → `extract:progress` → 界面进度条（含百分比）。
2. 官网信息卡：图标 + 站名 + 可点开网址 + 复制网址 + 标题 + 简介 + 「有访问保护/内容偏少」标签。
3. 标志主展示：按来源类型优先级挑最像官方的那张放大，其余缩略图点击切换，标注来源与体积。
4. 配色应用示例：主按钮 / 次要按钮 / 标签 / 链接，实时用该站色板渲染。
5. 设计文件预览：`bundle:preview` 在内存生成 tokens.css / brand.json 全文，可切换、可复制。
6. 空态/失败态：区分网址不合法（含内网拦截）、连不上、访问保护、内容单薄，各给大白话建议。
7. 结果历史：`electron/lib/history.cjs` 写 `userData/history.json`，最多 8 条、同站点只留最新、标志图裁剪控体积；支持回看 / 单条删除 / 清空。

### 顺手修的算法问题
- 主色挑选改为「优先有彩度的高信号色」：此前 `apple.com.cn` 会把近黑 `#1d1d1f` 当主色，十阶全灰；现取 `#0071e3`。
- 字体识别排除 `cIconfont` 一类图标字体，并按大小写合并同名（`Microsoft YaHei` 不再重复计数）。

### 新增自测手段
- `scripts/test-export.cjs` 扩到 13 项：拦截目录选择框，真实写入临时目录并核对 brand.json / tokens.css / logos 内容。
- `scripts/verify-ui.mjs`：完整提取 + 截图 + 检查无控制台报错；`scripts/verify-states.mjs`：进度 / 内网拦截 / 网络失败三态。

### 本轮自测结果
- `test-logic.cjs` 12/12、`test-export.cjs` 13/13、`tsc --noEmit` 零错误、全部 `.cjs` `node --check` 通过。
- 实测 baidu.com（主色 `#4e6ef2`、6 个标志）、apple.com.cn（主色 `#0071e3`、SF Pro）、内网拦截、域名不存在失败态、历史还原、文件预览均正常，控制台零报错。

---

## 九、P2 四项（用户要求全做，已完成）

### 1. 动态站点渲染
- 新增 `electron/lib/render-page.cjs`：隐藏 `BrowserWindow`（独立临时 session）打开页面 → 等 `document.readyState=complete` + 1.2s 静置 → 抓 `documentElement.outerHTML`、`document.styleSheets` 全部 `cssText`（**相对 url() 在页内就按 `sheet.href` 补成绝对地址**）、每 2500 个元素的 `getComputedStyle` 颜色/字体，最后 `capturePage()` 截图。
- 安全：`webRequest.onBeforeRequest` 对每条请求做公网校验（`isPrivateHost`），内网/本机/非 http(s) 一律 cancel；`setWindowOpenHandler` 拒绝弹窗；20 秒超时；用完销毁 + 清 session 缓存。
- `extract-site.cjs` 支持 `mode: auto|static|render`：auto 先静态抓，判定「被拦 / 彩色少于 2 个 / 无标题且无简介」时才渲染；渲染失败但静态有结果时保留静态结果并记 `renderError`。

### 2. 字体文件下载与在线字体映射
- 新增 `electron/lib/webfonts.cjs`：解析 `@font-face`（排除图标字体、`xx Fallback` 兜底字体、通用字体），woff2 > woff > otf > ttf 优先，拉丁子集优先；最多 10 个文件 / 单个 1.2MB / 合计 4MB，校验字体魔数。
- 来源分类：Google 样式表里的家族标 `google`（带可复制的在线样式地址）、同源 `@font-face` 标 `self`（下载文件）、只有名字的标 `system`。
- 修掉一个隐蔽 bug：`css-collect` 原来只回一堆 CSS 文本，字体里的相对路径按**页面**地址补全会 404（Next.js 的 `/media/...`）；现在每个样式表带自己的 `url`，按样式表地址解析。
- 界面：字体行显示来源徽标 + 体积 + 真实字形预览（把前 3 个小文件内联成 dataURL 的 `@font-face`）；导出写 `fonts/` + `fonts.css` + `manifest.json`。

### 3. 更多导出格式
- `tokens.css` 增加 `@font-face` 与 `--palette-N`（只有真拿到文件的才写 `@font-face`，历史记录里字体只剩名字时不会指向空气）。
- 新增 `tokens.json`（Design Tokens 结构：color.brand[0-9] / primary / palette / font.body / font.face）。
- 新增 `tailwind.config.js`（brand 0-9 + DEFAULT、palette、ink/canvas、fontFamily.sans）。
- 新增 `screenshot.jpg`（渲染模式或点「补一张」后才有）。
- 设计文件预览扩成四个标签；`bundle:preview` 一次返回全部文本，导出与预览共用同一套生成函数（测试断言两者一致）。

### 4. 主色手动更换
- `palette:generate` IPC 复用 `palette.cjs` 的 HSV 算法，只重算十阶、不联网。
- 配色面板：右上角「换个主色」原生取色器 + 候选色悬停 ★；换完十阶、配色示例、tokens.css/tailwind/tokens.json 全部同步。

### 新增/更新的自测
- `scripts/test-fonts.cjs`（18 项）：@font-face 解析、woff2 优先、图标字体排除、相对路径按样式表补全、Google 映射、系统字体判定、dataURL 预览。
- `scripts/test-export.cjs` 扩到 29 项：新增 tokens.json / tailwind.config.js 落盘、字体文件落盘、`tokens.css` 的 @font-face 指向 `./fonts/`、brand.json 不重复塞二进制、缩略图落盘。
- `scripts/verify-p2.mjs` / `verify-p2b.mjs`：渲染模式抓 shopify/tailwind（字体文件数、缩略图、四种预览、换主色、静态模式补截图、渲染模式内网拦截、brand.json 体积）。

### P2 自测结果（2026-10-31 深夜）
- `test-logic` 12/12、`test-export` 29/29、`test-fonts` 18/18、`tsc` 零错误、全部 `.cjs` `node --check` 通过。
- shopify.com 渲染模式：主色 `#36f4a4`、6 个标志、1 个字体文件（55KB）、缩略图 47KB；tailwindcss.com：4 个字体文件（IBMPlexMono/InterVariable/SourceSansPro/UbuntuMono）、缩略图 76KB；换主色 `#36f4a4 → #e0245e` 后 tokens.css 同步；只读源码 + 「补一张」截图成功；渲染模式访问 127.0.0.1 被拦；控制台零报错。



## 十、对齐 OpenDesign 原版设计体系（2026-11-01 凌晨）

用户拿原版 open-design 的 brand 项目（`.od/projects/brand-shopify-a53c5c`）比对，指出「少了挺多」。逐项核对后确认差距：原版产出 20 个文件/目录，本工具原来只有 7 项，缺的是整套设计体系（语义色角色、seed、三算法 tokens、theme.json、variables.css、组件 kit、六张成品模板、画廊、品牌文档、素材图、留档）。

### 做法：不重写，直接搬引擎
- 把 `open-design/apps/daemon/src/brands/engine/`（types/export/palette/seed/derive/kit/build + artifacts 9 个模板）原样 vendor 到 `vendor/od-engine/`，另加 `schema.ts`、`fonts.ts`、`prefetch.ts` 三个垫片，`html-injection-points.ts` 从 `packages/contracts` 搬入。
- `scripts/build-engine.cjs` 用 esbuild 打成 `electron/lib/od-engine.cjs`（203KB，CJS，主进程直接 require）；`npm run dev` / `build:renderer` 都会先跑一次。
- **字节级对齐验证**：拿原版项目的 `brand.json` + `fonts/manifest.json` 喂进移植后的引擎，18 个产物与原版磁盘文件逐字节一致（seed/tokens×3/variables×2/theme/kit×2/artifacts×6/index/BRAND-SYSTEM.md）。

### 新增的本项目专有层
- `brand-kit.cjs`：提取结果 → 原版 Brand 契约。7 个语义角色按「CSS 属性名 + 选择器」信号推断（body 背景→background、body 颜色→foreground、border-*→border、卡片底色→surface、中间灰→muted、主色→accent、异色相高频色→accent-secondary），判不出来才按亮度/彩度兜底；深色画布 + 浅色文字会保留深色（原版 dark-first 逻辑一致）。
- `imagery.cjs`：og:image / srcset / img 取素材图，单张 ≤600KB、合计 ≤2.4MB、最多 8 张、3 并发、整体 12 秒封顶；`&amp;` 实体已解码。
- `layout.cjs`：从 CSS 统计出现最多的 `border-radius` 与 `border-width`，圆角进 seed（`borderRadius`），描边进版式。
- `export-bundle.cjs`：一次导出写 `system/`（17 个文件）+ brand.json + DESIGN.md + guide.md + extraction.json + logos/ + imagery/ + fonts/ + prefetch/ + 三个便利格式 + 截图；`prefetch` 联网留档可关闭（`exportBundle(result, win, { prefetch: false })`，离线测试用）。
- 主进程 `system:file` IPC + 结果指纹缓存（同一结果连着点预览不重复生成，单次生成约 40ms）；`bundle:preview` 额外返回 DESIGN.md / guide.md / 文件清单。
- 界面：设计文件页拆成「成品预览 / 源码」两态；成品预览有 kit 浅色、kit 深色、总览、六张模板共 9 个 chip，用 iframe srcDoc 渲染；源码页七种文件。

### 顺手修的坑
- baidu 的蓝色描边被当成 `border` 角色 → 边框角色只接受无彩色。
- 素材图 URL 里的 `&amp;` 导致 404。
- hero 标语直接用整段简介会顶到四行 → 按「显示宽度」（中文算 2 单位）压到 44 单位以内，优先在顿号/逗号处断句。
- 历史记录会存素材图的二进制 → `trimImagery()` 只留两张 ≤120KB 的。

### 本轮自测结果
- `test-logic` 12/12、`test-fonts` 18/18、`test-engine` 32/32（新增）、`test-export` 64/64（重写）、`tsc --noEmit` 零错误、全部 `.cjs` `node --check` 通过。
- 真实联网导出（baidu.com，static）：产出 30 个文件，含 `system/` 18 个、prefetch 3 个、logos 2 个、docs 4 个。
- 界面实测（`scripts/verify-p3.mjs`）：百度 → 18 个体系文件、slug `baidu`、kit 浅色/深色、landing、BRAND-SYSTEM.md（2612 字）全部正常，控制台零报错。

### 仍未做
- 打包（按约定）；`od brand finalize` 那种「改 brand.json 后重生成整包」的入口；品牌页 `brand.html`（原版由 LLM 生成，这里用 kit 代替）。

## 十一、接入 AI（配置入口 + 品牌文案补全）与 finalize（2026-11-01 凌晨）

用户要求：先做 API Key 配置入口、规划 AI 还能做什么、并把 `od brand finalize`（改 brand.json 重生成）接上。

### finalize
- 新增 `electron/lib/brand-finalize.cjs`：`finalizeBrand(base, edited)` 以自动识别结果为底、用用户版本覆盖，缺的语义角色回填、`#F60` 补成 `#ff6600`、`rgb()` 转 hex、圆角 `12` 补 `px`，每一处修补都写进 `notes` 回给界面；`parseBrandText` 在 V8 不再给 position 的情况下自己扫括号/引号/尾逗号，把错误定位到行。
- 主进程 `brand:finalize` / `brand:auto`；`bundle:preview`、`system:file`、`bundle:export` 全部接受 `override`，`buildSystem(result, override)` 统一走 finalize，界面预览与导出共用同一条链路；system 缓存 key 里加了 override 的 sha1 前 12 位。
- 界面：设计文件 → 源码 → brand.json 变可编辑 textarea，工具条为「应用并重新生成 / 撤销修改 / 整理格式 / 恢复自动识别 / AI 补全文案」，落地后显示「已按这份 brand.json 重新生成 18 个文件」与修补清单。

### AI
- `electron/lib/settings.cjs`：`userData/ai-config.json`，Key 优先 `safeStorage`（DPAPI/钥匙串/libsecret）加密，不可用时降级 base64 并在界面如实标注；渲染层只拿得到 `hasKey` 与尾号；8 个服务商预设（含本机 Ollama）与自定义。
- `electron/lib/ai.cjs`：裸 fetch 调 `/chat/completions`，60s 超时（补全用 90s），400+max_tokens 自动重试一次；401/402/404/429/5xx/超时/DNS/拒绝连接全部翻成大白话（含「本机 Ollama 没启动」这种具体提示）；`parseJsonLoose` 容忍 ```json 包裹与前后解释；`normalizePatch` 把长度、条数夹紧并按已有 role 过滤，模型乱加键不会把导出搞崩。
- `ai:enrich`：素材（7 个色角色、高频色、字体、标题、段落、导航词、圆角描边）→ 模型产出 tagline/description/voice/imagery/配色中文名/postureRules → `applyBrandPatch` 合并 → `finalizeBrand` 收口 → 返回 brandJson。界面拿到就换成 override，整套重生成。
- 界面：顶栏「AI 设置」入口 + 状态胶囊（AI 未启用 / AI 已接：模型名）；`AiSettings.tsx` 弹窗含服务商 chips、地址、模型、Key（可显示/隐藏、留空表示不改）、测试连接（回显模型名与 token 数）、保存、清除配置、存储方式说明；结果提示横幅放在面板上方。

### 顺手改的
- `system/` 实际是 18 个文件（此前界面与 README 都写 17），已统一。
- `parseJsonLoose` 不再把顶层数组当成对象。

### 验证
- `test-ai.cjs` 64 项全过（Key 不明文落盘、留空不改 Key、非法地址拒绝、错误映射、提示词内容、JSON 容错、嵌套字段收敛、finalize 修补与行号定位、override 后 tokens 变色）。
- `test-logic` 12 / `test-fonts` 18 / `test-engine` 32 / `test-export` 64 全过，`tsc` 零错误，全部 `.cjs` `node --check` 通过。
- `verify-p4.mjs`（真实界面）：AI 设置错误态给「连不上这个接口…」、保存后顶栏变「AI 已接：test-model」、改 accent 为 `#e0245e` 后重生成 18 个文件、kit iframe 里出现新主色、AI 失败只提示不崩、控制台零报错。
- `verify-p5.mjs`（本地 stub 当模型）：测试连接回「连通了：stub-model 回了「通了」，用了 1100 个 token」；补全后 brand.json 出现 AI 标语/三条支柱/「靛蓝」「雪白」/排版规矩/tone；landing 模板 hero 用上 AI 标语；用完自动 `aiConfigClear`。
- 另跑了一次带 override 的真实导出（baidu）：`brand.json` 的 accent 为 `#e0245e/玫红`、`system/tokens.default.json` 的 `colorPrimary` 同步、kit 与 landing 都吃到新值。

### 还没做（已写进 README 的规划表）
分渠道文案、语义色角色复核、可读性审查、多站点风格综合、brand.html 品牌页、设计规范问答、导出包体检、图片风格分析、批量对照表——都复用「改 brand → finalize」与「直接往 system/ 写文件」两条链路。
