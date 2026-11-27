# 维护手册（dsh-panel-pins）

> 踩坑记录与架构要点，给未来的自己。

## 合规审查记录（2026-10-28，发布前审查）

| 检查项 | 结论 |
| --- | --- |
| 参考项目 `weibaohui/dsh-sidebar-tidy` 许可证 | **MIT** ✓，允许参考/移植并保留署名 |
| 代码抄袭 | 双向标识符检查 0 重合（我方 `dpp-*`/`dsh-panel-pins`/`findFamilyRows` 不在其 bundle；其 `dsh-tidy`/`locale.bind` 不在我方代码）。收纳思路（结构推导、锚点定位）为**思想**不受版权保护，实现为独立编写（自有类名、存储键、推导代码），README 已署名 |
| 图标 | `icon.svg` 与启动器各 icon path 与对方 bundle 逐条 grep 0 重合，原创 |
| 宿主（@deepseek-ai）专有代码 | 无复制。仅引用公开契约：`slots`/`settings.section` 槽位、设计 token 名、CSS 类名模式（类名模式是事实非代码）；代码中唯一 `@deepseek-ai` 字样是"不要 require 宿主原语包"的技术备注 |
| 敏感信息 | 无密钥/token/密码（grep apikey/secret/password/token 全部为 CSS design token 注释误命中） |
| LICENSE | MIT © 2026 QDNBD，package.json `license: MIT` 一致 |

**发新版时**：若再次参考他人实现，重复上表第 2、3 行的检查（双向 grep 特征标识符）。

## 架构速记

- 纯客户端插件：宿主半体 `lib/index.js` 是零逻辑薄壳，全部价值在 `lib/client.js`（web 端加载）。
- 样式全部通过 **类门控 + CSS 变量**：`html.dpp-tidy`（紧凑底部区）、`html.dpp-dark`（明暗）、`--dpp-panel-list-max` 等（设置页滑块实时写入 `<html>` style）。样式表只在 BUILD 变化时注入一次，切换零闪烁。
- 收纳目标推导（零硬编码类名哈希）：新会话行 → 面板列表 nav（`[class$="_panelList"]` 后缀匹配是最后兜底）→ 家族行 = 锚点后、列表前的可点击根子元素（含容器包按钮）。
- **标记-清扫**：隐藏入口时打 `data-dpp-hidden`，白名单变更/轮询时清扫恢复——对抗第三方插件移位/重建自己的入口。
- 钉住管理三源合并：侧栏可见面板行（已钉）+ localStorage 未钉记录 + `label-ids` 历史映射（宿主「更多」菜单插槽每次渲染都会喂）。

## 本机安装管线（重要：不要直接 Copy-Item！）

**症状**：直接拷文件到 `~/.dsh/profiles/desktop/node_modules/dsh-panel-pins` 后，桌面端一重启就被打回旧版。

**根因**：桌面端每次启动跑 pnpm install，按 profile 的 `pnpm-lock.yaml` 里记录的 **file: tgz** 重铺插件。绕过 lockfile 的拷贝必然回滚。

**正确流程**（replicate `D:\code\.dsh-acl-recovery\install-local-plugin.ps1`，该脚本会被环境的 safe-delete 护栏拦 `Remove-Item`，手工执行时避免无谓删除）：

1. `tar -czf D:\code\.dist\local-dsh-panel-pins-<ver>.tgz package.json cordis.patch.yml icon.svg lib locale`（在源码目录）
2. node 算 sha512 integrity（`C:\Users\wanglong\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`）
3. 备份 profile 三件套：`package.json` / `pnpm-lock.yaml` / `node_modules\.modules.yaml` → `*.bak-<ver>`
4. tgz 解包到 `~/.dsh/profiles/desktop/node_modules/dsh-panel-pins`（旧的先改名 `.old-<ts>`，事后清理）
5. 正则补丁三处：profile `package.json` 的依赖指向、lockfile 的 `@file:` 路径 + integrity + version、`.modules.yaml` 的 `@file:` 路径
6. 验证 `SRC==INST`（client.js SHA256 一致）、`LOCK hits == 2`、BUILD 标记

**同步前预检**：确认安装副本结构是 `lib/`+`locale/` 子目录（曾两次被外部工具拍平）。

## 已知坑

