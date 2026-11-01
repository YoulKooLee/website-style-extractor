# 网站风格提取器 · 大白话说明

## 一句话介绍
粘贴一个网址，软件就在你自己电脑上把这个网站的**配色、字体、标志**整理出来，再生成一整套**可以直接用的设计体系**（设计令牌、CSS 变量、组件 kit、六种成品模板、品牌说明文档）。全程不需要登录账号；默认不联网、不调用大模型，想让它把文案写得更像人，可以自己接一个大模型接口（可选，见下文）。抓过的结果存在本机，没网也能回看。

## 能做什么

### 抓取与整理
- 输入网址 → 打开网页、整理公开样式，得到：
  - **配色**：自动挑出网站主色，展开成由浅到深的 10 阶色板；再列出页面上出现较多的其他颜色；
  - **字体**：页面在用的字体、样例，以及它是「在线字体（Google Fonts）」「网站自带（字体文件已下载）」还是「系统字体」；
  - **标志**：网站图标、头部标志、分享图等候选，挑最像官方标志的那张放大，其余点小图切换；
  - **网站信息**：图标、站名、可点击打开的网址、页面标题、简介，以及一张网站缩略图。

### 三种抓取方式（应对不同网站）
| 方式 | 适合 | 说明 |
|---|---|---|
| 自动（默认） | 大多数网站 | 先读网页源码，读不到东西时自动换成内置浏览器渲染 |
| 只读源码 | 样式写在 HTML/CSS 里的站 | 最快；不执行页面脚本 |
| 浏览器渲染 | 内容靠 JS 现场生成的站 | 用隐藏的内置浏览器真正打开页面，慢一些但结果最全，还能顺便截图 |

渲染模式读的是「渲染后的页面结构 + 运行期注入的样式 + 每个元素的实际样式」，所以 CSS-in-JS、组件库动态插入的样式也能抓到。

### 看得见的效果
- **配色应用示例**：用这套颜色当场画出主要按钮／次要按钮／标签／链接。
- **改主色**：点右上角「换个主色」（或把鼠标移到任意候选色上点 ★），十阶立刻重算，预览和导出同步更新。
- **成品预览**：设计文件页里可以当场看组件 kit（浅色/深色两套）、总览画廊页和六张成品模板（landing / deck / poster / email / newsletter / form），和导出后浏览器打开的效果一致。
- **源码预览**：`tokens.css`、`brand.json`、`tokens.json`、`tailwind.config.js`、`DESIGN.md`、`guide.md`、`BRAND-SYSTEM.md` 七种都能看全文、一键复制。
- **改 brand.json 即时重生成**：`brand.json` 直接在软件里改（改色值、改标语、改语气都行），点「应用并重新生成」，18 个设计体系文件、六张模板、组件 kit 全部按新 brand 重算；写错了会告诉你第几行出问题，也能一键「恢复自动识别」。
- **AI 补全文案（可选）**：配好自己的 API Key 后一键让模型写标语、简介、语气、配色中文名，结果同样走「重生成」这条链路（见下文「接入 AI」）。
- **过程有反馈**：抓网页、渲染、整理样式、提配色、找标志、收素材图、下字体，每步都有进度。
- **最近提取**：成功的网站按时间排在左侧，点一下回到那次结果，可单条删除或清空。

### 一键导出（整套设计体系）
选一个文件夹，得到与原版 OpenDesign 同构的一套东西：

