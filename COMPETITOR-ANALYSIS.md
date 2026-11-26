# 侧栏面板管理插件竞品对比（2026-11-16 调研）

> 数据来源：npm registry 元数据、api.npmjs.org 下载量（周：2026-11-08 ~ 11-14）、GitHub API、awesome-dsh-plugin 市场索引（cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json，5643 条）。本机 DSH 0.2.0-rc.2。

## 一、四强基本盘

| | dsh-panel-control | dsh-panel-layout | dsh-panellist | **@qdnbd/dsh-panel-pins（本插件）** |
| --- | --- | --- | --- | --- |
| 作者 | QIUZAIYOU (asifadeaway) | devome | qwq1999 | QDNBD |
| npm 首发 | 2026-11-03 | 2026-11-08 | 2026-10-11 | 2026-10-28 |
| 最新版本 | 0.10.5（11-15） | 0.2.4（11-13） | 0.2.0（10-26） | 1.1.1（11-13） |
| 版本数 | **16 个 / 13 天**（最凶） | 6 个 / 6 天 | 3 个 | 7 个 / 17 天 |
| **周下载** | **1636** 🥇 | **1471** 🥈 | 233 | **832** 🥉 |
| GitHub stars | 1 | 1 | 2 | 0 |
| engines.dsh | >=0.2.1-rc.3 | ^0.2.1-rc.3 \| ^0.2.2-0 | >=0.2.0-rc.2 <0.3.0-0 | **>=0.2.0-rc.1 <0.3.0-0（最宽）** |
| 0.2.0-rc.2 可装？ | ❌ | ❌ | ✅ | ✅ |
| 存储位置 | Host 侧 `~/.dsh/panel-control/prefs.json` | localStorage | Host 侧 `$DSH_HOME/panellist.json`（0600 原子写+ajv） | localStorage（`dsh-panel-pins:` 前缀） |
| 实现路线 | DOM `style.order/display` + `data-dpc-*` | DOM flex `order` + `data-dpl-*` | **注册表对象直写**（改写 entry 的 order/label/component） | DOM + CSS 类名/CSS 变量门控（零 DOM 手术） |
| 自检/降级 | ❌（自认依赖 DOM 结构启发式） | ❌ | ✅ 5 项启动自检→只读降级 | ❌（但零硬编码选择器+主题 token 全兼容） |
| awesome-dsh-plugin 收录 | ✅ | ✅ | ✅ | ✅ |
| npm 描述关键词带 | 排序、隐藏、分组、折叠、自动分类 | 布局排序收纳 | take over the left rail | take over…searchable, grouped launcher |

## 二、本插件下载曲线特征（近 30 天，@qdnbd/dsh-panel-pins）

```
10-28  161  ← 首发 0.7.3
11-01  241  ← 发 0.11.0
11-05  203  ← 发 0.12.0
11-09  365  ← 发 1.0.0（峰值）
11-13  192  ← 发 1.1.1
平日基线     40~70/天
```

**结论：每次发版当天下载 3~5 倍尖峰。control 下载第一与其 13 天 16 版的发版频率强相关**（dshmarket「最近更新」排序曝光 + npm recently-updated 页）。竞品发版理由含修小 bug/调文案/补截图——发版频率本身就是分发手段。

## 三、功能矩阵