- **EXTRA_CSS 数组手改后必须跑 b90 套件 D 段**（1.4.7 事故）：声明块内混入裸选择器行（哪怕只是复制粘贴重复一行）= 坏声明，残余消费会吞掉其后**整段样式表**（无顶层 `;` 可停）；jsdom/`node --check` 都发现不了，只有 D 段的「无连续重复选择器行 + 末尾样式仍在」守卫能拦住。
- Bash 工具 cwd 跨调用不稳定：回归测试用绝对路径 `node D:/code/.tmp-dpp-test/test.js`。
- 回归测试沙箱在 `D:\code\.tmp-dpp-test\`（jsdom + stub React），测试两次踩过的自坑：文案断言别依赖容器语言；断言里 `[...querySelectorAll]` 拿到的是元素不是字符串。
- 新版 Chromium 设置 `scrollbar-width` 标准属性会**禁用** `::-webkit-scrollbar` 伪元素样式——统一走 webkit 伪元素，别混。
- 与 `dsh-any-background` 共存：弹层表面/滚动条必须消费宿主 token（`--dsw-menu-surface-fill`、`--dsh-scrollbar-thumb`），磨砂回退给 `blur(24px) saturate(150%)` 而非 `none`（否则删掉宿主 40px 磨砂）。
- 与独立版 `dsh-sidebar-tidy`（本地 CSS 补丁版 / GitHub 版）规则重叠：确认 panel-pins 稳定后建议用户卸载它们，避免叠加。
- `test-git-b83.js` 在 b84 起固定 4 失败（whitelist 移除→收纳→菜单清点链路：entriesOfSlot 桩形态过时），与 b84/b85 改动无关——stash 对照实测 HEAD 与工作树失败集完全一致。以 `test-b84-active-exempt.js`、`test-b85-feedback.js` 为准。

## 版本与构建号展示规范（2026-11-22 定稿，v1.4.3 起）

**双层标识，内外有别：**

| 标识 | 值例 | 允许出现的场合 | 禁止出现的场合 |
| --- | --- | --- | --- |
| **对外版本号** `VERSION` | `1.4.3` | 设置页脚注、issue 环境块、README、npm、GitHub tag/Release、收录描述、一切用户可见 UI | — |
| **内部构建号** `BUILD` | `b89` | 源码 `const BUILD`（排障锚点）、`?dppdebug` 覆盖层（`BUILD=b89` 行 + 标题） | **一切用户可见 UI**：设置页脚注、issue/诊断环境块、弹层标题、README、Release 标题 |

**理由**：官方发布渠道（npm/GitHub）每个版本号只有一个构建，`(bNN)` 对用户没有信息量，只会让人以为是版本号的一部分；它唯一的价值是**排障时区分本地 tgz 构建与 registry 构建**，而这只在 `?dppdebug` 里发生。

**每次发版检查**：`grep -n "(b" lib/client.js` 应只命中源码常量与 dppdebug 分支；`grep -n "'dsh-panel-pins v'" lib/client.js` 的两处（脚注 ~L7809、环境块 ~L1359）都必须是 `'dsh-panel-pins v' + VERSION`，**不带** `+ ' (' + BUILD + ')'`。

**历史**：v1.3.3–v1.4.2 曾把构建号放进脚注与环境块（当时的理由：issue 环境块与脚注一眼对照）；v1.4.3 起废止——对照需求由 `?dppdebug` 承担。

## v1.6.0（b96）右栏标签页 + 语言跟随 + 主题跟随（2026-11-26）

调研见 [OPPORTUNITIES.md](OPPORTUNITIES.md) 与 [COMPETITOR-ANALYSIS.md](COMPETITOR-ANALYSIS.md) 第九节。宿主版本 0.2.2-rc.5。三项都来自「宿主给了公开契约、我们没接」的漏接，不新增范式、不做 DOM 手术。

### ① 右栏标签页进入面板清单（推翻 v1.5.0 的旧结论）

- **旧结论是错的**：v1.5.0 写「宿主没有 `openGuide` 之类的公共打开 API，所以右侧栏不做」——**搜错了 API 名**。宿主确有完整的公开三件套：
  - `ctx.sidebarRightTabs.register({ id, kind, patterns?, priority?, canOpen?, title, guide?, keepMounted? })`（类型注册）
  - `ctx.slots.register({ name: 'sidebar.right.pane.tab', key: definition.id }, Body)`（正文注册）
  - `ctx.sidebarRight.openTab(kind, options?)`（打开）
  宿主 README 明写「the shipped guide type goes through exactly the same public path a type from another package does」（`dsh-client-ui-sidebar-right/README.md:83-86`）。
- **只列「页类型」**：注册项分两类——**页类型**（无 `patterns`，按 kind 打开）与**资源类型**（声明 `patterns` 匹配 `dsh-resource://` 地址，按**地址**打开）。`openTab()` 只会合成页地址 `sidebar://<kind>`（`service.ts:482` + `contract/seed.ts:45-47`），**不检查 patterns** → 对资源 kind 按名字打开会挂上一个 body 直接抛异常的坏标签页（documentpreview `CodeBody.tsx:17`）。且运行时没有「枚举某类型的全部地址」的公开 API，资源类型天然无法从类型清单推导可点击的地址。
- **`entries()` 已经只返回「当前生效」的那份**：被 extension 接管的 builtin 不会出现（`tab-registry.ts:313-315, :407-408`），所以我们**不需要**自己判断 extension/builtin 优先级。
- **`title` 是必填函数 `(address) => string`**，不是字符串。页类型收到的地址是 `sidebar://<kind>`；`pageAddress()` 本身**不是公开导出**，所以自己拼同一个字符串。第三方 title 实现不受控 → 必须 try/catch，兜底显示 kind。
- **`openTab` 会抛两种错**：kind 未注册（`service.ts:481`）与**没有会话在屏**（`service.ts:861`，优先于 kind 检查）。所以：点击瞬间**再查一次** `registry.get(kind)`；并且组出现前先看 `ctx.sidebarRight.mounted.getSnapshot()`，没会话就不出组（不出死行）。宿主自己的范式见 `ui-open-in-app/src/client/context-menus.tsx:192-193`（查了再开）。
- **需要导航参数的 kind 手工排除**（`scheduleTask`）：参数表 `SidebarRightTabParamsMap` 只是 TS 声明合并，运行时不存在（`contract/params.ts:38-40`），只能靠白名单。
- 枚举走 `ctx.sidebarRightTabs.entries()`，**每次开菜单现取**——别的包可能在我们之后才注册类型（每个类型都在自己包的 `ctx.effect` 里注册），快照会漏。
- 徽标**不计入**右栏条目：b95 的「主面板」组同样没计入，徽标的口径是「侧栏面板 + 插件入口行」。

### ② 语言跟随宿主

- 宿主的 locale runtime 在 **client half** 提供（`dsh-client-locale/src/client/index.ts:588 ctx.provide('locale', locale)`），8 种语言（zh/en/ja/es/fr/de/ru/pt）且可在应用内切换。当前语言 id = `ctx.locale.getSnapshot().active`（`index.ts:75-82, :228-230`）；**没有** `.current` / `.language` 属性，别猜名字。
- 两条订阅通道语义不同：**`subscribe(fn)`**（store 式）在任何快照变化时触发（含字典注册）；**`ctx.on('locale/change', snapshot)`** 只在生效语言切换时触发（`index.ts:88-99, :506`）。我们两条都挂，`refreshLocale()` 在语言没动时是 no-op，重复信号零成本。
- **走 B 方案（自己读 active id 选 zh/en），不注册宿主命名空间**：注册命名空间要求补齐 8 语言字典才有收益，而 A 方案（`ctx.locale.register(ns, {zh, en})`）的逐键 fallback 链与 `common` 继承对我们只有双语时**结果完全等价**，改动量却大一个数量级；且注册命名空间还有命名空间撞名抛错、缺键静默显示 key 本身两个坑。
- **`locale` 绝不写进 `inject`**：旧宿主（engines.dsh >= 0.2.0-rc.1）可能没有 locale 包，声明缺失服务会 park 整个 fiber、插件永不加载。一律 `optionalService('locale')`。
- **原来的 `const zh` 是模块求值时的一次性快照**（`client.js:481-487`，IIFE 读 `navigator.language`），导致：宿主设成中文而浏览器是 en-US 时插件显示英文；且挂载后无法切换。现在 `zh` 是 `let`，`LABEL` 由 `buildLabels()` 生成、**原地重建**（对象 identity 不变 → 185 处 `LABEL.x` 引用一行不用改），`refreshLocale()` 负责重算 + 重建 + 通知订阅者。
- 设置页订阅 `onLocaleChange` 触发 React 重渲染（`setLocaleRev`）；设置项的 `label` 本来就是 thunk（`label: () => zh ? … : …`），宿主重渲染时自动跟随。
- 启动器按钮的 `aria-label` 与 `.dpp-launcher-label` 是**创建时缓存**的 → `repaintLauncherLabels()` 单独刷。

