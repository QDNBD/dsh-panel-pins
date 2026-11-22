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
