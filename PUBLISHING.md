# 发布状态与 Runbook（dsh-panel-pins）

> 记录公开发布的当前状态与后续发版步骤。发布流程与 `dsh-cli-bridge` 完全同构（见其 PUBLISHING.md 的流程调研）。

## 单发布收敛（2026-11-17 定稿）

v1.2.1 是 @qdnbd/dsh-panel-pins 的**最后一版**（scoped 别名冻结）；从 1.2.2 起**只发裸名 `dsh-panel-pins`**，每次发版 = 1 条 publish + 1 次 OTP。

| 时间线 | 事件 |
| --- | --- |
| 2026-11-16 | v1.2.0 双发布（裸名 1.2.0 上线 + scoped alias 同步） |
| 2026-11-17 | v1.2.1 双发布（scoped 最终版）；随后 `npm deprecate @qdnbd/dsh-panel-pins@"<1.2.1"`——8 个旧版本挂迁移路牌，1.2.1 保持干净（deprecated 旧版是冻结别名的正确用法） |
| 2026-11-17 | git 仓根转裸名身份（package.json/cordis.patch.yml name = dsh-panel-pins），删除 publishing/bare 中转；**单发布时代开始** |

## 当前状态（2026-11-22，已发布 v1.4.3）

| 项 | 值 |
| --- | --- |
| npm 主包 | `dsh-panel-pins@1.4.2` → **1.4.3 待发**（b89，构建号隐藏）；本机 profile 暂用 file:.dist tgz 1.4.3，发布后切回 registry |
| **本次待发** | **v1.4.3（b89）**——构建号收为内部标识：设置页脚注与 issue 环境块只显示 `v1.4.3`，（b89）仅存于 `?dppdebug` 诊断。前线功能（13/13 桥接对齐）不变。发布前校验全绿：桥接套件 41/41、主套件 64/72（8 挂 = HEAD 基线遗留）、node --check ✓、dry-run 10 文件 99.0 kB ✓。GitHub Release 已发：tag v1.4.0/v1.4.1/v1.4.2 已推，Release 页 https://github.com/QDNBD/dsh-panel-pins/releases/tag/v1.4.2 ✓ |
| 状态 | **已发布**（2026-11-22 21:47，用户浏览器 2FA 认证后 publish 成功） |
| registry 核验 | ✓ version 1.4.2 = latest；✓ tarball https://registry.npmjs.org/dsh-panel-pins/-/dsh-panel-pins-1.4.2.tgz；✓ repository 回链 + engines.dsh 区间 |
| 本机切换 | ✓ profile 依赖已从 file:.dist tgz 切到 registry `^1.4.2`（pnpm --registry 官方源重算 lockfile，安装副本 BUILD=b88 与 git 字节一致） |
| 收录 PR | ✓ awesome-dsh-plugin 描述更新至 v1.4.2（设置页桥接完备 13/13）：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/17824 |
| 发布命令 | 仓库根 `npm publish --access public --registry https://registry.npmjs.org`（单发布，一次 OTP） |
| 发布后动作 | ① 本机 profile 依赖从 file:.dist tgz 切到 registry `1.4.2`（pnpm 重算 lockfile，重启即可）；② awesome-dsh-plugin 收录描述如需更新提 PR（data/plugins/QDNBD__dsh-panel-pins.yml）；③ 更新本表 |

## 历史状态（2026-10-28，v0.7.3 首发）

| 项 | 值 |
| --- | --- |
| GitHub 仓库 | https://github.com/QDNBD/dsh-panel-pins （main，已推 v0.7.3） |
| npm 包名 | `@qdnbd/dsh-panel-pins`（scope 与 npm 用户名一致） |
| 元数据 | MIT · engines.dsh `>=0.2.0-rc.1 <0.3.0-0` · publishConfig 强制官方源 · repository 回链 ✓ |
| 合规审查 | ✅ 2026-10-28 通过（见 MAINTENANCE.md「合规审查记录」） |
| 市场图标 | ✅ `assets/icon-180.png`（180×180 位图；收录 YAML 已带 `icon:` 字段，规则拒绝 SVG 故由 icon.svg 转 PNG 底板） |
| 详情页截图 | ✅ `screenshots.json`（3 张：启动器弹层 / 设置页 / 紧凑底部区，`assets/` 下）— 换图直接推本仓库即可，无需提 PR |
| npm publish | ✅ 2026-10-28 `@qdnbd/dsh-panel-pins@0.7.3` 已发布（2FA 安全密钥走浏览器认证；registry 元数据验证：repository 回链 ✓ MIT ✓ engines.dsh ✓） |
| 收录 PR | ✅ 已提 https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/10186 （fork 提交 ceaf0f4，YAML 含 icon 字段；CI 绿后等人工审核，通常一天内生效） |
| GitHub 元数据 | ✅ Description + Topics（dsh-plugin / dsh / deepseek-harness）已设置 |