### ③ 主题跟随宿主

- 宿主运行期改的是**三个属性**，**没有一个是 `<html>` 的 class**：`<html>.style.colorScheme`、`<html>[data-ds-theme-source]`、`<body>[data-ds-dark-theme]`（`dsh-client-ui-layout/src/client/theme-presenter.ts:69-76`）。v1.5.0 的观察器只听 `class` → **根本不会触发**，切主题最长 5 秒（靠兜底 interval）。
- 正解是**订阅宿主的公开事件**：`ctx.on('theme/change', snapshot)`，snapshot 带 `active.colorScheme`（`dsh-client-ui-theme/src/client/index.ts:144, :438`）；服务本体是 `ctx.provide('theme', theme)`（`:609`），`theme.getTheme()` 同样给出快照。零 DOM 嗅探、零滞后。
- **DOM 兜底**（无 theme 服务的老宿主）：读宿主真正写的属性。注意 `data-ds-theme-source` 为 `'system'` 时实际明暗由 `body[data-ds-dark-theme]` 决定（该属性只在解析结果为暗色时存在）→ **body 属性才是权威**。
- **DOM 推导出来的结果不能缓存**：宿主切回亮色时是**移除** `data-ds-dark-theme`，缓存会把弹层留在暗色。所以只有**服务/事件**的答案进 `hostColorScheme`，DOM 每次实时读。
- 影响面有限：`html.dpp-dark` 只用于弹层不透明底色（不是主题失效），属抛光级缺陷——但改动只有几行，顺手做掉。

#### ③-1 真机复验发现：主题信号的优先级（v1.6.0 补丁）

在**真机**（DSH 0.2.2-rc.5 桌面端 + 装了「外观定制」插件的环境）做了一次真实换肤，发现 v1.6.0 初版的主题判定是错的：

| 信号 | 宿主切到深色时的值 | 是否可信 |
| --- | --- | --- |
| `theme.getTheme().active.colorScheme` | **`light`**（第三方主题 `custom-color` 的 colorScheme 是 light） | ❌ 与实际调色板不符 |
| `getComputedStyle(document.body).colorScheme` | **`light`**（body 有自己的 `color-scheme` 声明，不继承） | ❌ 永远是 light |
| `document.documentElement.style.colorScheme` | `dark`（宿主 presenter 写的解析结果） | ✅ |
| `<html>[data-ds-theme-source]` | `dark` | ✅ |

初版把 **service 的值缓存成权威**（`hostColorScheme`），于是它挡住了 DOM 兜底——宿主已经暗了，插件还亮着。修正后的优先级：

1. **宿主 presenter 写下的解析结果**（`<html>.style.colorScheme` → `getComputedStyle(<html>).colorScheme` → DOM 属性），**每次实时读、不缓存**；
2. 主题服务（降级为兜底——第三方自定义主题可能与实际调色板不符）；
3. `<html>` 的 computed color-scheme；
4. body 背景亮度。

**教训**：`ctx.theme` 的 `active.colorScheme` 描述的是「当前生效的主题**定义**」，**不等于「屏幕上是什么颜色」**——第三方主题可以注册一个 colorScheme 与用户偏好不符的 theme id。判断"是不是暗色"必须读宿主 presenter 写下来的**解析结果**。

**另一个坑**：`<body>` 的 `color-scheme` **不继承**（body 上有独立声明），读 body 永远得到 light——必须读 `<html>`。

#### ③-2 真机复验方法（可复用）

桌面端是 Electron，**用 `--remote-debugging-port` 重启即可用 CDP 在真实渲染进程里求值**：

```powershell
Get-Process 'DeepSeek Harness' | Stop-Process -Force; Start-Sleep 6
Start-Process 'C:\...\DeepSeek Harness\DeepSeek Harness.exe' -ArgumentList '--remote-debugging-port=9222'
# → http://127.0.0.1:9222/json/list 拿 webSocketDebuggerUrl，Runtime.evaluate 即可
```

**⚠️ 两个 2026-11-26 实测的启动坑（此前「CDP 端口起不来」的真正根因）**：

1. **`ELECTRON_RUN_AS_NODE=1`**：agent/工具会话的环境变量里常带着这个值（WorkBuddy 等工具链注入）。宿主 exe 继承后以**纯 Node 模式**启动：拒绝 `--remote-debugging-port` 报 `bad option`、`--version` 回答 Node 版本、无参数启动读 stdin 到 EOF 即退（窗口都不出现）。**启动宿主前必须先清掉该变量**（PowerShell：`Remove-Item Env:ELECTRON_RUN_AS_NODE`）。
2. **agent 前台命令结束会连带杀掉它启动的宿主**：`Start-Process` 出的进程属于本次命令的作业对象，命令一返回就被回收（表现为「启动成功、几秒后进程全没」）。从 agent 会话做真机验证要**后台保活**：`run_in_background` 里启动 + 死循环监控；后续 CDP 走 TCP 独立连接，不依赖启动它的 shell。
3. 两次连续重启要间隔够长（12s+），否则新实例可能绑不上端口（DevToolsActivePort 文件写了新 GUID 但连接被拒）——干净杀进程 → 等 → 再启动。

- 宿主自己的设置入口：侧栏底部「**账号菜单**」→「设置 Ctrl+,」→ 左侧导航；**外观**（浅色/深色/跟随系统）在「通用设置」里，控件是 `button.Iwzhua_themeCube`；**语言**在「通用设置」的 `button.CDP_Dq_selector`。
- `Emulation.setEmulatedMedia` 能改 `prefers-color-scheme`（`matchMedia` 会变、MQL change 事件会触发），但**宿主不会因此换肤**——它的主题偏好是显式值不是 system，媒体查询监听器会主动 return。**要换肤必须走宿主的设置 UI**。
- 往**装在盘上那份** `lib/client.js` 注入探针（不动源码仓）再重启，能直接读到插件内部状态；改完用 `scripts/pack.ps1` 重装即还原。

### ④ 顺手修的坑：MutationObserver 的取值