| 功能 | control | layout | panellist | pins | 差距定性 |
| --- | :-: | :-: | :-: | :-: | --- |
| 拖拽排序（侧栏行直接拖） | ✅ 行首把手+按名排序 | ✅ 行内拖+菜单内拖+触屏「移到最前」箭头 | ✅ 拖+键盘上下移 | ⚠️ 仅置顶+设置页钉住管理拖拽 | **硬缺口 ①**（用户第一直觉） |
| 隐藏/收纳 | ✅ 眼睛按钮 | ✅ 溢出进「更多」 | ✅ 含「激活页临时保留」 | ✅ 右键隐藏+设置页恢复+菜单恢复组 | 已覆盖 |
| 重命名 | ✅ | ❌ | ✅ | ✅ 悬浮编辑器（v1.1.1 重写） | 已覆盖 |
| 分组 | ✅ 分组树+折叠 | ❌ | ✅ 真注册分组行（flyout 菜单） | ✅ 菜单分组+自定义分组+折叠记忆 | 已覆盖 |
| **AI 自动分类** | ✅ 独家（发面板名给宿主当前模型，分 2-4 组；手动拖过的锁定） | ❌ | ❌ | ❌ | **硬缺口 ②**（下载第一的招牌） |
| 布局切换（按钮行/列表+行数上限 1-3） | ❌ | ✅ 独家（按宽度算格数） | ❌ | ❌（有仅图标 18px 中间态） | **硬缺口 ③**（第二下载的招牌） |
| 吸收左下角「更多」（设置/反馈/登录并入菜单） | ❌ | ✅ 独家（含登录态感知） | ❌ | ❌（有紧凑底部区，思路不同） | 可选 |
| 图标替换（24 内置图形+SVG 粘贴+净化） | ❌ | ❌ | ✅ 独家 | ❌ | 可选（panellist 下载最低，说明非下载驱动） |
| 设置页补入口（桥接第三方设置页） | ✅ 独家 | ❌ | ❌ | ❌（但菜单收集第三方入口行，方向不同） | 可选 |
| 侧栏溢出限高兜底 | ✅（0.2.2-rc.1 自适应让位） | ✅ | — | ✅ **四个滑块**（面板列表/底部区/弹层/二维码） | pins 更细 |
| **Ctrl+K 命令面板** | ❌ | ❌ | ❌ | ✅ **独家** | |
| **菜单内搜索+命中高亮** | ❌ | ❌ | ❌ | ✅ **独家** | |
| **Alt+1..9 直达** | ❌ | ❌ | ❌ | ✅ **独家** | |
| **最近使用 MRU（上限 5）** | ❌ | ❌ | ❌ | ✅ **独家** | |
| **具名布局预设一键切换** | ❌ | ❌ | ❌ | ✅ **独家** | |
| 配置导入/导出 | ❌ | ❌ | ✅ 文件（schema 校验） | ✅ 剪贴板 JSON | 已覆盖 |
| 宿主行像素级对齐的一级启动器 | ❌ | ❌ | ❌ | ✅ 独家 | |

## 四、定位判断

- pins 是四家里唯一的「**键盘效率型启动器**」（Ctrl+K / Alt+N / MRU / 搜索高亮 / 预设五项独家），另三家是「布局整理器」——**差异化是真实存在的，不缺功能深度故事**。
- 差距集中在：① 侧栏行拖拽排序（三家全有）；② AI 自动分类（control 招牌）；③ 按钮行/列表布局切换（layout 招牌）。
- **分发效率差距大于功能差距**：包名被 scope 削弱 + 发版节奏慢一倍。

## 五、分发漏洞与机会

1. **裸名 `dsh-panel-pins` 在 npm 上是 404（未被注册！）**——三个竞品全是裸名，市场搜索/安装命令天然吃亏。裸名现在仍可抢注（双发布策略：裸名 stub 重定向 + scoped 正包，见 `publishing/bare/`）。
2. npm token 已失效（E401，2026-10-28 登录的）；发布需重新 `npm login --registry https://registry.npmjs.org`（2FA 走浏览器）。
3. 收录 YAML（`publishing/awesome-dsh-plugin--data-plugins-QDNBD__dsh-panel-pins.yml`）描述未带 Ctrl+K / command palette 等搜索关键词；GitHub topics 缺 `sidebar` / `command-palette` / `launcher`。
4. README 缺：兼容区间卖点（0.2.0-rc.2 上 control/layout 装不上，老版本用户是独占市场）、独家功能对比表。~~GIF 演示~~（**修正**：11-13 已加 demo.mp4 + 浅/深色截图对，demo 物料不再是缺口）。

> **2026-11-16 已执行**：#1 staging 完成（`publishing/bare/`，npm pack 通过，待登录发布）；#3 README 双语完成（下载量徽章 + 「为什么选它」对比表 + 老版本卖点 + 裸名占位说明）；#4 收录 YAML 重写完成（待 PR）；GitHub topics 扩至 10 个（+launcher/command-palette/pin/rename）并更新仓库 description 为键盘效率型定位。执行步骤见 PUBLISHING.md「2026-11-16 分发优化」一节。

## 六、行动清单（ROI 排序）