## 首次上架步骤（存档，2026-10-28 已全部完成）

1. ✅ **npm 登录 + 发布** ⚠️ 本机 npm 默认源是 **npmmirror 镜像（CNPM）——镜像不允许注册/发布**，必须显式官方源：

   ```powershell
   cd D:\code\git\dsh-panel-pins
   # ① 登录官方源（注意 --registry 参数；打开的是 www.npmjs.com 授权页）
   npm login --registry https://registry.npmjs.org
   # ② 开启 2FA（2025-10 起强制：不开 publish 必报 E403 "Two-factor
   #    authentication ... required"。安全密钥（Windows Hello/通行密钥）与
   #    TOTP 验证器 App 均可；安全密钥发布时走浏览器确认，TOTP 走 6 位码。
   #    恢复码务必备份）https://www.npmjs.com/settings/<用户名>/tfa
   # ③ 发布
   npm publish --access public
   ```

   发布后 registry CDN 有约 3 分钟延迟才可查询；国内用户装包走 npmmirror（自动同步），不受影响。

2. ✅ **GitHub 仓库元数据**（`gh repo edit` 即可）：Description + Topics `dsh-plugin`、`dsh`、`deepseek-harness`。

3. ✅ **提收录 PR**：fork awesome-dsh-plugin/awesome-dsh-plugin → 写入 `data/plugins/QDNBD__dsh-panel-pins.yml`（内容取 `publishing/` YAML 去掉注释行）→ 建 PR。
   **已提：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/10186**（fork 提交 ceaf0f4，CI 绿后人工审核，通常一天内生效；有审核意见按评论改）。

4. ✅ **市场卡片图 + 详情页截图**：`icon:` 字段指 `assets/icon-180.png`（规则拒绝 SVG，须 GitHub 托管位图）；截图在本仓库根 `screenshots.json`（1-8 张相对路径），换图推自己仓库即生效，无需 PR。

5. （可选）第二市场 https://dsh-plugin.org/zh/submit ——Topics 加过后它会自动爬到，无需手动。

## 全流程一览（从改代码到用户看到更新）

```
D:\code\plugins\dsh-panel-pins        ← 开发源（包名 dsh-panel-pins）
        │  ① 改代码 → node --check → 回归测试
        ▼
tgz 安装管线（MAINTENANCE.md「本机安装管线」）
        │  ② 打包 .dist tgz → 备份 profile 三件套 → 解包装入
        │     → 补丁 package.json/pnpm-lock/.modules.yaml 三处
        ▼
本机桌面端（重启 pnpm 按 lockfile 重铺，不再回滚）
        │  ③ 同步 lib/、locale/、icon.svg 到 git 仓（不拷两份包身份文件）
        ▼
D:\code\git\dsh-panel-pins            ← 开源仓（包名 @qdnbd/dsh-panel-pins）
        │  ④ commit + push（可 npm version patch 打 tag）
        ▼
npm publish --access public           ← 官方源，带 OTP
        │  ⑤ registry 自动关联收录仓库（repository 回链）
        ▼
市场自动显示「可更新」，npmmirror 自动同步给国内用户
```

## 发版 Runbook（以后每次更新）