- 插件里的 `new MutationObserver(...)` 取的是**全局**构造器。在浏览器里 `window.MutationObserver === MutationObserver` 所以无差别；但在被另一个 window realm 执行时（jsdom 回归台、宿主沙箱）没有全局 `MutationObserver` → `ReferenceError` 被 catch 吞掉 → **观察器从未安装**。这是既有代码的老问题（老 class 观察器在测试里也一直没生效），现在统一走 `mutationObserverFor(callback)`：优先 `window.MutationObserver`。
- 这条修完，DOM 兜底路径才**可测**——之前 b96 的两条 DOM 断言就是被它挡住的。

### 回归

- 新套件 `D:\code\.tmp-dpp-test\test-b96-locale-theme-righttabs.js`（33 项）：主题服务/事件/DOM 属性三条路径与销毁解绑、**「宿主 presenter 信号压过说谎的 theme 服务」两条**；宿主语言压过 navigator.language、`locale/change` 与 store 双通道、销毁解绑；右栏页类型列出、资源类型与需参数 kind 不列出、点击打开、点击前类型已卸载则不打开、无宿主控制器/无会话则不出组、title 抛错兜底、palette 同样列出。
- 全量：b96 33/33 + b95 快捷键/主面板 25/25 + b95 拼音 16/16 + b84 26/26 + b85 29/29 + b86 41/41 + b90 29/29 = **199 项全绿**。
- **真机端到端复验**（CDP 驱动真实桌面端）：v1.6.0 已加载（`__dppFeedback.feedbackEnvBody()` → `dsh-panel-pins v1.6.0`）；palette 里出现「右栏标签页 · 12」组（宿主 12 个页类型）且资源类型未混入；`mbsn` 命中「面面板收纳」；宿主语言 English ↔ 中文 实时切换，启动器文案跟着变（`Open panels menu` ↔ `打开面板菜单`）；宿主深色 ↔ 跟随系统 实时切换，`html.dpp-dark` 跟着变。

## v1.6.1（b97）新会话按钮居中修复（2026-11-26）

### 现象

侧栏「+ 新会话」按钮里的文字**顶在上沿**，按钮下半截留一大块空白，整个按钮看着像半个空输入框。2026-11-26 用户两次截图报此问题。

### 定位过程（每一步都可复核）

1. **先排除外部插件**：真机 CDP 抓到按钮元素是 `button.wtg9ga_newSession`（宿主 CSS module 的哈希类名），`CSS.getMatchedStylesForNode` 命中的规则只有 3 条——2 条浏览器 UA 默认 + 1 条宿主自己的 `.wtg9ga_newSession`（来自 `@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css`）。**没有任何插件规则命中**；把 33 张第三方样式表全部 `sheet.disabled = true` 后，按钮的计算样式（`rgb(255,255,255)` / `0.8px solid rgba(0,0,0,0.12)` / `12px`）**一字不变**。宿主自己的样式本来就是「白底 + 细描边 + 12px 圆角」。
2. **再量自己的锅**：A/B 对照——同一时刻**只**切换本插件那张样式表：

   | | 按钮垂直中心 | 文字中心 | 偏差 |
   | --- | --- | --- | --- |
   | 本插件样式表**开** | 115 | 107 | **偏上 8px** |
   | 本插件样式表**关** | 111 | 111 | **0** |

3. **根因**：`html.dpp-tidy.dpp-tidy-brand [class*="_newSession"] { margin-bottom: 8px !important; }`。宿主把「新会话」拆成

   ```
   div._newSessionRow → div[data-slot=sidebar.session.action] → button._newSession
     → span._newSessionLabelMask → span._newSessionContent → span._newSessionLabel
   ```

   而 `[class*="_newSession"]` 是**前缀包含**匹配，一次命中 **6 个**元素（行、按钮、遮罩、内容、标签、快捷键提示）。按钮是 `display:flex; align-items:center`，多出来的 8px 下边距落在内层 span 上，把内容整体顶到上沿。
4. **修法**：把间距锚到**行**本身 → `[class*="_newSessionRow"]`（宿主类名 `wtg9ga_newSessionRow`）。行间距（按钮与下方面板列表之间的 8px）保留，按钮与内层恢复宿主原样。

### 教训

- **用宿主的哈希类名做「包含匹配」时，必须挑唯一的那一段**。`_newSession` 是 `_newSessionRow` / `_newSessionLabel` / `_newSessionContent` / `_newSessionLabelMask` / `_newSessionShortcut` 的**共同前缀**，一写就全中。要写成 `_newSessionRow` 这种带完整后缀的词。
- 这类问题**像素级证据比目测可靠**：CDP 量 `getBoundingClientRect()` 的中心差（以及 `Range` 量文字墨迹位置），比盯截图猜快得多。
- 复验手段有两套：CDP（`--remote-debugging-port` + `Runtime.evaluate`）为主；**CDP 端口没起来时用 `PrintWindow` 直接抓窗口像素**做兜底（本轮就撞上过端口没绑上的情况）。

### 回归

全套 **199 项全绿**（b96 33 / b95 快捷键 25 / b95 拼音 16 / b84 26 / b85 29 / b86 41 / b90 29）；真机复验：按钮内壁 y=121~166（中心 143.5）、文字墨迹 y=136~151（中心 143.5），**偏差 0**。

## v1.5.0（b95）宿主快捷键 + 拼音搜索 + 主面板入口（2026-11-25）

调研见 [COMPETITOR-ANALYSIS.md](COMPETITOR-ANALYSIS.md) 第八节。宿主版本 0.2.2-rc.5。

### ① `Ctrl+K` 注册进宿主快捷键服务

- **契约来源**：`app.asar` 字符串扫描 + 宿主 `dsh-client-shortcuts` 的 README。命令形状：
  `{ id, label: () => string, aliases: string[], defaults: Partial<Record<'desktop|web>:'macos|windows|linux', {code, modifiers}>>, regions: ('page'|'editable'|'terminal')[], modals: string[], resolve(ctx) => {status:'handled',run} | {status:'pass'} | {status:'blocked',reason} }`。