```
风格提取-域名-日期/
├─ brand.json              品牌本体：7 个语义色角色、字体、语气、素材清单、版式
├─ DESIGN.md               品牌说明书（frontmatter + 色板表 + 字体 + 语气 + 素材 + 版式）
├─ guide.md                一页纸品牌指南
├─ extraction.json         这次抓取的明细（主色、色板、字体来源、标志、模式）
├─ system/                 ← 设计体系本体，18 个文件
│  ├─ seed.json            20 个种子字段（所有下游都从它推导）
│  ├─ tokens.default.json  完整设计令牌（218 个变量，浅色）
│  ├─ tokens.dark.json     同一颗种子的深色算法
│  ├─ tokens.compact.json  同一颗种子的紧凑算法（只改密度）
│  ├─ variables.css        :root + .dark 两套 CSS 变量，一个文件切主题
│  ├─ variables.dark.css   独立的深色 :root
│  ├─ theme.json           antd ConfigProvider 主题（token + algorithm）
│  ├─ kit.html             组件全家桶（按钮/表单/导航/卡片/数据/营销/标签/提示/色板/字号）
│  ├─ kit.dark.html        深色组件全家桶
│  ├─ index.html           总览画廊页，串起所有产物
│  ├─ BRAND-SYSTEM.md      技术说明：每个文件是什么、怎么换主色、怎么切深色
│  ├─ artifacts/           landing / deck / poster / email / newsletter / form 六张成品
│  └─ scripts/apply-design-tokens.mjs  把 variables.css 拷进你项目的小脚本
├─ logos/                  标志图片
├─ imagery/                站点素材图（og:image 与页面大图，最多 8 张，有才生成）
├─ fonts/                  网站自带字体 + fonts.css + manifest.json（有才生成）
├─ prefetch/               抓取留档：原始 page.html、styles.css、material.md
├─ tokens.css / tokens.json / tailwind.config.js   三个便利格式（Tailwind、Design Tokens 消费方用）
└─ screenshot.jpg          网站缩略图（有才生成）
```

同一次导出里，`system/` 的节点名与变量名（`--brand-color-primary` 这类）和原版一致，所以原版的使用说明、组件代码可以直接套用。

## 接入 AI（可选，不填照样能用）

默认所有计算都在本机完成，不联网、不花钱。想要更像人的品牌文案，可以自己接一个**兼容 OpenAI 格式**的大模型接口（DeepSeek、通义千问、Moonshot、智谱、OpenAI、硅基流动、本机 Ollama 都行）。

### 怎么配
1. 点右上角「AI 设置」；
2. 选服务商 —— 接口地址和模型名会自动填好，也可以手改；
3. 粘贴自己的 API Key，点「测试连接」，看到「连通了：xxx 回了「通了」」就说明整条链路通了；
4. 点「保存」，顶栏会显示「AI 已接：模型名」。

### Key 怎么存
- 文件只有一个：系统应用数据目录下的 `ai-config.json`；
- 优先用系统凭据加密（Windows 是 DPAPI、macOS 是钥匙串、Linux 是 libsecret）；系统没提供凭据服务时会降级成 base64，界面上会**如实写明**是哪种；
- 界面永远只显示尾号；只有你点「测试连接」或「AI 补全文案」时，才把这个 Key 发给你自己填的那个接口，不经过任何第三方；
- 「清除配置」直接删掉这个文件。

### 现在 AI 能做什么：补全品牌语言
点「AI 补全文案」，模型读的是**实测素材**（7 个语义色角色、高频色、字体、页面大标题、正文段落、导航词、圆角与描边），产出一整套品牌语言：

| 产出 | 落到哪 |
|---|---|
| 标语、简介 | `brand.json` → 落地页 hero、DESIGN.md |
| 语气形容词、tone、三条文案支柱、推荐用词 / 避免用词 | `brand.json.voice` |
| 影像风格、画面主体、处理手法、该避免的画面 | `brand.json.imagery` |
| 主要颜色的中文名（如「靛蓝」「雪白」） | `brand.json.colors[].name` |
| 排版规矩（标题不超过两行 之类） | `brand.json.layout.postureRules` |

拿到结果后**自动重生成整套设计体系**（18 个文件），可以接着手改 `brand.json`。一次调用约 1~2k token。

### 分渠道文案（已实现）
点「AI 文案」标签页 →「生成分渠道文案」，模型读完品牌语气和信息点后，为三个渠道各写一套可直接使用的文案，语气有明确区分：

| 渠道 | 写什么 | 语气定位 |
|---|---|---|
| 官网首页 | 大标题、副标题、3 条卖点、CTA 按钮 + 辅助句 | 面向第一次来的访客，说清价值落到按钮上 |
| 公众号文章 | 2~3 个备选标题、摘要、正文开头、结尾引导 | 从场景切入讲展开，结尾自然引导 |
| App 商店 | 一句话介绍、商店标题/副标题、描述、版本更新 | 一句话说清价值，按「功能 → 适合谁 → 亮点」组织 |