1. 开发源 `D:\code\plugins\dsh-panel-pins` 改代码 → `node --check lib/client.js` → 跑 `D:\code\.tmp-dpp-test\test.js` 回归（jsdom 27+ 项断言）
2. 本机生效：跑 tgz 安装管线（见 MAINTENANCE.md），profile 三处 lockfile 指向新 tgz
3. 同步 git 仓：把 `lib/`、`locale/`、`icon.svg` 拷到 `D:\code\git\dsh-panel-pins`（**不要**拷 package.json 和 cordis.patch.yml——两边的包身份不同），确认仓库 package.json 的 `version` 同步递增 → commit + push（可 `npm version patch` 打 tag）
4. `npm publish --access public`（市场自动出现"可更新"，无需通知收录仓库）
5. ⚠️ **宿主升级时同步放宽兼容区间**：package.json 的 `engines.dsh` 与 `dsh.compatibility.dsh` 两处（当前 `>=0.2.0-rc.1 <0.3.0-0`）。宿主升 0.3.0 后若不改，市场会把本插件按"与当前 DSH 不兼容"隐藏。
6. 更新 PUBLISHING.md 状态表

## 双包名说明（v1.2.0 起更新：裸名是主包）

**2026-11-16 决策**：包名统一到裸名 `dsh-panel-pins`——它是**主安装名**（完整插件，README/市场/文档安装命令全指向它）；`@qdnbd/dsh-panel-pins` 降级为 **legacy alias**，继续同步发版照顾存量用户（**不 deprecate**：deprecated 包会被市场索引降权，alias 必须保持干净）。意外收益：本地开发形态（`D:\code\plugins\dsh-panel-pins`）本来就叫裸名，统一后「本地 = npm」同构，双包名心智负担消失。

| 场景 | 包名 | cordis.patch name | 位置 |
| --- | --- | --- | --- |
| 本机 file: tgz 开发安装 | `dsh-panel-pins` | `dsh-panel-pins` | `~/.dsh/profiles/desktop/node_modules/dsh-panel-pins` |
| **npm 主发布（v1.2.0 起）** | **`dsh-panel-pins`** | `dsh-panel-pins` | registry，staging 在 `publishing/bare/` |
| npm legacy alias | `@qdnbd/dsh-panel-pins` | `@qdnbd/dsh-panel-pins` | registry，git 仓库根 |

`dsh` 客户端按包名关联加载 client bundle，所以**每个安装形态内部两处名字必须一致**（patch name == package name）；同一 profile 里裸名与 scoped **不可并存**（会双重注册设置分区）——本机开发形态与 npm 裸名同构，天然安全。

## 发版 Runbook（v1.2.0 起：裸名主包双发布）

1. 开发源 `D:\code\plugins\dsh-panel-pins` 改代码 → `node --check lib/client.js` → 跑 `D:\code\.tmp-dpp-test\test.js` 回归（jsdom，v1.2.0 起 57 项断言含 settings transfer）
2. 本机生效：跑 MAINTENANCE.md「本机安装管线」（tgz → 备份三件套 → robocopy 解包 → 补丁三处 → SRC==INST + BUILD 验证）
3. 同步 git 仓：把 `lib/`、`locale/`、`icon.svg` 拷到 `D:\code\git\dsh-panel-pins`（**不要**拷 package.json 和 cordis.patch.yml——两边的包身份不同），确认仓库 package.json 的 `version` 同步递增 → commit + push
4. **双发布**（都要求 npm 官方源 + 浏览器 OTP，在本人终端执行）：
   ```powershell
   # ① 裸名主包（publishing/bare/，先同步 lib/locale/icon/README 进去）
   cd D:\code\git\dsh-panel-pins\publishing\bare
   npm publish --access public --registry https://registry.npmjs.org
   # ② scoped legacy alias（git 仓库根）
   cd D:\code\git\dsh-panel-pins
   npm publish --access public --registry https://registry.npmjs.org
   ```
   ⚠️ **不要 deprecate** 任何一侧：裸名现在是正包，scoped 是活 alias。
5. ⚠️ **宿主升级时同步放宽兼容区间**：`publishing/bare/package.json` 与 git 仓库 `package.json` 两处的 `engines.dsh` + `dsh.compatibility.dsh`（当前 `>=0.2.0-rc.1 <0.3.0-0`）。
6. 更新 PUBLISHING.md 状态表 + awesome-dsh-plugin 收录描述 PR（如描述有变）。

## 2026-11-16 分发优化（裸名抢注 + 文档/索引更新）

背景与完整竞品对比见 [COMPETITOR-ANALYSIS.md](COMPETITOR-ANALYSIS.md)。裸名 `dsh-panel-pins` 在 npm 上仍是 404（未注册），用「stub 占位 + deprecate 指回 scoped 正包」双发布策略抢注搜索与安装命令流量。