| # | 动作 | 类型 | 状态 |
| --- | --- | --- | --- |
| 1 | 裸名 `dsh-panel-pins` 抢注（stub 包 deprecate 指向 scoped 正包） | 零代码 | 待 npm 登录后发布 |
| 2 | 发版节奏提至每周 2-3 patch | 流程 | 长期执行 |
| 3 | README 补裸名命令/兼容卖点/独家对比表 | 文档 | ✅ 本次 |
| 4 | 收录 YAML 描述 + GitHub topics 更新 | 分发 | ✅ 本次 |
| 5 | v1.2.0：侧栏行 HTML5 拖拽排序（触屏学 layout「移到最前」箭头） | 功能 | 排期 |
| 6 | v1.3.0：AI 自动分类（面板名发宿主模型分 2-4 组，写入自定义分组；对齐 control 的锁定语义） | 功能 | 排期 |
| 7 | v1.2.0+ 可选：按钮行/列表布局 或 吸收左下角「更多」二选一 | 功能 | 观察数据 |
| 8 | README 顶部加 GIF/视频演示 | 文档 | 需录屏 |

## 附：竞品实现要点存档（写拖拽/AI 分类时参考）

- **layout 拖拽**：HTML5 drag-and-drop，行打 `data-dpl-*`，flex `order` 排序、`display:none` 隐藏溢出；行模式按左右半区判插入点、列表按上下半区；触屏无 HTML5 DnD → 「更多」行右侧向上箭头一键排第一；卸载靠 `<html data-dpl-mode>` 单开关门控恢复宿主外观。行数估算常量 CELL=36/GAP=4/ROW_PAD=2。
- **control AI 分类**：把入口名称发给「当前 profile 默认模型」分 2-4 组；手动拖过的入口锁定，「只分未动过的」跳过锁定项，「全部分类」重分但不清锁定；边界说明里明确「会把名称发给模型服务商，可关闭」。
- **panellist 注册表改写**：`sidebar.panellist` 是 list 槽位；注册项对象不冻结、entriesOfSlot 原样交回 → 直写 entry.order/label/component 对下次投影可见但**不通知订阅者**，需再注册/销毁一个一次性行制造账本变更触发重投影；写前必比避免永不收敛的抖动；包装组件登记 WeakSet/WeakMap 供回读识别。5 项启动自检任一失败→只读降级。
- **control 设置页补入口**：第三方插件只注册设置页没注册侧栏入口时自动补一行（wiring i/l/s = inject/locale/store 扫描）；设置页归属按 section id+label 启发式识别。
- **layout 吸收左下角**：设置走宿主命令 `settings.open`（无绑定时 openSettings → 人工路径回放）；反馈走 `__DSH_CONTACT_CONFIG__` 公开问卷链接；登录跟随 `remote.$stream` account 流的 `startSignIn`（授权 URL 仅在 attempt 到 waiting-browser 后出现）。

---

## 七、2026-11-22 复核（发布 1.4.2 前）

npm registry `latest` + api.npmjs.org（周：11-15 ~ 11-21；月：10-23 ~ 11-21），对照三家最新 README。

| | panel-control | panel-layout | panellist | **pins** |
| --- | --- | --- | --- | --- |
| latest | 0.10.5（11-15） | 0.2.5（11-17） | 0.2.0（10-26） | 1.4.2（本地，未发布） |
| npm 上最新 | 0.10.5 | 0.2.5 | 0.2.0 | **1.3.1（11-18）** |
| engines.dsh | >=0.2.1-rc.3 | ^0.2.1-rc.3 \|\| ^0.2.2-0 | >=0.2.0-rc.2 <0.3.0-0 | **>=0.2.0-rc.1 <0.3.0-0** |
| engines.node | — | >=22 | ^22.19 \|\| >=24 | **>=20** |
| 周下载 | 513 | 552 | 298 | **1115** 🥇 |
| 月下载 | 4264 | 2023 | 1336 | 1115（11-16 才建包，仅 6 天） |

**变化点**