每条可单独复制，也可按渠道或整包复制；点「导出整套设计体系」时会带上 `copy.json`（format: brand-copy/1），可以直接留给开发或运营取用。生成分渠道文案不影响 brand.json，想换风格随时「重新生成」。

### 还能做什么（规划，尚未实现，你点哪个我做哪个）
| 优先级 | 能力 | 说明 |
|---|---|---|
| P1 | 语义色角色复核 | 把 CSS 信号交给模型判断 accent / background 有没有判错，给置信度和替代色 |
| P1 | 可读性审查 | 列出不达标的文字/底色组合，给具体修法，改完自动重算整套 |
| P2 | 多站点风格综合 | 3 个竞品 → 一套融合方案（主色取谁、字体取谁、为什么），做「行业基准风格」 |
| P2 | `brand.html` 品牌页 | 原版有，靠模型写营销语，输出能直接发给客户的品牌页 |
| P2 | 设计规范问答 | 把 tokens + brand 当知识库，问「次要按钮什么颜色」「深色模式背景多少」 |
| P3 | 导出包体检 | 检查缺什么、命名是否一致、要不要补深色版，给改进清单 |
| P3 | 图片风格分析 | 多模态：判断 hero 图和品牌调性是否一致，给替换建议 |
| P3 | 批量对照表 | 一次跑十几个站点，输出风格对照表（主色 / 字体 / 圆角 / 语气） |

实现上这些能力只复用两条已有链路：**改 brand → finalize 重生成**，和**直接往 `system/` 里写文件**。所以成本主要在提示词设计和结果校验（模型乱写要比没人写更危险，所有输出都会先过一遍字段校验）。

## 怎么启动（开发模式，先不打包）
1. 确认电脑装有 Node.js（本机可用自带的 `D:\Github开源项目\tools\node-v24.22.1-win-x64`）。
2. 在本目录打开终端，首次执行：`npm install`（已执行过可跳过）。
3. 启动：`npm run dev`，稍等几秒会弹出软件窗口；也可以直接双击 `启动-网站风格提取器.cmd`。
4. 在输入框粘贴网址（可省略 `https://`，会自动补全），点「开始提取」或直接回车。

> 本轮按约定只做本地跑通，**没有打包成安装包**；等你确认功能满意后再统一打包。

> 小提示：如果软件一启动就报 `Cannot read properties of undefined (reading 'requestSingleInstanceLock')`，说明当前终端里带着 `ELECTRON_RUN_AS_NODE` 之类的环境变量，Electron 被当成普通 Node 跑了。先执行 `set ELECTRON_RUN_AS_NODE=` 再启动，或者直接用 `启动-网站风格提取器.cmd`（里面已经清过这两个变量）。