- **绑定键位用 `code`（物理键）+ `modifiers:['primary']`**（`primary` 在 macOS 展开为 Cmd、其它为 Ctrl）。宿主拒绝重复 id 与**重叠默认键位**——宿主将来自己占用 Ctrl+K 时 `register()` 会抛异常。
- **必须自己写守卫**：宿主 `dispatch()` 里 `priority = runtime==='desktop' && (windows||macos)`——**Desktop 端不自动执行 `regions`/`modals` 检查**（只有 Web 路径执行）。所以「不在宿主输入框里抢键」的判定必须放在我们的 `resolve()` 里，用宿主算好的 `context.region`（'editable'/'terminal'/'page'），比旧的手工嗅探 `event.target` 可靠（宿主还管 shadow root 与 xterm）。
- **回退是契约不是错误路径**：服务不存在（<0.2.2）或 `register()` 抛错 → 保留原来的 `document keydown` 监听（`hostShortcutActive` 为 false 时才由它接管）。宿主接管后我们的 DOM 监听**必须让位**，否则「宿主 toggle 关闭 + 插件再开」会互相抵消。
- **我们自己的搜索框也是 editable 区**：宿主 `resolve` 在 editable 区返回 pass，所以 palette 里的 Ctrl+K 关闭由搜索框自己的 keydown 处理。
- `modals: []`：Web 路径下任何打开的模态都会挡下命令，与我们在 `resolve` 里的判断一致。
- 清理：`dispose` 事件里调用 `register()` 返回的 disposer（孤儿绑定会把 Ctrl+K 永久占住）。

### ② 拼音搜索

- 字表 = **完整 GB2312（一级 + 二级，6763 字）** → 拼音（无声调），紧凑编码成 `<汉字><ascii 拼音>` 记录流，单引号字符串字面量内联在 `lib/client.js`。GBK 独有的生僻字（如 龘）不在表内 → 退回字面匹配，不报错。
- 生成脚本 `scripts/gen-pinyin.mjs`（仅构建期用 `pinyin-pro` + `iconv-lite`，**插件运行时零依赖**）。字表由脚本注入，**不要手改**。
- 注入坑（踩了两次）：① `String.replace` 的**字符串替换值**会解释 `$&` / `$'` 等模式 → 必须用**替换函数**；② 占位符往返替换会多出一层引号（`'__X__'` → `'表'` 变成 `''表''`）→ 直接**按行重建**那一行，别用正则截断整行（正则 `[^']*` 会在双引号处截断，留下半截字表）。
- 匹配层级（分数从高到低）：字面全等 > 字面前缀 > 拼音首字母全等 > 全拼前缀 > 字面子串 > 首字母子串 > 全拼子串 > 模糊子序列（按间隔扣分）。**字面命中永远压过拼音命中**，与用户直觉一致。
- **按显示名匹配**（`displayNameFor`），不是原始 label——重命名过的行才是用户看到的名字。
- 排序只在**组内**做（组序不变，`replayGroupFolds` 依赖「组头 + 相邻子项」）。清空搜索框必须**恢复原顺序**（`menuItems` 数组保存原始次序，用 `insertBefore` 复位）。`Array.prototype.sort` 稳定 → 同分保持原序。

### ③ 主面板入口

- 宿主 `ui-layout` 用 `ctx.slots.entries('main')` 枚举主面板（`entry.options.key`），我们读**同一个公开槽位**；打开用 `layout.selectPanel(key)`——与设置页桥接同一调用。
- 排除：宿主会话列 `conversation`、我们自己的 `dpp-bridge-*`（已在「设置页」组里）。
- 标签：优先 `options.label` → `options.title` → 槽位 key（第三方多半只给 key，会显示原始 id，属可接受的降级）。
- **右侧栏标签页当时不做**（⚠️ **此结论已被 v1.6.0 推翻**）：better-sidebar 的 tab 落在宿主原生右栏，我们当时搜的是 `openGuide`（asar 里 0 命中）就断定没有公共打开 API——**搜错了 API 名**。宿主其实有完整的公开三件套（`ctx.sidebarRightTabs.register` / `ctx.slots.register({name:'sidebar.right.pane.tab'})` / `ctx.sidebarRight.openTab(kind)`）。**教训**：宿主契约要用「包 README + TS 源码」双向查证，不能只靠关键词全库扫描的 0 命中下结论——0 命中只证明**这个符号名**不存在。见 v1.6.0 章节与 OPPORTUNITIES.md。

### 回归

- 新套件 `D:\code\.tmp-dpp-test\test-b95-shortcuts-mainpanels.js`（25 项）：宿主命令注册/解析器三种上下文/销毁解绑/宿主接管后不重复触发/注册被拒时回退/主面板组渲染与点击选中/拼音搜索与清空复原。
- `test-b95-pinyin.js`（16 项）：直接**从 client.js 抽取真实匹配代码**执行（不是另写一份实现），避免测试与实现漂移。
- **b85 套件的版本断言此前写死 `v1.4.0` / `b86`**（v1.4.3 起契约已去掉用户可见构建号），6 项长期失败；已改成从 package.json 与源码动态读取，现 29/29。
- b84 26/26、b86 41/41、b90 29/29 保持不变。

## v1.3.3（b85）反馈机制

- 三通道全点击触发、零自动上报：GitHub issue（URL params 预填 title/body）、作者自有问卷（`FEEDBACK_SURVEY_URL` = 作者自己的飞书表单 rcnenqajjbvx.feishu.cn——**绝不指向宿主问卷** `trtgsjkv6r.feishu.cn`，那是 DSH 官方的表单，插件作者收不到提交）、诊断复制（`buildDump()` + 环境块上剪贴板）。宿主 `__DSH_CONTACT_CONFIG__.contactSource` 只作 `prefill_source` 的来源标注，永不改变目的地。
- **隐私红线**：`feedbackEnvBody()` 只含插件版本/构建、宿主版本、UA、语言四项，绝不包含 localStorage 值与面板名——dump 含面板名/重命名，复制必须显式点击（「复制诊断信息」），永不自动附到 URL。
- `window.open` 必须在 click 处理器内同步调用（异步打开被 webview 弹窗拦截拦掉）；三个 UI 入口（设置卡/palette 命令/诊断按钮）都守此约。
- 回归：`D:\code\.tmp-dpp-test\test-b85-feedback.js`（29 断言：URL 构造、契约读取、回退、剪贴板失败 toast、隐私不泄漏；版本断言从 package.json 动态读取，改版本号不再破坏测试）；测试钩子 `window.__dppFeedback`。

## v1.4.0（b86）设置页桥接进 launcher