1. **pins 周下载已反超，成四家第一**（11-16 首次调研时是 832 / 第三）。control 从 1636 掉到 513，与它 11-15 后停更（一周无新版）时间吻合——再次印证发版频率≈曝光。
2. **硬缺口 ①（侧栏行拖拽）已消**：v1.2.2 已交付并写进 README。
3. **设置页桥接追平 control**：control 0.10.5 与 pins v1.4.x 都做，但 pins 做到「全量对齐」——每个 `settings.section` 一行，含自身设置页（1.4.2）。
4. **剩余硬缺口只有两个**：AI 自动分类（control 招牌）、按钮行/列表布局切换（layout 招牌）。换图标（panellist）、吸收左下角「更多」（layout）属低优先，不构成下载驱动。
5. **兼容区间仍是独占卖点**：0.2.1-rc.3 之前的宿主上 control/layout 装不上；layout/panellist 还要 Node 22+，pins 是 Node 20 唯一可装。

**结论**：README 定位继续押「键盘效率型启动器 + 全量收纳 + 最宽兼容」，对照表按四家分列写事实（不再写「其它同类 ❌」），并把 AI 分类/布局切换两个缺口在文末「怎么选」里如实指向竞品——降低装错后的差评，也避免「独家」claim 被证伪。

---

## 八、2026-11-25 复核（发布 1.4.8 后）

> 数据来源：npm registry `latest` + api.npmjs.org 下载量（周：11-18 ~ 11-24）、各包 README（packument 抓取）、本机 `app.asar` 字符串扫描（宿主 0.2.2-rc.5）、`dsh --version` = 0.2.2-rc.5。

### 1. 赛道是 11 家，不是 4 家

前两次复核只盯了「四强」。全量搜下来，同一挂载点（`sidebar.panellist` / 侧栏行）上已经有 11+ 个插件，其中 7 个是 10 月底之后才出现的：

| 包 | 周下载 | 月下载 | 最新版 | engines.dsh | 一句话定位 |
| --- | :-: | :-: | --- | --- | --- |
| **dsh-panel-pins（本）** | **826** 🥇 | 1587 | 1.4.8（11-25） | `>=0.2.0-rc.1 <0.3.0-0` | 键盘效率型启动器（Ctrl+K / Alt+N / MRU / 预设） |
| `@qdnbd/dsh-panel-pins`（旧） | 232 | 2494 | 1.2.1 冻结 | 同 | 旧 scoped 包，**仍在分流** |
| dsh-panel-layout | 342 | 2162 | 0.2.5（11-17） | `^0.2.1-rc.3` | 按钮行/列表 + 行数上限 + 吸收左下角「更多」 |
| dsh-panel-control | 295 | 4414 | 0.10.7（11-25） | `>=0.2.1-rc.3` | 分组树 + **AI 自动分类**（会外发入口名） |
| dsh-panellist | 301 | 1372 | 0.2.0（10-26） | `>=0.2.0-rc.2` | 注册表直写 + 换图标（24 图形/SVG 粘贴） |
| dsh-panel-compact | 299 | 1031 | 0.1.0（11-03） | `>=0.2.0` | **只留 3 行**，其余进「更多」 |
| dsh-panel-tidy | 246 | 1164 | 0.2.1（11-14） | `>=0.2.0 <0.3.0` | 指针事件拖拽 + 拖进「更多」即收纳 |
| dsh-panel-order | 149 | 714 | 0.1.0 | `>=0.2.0-0` | 纯排序 |
| dsh-panel-titlebar | 122 | 1530 | 0.3.4（11-06） | `>=0.2.1-0` | 面板行搬进 **Windows 标题栏**（省 ~240px 纵向） |
| dsh-panel-folders | 102 | 628 | 0.1.1 | `0.2.2-rc.1` | 可折叠分组 |
| dsh-panel-collapse | 95 | 448 | 1.0.0 | `>=0.2.0-rc.2` | 折叠面板列表 |
| dsh-panel-fold | 89 | 731 | 1.0.1 | `^0.2.2-rc.1` | 收进「更多」 |

邻近品类（不是同一挂载点，但抢同一批用户）：

| 包 | 周下载 | 最新版 | 定位 |
| --- | :-: | --- | --- |
| dsh-better-sidebar | **73582** | 0.33.0（11-24） | 文件树/编辑器/变更/任务/侧聊，并**对外提供注册标签页的服务** |
| dsh-panel-updater | 1031 | 1.0.4（11-23） | 插件更新/依赖体检/同步码，2 天前才发 1.0.0 就吃到 1000+ |
| dsh-plugin（市场本体） | 9935 | 2.4.3 | 渠道本身：23,000+ 索引 / 6,000+ 可装 |