## 目录结构（技术备注，普通使用可忽略）
```
网站风格提取器/
├─ electron/                桌面主进程（联网抓取、渲染、提取、导出写盘、本地历史）
│  ├─ main.cjs             窗口、单实例、IPC（进度 / 预览 / 历史 / 换主色 / 补截图 / 外链）
│  ├─ preload.cjs          安全桥接（只暴露白名单方法）
│  └─ lib/
│     ├─ fetch-http.cjs    抓取（浏览器 UA、8 秒超时、禁止内网地址）
│     ├─ render-page.cjs   隐藏窗口渲染：取渲染后 DOM、运行期样式、实际计算样式、截图
│     ├─ colors.cjs        颜色规范化、频次统计、主色挑选（优先有彩度的品牌色）
│     ├─ palette.cjs       主色展开成 10 阶（Ant Design HSV 算法移植）
│     ├─ fonts.cjs         字体识别（排除通用/图标/兜底字体，大小写合并）
│     ├─ webfonts.cjs      @font-face 解析、字体文件下载（woff2 优先）、Google 字体地址映射
│     ├─ logos.cjs         标志候选收集 + 公共图标服务兜底
│     ├─ imagery.cjs       站点素材图收集（og:image / srcset / img，单张 ≤600KB，最多 8 张）
│     ├─ layout.cjs        从 CSS 猜圆角与描边粗细（进 seed 与版式）
│     ├─ brand-kit.cjs     提取结果 → 原版 Brand 契约（7 个语义色角色 + 语气 + 素材 + 版式）
│     ├─ meta.cjs          标题/简介/标题文案/导航词
│     ├─ css-collect.cjs   内联样式 + 外链样式表 + Google 字体样式表（每条带自己的来源地址）
│     ├─ extract-site.cjs  主编排：静态抓取 → 必要时渲染 → 标志/素材 → 字体下载 → 主色十阶
│     ├─ export-bundle.cjs 组装 system/ 全套 + brand.json/DESIGN.md/guide.md + 三个便利格式并写盘
│     ├─ brand-finalize.cjs 校验/修补手改或 AI 补全的 brand.json（缺角色回填、色值规范化、错误定位到行）
│     ├─ settings.cjs      AI 配置读写（userData/ai-config.json，Key 走系统凭据加密）
│     ├─ ai.cjs            兼容 OpenAI 的调用、错误翻大白话、提示词、输出收敛
│     ├─ od-engine.cjs     ★ 由 vendor/od-engine 编译出来的设计体系引擎（自动生成，别手改）
│     └─ history.cjs       最近提取（userData/history.json，最多 8 条，裁掉大体积二进制）
├─ vendor/od-engine/       从 OpenDesign 原样搬来的设计体系引擎（Apache-2.0）
│  ├─ engine/              seed → derive → export → kit → artifacts 全链路
│  ├─ schema.ts / fonts.ts / prefetch.ts   垫片：只补本应用需要的类型与字体注入
│  └─ entry.ts             打包入口
├─ src/                    界面（React + Vite + Tailwind）
│  ├─ App.tsx              主界面与状态流转
│  ├─ lib/ui.ts            小工具（复制、图标挑选、格子底、对比色）
│  └─ components/          网站信息卡 / 标志展示 / 配色 / 字体 / 设计文件（含 brand.json 编辑器）/ 最近提取 / AI 设置
├─ scripts/
│  ├─ build-engine.cjs     把 vendor 里的引擎打成 electron/lib/od-engine.cjs
│  ├─ test-logic.cjs       离线算法自测 12 项
│  ├─ test-export.cjs      导出文本 + 真实落盘自测 64 项（含 system/、素材图、字体注入）
│  ├─ test-fonts.cjs       字体解析、相对路径、Google 映射自测 18 项
│  ├─ test-engine.cjs      语义角色推断 + 引擎产物结构自测 32 项
│  ├─ test-ai.cjs          AI 配置加密、提示词、JSON 容错、brand.json 校验与 finalize 自测 64 项
│  ├─ smoke-fetch.cjs      联网冒烟（node scripts/smoke-fetch.cjs 网址）
│  ├─ verify-ui.mjs        走调试端口跑一次完整提取并截图（需应用带 --remote-debugging-port=9222）
│  ├─ verify-states.mjs    进度条 / 内网拦截 / 网络失败三态
│  ├─ verify-p2.mjs        渲染模式、四种预览、换主色、补缩略图、渲染模式内网拦截
│  ├─ verify-p2b.mjs       Google 字体标记、字体面板、brand.json 体积
│  ├─ verify-p3.mjs        成品预览：kit 浅/深、landing、BRAND-SYSTEM.md 逐张截图
│  ├─ verify-p4.mjs        AI 设置错误态 → 保存 → 手改 brand.json → finalize 重生成
│  └─ verify-p5.mjs        本地假接口端到端跑 AI 补全（用完自动清配置）
└─ 配置：vite.config.ts / tailwind.config.js / postcss.config.js / tsconfig.json
```