### 已完成（本次，无需再动）

| 项 | 状态 |
| --- | --- |
| `publishing/bare/` stub 包 staging | ✅ package.json(0.0.1)+README，npm pack 通过（2 文件 1.6kB，无 dsh.bundle 清单——绝不双重注册） |
| README 双语 | ✅ 下载量徽章 + 「为什么选它」对比表 + 老版本 (0.2.0-rc.2) 独占卖点 + 裸名占位说明 |
| 收录 YAML | ✅ `publishing/awesome-dsh-plugin--data-plugins-QDNBD__dsh-panel-pins.yml` 描述重写（键盘效率定位 + Ctrl+K/Alt+1..9/command palette/MRU/layout presets 关键词） |
| GitHub topics | ✅ 10 个（+launcher / command-palette / pin / rename） |
| GitHub description | ✅ 已改为键盘效率型启动器定位 |

### 待执行：npm 重新登录 + 裸名发布（token 已失效 E401）

```powershell
cd D:\code\git\dsh-panel-pins
# ① 重新登录官方源（打开 www.npmjs.com 浏览器授权，2FA 走安全密钥/TOTP）
npm login --registry https://registry.npmjs.org

# ② 发布裸名 stub 并立即 deprecate 指回正包
#    ⚠️ 每次 npm 命令都显式带 --registry（本机默认源是 npmmirror，不允许发布）
cd publishing\bare
npm publish --access public --registry https://registry.npmjs.org
npm deprecate dsh-panel-pins@0.0.1 "Renamed: install @qdnbd/dsh-panel-pins instead" --registry https://registry.npmjs.org

# ③ 验证（registry CDN 约 3 分钟延迟）
npm view dsh-panel-pins deprecated --registry https://registry.npmjs.org
```

发布成功后：npm 搜索 "dsh-panel-pins" 命中占位包 → README 重定向 scoped 正包；`npm install dsh-panel-pins` 的用户看到 deprecate 提示。

> **实际执行记录（2026-11-16 17:20）**：
> 1. ✅ 首次发布撞上 npm **staged release 审核**：registry 文档先出现 npm 自己的占位版 `0.0.0-stage`（readme 写 "submitted for review"），约 3-5 分钟后 0.0.1 自动过审上线；**包名注册在 publish 那一刻就生效**（这是抢注的关键——别被审核中间态吓到重发）。npmjs.com 网页比 registry CDN 文档先刷新，验证以网页为准。
> 2. ⚠️ `npm deprecate` 现在要求**浏览器 OTP**（2026-08 "bypass 2FA tokens restricted" 政策：敏感操作即使已登录也要再授权一次）。命令本身没问题——在终端重跑、按 Enter 开浏览器确认即可；npm error EOTP 里的 authId URL 在 agent 输出里是打码的，只能在本人终端执行。
> 3. ✅ 最终状态：`dist-tags.latest = 0.0.1`，README/keywords/repository 回链全部正确。

### 待执行：收录描述更新 PR

把 `publishing/awesome-dsh-plugin--data-plugins-QDNBD__dsh-panel-pins.yml` 中 `url:` 及之后的内容，粘贴到 awesome-dsh-plugin 仓库的 `data/plugins/QDNBD__dsh-panel-pins.yml`（fork → 网页编辑 → PR；更新已有条目走编辑而非新建文件）。

### 以后每次发版

- **节奏目标：每周 2-3 个 patch**（下载曲线证明发布日下载 3-5 倍；小修小补都值得发版）。
- ~~stub 占位包版本与正包镜像~~（**已被 v1.2.0 决策取代**：裸名不再是占位 stub，而是主包完整形态；见「双包名说明」与「发版 Runbook」——裸名与 scoped 双发布，均不 deprecate）。
- v1.2.0（b70）已交付：settings transfer 文件导出/导入（jsdom 回归 57 项断言）+ 包名统一。
- v1.3.0 规划：AI 自动分类（参考 control 实现要点：发面板名给宿主模型分 2-4 组、手动改动锁定语义）。
- v1.2.x 排期观察：侧栏行 HTML5 拖拽排序（触屏「移到最前」箭头，参考 COMPETITOR-ANALYSIS.md 附录 layout 实现要点）。