**结论 1：本插件在「面板整理」这一档仍是周下载第一（826 > 342 / 295 / 301），但这一档的天花板就是 800–1000/周——它不是流量入口，是尾部品类。真正的大盘在 better-sidebar（7.3 万/周）和市场本体。**

### 2. 三条新事实

**① 宿主 0.2.2-rc.5 已经自带两样我们一直自己手搓的东西。**

`app.asar` 字符串扫描（0.2.2-rc.5）：

| 宿主能力 | 命中 | 说明 |
| --- | :-: | --- |
| `setPinned` / `onPinnedChange` | 44 / 39 | **原生图钉**已上线，`sidebar.panellist.actions` 槽把它透给插件 |
| `sidebar.panellist` / `.actions` | 66 / 32 | 面板行与「更多」菜单两个公开槽位 |
| `shortcuts` 服务 | — | `register` / `registerFixed` / `observeFixedInput`；defaults 按 `runtime:platform` 声明；物理 `code`，`primary` 展开为设备修饰键；`resolve` 返回 `{status:'pass'\|'handled'}` 做仲裁；`regions`/`modals` 管作用域 |
| `settings.shortcuts` | 6 | 宿主有**快捷键设置页**：Desktop 存 `userData/keybindings.json`，Web 存 `dsh.keybindings.v1`，用户可改键位 |
| `commandPalette` / `quickSwitch` | **0 / 0** | **宿主没有自带命令面板** → 我们的 Ctrl+K 护城河成立 |
| `settings.open` | 12 | 宿主命令注册表存在 |

这条最重要：宿主把「快捷键」做成了一等公民（可重映射、有设置页、有冲突检测、有模态仲裁）。我们现在的 Ctrl+K 是 `document.addEventListener('keydown', …, true)` 裸监听 + 自己手写「别在宿主输入框里抢键」启发式（client.js:6001）——**这套仲裁宿主已经做了，而且做得更好**。

**② 竞品开始卷「范式」，不是卷功能清单。**

- `titlebar`：把整排面板行搬进 Windows 标题栏，纵向省 ~240px（0.3.4，7 个版本）。
- `compact`：只留 3 行，其余进「更多」（0.1.0 就吃到 299/周）。
- `tidy`：**不用 HTML5 DnD**，改纯指针事件——所以触屏能拖；长按 500ms 才进入拖动态；拖到「更多」上松手即收纳并自动展开菜单；落点线 + 品牌色描边；支持 `prefers-reduced-motion`。它的 README 还给出一条关键情报：**0.2.2 起宿主自带钉针**，插件可以点宿主自己的「取消固定」钮；更早的宿主没有钉针才退回 `display:none` + `actions` 槽自己画。
- `control` 的 AI 自动分类会把**入口名称发给模型服务商**（README 自己写明），我们「零自动上报」的定位在这一点上天然占优。

**③ 我们的兼容债集中在滚动契约。** 1.4.4 → 1.4.8 五个版本全在修 rc.5 的侧栏滚动手令（1.4.4 让位、1.4.5 链式驱动、1.4.6 完全退让、1.4.7 轻量驱动、1.4.8 回退截断样式表）。这块是「跟着宿主滚动手令反复返工」，不是功能债。

### 3. 我们自己的三个问题

1. **旧 scoped 包还在分流，且根因已定位**：裸名包 11-16 才存在，11-17 起成为唯一在更的包（10 个版本）；scoped 包日下载从 253/天 掉到 **26–34/天的平基线**（≈900/月，**占全部安装量的一半**）——这些新用户拿到的正是**冻结在 1.2.1** 的旧包（无设置页桥接、无预设、无导出导入、无拖拽排序）。**根因**：packument 实测该包 9 个版本里 8 个已带 deprecation，**唯独 `latest`=1.2.1 没标** → `npm install @qdnbd/dsh-panel-pins` 装的正是 latest，**毫无警告地装上冻结版**。修复只需一条 `npm deprecate` 命令（免发版、可撤销）。官方市场目录（6885 条）与 awesome 收录条目**均只有裸名**，不是漏流源头。
2. **client.js 已 8215 行单文件**，功能密度到了必须模块化的临界点。
3. **Ctrl+K 抢键风险靠自己兜**，没有借宿主 shortcuts 的仲裁。