## 能力边界（提前知道，避免误判为故障）
1. **渲染模式也不是万能的**：需要登录、点了才加载的深分页、有人机验证的站，仍可能拿不全；渲染窗口只加载公开页面，20 秒打不开就放弃。
2. **只抓公开页面**：内网、本机、云元数据地址一律拦截（静态抓取和渲染窗口都拦），不会登录、不会读私密内容。
3. **截图为视口大小**：拍的是 1366×900 视口内的首屏，不是整页长图。
4. **字体下载有上限**：最多 10 个文件、单个 1.2MB、合计 4MB，woff2 优先、只取拉丁字符子集那一片；中文字体常有几 MB，会被跳过（界面会写「没下到」）。
5. **在线字体**：识别到 Google Fonts 时会给出可直接引用的样式地址；国内访问 Google 字体可能不通，需要自己换镜像或下载后自托管。
6. **相对路径**：字体里的 `../media/x.woff2` 会按「样式表自己的地址」补全（按页面地址补全会算错）。
7. **不下载品牌字体版权**：抓到什么就用什么，字体版权仍归原网站；商用请自行确认授权。
8. **语义色角色是「推断」不是「理解」**：background/surface/foreground/muted/border 靠 CSS 里的属性名 + 选择器信号判，判断不出来就按亮度与彩度估。像 Shopify 这种「深色画布 + 浅色文字」的深色优先站点，原版用大模型读出来的结论和启发式可能不一样（我们通常给浅色版，深色在 `kit.dark.html` 与 `tokens.dark.json` 里）。
9. **模板文案默认是机器拼的**：不接 AI 时只用页面标题、简介、导航词拼，标语会自动截到两行以内；接了 AI 可以一键补全（见上文），也可以手改 `brand.json` 后点「应用并重新生成」。
10. **成品模板里的图片**：来自站点素材图（最多 8 张）；抓不到就退回色块版式，不会留空白框。
11. 不做整页长截图、不做团队/账号绑定（刻意不做）；AI 完全可选，不配置时行为和以前一样。
12. **AI 只碰文案与命名，不碰抓取**：配色、字体、标志仍然来自本机实测，模型看不到、也改不了抓取过程。

## 自测方式（改完代码可以照这个顺序跑）
```
node scripts/build-engine.cjs       # 改了 vendor/ 里的引擎才需要重跑
node scripts/test-logic.cjs         # 期望 12 通过 0 失败
node scripts/test-fonts.cjs         # 期望 18 通过 0 失败
node scripts/test-engine.cjs        # 期望 32 通过 0 失败
node scripts/test-ai.cjs            # 期望 64 通过 0 失败（AI 配置、提示词、brand.json 校验）
node scripts/test-export.cjs        # 期望 64 通过 0 失败
npx tsc -p tsconfig.json --noEmit   # 期望零错误
node scripts/smoke-fetch.cjs https://www.baidu.com
```
（也可以直接 `npm test`，一次跑完上面五份测试。）

界面自测：①正常站出结果 ②切「浏览器渲染」抓一个 JS 站，看是否出现缩略图和字体文件数 ③成品预览里 kit 浅色/深色、landing 都能正常显示 ④源码页七种文件都有内容 ⑤换个主色，十阶、kit、tokens.css 同步变 ⑥只读源码模式点「补一张」能补截图 ⑦输入 127.0.0.1 被拦 ⑧导出文件夹里能看到 `system/` 全套 ⑨改 `brand.json` 的 accent 色值，点「应用并重新生成」，kit 里的主色要跟着变（`node scripts/verify-p4.mjs` 会自动做一遍并截图）⑩配置一个本地假接口跑 AI 补全（`node scripts/verify-p5.mjs`，会在本机临时起一个 stub，用完自动清配置）。

## 技术来源与许可
- 颜色频次/字体/标志提取思路、十阶色板算法、字体自托管与多格式导出的设计，参考了开源项目 OpenDesign（`apps/daemon/src/brands/`，Apache License 2.0）。
- `vendor/od-engine/` 里的设计体系引擎（seed → 三套 tokens → variables.css → kit → artifacts → 画廊）是**原样搬用**该项目的代码，只补了 `schema` / `fonts` / `prefetch` 三个垫片，再用 esbuild 打成 `electron/lib/od-engine.cjs`。移植后做过字节级对齐：同一份 `brand.json` 输入，18 个产物与原版完全一致。
- 仅用于学习与风格参考；抓取到的第三方品牌名称、Logo、字体版权归原网站所有，请勿冒充官方或用于侵权用途。

## 后续可选增强（待你拍板再做）
- AI 能力按上文「还能做什么」的优先级推进；
- 整页长截图 / 多页截图（滚动拼接）；
- 字体子集化（把中文字体裁成只含页面用到的字，体积能压到几十 KB）；
- 打包成 Windows 安装包 / 免安装绿色版。