- 机制（dsh-panel-control 先例适配，前缀 `dpp-bridge-`）：只注册 `settings.section` 无侧栏入口的第三方页面搬进 Panels 菜单——注册 `main` keyed 面板（`dpp-bridge-<section id>`，声明自有子槽）+ 把 section 组件**带顶层 `inject`/`store`/`locale`**（宿主 StoredEntry 顶层字段，不在 `options` 里——0.9.3 事故）重注册进子槽；壳组件顶栏「返回对话」= `layout.selectPanel(null)`。
- 归属启发式：id 精等 / 剥 `-settings` 后等 / 面板 id 以 `-<base>` 结尾（**含 idx>=0 守卫**——`indexOf` 的 -1 会与算术 -1 撞车造成误判归属）/ label 同名 → 视为已有入口；内置五件（account/general/models/agent-presets/plugins）、自有 section、声明了 `children` 的 section、无组件 section 一律排除。
- 菜单呈现：launcher overlay 新增「设置页」组（`group: 'bridge'`），点击 = `layout.selectPanel(bridgeId)`；无 layout 服务时整组隐藏（无死行）；空清单守卫放宽（`bridgeSettings.entries.size === 0` 才 early-return）。
- 对账纪律：只做增删（绝不重注册未变化的行，避免交互中重挂载）；120ms 去抖；`settings.section` 订阅**可重试**（声明前 subscribe 观察不到任何东西）；启动重扫 `[350, 900, 2000, 4200, 8000, 15000]ms`；每个 `slots.register` try/catch + 成对回滚——**register 抛错泄漏进 loader.start() 会中止整个启动**（文档化事故）。
- 开关：`dsh-panel-pins:bridge`（默认开）+ 设置卡 switchRow；关闭即成对撤回，若正停在该页先 `selectPanel(null)`（选中不存在的 key = 空列死屏）。dispose 事件清理全部配对 + 订阅 + 定时器。
- 回归：`test-b86-bridge.js`（42 断言：识别启发式全套、顶层字段透传、成对注册/回滚、开关撤回与安全着陆、overlay 组渲染与点击选中、晚注册订阅、dispose 清理、无 layout 降级）；测试钩子 `window.__dppBridge`。

## v1.4.8（b94）rc.5 限高列表滚轮修复 + 1.4.7 样式表截断事故回退（2026-11-25）

- **用户报告**：桌面端回退到 1.4.4——工作区可以滑动、列表滑动不了；1.4.5–1.4.7 三版都没修好。
- **根因①（1.4.4 的固有缺陷）**：rc.5 免驱动限高只是错觉——宿主手令视口处理器（`scroll-handoff.ts`）对导航区所有可取消滚轮事件 preventDefault 后只驱动视口，列表 `overflow-y:auto` 的原生滚动永远不会发生。
- **根因②（1.4.7 的致命事故）**：EXTRA_CSS 里 `html.dpp-rc3 [class$="_regionArea"] {` 被复制两遍。声明块内出现裸选择器 = 坏声明，CSS 解析器的「消费坏声明残余」会吞掉平衡块直到下一个顶层 `;` 或 EOF——本样式表全是 `selector { }` 规则、没有顶层分号，**其后所有规则被静默丢弃**（滚动条主题、tidy 底部限高、icon-only、.dpp-launcher、弹层全灭）。1.4.7 的「还是不行」大概率由此目视即判死刑。
- **修复**：以 v1.4.4 为基底 + `installNavWheelLite`（列表可吸收步 preventDefault + 驱动列表；边界步原样放行；不 stopPropagation、不代写 viewport）。监听次序安全：插件 capture 在 nav（先发），宿主 bubble 在视口祖先（后发）且 `event.defaultPrevented` 早退。EXTRA_CSS 与 1.4.4 **逐字节一致**（node 比对）。新增 `RC5_CLASS`（仅作 ensureLauncher 驱动分派门，无 CSS 挂其上）。
- **回归**：b90 套件更新至 b94 契约 29/29——A 段 LITE 驱动（吸收/边界放行/不写视口）、B 段 rc3 劫持、C 段 legacy、D 段改回不门控 cap + **两条截断守卫**（无连续重复选择器行；launcher/overlay 样式仍在=样式表未被截断）；b84 26/26、b86 41/41 不变。
- **本机**：pack.ps1 全绿，profile 三处 → `local-dsh-panel-pins-1.4.8.tgz`，SRC==INST（SHA256 一致），BUILD=b94。`.pnpm/lock.yaml` 虚拟存储副本仍 1.4.4 旧态（今晨 registry 切换前已陈旧，重铺自动重建，不处理）。npm/GitHub 未发布，待用户重启验证后走 OTP publish。

## v1.4.4（b90）rc.5 滚动手令契约修复（2026-11-24）

- **用户报告**：rc.5 桌面端 + 插件 1.4.3，「左侧工作区滑动不下去」。
- **根因**：rc.5（`dsh-client-ui-sidebar`）把侧栏滚动改成了 **scroll-handoff**——视口 `div._scrollArea` 是绑定 `scrollHandoff.bindViewportRef` 的 **grid** + `container-type: scroll-state` 容器，视口先把面板导航滚走，工作区列表座 `div[data-sidebar-list-area]`（`dsh-client-ui-workspace` WorkspaceBrowser）再经 `@container scroll-state(scrollable: bottom)` 接管。1.4.3 的 b79 把 `_scrollArea` 强改 flex、b83 把工作区 root 解限高、b81 在 nav 上 capture 拦滚轮——三者都破坏了这条契约：工作区永远等不到接管，滚轮被 b81 吃掉。
- **修复**：`detectScrollContract()`——`_scrollArea` 带 `data-sidebar-scrollport` 标记 = rc5；不带 = rc3；都没有 = null（legacy，不加结构规则）。b79/b83 结构规则与 b81 滚轮劫持全部限定 `html.dpp-rc3`；rc.5 只保留不门控的面板列表限高（到列表末尾自然链给视口，正是宿主契约）。检测结果暴露在 `window.__dppScrollContract`。
- **回归**：`test-b90-scroll-contract.js` 16 断言（rc5/rc3/legacy 三形态 × 门控类 × 滚轮劫持 × 样式表门控 + 面板限高不门控）；b84 26/26、b86 41/41 不变；b85 的 3 失败为测试自身陈旧断言（还在断言 `v1.4.3 (b89)` 形态，HEAD stash A/B 实测一致），与本次无关。
- **验证边界**：官方 dsh-doc 验证参考禁止从 shell 拉独立浏览器/找 web token——rc.5 真机滚轮行为待用户重启桌面应用后确认；静态证据链：宿主 `SidebarRoot.tsx`/`scroll-handoff.ts`/`SidebarRoot.module.css`/`WorkspaceBrowser.module.css`（asar 内 src 直读）。

## 宿主契约（v1.3.2 b84 实测，桌面端 0.2.2-rc.5）

从安装目录 asar 提取 `@deepseek-ai/dsh-client-ui-layout` 的 client.js 逐字核实（提取法：读 asar 头 JSON 拿文件 offset/size，`8 + headerSize + offset` 处读 bytes）：