### 4. 候选实现清单（按 ROI 排序）

| 档 | # | 候选 | 对标 | 竞品是否已有 | 可行性 |
| --- | :-: | --- | --- | --- | :-: |
| **P0 差异化** | 1 | **Ctrl+K / Alt+N 注册进宿主 `ctx.shortcuts`** → 用户可在「设置 → 快捷键」改键位，宿主做模态仲裁（不再自己猜「是不是在输入框」） | 宿主契约已确认 | **0 家** | 高（service 不存在时回退现有裸监听） |
| | 2 | **拼音首字母 + 模糊匹配 + 匹配位排序**（`gl` → 「更多」、`msb` → 「面板收纳」） | 中文用户刚需 | **0 家** | 高，纯前端 |
| | 3 | **面板清单扩展到第三方标签页**（better-sidebar 等对外注册的 tab 服务） | better-sidebar 7.3 万/周 | 0 家 | 中，需探测服务名 |
| **P1 补缺口** | 4 | **本地启发式自动分组**（零外发，对位 control 的模型分类） | control 招牌 | control 有（外发） | 中高 |
| | 5 | 布局形态：按钮行/列表 + 行数上限 1–3 | layout 招牌 | layout 有 | 中（layout 已公开 CELL/GAP/ROW_PAD 常量） |
| | 6 | 标题栏模式（面板行搬进 Windows 标题栏） | titlebar | titlebar 有 | 中低，耦合深、仅 Windows |
| | 7 | 拖拽升级为指针事件 + 长按进入拖动态 + 减少动效 | tidy 手感 | tidy 有 | 中 |
| **P2 打磨** | 8 | 命令面板前缀模式（`>` 只搜命令 / `@` 只搜面板） | Raycast 风 | 0 家 | 低 |
| | 9 | 菜单无障碍：roving tabindex、`aria-activedescendant`、焦点环 | — | 0 家 | 低 |
| | 10 | 本地使用统计（哪个面板最常用 → 反过来指导收纳） | — | 0 家 | 中 |
| | 11 | **互斥检测**：发现同装 control/layout/tidy/compact 就提示 | README 已写「同时只留一个」 | 0 家 | 中低 |
| **P3 工程** | 12 | client.js 模块化拆分（8200 行 → 多模块） | — | — | 中高，风险可控 |
| | 13 | 滚动契约重构：把 rc.3/rc.5 分支收敛成一份声明式策略 | — | — | 中 |

### 5. 建议

**本轮做 P0 三件套（1+2+3），补 P2 的 8/9/11。** 理由：

- P0 三件在 11 家里**一家都没有**，是唯一能把「四家对比表」升级成「十一家里只有我们有」的差异化；其中 1 和 2 都是低风险高感知。
- 1 同时解决一个真实痛点：现在 Ctrl+K 抢键靠启发式，注册进宿主后由宿主仲裁，还能顺带拿到「可改键位」这个用户可见的卖点。
- P1 的 4（本地自动分组）是补 control 的招牌，但**要做出差异**才有意义——control 会把名字发给模型服务商，我们做成本地规则版，「不外发也能分类」才是我们的说法。
- P1 的 5/6 属范式竞争，耦合深、兼容风险高，**先观察**（control 靠发版频率赢，layout 靠范式，两者都不靠功能数量）。
- P3 的 13 是长期债：滚动契约每次宿主升级都要返工，值得单独排一版把分支收敛。

**分发侧同步做两件零代码的事**：① 旧 scoped 包页面顶部加迁移提示（现在 232/周的新用户装到冻结的 1.2.1）；② README 对照表从「四家」扩到「十一家」，并把 titlebar / compact / tidy 三个新对手如实列进去。

### 6. 落地结果（2026-11-25，v1.5.0 b95）

