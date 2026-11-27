# 候选机会盘点（第九节·扩展稿）

> 调研日期：2026-11-26。宿主版本 **DSH 0.2.2-rc.5**（`C:\Users\wanglong\AppData\Local\Programs\DeepSeek Harness\resources\app.asar`，209MB，本轮已完整解包分析）。
> 方法：三条独立证据线交叉验证 —— ①宿主契约线（asar 解包逐字读 TS 源码 + README 契约文档）；②代码/UX 线（`lib/client.js` 8675 行逐段读）；③竞品线（npm registry + api.npmjs.org 实测）。
> 配套：[COMPETITOR-ANALYSIS.md](COMPETITOR-ANALYSIS.md) 第八节（上一轮盘点）、[MAINTENANCE.md](MAINTENANCE.md)（踩坑记录）。
> 解包产物在 `D:\code\.tmp-dpp-test\asar-extract\`，不污染源码仓。

---

## 零、先更正上一轮的一个**错误结论**

上一轮（第八节）写下：

> **P0-3 右侧栏标签页不做**：宿主 `openGuide` 在 asar 里 0 命中，没有公开的打开 API，枚举出来也点不开——宁可不做，也不做点不动的死行。

**这个结论是错的，根因是搜错了 API 名字。**

宿主确实有公开的右栏标签页**注册 + 枚举 + 打开**三件套，完整契约写在
`@deepseek-ai/dsh-client-ui-sidebar-right/README.md:83-86`：

| 阶段 | 公开 API | 源码位置 |
| --- | --- | --- |
| ① 注册类型 | `ctx.sidebarRightTabs.register({ id, kind, patterns?, priority?, canOpen?, title, guide?, keepMounted? })` | `src/client/tab-registry.ts:94-139`、`src/client/index.ts:183-184` |
| ② 注册内容体 | `ctx.slots.register({ name: 'sidebar.right.pane.tab', key: definition.id }, Body)` | `README.md:86`、`src/client/index.ts:290` |
| ③ 打开 | `ctx.sidebarRight.openTab(kind, options?)` / `openResource(address, options?)` | `src/client/service.ts:250`（声明）、`:380-392`（实现） |
| ④ 枚举 | `ctx.sidebarRightTabs` 的 `entries()` / `subscribe` | `src/client/tab-registry.ts:321`、`:402`、`src/client/index.ts:230` |

宿主 README 原文（第 83 行）：

> A tab type registers in two stages, and the shipped guide type goes through exactly the same public path a type from another package does (`ui-sidebar-documentpreview` is the live proof).

`openGuide` 之所以 0 命中，是因为它根本不是这个 API 的名字 —— 真名是 `sidebarRight.openTab(kind)`。
**第八节「P0-3」应当恢复为候选，且它是本轮最高价值的一条。**

---

## 一、宿主契约线：已证实但我们完全没用上的公开能力

宿主在 `0.2.2-rc.5` 里提供了 **21 个 `provide()` 服务 + 85 个公开槽位**（`ctx.slots.register/inject` 可注册）。
我们目前**只用了 2 个槽位**（`sidebar.panellist.actions`、`settings.section`）和 **2 个服务**（`ctx.slots`、`ctx.shortcuts`）。
下面每一条都是**已在本机 asar 中逐字核实**的，不是推测。

### H1 ★ 右栏标签页：可枚举 + 可打开（推翻旧结论）

- **做什么**：把宿主右栏已注册的标签页类型（`kind` + `title`）纳入我们的「面板」启动器分组，点击调 `ctx.sidebarRight.openTab(kind)` 打开。
- **解决谁的问题**：装了 better-sidebar（**73,582 次/周**，本赛道流量是第二名的 80 倍）却找不到它的标签页的用户；以及任何注册了右栏标签页的第三方插件。
- **证据**：
  - `dsh-client-ui-sidebar-right/README.md:95` —— 「`openResource(address, options?)` 和 `openTab(kind, options?)` 是导航控制器，**进入右栏的每一条路径都是对这两个之一的调用**」。
  - `src/client/service.ts:390` —— `openTab<K extends string>(kind: K, options)` 实现；`:481` —— kind 未注册时抛 `sidebarRight: no tab type is registered as "..."`。
  - `src/client/tab-registry.ts:94-139` —— `SidebarRightTabDefinition` 有 `id`/`kind`/`title(address)`/`guide?`/`multiple?`/`keepMounted?`。
  - `src/client/tab-registry.ts:321` —— `entries(): readonly SidebarRightTabDefinition[]`，`:402` —— `subscribe(listener)`。
  - `src/client/tab-registry.ts:328-330` —— `guide()` 返回每个已注册类型的 guide 条目（含 `kind`），这批条目**本身就是现成的「右栏入口清单」**。
- **实现难度**：**中**。枚举 + 分组渲染是纯前端；打开一行 `openTab(kind)`。难点只有两个：①`openTab` 对未注册 kind 会抛，必须 try/catch（与 `layout.selectPanel` 同款教训）；②右栏是 **session 作用域**，没有选中会话时 `openTab` 无处可落 —— 需要判定「当前有无会话」再决定是打开还是提示。
- **兼容与回归风险**：**低**。全部走公开服务 `ctx.sidebarRight`，服务不存在时整组隐藏（与 v1.4.0 桥接同款降级策略）。**不触碰任何硬约束**：不写 DOM、不做手术、不改 `inject`。
- **是否触碰硬约束**：❌ 不触碰。`ctx.sidebarRight` 走 `optionalService()` 容错读取。
- **我验证过 / 没验证**：契约与源码 ✅ 已验证；**「better-sidebar 的标签页确实注册进了 `sidebarRightTabs`」未验证**（better-sidebar 是第三方包，本机没装其源码），只验证了宿主侧通道存在且为公开契约。

### H2 ★ 宿主自带命令面 `ctx.commandUi`

- **做什么**：把我们的面板清单注册成宿主 `/` 菜单里的一条命令（`popupSelect`），用户键入 `/` 即可搜面板并直达；也可把 Ctrl+K 注册成一条 `action`。
- **解决谁的问题**：**不知道 Ctrl+K 存在的用户**。我们最强的护城河是键盘效率，但键盘用户之外 100% 的用户看不见它 —— 命令面板的「可发现性」问题。
- **证据**：
  - `dsh-client-ui-commands/src/client/contract.ts:135-149` —— `CommandUiContract`：`register(contribution)` / `decorate(decoration)` / `dismiss(name)`。
  - `contract.ts:64-75` —— `PopupSelectSpec`：`options(session, signal): Promise<readonly SelectOption[]>`、`onSelect(option, session)`、`searchMode?: 'substring' | 'fuzzy-label'`、`searchLabels?()`。
  - `contract.ts:30-47` —— `SelectOption` 带 `group?: { name, label }`（吸顶分组）、`badge?`、`detail?`、`active?`。
  - `contract.ts:82-89` —— `ActionSpec`（裸调用型）。
  - `dsh-client-ui-commands/README.zh.md:28` —— 「composer 的 `+` 按钮与键入的 `/` 打开同一个菜单」；`:38` —— `'fuzzy-label'` 在组内按前缀/得分排序。
- **实现难度**：**中**。注册本身是一行；但我们现有面板清单在 **DOM 层**（`lib/client.js` 读侧栏行），要喂给 `options()` 得先有一条**数据层的面板清单**（`ctx.slots.entries('sidebar.panellist')` 已经能给出权威 id+label —— 见我们 v1.5.0 的「主面板」实现，client.js:4660 附近）。
- **兼容与回归风险**：**中**。①宿主会做「同名冲突直接报错」——我们的命令名必须避开宿主目录；②`popupSelect` 走宿主自己的弹窗壳，我们**失去**自研拼音搜索（宿主只有 substring/fuzzy-label，**没有拼音**）→ 必须想清楚是「宿主壳 + 无拼音」还是「我们自己的壳 + 拼音 + 另挂一条 action」。
- **是否触碰硬约束**：❌ 不触碰。
- **我验证过 / 没验证**：契约 ✅ 已验证；**未在真机上注册过**（`ui-commands` 需与 `ui-input-trigger`、`ui-conversation` 同时挂载，宿主 bundle 里三者都在 `dsh-web-app/cordis.patch.yml:403-407` ✅）。

### H3 触发源注册 `ctx.inputTriggers.registerSource`

- **做什么**：注册一个自己的触发源（如 `@面板`），在 composer 里作为独立 source 出现。
- **证据**：`dsh-client-ui-input-trigger/src/client/contract.ts` —— `InputTriggerServiceContract.registerSource(src): () => void`（重复 trigger/name 会抛）。
- **实现难度**：**中高**（要实现 source 的候选发现 + 解析协议，比 H2 重）。
- **风险**：**中高**。与 H2 收益重叠，**建议 H2 先做、H3 观察**。
- **我验证过 / 没验证**：契约 ✅ 已验证；真实接入路径未验证。

### H4 ★ 语言：宿主有 8 种语言 + 应用内语言设置，我们只认 `navigator.language`

- **做什么**：用 `ctx.locale` 注册我们的字典（`ctx.locale.register(ns, { zh, en, ... })` + `ctx.locale.bind(ns)`），文案随宿主语言即时切换。
- **解决谁的什么问题**：**用日/西/法/德/俄/葡语界面的用户** —— 现在我们的插件是纯英文/纯中文，与宿主界面语言不一致（混排）。以及**在应用内切了语言的用户** —— 我们的语言判定完全不跟随。
- **证据**：
  - `dsh-client-locale/README.md:12` —— 宿主内置 en / zh / ja / es / fr / de / ru / pt（`pt` 含 `pt-PT`）；用户选择持久化在 `locale.preference`，**即时生效**。
  - `README.md:34` —— 「Active locale is applied immediately」；`README.md:40` —— `ctx.locale.register(ns, { zh, en, ja })`，`ctx.locale.bind(ns)` 翻译。
  - **我们的实现**：`lib/client.js:481-486` —— `const zh = (function () { return String((navigator && navigator.language) || '').toLowerCase().indexOf('zh') === 0 })()`，**模块初始化时求值一次，此后再不重算**；全文件所有文案都是 `zh ? '中文' : 'English'` 的硬编码二元分支。
  - **旁证**：`locale/zh.json`、`locale/en.json` 里只有 `meta.title` / `meta.description`，是**市场卡片元数据**，不是 UI 词典 —— client.js 里没有任何地方引用它们（grep `locale/` 0 命中）。即：**我们的 UI 一行 i18n 框架都没有**。
- **实现难度**：**中**。把 `LABEL` 对象从「初始化期常量」改成「按当前语言求值的函数」，是纯重构，不动 UI 结构。
- **兼容与回归风险**：**低**。`ctx.locale` 不存在时退回现有 `navigator.language` 判定即可（老宿主路径不变）。
- **是否触碰硬约束**：❌ 不触碰（`optionalService('locale')`）。
- **我验证过 / 没验证**：✅ 全部已验证。

### H5 ★ 主题：宿主切主题时我们的明暗判定有延迟

- **做什么**：用 `ctx.theme` 快照（`snapshot.active.colorScheme`）判定明暗，订阅 `theme/change` 事件即时跟随。
- **解决谁的什么问题**：**在应用内切换明暗主题的用户** —— 我们的弹层底色最长 5 秒不跟（fallback 定时器兜底），切换瞬间观感割裂。
- **证据**：
  - **宿主怎么切**：`dsh-client-ui-layout/src/client/theme-presenter.ts:69-75` —— `document.documentElement.style.colorScheme = scheme`（改的是 **`style` 属性**）、`document.documentElement.setAttribute('data-ds-theme-source', …)`（改的是 **`data-*` 属性**）、`body.setAttribute('data-ds-dark-theme', '')`。**三者都不是 `class` 属性。**
  - **我们怎么探**：`lib/client.js:8474-8481` —— `attrObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })`，回调是 `applyTheme`。**只看 `class`，而宿主改的是 `style` / `data-ds-theme-source` → 观察器在主题切换时不触发。**
  - 兜底：`lib/client.js:8452` —— `setInterval(refreshAll, 5000)` → `:2509` 调 `applyTheme()`。所以**最长 5 秒后自愈**，但切换瞬间的错色是真实存在的。
  - 兜底之外还有一层启发式：`lib/client.js:1069-1085` `isDarkSurface()` —— 先读 computed `colorScheme`（**这条其实有效**，因为宿主把 `colorScheme` 写在 `<html>` 的 inline style 上），失败再按 body 背景色亮度猜（`< 384` 判暗）。
  - 宿主侧契约：`dsh-client-ui-theme/README.md:12,28` —— 「Feature plugins consume the current snapshot through `ctx.theme`… **they do not manage theme state themselves**」。
- **实现难度**：**低**（加两个 attribute 到 `attributeFilter` 即可，5 分钟级；或换 `ctx.theme` 订阅）。
- **兼容与回归风险**：**低**。纯读侧改动。
- **是否触碰硬约束**：❌ 不触碰。
- **我验证过 / 没验证**：✅ 全部已验证（含宿主 presenter 的逐字实现）。

### H6 宿主原生右键菜单 `ctx.contextMenus`

- **做什么**：把我们的「行右键菜单」从自绘 DOM 换成宿主 `contextMenus.register({ id, target, order, resolve })`，获得宿主原生观感、阴影、触屏长按与键盘可达性。
- **证据**：`dsh-client-ui-context-menu/src/client/`（`registry.ts` 8KB、`target-key.ts`、`trigger.ts`、`store.ts`）；宿主自家用法见 `dsh-client-ui-sidebar-right/src/client/index.ts:141-158`（`ctx.contextMenus.register({ id:'sidebar.close', target:'tab', order:100, resolve: ({sessionId,paneId,tab}) => [...] })`）。
- **实现难度**：**中**。契约清晰，但我们的菜单是**纯 DOM**（client.js:5651-6133），要转成 React 组件 + 宿主 target 匹配，工作量不小。
- **风险**：**中高**。自绘右键菜单是我们差异化的一部分（宿主菜单未必支持我们「置顶/收藏/拖拽管理」这类自定义行）；且移动端触发方式是宿主决定的。
- **我验证过 / 没验证**：契约 ✅ 已验证；**未评估宿主菜单能否表达我们的全部行**，未验证。

### H7 未用上的公开槽位（宿主 85 个槽位里的高价值者）

宿主 `ctx.slots` 共有 85 个可注册槽位，我们只注册了 2 个。以下是评估过后**尚未被任何插件用过**或**几乎没人用**的：

| 槽位 | 用途 | 价值评估 | 难度 | 证据 |
| --- | --- | --- | --- | --- |
| `sidebar.toggle.badge` | 侧栏收起时，展开按钮上的**非交互徽标** | 中。可显示「已收纳 N 个面板」/「当前分组 X」→ 收起态的**信息可见性** | 低 | `dsh-client-ui-sidebar/README.md:50,56` |
| `sidebar.footer.action` | 侧栏底部动作行 | 中。宿主已有紧凑底部区，我们可用官方位 | 低 | slots 扫描（`dsh-client-ui-cordis/src/client/index.ts:86`） |
| `sidebar.right.tab.guide.entry` | 右栏 guide 页的入口卡片 | 中高。若做 H1，顺带贡献一个 guide 卡片 | 中 | `dsh-client-ui-sidebar-right/README.md:121` |
| `sidebar.right.pane.tab` (+`.title`) | **自己注册一个右栏标签页** | 高。可以做「我们的面板面板」页进右栏 | 中高 | `README.md:86` |
| `conversation.session.header.actions` | 会话头右侧动作区 | 中 | 低 | slots 扫描 |
| `sidebar.workspaces.session.menu.item` / `.row.action` | 会话行菜单项 / 行内动作 | 中。可把「置顶会话」「面板管理」进会话右键 | 中 | slots 扫描 |
| `sidebar.session.row.hover` / `.leading` | 会话行悬停/前导槽 | 中低 | 低 | slots 扫描 |
| `sidebar.session.action`（hoc） | 包住 New Session 行 | 低（我们不碰 New Session） | 低 | `dsh-client-ui-sidebar/README.md:52` |
| `contextMenu.content` / `.icon` | 右键菜单扩展 | 与 H6 配套 | 中 | slots 扫描 |
| `workspace.toast.content` | 宿主 toast 渲染工厂 | 中低 | 低 | `dsh-client-ui-workspace/src/client/toast/register.ts:22` |
| `conversation.input.overlay` | composer 输入浮层 | 低（与 H2 重复） | 中 | slots 扫描 |
| `shell.leading` / `shell.overlay` | 窗口 chrome | 低 | 中高 | slots 扫描 |

### H8 ★★ 宿主原生 Pin 控件已经上线，且与我们的持久化 Pin 是**双源**

- **证据链**：
  - 宿主原生 Pin UI 存在：`dsh-client-ui-entry-customization/README.zh.md:31` —— 左侧栏「更多」菜单列出未固定入口，每项带独立「固定到左侧栏」图标；悬停时原位替换。
  - 它确实被装载：`dsh-web-app/cordis.patch.yml:460-461` —— `- id: entry-customization / name: '@deepseek-ai/dsh-client-ui-entry-customization'`（在**浏览器插件名单**里）。
  - 宿主的 pin 状态**纯内存、刷新重置**：`dsh-client-ui-sidebar/src/client/panel-pins.ts:25-35`（`createSnapshotStore({ unpinned: NO_PANELS })`，无持久化）；`dsh-client-ui-sidebar/README.md:44` —— 「Choices reset when the plugin reloads and legacy localStorage values are ignored」。
  - **我们把持久态推回宿主**：`lib/client.js:954-963` `syncIntoHost(entries, onPinnedChange)` —— 逐条比对 `entry.pinned`（宿主内存态）与 `wantPinned = !unpinned.has(entry.id)`（我们的 localStorage 态），不一致就 `onPinnedChange(entry.id, wantPinned)` 强行覆盖。调用点 `client.js:6652`（`PinMenuRows` 的 `useEffect`，依赖 `[entries, onPinnedChange]`）。
  - 我们自己也在同一槽位渲染 Pin 行：`client.js:6633` `PinMenuRows({ entries, onOpen, onPinnedChange, onDismiss })`，注册于 `client.js:8390-8391`（`name: 'sidebar.panellist.actions'`, `id: 'panel-pins'`, `order: 900`）。
- **推断出的两个问题（⚠️ 需真机确认）**：
  1. **双份 Pin 控件**：「更多」菜单里同时有宿主的原生固定图标行和我们的 Pin/Unpin 行（`client.js:6735-6751`）。
  2. **状态分叉**：宿主原生「取消固定」会把该条目从宿主 `entries` 里**移除**（宿主 More 菜单只列未固定项）→ 我们的 `syncIntoHost` 遍历不到它 → **我们的 localStorage 不知道这次取消** → 我们的启动器仍显示它为「已固定」；插件重载后我们又把持久态推回去，**行又回来**。反向亦然：我们在自己界面里取消固定，会覆盖宿主的内存态。
- **解决谁的什么问题**：所有用宿主原生 Pin 按钮的用户 —— 目前会看到一个行为不稳定的双套机制。
- **实现难度**：**中**。
- **风险**：**中**。方案要么（a）检测宿主已有原生 Pin 控件时**隐藏我们的 Pin 行**，只保留「持久化镜像」职责（写回 localStorage + 重载时恢复）；要么（b）保持现状并在文档里说明谁赢。**方案 (a) 更干净但需要能识别宿主那套 UI**（不可用硬编码选择器 —— 得靠 `entries` 里 `pinned` 字段 + 槽位注册 id 判断）。
- **是否触碰硬约束**：❌ 不触碰。
- **我验证过 / 没验证**：源码与契约 ✅ 全部已验证；~~「双份 UI 实际同时可见」「宿主取消固定后行会回来」是代码推断，未在真机截图确认~~ → **两项均已于 2026-11-26 真机 CDP 实锤，见下方补充**。

### H8-补充：2026-11-26 真机验证（CDP 9333，`cdp-pin-dual/phase4.js`，截图在 `.tmp-dpp-test/pin-*.png`）

**结论一：双份 Pin 控件同时可见 ✅**。同一个「更多」菜单里，7 个已钉面板每个都同时有：宿主原生行尾图标 `wtg9ga_panelUnpin`（aria「从侧边栏取消固定XX」，28×28）+ 我们注册的整行 `button.dpp-row`（「从侧栏取消钉住XX」）。

**结论二：宿主原生取消固定会被无声复活 ✅**，且比 H8 原推断**更严重**——不需要等插件重载，**只要重开一次「更多」菜单就立即复活**。时序（目标：插件市场）：

| 时刻 | 侧栏行 | 我们的 `unpinned` 存储 | 原生取消固定按钮 |
| --- | --- | --- | --- |
| T0/T1 点击前 | 可见 y=87 | `[]` | 在 |
| T2 点原生取消 +600ms | **从 DOM 消失** | `[]`（没学到） | 该项消失 |
| T3/T4 关菜单 +3s | 不在 | `[]` | 该项不在 |
| T5 **重开菜单**（我们的 slot 挂载） | **回来了 y=87** | `[]` | **回来了** |
| T6 +2.5s | 在 | `[]` | 在 |

**机制修正（比 H8 推断更精确）**：宿主原生取消固定后，条目**并没有**被移出传给 slot 的 `entries`（H8 原推断「遍历不到它」不准确）——复活路径是：重开菜单 → 我们的 `PinMenuRows` 挂载 → `useEffect` → `syncIntoHost()` 发现「存储认为该钉住」vs「宿主内存 pinned:false」不一致 → `onPinnedChange(id, true)` **主动强推回宿主**。用户刚做的取消固定被无声覆盖，且全程无任何提示。

**启动器徽标不更新**：原生取消固定后 `dpp-launcher` 徽标保持「面板9」不变（因为我们不知道这次取消），进一步放大不一致。

**顺带踩坑（runbook 级）**：本机 agent/工具会话环境带 `ELECTRON_RUN_AS_NODE=1`，直接 `Start-Process DeepSeek Harness.exe` 会以 Node 模式启动（拒 `--remote-debugging-port` 报 bad option、无参数时读 stdin 到 EOF 即退）——**之前「CDP 端口起不来」的坑多半是这个**。启动宿主前必须先清掉该变量；且从 agent 会话启动需后台保活（前台命令结束时宿主会被连带杀掉）。

---

## 二、代码 / UX 线：自家实现里的具体痛点

### U1 ★ 语言不跟随宿主设置（与 H4 同源，代码侧证据）

`lib/client.js:481-486`：

```js
const zh = (function () {
  try {
    return String((navigator && navigator.language) || '').toLowerCase().indexOf('zh') === 0
  } catch (error) { return false }
})()
```

模块初始化求值一次。宿主允许在「设置 → 通用 → 语言」里切换到 ja/es/fr/de/ru/pt —— **切过去之后我们的界面不变**。
**我验证过**：✅ 源码已读；`navigator.language` 与宿主语言设置是两套来源，宿主 README.md:34 明确语言选择是**应用内设置**，与 navigator 无关。

### U2 ★ 主题切换滞后（与 H5 同源，代码侧证据）

见 H5。要点：观察器只听 `class`，宿主改的是 `style` + `data-ds-theme-source` + `body[data-ds-dark-theme]`。
**我验证过**：✅（宿主 presenter 逐字 + 我们观察器逐字）。

### U3 ★ 拖拽是 HTML5 DnD → 触屏完全不能拖

`lib/client.js:6944-7056`：只有 `dragstart` / `dragover` / `dragend` / `dragend` 清理，**没有任何 `pointerdown/pointermove` 拖拽实现**（文件里的 `pointerdown` 只有 5627/6128/6975 三处，全是「关闭浮层」和「标记可拖」用途）。
HTML5 DnD 在触屏设备上不触发 → 手机/平板用户无法调整侧栏行顺序。
竞品 `dsh-panel-tidy`（246/周）用的正是纯指针事件 + 长按 500ms 进入拖动态，README 里明写「不用 HTML5 DnD，所以触屏能拖」。
**我验证过**：✅ 我们的实现；竞品的实现只读了 README 描述，**未读其源码**。

### U4 ★ 无障碍：overlay 的 ARIA 不完整，键盘高亮不暴露给读屏

- `lib/client.js:4736` —— overlay 的容器 `dpp-ov-body` **没有 `role="menu"`**；但它的子项普遍带 `role="menuitem"`（`:5479`、`:5501`、`:5535`、`:5181` …）。
  → **`role="menuitem"` 没有 `menu` 祖先，是无效 ARIA**。
- 键盘高亮实现：`:5395-5410` `clearKb()` / `setKb(idx)` —— **只加/删 CSS class `dpp-kb`**，焦点始终留在搜索框（`search.focus()`），**没有 `aria-activedescendant`、没有 `role="option"`/`aria-selected`**。
  → 读屏软件**完全不知道当前高亮的是哪一行**。
- 对比：宿主自己的 `PopupSelectView` 实现了完整的 listbox 语义（`dsh-client-ui-commands/README.zh.md:28`：「`↑`/`↓` 在行间移动，回车与 `Tab` 接受高亮行」）。
- 行右键菜单那侧反而是对的：`:4728` `box.setAttribute('role','menu')` + `:4758` `item.setAttribute('role','menuitem')`。
- **键盘流本身是好的**：`ArrowUp/ArrowDown/Enter/Escape` 全有（`:5422-5436` 搜索框、`:5613-5625` overlay、`:6088-6110` 右键菜单），`Alt+1..9` 直达（`:5598-5611`），还有 `Tab` 循环（`:6104`）。
**我验证过**：✅ 全部逐行读过。**未做真机读屏验证。**

### U5 toast 不用宿主 token

`lib/client.js:2930-2944` 的 `.dpp-toast` 用 `--dsw-menu-surface-fill` + `--dsw-alias-label-primary`；宿主自己的 toast 用的是 `--dsw-alias-toast-bg` / `--dsw-alias-toast-label` / `--dsw-alias-toast-action`（`dsh-client-ui-theme/README.md:80`）。
→ 我们的 toast 与宿主原生 toast 外观不一致（不同底色语义）。
**我验证过**：✅ 两边的 token 名都在源码里。

### U6 工程债：`lib/client.js` 8675 行 / 397KB 单文件

上一轮已记录。补充实测：文件里 `LABEL` 文案表、`EXTRA_CSS` 样式表、拼音字表、React 组件、DOM 注入逻辑全在一个模块。P0 的 H2/H4/H5 都要动 `LABEL` 与主题逻辑，**叠加在 397KB 单文件上，每一项的回归面都被放大**。

---

## 三、竞品线：格局复核（2026-11-26 实测）

### 3.1 下载量：与上一轮**完全一致**

`api.npmjs.org/downloads/point/last-week`（窗口 **2026-11-18 ~ 11-24**，即当前最新完整周）：

| 包 | 周下载 | 月下载 | 最新版 | time.modified |
| --- | ---: | ---: | --- | --- |
| **dsh-panel-pins（本）** | **826** 🥇 | 1587 | 1.4.8 | — |
| @qdnbd/dsh-panel-pins（旧） | 232 | 2494 | — | — |
| dsh-panel-layout | 342 | 2162 | 0.2.5 | 2026-11-17 |
| dsh-panellist | 301 | 1372 | 0.2.0 | 2026-10-26 |
| dsh-panel-control | 295 | 4414 | 0.10.7 | 2026-11-25 |
| dsh-panel-compact | 299 | 1031 | 0.1.0 | 2026-11-03 |
| dsh-panel-tidy | 246 | 1164 | 0.2.1 | 2026-11-14 |
| dsh-panel-order | 149 | 714 | 0.1.0 | 2026-10-27 |
| dsh-panel-titlebar | 122 | 1530 | 0.3.4 | 2026-11-06 |
| dsh-panel-folders | 102 | 628 | 0.1.1 | 2026-11-06 |
| dsh-panel-collapse | 95 | 448 | 1.0.0 | 2026-10-20 |
| dsh-panel-fold | 89 | 731 | 1.0.1 | 2026-11-05 |
| dsh-better-sidebar | **73,582** | 383,228 | 0.33.0 | 2026-11-24 |
| dsh-panel-updater | 1031 | 1031 | 1.0.4 | 2026-11-23 |

**与第八节表格逐格相同** —— 不是我们没更新，而是**窗口相同**（上次调研也在 11-25，latest-week 同样是 11-18~11-24）。

### 3.2 竞品**零动作**：12 个竞品的版本号与 `time.modified` 自 11-25 起全部未变

`dsh-panel-control` 仍停在 0.10.7（11-25）、`layout` 0.2.5（11-17）、`tidy` 0.2.1（11-14）……
→ **两周内没有新对手入场，也没有对手补上我们 v1.5.0 的三件套（宿主快捷键/拼音/主面板桥接）**。上一轮的两个硬缺口（AI 分类、布局切换）仍然只有 control / layout 各占一个，**且我们 v1.5.0 的三件套仍是 11 家里唯一**。

### 3.3 我们自己的分发状态

`npm view dsh-panel-pins version` → **1.4.8**（npm latest 仍是 1.4.8，v1.5.0 未发布，与 PUBLISHING.md 一致）。
**注意**：本轮 `npm view` 对 12 个包**同时**返回了版本号与 `time.modified`（`npm view <pkg> version` 单字段形式可用；多字段 + `--json` 的形式在本机返回异常，脚本已改用单字段逐个查询）。

### 3.4 竞品线给出的**反向结论**

竞品这一轮没动，说明**这一档不是靠功能数量赢的**（control 靠发版频率、layout 靠范式、titlebar 靠 Windows 专属）。
→ **本轮不建议去追 AI 分类 / 布局切换 / 标题栏模式**。真正的缺口在**宿主契约**（H1/H2/H4/H5）和**自家实现质量**（U1/U2/U3/U4）—— 这些竞品**都还没做**，因为它们没意识到宿主给了这些接口。

---

## 四、三线交叉验证后的分层清单

> 判定规则：**P0** = 有明确证据的护城河或缺陷、2 周内可落地、风险可控；**P1** = 值得做但需要评估或试点；**P2** = 观察项，写清触发条件。
> 「三线」指：宿主契约线 / 代码 UX 线 / 竞品线。标 ✅ 表示有该线证据，标 ❌ 表示该线无证据（不构成否定）。

### P0 —— 护城河与明确缺陷（2 周内可落地）

| # | 候选 | 做什么 | 解决谁的什么问题 | 证据 | 难度 | 风险 | 硬约束 | 三线 |
| :-: | --- | --- | --- | --- | :-: | :-: | :-: | :-: |
| **P0-1** | **右栏标签页纳入面板清单**（H1） | 枚举 `ctx.sidebarRightTabs.entries()` 的 kind+title，在启动器里开一个「右栏」分组，点击 `ctx.sidebarRight.openTab(kind)` | 装了 better-sidebar / 任何右栏标签插件却找不到入口的用户；我们把「入口清单」从「侧栏」扩到「整个宿主」 | 宿主 `sidebar-right/README.md:95`、`service.ts:250/390`、`tab-registry.ts:321`；**推翻第八节错误结论** | 中 | 低 | ❌ | 契约✅ 竞品❌(0家) UX✅ |
| **P0-2** | **宿主原生 Pin 与插件持久化 Pin 双源收敛**（H8）✅ **已于 v1.7.0（b98，commit `2d33aca`）落地——方案 (a)**：检测 `button[class$="_panelUnpin"]`，隐藏自有钉住行，首挂载 adopt+restore、武装后镜像记录（宿主赢）；预设/导入解除武装。真机端到端全过，详见 MAINTENANCE.md v1.7.0 节 | 检测到宿主已提供原生 Pin 控件时，让我们的 Pin 行降级为「仅持久化镜像」，并把宿主的取消固定同步进 localStorage | 所有点宿主原生固定图钉的用户（目前是行为不稳定的双套机制） | `entry-customization/README.zh.md:31` + `dsh-web-app/cordis.patch.yml:460` + `panel-pins.ts:25-35` + 我们 `client.js:954-963/6633/8390` | 中 | 中 | ❌ | 契约✅ 代码✅ |
| **P0-3** | **接入 `ctx.locale`，语言跟随宿主**（H4/U1） | `ctx.locale.register('panelPins', { zh, en, ... })` + `bind()`，文案随宿主语言即时切换；补 ja/es/fr/de/ru/pt 词典 | 宿主界面切到日/西/法/德/俄/葡语的用户，现在看到的是混排 | 宿主 `locale/README.md:12/34/40`；我们 `client.js:481-486`（一次性求值）+ 全文件硬编码二元分支 | 中 | 低 | ❌ | 契约✅ UX✅ |
| **P0-4** | **主题判定改用宿主契约**（H5/U2） | `ctx.theme` 快照判明暗 + 订阅 `theme/change`；最低限度：观察器 `attributeFilter` 加上 `style` 与 `data-ds-theme-source` | 切明暗主题时弹层底色最长 5 秒不跟的用户 | 宿主 `theme-presenter.ts:69-75` vs 我们 `client.js:8474-8481`（只听 `class`）+ `:8452` 5s 兜底 | 低 | 低 | ❌ | 契约✅ UX✅ |

**P0 的共同特征**：**全部是「宿主给了契约、我们没接」的漏接**——不新增范式、不动 DOM、不碰硬约束，且都是竞品**还没做**的（竞品基本只做 DOM 层的整理，这正是他们的天花板）。

### P1 —— 值得做，但需要评估 / 试点

| # | 候选 | 做什么 | 解决谁的什么问题 | 证据 | 难度 | 风险 | 硬约束 | 三线 |
| :-: | --- | --- | --- | --- | :-: | :-: | :-: | :-: |
| **P1-1** | **面板清单进宿主 `/` 命令菜单**（H2）✅ **已于 v1.9.0（b101）落地——保守试点**：`commandUi.register({ name:'panel-launcher', ui:{ kind:'action' } })` 一条命令打开自己的 Ctrl+K 面板（拼音不丢）；有界重试解决 mount 时序；真机端到端全过（含 `/启动` 排序直达），详见 MAINTENANCE.md v1.9.0 节 | ~~`ctx.commandUi.register({ name:'panels', ui:{ kind:'popupSelect', options, onSelect } })`~~ | 不知道 Ctrl+K 存在的绝大多数用户 | `commands/contract.ts:64-75/135-149`；`README.zh.md:28` | 中 | 中 | ❌ | 契约✅ UX✅ 竞品✅(0家) |
| **P1-2** | **拖拽升级为指针事件 + 长按进入拖动态**（U3） | 纯 pointer events 实现拖拽，触屏可拖；长按 500ms 进入拖动态；落点线 + `prefers-reduced-motion` | 手机/平板用户（现在完全不能拖） | 我们 `client.js:6944-7056` 纯 HTML5 DnD；竞品 tidy README 自述用指针事件 | 中 | 中 | ❌ | 代码✅ 竞品✅ 契约❌ |
| **P1-3** | **无障碍补齐**（U4） | overlay 容器加 `role="menu"`；搜索框加 `role="combobox"` + `aria-controls`；高亮行加 `role="option"` + `aria-activedescendant`；roving tabindex | 读屏用户；也是 WCAG 合规 | 我们 `client.js:4736`（容器无 role）vs `:5479`（子项有 menuitem）；`:5395-5410`（高亮仅 CSS class） | 低 | 低 | ❌ | 代码✅ 契约✅（宿主 PopupSelectView 是范本） |
| **P1-4** | **原生右键菜单 `ctx.contextMenus`**（H6） | 行右键从自绘 DOM 换成宿主菜单注册 | 触屏长按、观感统一、可达性 | `context-menu/src/client/registry.ts`；宿主用法 `sidebar-right/src/client/index.ts:141-158` | 中 | 中高 | ❌ | 契约✅ 代码✅ 竞品❌ |
| **P1-5** | **`sidebar.toggle.badge` 侧栏徽标**（H7） | 侧栏收起态在展开按钮上显示「已收纳 N 个面板」等状态 | 收起侧栏后完全不知道有多少面板被收纳 | `sidebar/README.md:50,56` | 低 | 低 | ❌ | 契约✅ UX✅ 竞品❌ |
| **P1-6** | **toast 换宿主 token**（U5） | `.dpp-toast` 改用 `--dsw-alias-toast-bg/-label/-action` | 观感一致性 | 我们 `client.js:2930-2944` vs 宿主 `theme/README.md:80` | 低 | 低 | ❌ | 代码✅ 契约✅ |

### P2 —— 观察项（写清触发条件，暂不做）

| # | 候选 | 触发条件（满足才开始评估） | 现状与理由 |
| :-: | --- | --- | --- |
| **P2-1** | **宿主原生 Pin 全量接管，我们退化为纯持久化层**（H8 延伸） | 宿主把 pin 状态持久化进设置命名空间（像 `locale.preference` / `ui-theme` 那样），我们只需镜像 | 现在宿主的 pin 纯内存（`panel-pins.ts`），**持久化仍是我们的独有价值**，暂不退让 |
| **P2-2** | **本地启发式自动分组（零外发）** | ①control 的 AI 分类周下载连续两周上涨；②或用户端出现 ≥3 条「能不能自动分组的分组」类反馈 | control 0.10.7 周下载 295、上周 295，**没涨**；control 的 AI 分类要外发入口名给模型服务商，我们做本地规则版才有差异化 |
| **P2-3** | **按钮行/列表布局切换、标题栏模式** | ①宿主原生提供布局 API；②或本插件仓库出现 ≥5 条相关 issue/讨论 | 用户上一轮已明确「先观察」；layout 0.2.5 停在 11-17 **两周没动**，titlebar 停在 11-06，**范式竞争降温** |
| **P2-4** | **`ctx.inputTriggers.registerSource` 自定义触发源**（H3） | P1-1 落地后，若发现 `/` 菜单里塞不下完整面板清单（条目太多） | 收益与 P1-1 重叠，但实现重一档 |
| **P2-5** | **注册我们自己的右栏标签页**（H7 `sidebar.right.pane.tab`） | P0-1 落地后，用户反馈「面板清单只能看不能改」 | 与「范式级改造」一样耦合深，先观察 |
| **P2-6** | **`lib/client.js` 模块化拆分**（U6） | ①下一版要新增的字表/常量 > 50KB；②或回归套件出现跨版本 flaky | 8675 行 / 397KB 已是临界点；**但 P0/P1 改动全落在这个文件上，建议先把 P0 四项做完再拆**，避免同时动两件大事 |

---

## 五、推荐执行顺序

1. **先做 P0-4（主题）与 P0-3（语言）**：低风险、小改动、纯读侧契约，且是**明确缺陷**（不是新功能），修完用户立刻能感知。
2. **再做 P0-2（Pin 双源收敛）**：这是**兼容性问题**，越晚做越可能积累用户困惑；建议与 P0-1 同批做（同属「接宿主契约」）。
3. **然后做 P0-1（右栏标签页）**：本轮最大增量，但要处理 session 作用域与 kind 未注册的异常。
4. **P1 里优先 P1-3（无障碍）+ P1-5（徽标）**：低风险低成本；P1-1（`/命令菜单`）先做小规模试点（只挂一条 action「打开面板启动器」，不迁全部面板），评估宿主菜单壳是否比我们的拼音壳更好用再决定要不要全量迁移。
5. **P1-2（触屏拖拽）**：工作量集中在指针事件与落点计算，和 tidy 的手感对齐即可，不追求超过它。
6. **P2 全部按触发条件监控**，本轮不排期。

## 六、本轮明确**没有**做的事

- ❌ **没有执行任何 npm 写操作**（无 publish / deprecate / unpublish）。只用了 `npm view`（只读）与 `api.npmjs.org`（只读）。
- ❌ **没有改 `lib/client.js` 的任何实现**（本轮只做调研与方案设计）。
- ❌ **没有动 `engines.dsh`**（仍是 `>=0.2.0-rc.1 <0.3.0-0`）。
- ❌ **没有新增运行时依赖**（P0/P1 全部方案均可用纯前端 + 宿主公开契约实现）。
- ❌ **没有把任何新服务写进 `inject`**（P0/P1 全部走 `optionalService()` 容错读取）。
- ❌ **没有验证 better-sidebar 的标签页注册形态**（未安装其源码）、**没有真机截图确认宿主原生 Pin 的双份 UI**、**没有真机读屏验证**、**没有在真机上注册过 `ctx.commandUi`** —— 这四项在正文中已逐条标注为「未验证」。

## 七、需要用户拍板的三件事

1. ~~**P0-2 的方向**~~ ✅ **已拍板并落地**（2026-11-27）：选了方案 (a)——宿主原生 Pin 在场时插件隐藏自有钉住行、退为纯持久化镜像；v1.7.0（b98）已实现、回归 215 项全绿、真机端到端全过。
2. ~~**P1-1 的范围**~~ ✅ **已拍板并落地**（2026-11-27）：保守试点——只挂一条「打开面板启动器」action（v1.9.0/b101），不搬全量清单、拼音保留；全量迁移评估为不划算（宿主壳无拼音）。
3. **P0-1 的边界**：右栏标签页是「只列出来 + 点击打开」，还是也允许从我们的启动器**管理**（置顶/隐藏）它们？
