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

## 宿主契约（v1.3.2 b84 实测，桌面端 0.2.2-rc.5）

从安装目录 asar 提取 `@deepseek-ai/dsh-client-ui-layout` 的 client.js 逐字核实（提取法：读 asar 头 JSON 拿文件 offset/size，`8 + headerSize + offset` 处读 bytes）：

- **layout 服务**：`ctx.reflect.provide('layout', ...)`，可选读取必须走 `optionalService` 容错访问器（`ctx.get` 对未声明服务部分 cordis 版本抛错）；**绝不**把 layout 加进 `inject` —— 声明缺失服务会 park 整个 fiber，插件永不加载（panellist 文档化的教训）。
- **panelInfo 形状**：`{ getSnapshot: () => store.getSnapshot().panelInfo, subscribe: listener => store.subscribe(listener) }`；快照形如 `{ activePanelId: string|null }`。`activePanelId()` 与订阅驱动刷新（切面板不产生 sidebar DOM mutation，observer 看不见）都建立在这上面。
- **selectPanel 语义**：`layout.selectPanel(panelId)` 对未注册的 main key **抛错**（`main panel "..." is not registered`）——桥接/跳转调用必须 try/catch；store 层 `retainMainPanels` 会在面板清单变化时自动清掉失效的 activePanelId（置 null，回对话），是宿主级的失效兜底。
- **profile 安装形态警报**：1.2.2 起 npm 单名发布，desktop profile 的依赖形态从 `file:tgz` 漂成 registry `^x.y.z`——pack.ps1 的 5a/5b/5c 只匹配 local- tgz 形态，全部静默空转，**桌面端启动重铺会把本地安装回滚到 npm 已发布版**。pack.ps1 已加 5a2（检测 `^` 形态 → 自动转 file:tgz + pnpm lock 重建，pnpm.cjs 从运行时 `dependencies\pnpm\bin\pnpm.cjs` 相对定位）。