| # | 动作 | 状态 |
| --- | --- | --- |
| P0-1 | `Ctrl+K` 注册进宿主 `ctx.shortcuts`（`settings.shortcuts` 可改键/看冲突；宿主负责 editable/terminal/modal 仲裁；服务不存在或键位被占时回退插件自己的监听） | ✅ v1.5.0（b95）交付，b95 套件 25/25 |
| P0-2 | 拼音首字母 + 全拼 + 模糊匹配 + 组内相关度排序（内置完整 GB2312 6763 字表，纯本地零外发） | ✅ v1.5.0（b95）交付，纯函数套件 16/16 |
| P0-3 | 主面板入口：枚举根级 `main` 槽（宿主 `ui-layout` 同款公开调用），`layout.selectPanel(key)` 打开 | ✅ v1.5.0（b95）交付。⚠️ **本行括注「右侧栏标签页不做」是错的，已于第九节更正**——宿主确有公开打开 API（`ctx.sidebarRight.openTab(kind)` / `ctx.sidebarRightTabs.register` / `ctx.slots.register({name:'sidebar.right.pane.tab'})`），上一轮搜的是错的名字（`openGuide` 0 命中 ≠ 无此能力）。详见 [第九节](#九2026-11-26-候选机会盘点宿主-022-rc5-深挖) 与 [OPPORTUNITIES.md](OPPORTUNITIES.md) |
| 分发① | 旧 scoped 包迁移提示 | 🟡 **根因已定位**：scoped 包 9 个版本里 8 个已废弃，唯独 `latest`=1.2.1 没标 → `npm install @qdnbd/dsh-panel-pins` 毫无警告地装上冻结版（~30/天 ≈ 900/月，占一半安装量）。修复 = **一条 `npm deprecate` 命令**（免发版、可撤销；写操作要 OTP，用户自己终端跑一次）+ npm 网页端换 README（免 OTP）。已写入 PUBLISHING.md；市场目录与收录条目均已确认干净 |
| 分发② | README 对照表扩到 11 家 + 如实列 titlebar/compact/tidy | ✅ 中英双语完成（对照表、亮点、为什么选它、怎么选、更新日志同步） |
| P1-4 | 本地启发式自动分组（零外发，对位 control 的模型分类） | ⏳ 未做——**建议观察**：control 的 AI 分类要发模型服务商才有效，本地规则版预期收益有限，等用户反馈再排 |
| P1-5/6 | 按钮行/列表布局、标题栏模式 | ⏳ 本轮明确不做（用户决定）：耦合深、兼容风险高，先观察 |
| P2-8/9/11 | 命令面板前缀模式、无障碍 roving tabindex、互斥检测 | ⏳ 本轮未做，待排期 |
| P3-12/13 | client.js 模块化拆分、滚动契约收敛 | ⏳ 未做——**client.js 因拼音字表涨到 397KB / 8675 行**，模块化必要性比调研时更强，建议尽快排 |

> **新增风险提示**：v1.5.0 的字表让 `lib/client.js` 从 337KB 涨到 397KB（+41KB 字表 + ~18KB 代码）。浏览器端首屏解析成本可忽略，但**这个文件已不适合再往里塞大块常量**——后续模块化拆分（P3-12）应把字表与匹配器拆成独立文件或惰性加载。

---

## 九、2026-11-26 候选机会盘点（宿主 0.2.2-rc.5 深挖）

> 完整方案、逐条证据行号与「已验证/未验证」标注见 **[OPPORTUNITIES.md](OPPORTUNITIES.md)**。本节只给结论表。
> 方法：宿主 asar 完整解包（209MB）→ 逐字读 TS 源码与包 README 契约 + 自家 `lib/client.js` 逐段读 + npm registry / api.npmjs.org 实测，三线交叉验证。

### ⚠️ 先更正上一轮的一个错误结论

第八节写「**右侧栏标签页不做**：宿主 `openGuide` 0 命中，没有公开的打开 API」——**这个结论是错的，搜错了 API 名**。
宿主确有公开的「注册 + 枚举 + 打开」三件套：`ctx.sidebarRightTabs.register({ id, kind, title, … })` / `ctx.slots.register({ name:'sidebar.right.pane.tab', key: definition.id }, Body)` / `ctx.sidebarRight.openTab(kind)`（`dsh-client-ui-sidebar-right/README.md:83-86`、`service.ts:250/390`、`tab-registry.ts:321`）。宿主 README 明写「the shipped guide type goes through exactly the same public path a type from another package does」。**第八节的 P0-3 恢复为候选，且是本轮最高价值的一条。**

### 分层结论

| 层 | # | 候选 | 一句话证据 | 难度 |
| :-: | :-: | --- | --- | :-: |
| **P0** | 1 | **右栏标签页纳入面板清单** | `ctx.sidebarRight.openTab(kind)` 是公开 API；枚举走 `sidebarRightTabs.entries()` | 中 |
| | 2 | **宿主原生 Pin 与插件持久化 Pin 双源收敛** | 宿主 entry-customization 已进浏览器名单（`dsh-web-app/cordis.patch.yml:460`）+ 宿主 pin 纯内存（`panel-pins.ts`）vs 我们 `client.js:954-963` 推回 | 中 |
| | 3 | **接入 `ctx.locale`，语言跟随宿主** | 宿主 8 语言 + 应用内语言设置；我们 `client.js:481-486` 只认 `navigator.language` 且只求值一次 | 中 |
| | 4 | **主题判定改用宿主 `ctx.theme`** | 宿主运行期改 `<html>.style` / `data-ds-theme-source` / `<body>[data-ds-dark-theme]`（`dsh-client-ui-layout/src/client/theme-presenter.ts:69-76`），我们只观察 `<html>` 的 `class`（`client.js:8477-8481`）→ 观察器**根本不会触发**，最长 5s 滞后 | 低 |
| **P1** | 5 | 面板清单进宿主 `/` 命令菜单（`ctx.commandUi`） | `commands/contract.ts:135-149`；宿主 0 家同类 | 中 |
| | 6 | 拖拽升级为指针事件 + 长按（触屏） | 我们纯 HTML5 DnD（`client.js:6944-7056`）→ 触屏不能拖；tidy 用指针事件 | 中 |
| | 7 | 无障碍补齐（`role="menu"` / `aria-activedescendant` / roving tabindex） | overlay 容器 `dpp-ov-body` 无 role 而子项有 `menuitem`（`client.js:4736/5479`）；高亮仅 CSS class（`:5395-5410`） | 低 |
| | 8 | 原生右键菜单 `ctx.contextMenus` | `context-menu/src/client/registry.ts`；宿主用法 `sidebar-right/src/client/index.ts:141-158` | 中 |
| | 9 | `sidebar.toggle.badge` 侧栏收起态徽标 | `sidebar/README.md:50,56` | 低 |
| | 10 | toast 换宿主 token | 我们用 `--dsw-menu-surface-fill`（`client.js:2930-2944`）vs 宿主 `--dsw-alias-toast-bg` | 低 |
| **P2** | 11-16 | 宿主 Pin 全量接管 / 本地自动分组 / 布局切换 / 标题栏模式 / 自定义触发源 / 模块化拆分 | 均写明触发条件，见 OPPORTUNITIES.md 第四节 | — |

### 竞品格局复核（2026-11-26 实测）

- 下载量与第八节**逐格相同**（api.npmjs.org `last-week` 窗口仍是 **2026-11-18 ~ 11-24**，即最新完整周；上次调研同在 11-25，窗口相同）。本插件仍以 826/周居「面板整理」档第一。
- **12 个竞品的版本号与 `time.modified` 全部未变**（control 0.10.7/11-25、layout 0.2.5/11-17、tidy 0.2.1/11-14、titlebar 0.3.4/11-06 …）→ **两周零动作，无新对手入场，也无人补上我们 v1.5.0 的三件套**。
- `npm view dsh-panel-pins version` = **1.4.8**（v1.5.0 未发布，与 PUBLISHING.md 一致）。
- **反向结论**：这一档不是靠功能数量赢的（control 靠发版频率、layout 靠范式、titlebar 靠 Windows 专属），**且竞品全都没接宿主契约**（他们基本只做 DOM 层整理）——所以本轮不建议追 AI 分类 / 布局切换，**真正的缺口在宿主契约（H1/H2/H4/H5）与自家实现质量（U1/U2/U3/U4）**。

### 本轮没做的事

未执行任何 npm 写操作（无 publish/deprecate）；未改 `lib/client.js` 实现；未动 `engines.dsh`；未新增运行时依赖；未把任何新服务写进 `inject`。解包产物在 `D:\code\.tmp-dpp-test\asar-extract\`，未污染源码仓。