- **layout 服务**：`ctx.reflect.provide('layout', ...)`，可选读取必须走 `optionalService` 容错访问器（`ctx.get` 对未声明服务部分 cordis 版本抛错）；**绝不**把 layout 加进 `inject` —— 声明缺失服务会 park 整个 fiber，插件永不加载（panellist 文档化的教训）。
- **panelInfo 形状**：`{ getSnapshot: () => store.getSnapshot().panelInfo, subscribe: listener => store.subscribe(listener) }`；快照形如 `{ activePanelId: string|null }`。`activePanelId()` 与订阅驱动刷新（切面板不产生 sidebar DOM mutation，observer 看不见）都建立在这上面。
- **selectPanel 语义**：`layout.selectPanel(panelId)` 对未注册的 main key **抛错**（`main panel "..." is not registered`）——桥接/跳转调用必须 try/catch；store 层 `retainMainPanels` 会在面板清单变化时自动清掉失效的 activePanelId（置 null，回对话），是宿主级的失效兜底。
- **profile 安装形态警报**：1.2.2 起 npm 单名发布，desktop profile 的依赖形态从 `file:tgz` 漂成 registry `^x.y.z`——pack.ps1 的 5a/5b/5c 只匹配 local- tgz 形态，全部静默空转，**桌面端启动重铺会把本地安装回滚到 npm 已发布版**。pack.ps1 已加 5a2（检测 `^` 形态 → 自动转 file:tgz + pnpm lock 重建，pnpm.cjs 从运行时 `dependencies\pnpm\bin\pnpm.cjs` 相对定位）。

## v1.7.0（b98）Pin 双源收敛——宿主管交互，插件管记忆（2026-11-27）

### 背景（真机实锤的缺陷，2026-11-26 CDP 取证）

- 宿主 0.2.2-rc.5 自带原生图钉：侧栏面板行行尾 `css.panelUnpin`（hash 成 `wtg9ga_panelUnpin`，`SidebarRoot.tsx:101-110`，`wide && canUnpin` 时渲染）+「更多」菜单里 entry-customization 的未钉条目固定按钮。宿主 pin store **纯内存**（`panel-pins.ts` 的 snapshot store，重启重置）——`createPanelPins` 源码逐字核实。
- 插件的持久化 `unpinned`（localStorage）+ 旧 `syncIntoHost` 在**每次 slot 挂载**都把存储意图强推回宿主 → 用户在原生图钉上取消固定被无声复活。真机时序铁证：T2 点原生取消行消失（DOM 移除）→ T5 重开菜单行复活（`syncIntoHost` 推回），localStorage 全程 `[]`。
- 同一菜单双份控件：宿主原生行尾图标 + 插件 `.dpp-row` 整行，7 个面板全双份。

### 方案 a 实现（`lib/client.js`，「native pin mirror」节）

- **检测**：`probeNativePinControls()` → `document.querySelector('button[class$="_panelUnpin"]')`（`$=` 尾段匹配，hash 前缀无关；`panelUnpin` 类名仅 sidebar 包使用）。探测在 PinMenuRows effect 每次挂载时跑 + 300ms 延迟补探；`nativePinSeen` 会话级闩锁（新 renderer 重置，宿主升级移除控件自动回退旧行为）。
- **三种同步模式**（PinMenuRows effect 分流）：
  - 无原生控件（旧宿主）：旧 `syncIntoHost` 每次挂载推送，行为与 1.6.1 逐字相同；
  - 原生控件 + 首次挂载（`!mirrorArmed`）：`mirrorAdoptAndRestore`——先**收养**（宿主已 unpinned 而存储不知道的 id，覆盖「用户先原生取消、后开菜单」的窗口），再**恢复**（宿主内存重置导致的丢失，推回存储意图），然后武装；
  - 已武装：`mirrorFromHost`——**宿主赢**，entries 的 pinned flags 原样记入 localStorage，永不推送。原生取消固定从此被记住、不复活。
- **解除武装**：`applyLayoutSnapshot`（布局预设）与 `applyImportedDumpShared`（导入配置）整份覆写 unpinned 存储 → `mirrorArmed = false`，下次挂载走恢复把新意图推给宿主。
- **UI**：`nativePin` state 门控渲染——原生控件在场时不渲染逐条钉住行（fold/tidy/family 行保留，与 pin 无关）。peek（临时钉住打开未钉面板）不变：peek 只对存储中已 unpinned 的面板操作，mirror 记录前后幂等。
- 用户显式操作（设置页钉住管理/右键钉住/导出导入）照旧写存储 + 推送，armed mirror 记录宿主状态后自然一致。

### 回归

- 新套件 `D:/code/.tmp-dpp-test/test-b98-pin-mirror.js`（16 项，mini-React stub：真 useState 槽位 + useEffect deps 语义）：legacy 行渲染与推送、首挂载恢复、armed 镜像记录原生取消/原生重钉、**无复活断言**（calls 里不得出现 (id,true) 回推）、adopt-before-restore、行隐藏+fold 保留、plugins id 永不镜像。
- 全量：b98 16/16 + b96 33/33 + b95 25/25 + 16/16 + b84 26/26 + b85 29/29 + b86 41/41 + b90 29/29 = **215 项全绿**（b86-final.js 文件自身编码损坏不参与，与改动无关）。
- **真机端到端**（CDP，`cdp-pin-verify-a/b.js`）：V1 加载 ✓；V2 菜单中逐条钉住行 0、原生按钮在场 ✓；V3 原生取消插件市场 → localStorage 立刻记录 `dsh-market` → 重开菜单行不复活、原生按钮不回来（+2.5s 稳定）✓；V4 应用重启 → store 两 id 保留 → 首挂载恢复：插件市场/定时任务都从侧栏消失并正确出现在菜单未钉区（label-id-map 证实 `dsh-automation`=定时任务）✓。
- 既有视觉遗留（与本次无关，未处理）：schedules（自动化任务）行在菜单打开瞬间采到 display:none——实为**收起菜单里的未钉条目**（panelRow 类在菜单条目上同样存在）+ Tooltip portal 按钮残留坐标，关闭菜单后侧栏行全部 flex 正常。

### 发布状态

- pack.ps1 全绿：`local-dsh-panel-pins-1.7.0.tgz` → desktop profile 三处同步，SRC==INST。BUILD=b98，VERSION=1.7.0。
- npm/GitHub 未发布（同 1.6.0/1.6.1 一起等用户 OTP publish）。

## v1.7.1（b99）toast 宿主 token + overlay 无障碍语义（2026-11-27）

- **toast token（P1-6）**：`.dpp-toast` 的 `background-color`/`color` 改以 `--dsw-alias-toast-bg` / `--dsw-alias-toast-label` 打头（宿主 `dsh-client-ui-theme/src/styles/design-platform.css:299-301/451-452` 定义，两套 palette 都是深底），旧 menu-surface 链保留为老宿主 fallback。真机 computed 背景 `rgb(53,54,56)` = 宿主 toast 深底 neutral-bluish-800，与原生提示观感一致。toast 本就有 `role="status"`。
- **ARIA（P1-3）**：overlay 从无效的 `role="menu"`（内含可编辑搜索框，menuitem 语义非法）改为——容器 `role="dialog"` + `aria-label`（面板菜单/命令面板，LABEL 新增 ovMenu/ovPalette）；`.dpp-ov-body` → `role="listbox"` + 稳定 id `dpp-ov-list`；8 处行 `menuitem` → `option` + `aria-selected`；搜索框 → `role="combobox"` + `aria-expanded/haspopup/aria-controls/aria-autocomplete=list`；`setKb/clearKb` 同步 `aria-selected` 与 `aria-activedescendant`（行 id 惰性分配 `dpp-ov-opt-N`）；footer 三行（foot/fam/tidy）移除 role（dialog 里 menuitem 非法，原生 button 语义即正确；**勿用 presentation——会剥掉可交互语义**）；group head 加 `role="presentation"` + `aria-label`（焦点保留但不在 option 流里）；空状态 → `role="status"`。行右键菜单的 `menu/menuitem`（6425/6481 附近）本来就是合法配对，未动。
- **回归**：新 `test-b99-toast-aria.js` 34 项（token 打头/兜底链、b90 D 段截断守卫、dialog/listbox/combobox/option/status 全链、ArrowDown 驱动 aria-activedescendant 到真实 option、过滤重置）；全量 **249 项全绿**（b99 34 + b96 33 + b95 25+16 + b84 26 + b85 29 + b86 41 + b90 29 + b98 16）。测试正则踩坑：`/color:/` 会先匹配 `background-color:` 的后缀，须用 `(^|;)\s*color:`。
- **真机**（`cdp-verify-171.js`）：V1 toast token 在活样式表打头且解析出宿主深底色 ✓；V2 launcher 打开菜单 → dialog+「面板菜单」/listbox+id/combobox+controls/51 行 48 option 0 menuitem ✓；V2b ArrowDown → `aria-activedescendant=dpp-ov-opt-1` 解析到 option 行、selected=true、dpp-kb 在 ✓。**脚本注意**：真机打开 overlay 要点 `[data-dpp-launcher]` 或 Ctrl+K——`aria-label=更多` 的是宿主自己的菜单。
- **发布**：pack.ps1 全绿（1.7.1 三处同步），commit + tag v1.7.1 + GitHub Release。npm 待 OTP。

## v1.8.0（b100）触屏长按拖拽 + 侧栏收起徽标（2026-11-27）

- **P1-2 触屏拖拽**：鼠标路径（HTML5 DnD）原样保留零回归；触屏/触控笔新增长按手势（installRowDrag 之后的模块级 touch 段）——按住 500ms armed（vibrate 30ms 反馈）→ 移动 >8px 进入拖态（touchmove preventDefault 抑制滚动 + elementFromPoint 找落点 + 复用插入线）→ 松手 `commitRowDrop` 提交；armed 未动松手 → 合成 `contextmenu` 到行按钮，**复用右键菜单全逻辑**（handleContext 正常处理）；armed 前移动 >10px → 取消让位滚动。原生长按 contextmenu 在 armed 期间被 capture 拦截（防双菜单），合成菜单后的 tap-click 被 400ms 窗口抑制（防误开面板）。`commitRowDrop` 从 drop handler 抽出为模块级共享函数（drop/触屏两路共用）。
- **两个实现坑（诊断实锤）**：①client.js 闭包无 DOM 构造器——`new MouseEvent` 抛 `MouseEvent is not defined` 且被 onTouchEnd 的 catch 吞掉（armed 分支整个失效），必须 `new window.MouseEvent`；②commitRowDrop 首次插在了 installRowDrag 函数体内，模块级 onTouchEnd 报 `commitRowDrop is not defined`——已移到模块级（panelRowFromEventTarget 前）。诊断手段：onTouchEnd/catch 加 [PROBE] 日志 + localStorage.setItem spy，跑完即删。
- **P1-5 收起徽标**：注册宿主自有槽位 `sidebar.toggle.badge`（SidebarRoot.tsx:302 `renderSlot(...)`，index.ts:99 `'single'/root`，仅收起态渲染）；ToggleBadgeRows 每 1.5s 轮询 `foldedBadgeCount()`（rowsHidden ? readPanelList().length : 0 + family ? findFamilyRows().length : 0），0 渲染 null；旧宿主 inject 未知槽位惰性无效。
- **回归**：新 `test-b100-touch-badge.js` 24 项（armed/拖拽提交/取消/合成菜单/click 抑制/native suppress/mouse DnD 不回归 + badge 注册/计数/轮询）。**jsdom 手段**：TouchEvent 不可构造 → 普通 Event 手动挂 touches/changedTouches；elementFromPoint 未实现 → 测试桩直接返回落点行；getBoundingClientRect 全 0 → 落点行实例覆写。**测试坑**：b98 系列 react stub 的 useState 缓存槽位——同实例二次渲染不重跑 initializer，badge 计数变化必须等 1.5s 轮询触发 setCount 后再渲染；children 在 props 里（b99 已修，勿再读 out.children）。全量 **273 项全绿**（b100 24 + b99 34 + b96 33 + b95 25+16 + b84 26 + b85 29 + b86 41 + b90 29 + b98 16）。
- **真机**（`cdp-verify-180.js`）：V1 toast token 无回归 ✓；V2 overlay ARIA 无回归（dialog/listbox/combobox、48 option 0 menuitem）✓；V3 收起侧栏 + 开收纳 → `.dpp-badge` 显示「8 · 已收纳 8 行进启动器」→ 恢复后消失 ✓（badge 在收纳 0 行时按设计不渲染，第一次采到 null 是正确行为）。触屏手势真机无法模拟（桌面 CDP 无 touch），靠 jsdom 24 项覆盖 + 桌面端实际触屏待用户复验。
- **发布**：pack.ps1 全绿（1.8.0 三处同步），commit + tag v1.8.0 + GitHub Release。npm 1.6.0–1.8.0 五版待 OTP publish。
