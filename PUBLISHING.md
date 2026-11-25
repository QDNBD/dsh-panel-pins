# 发布状态与 Runbook（dsh-panel-pins）

> 记录公开发布的当前状态与后续发版步骤。发布流程与 `dsh-cli-bridge` 完全同构（见其 PUBLISHING.md 的流程调研）。

## 单发布收敛（2026-11-17 定稿）

v1.2.1 是 @qdnbd/dsh-panel-pins 的**最后一版**（scoped 别名冻结）；从 1.2.2 起**只发裸名 `dsh-panel-pins`**，每次发版 = 1 条 publish + 1 次 OTP。

| 时间线 | 事件 |
| --- | --- |
| 2026-11-16 | v1.2.0 双发布（裸名 1.2.0 上线 + scoped alias 同步） |
| 2026-11-17 | v1.2.1 双发布（scoped 最终版）；随后 `npm deprecate @qdnbd/dsh-panel-pins@"<1.2.1"`——8 个旧版本挂迁移路牌，1.2.1 保持干净（deprecated 旧版是冻结别名的正确用法） |
| 2026-11-17 | git 仓根转裸名身份（package.json/cordis.patch.yml name = dsh-panel-pins），删除 publishing/bare 中转；**单发布时代开始** |

## 当前状态（2026-11-25，**v1.5.0 待发布**，npm 上仍是 v1.4.8）

| 项 | 值 |
| --- | --- |
| npm 主包 | `dsh-panel-pins@1.4.8`（latest，已发布）。**v1.5.0 尚未 publish**——本机验证 + 用户 OTP 后执行 |
| 待发布内容 | **v1.5.0（b95）** 三件事：① `Ctrl+K` 注册进宿主快捷键服务 `ctx.shortcuts`（可在「设置 → 快捷键」改键、冲突可见；宿主负责输入框/模态仲裁，老宿主与键位被占时回退插件自己的监听）；② 搜索支持拼音首字母 / 全拼 / 模糊子序列，按相关度在组内排序（内置完整 GB2312 6763 字表，纯本地）；③ 只注册了**主面板**（根级 `main` 槽）的第三方插件进入启动器「主面板」分组 |
| 回归 | b95 新套件 25/25（宿主快捷键注册/解析器语义/拒绝注册回退/主面板组/拼音搜索）+ b95 拼音纯函数 16/16 + b84 26/26 + b86 41/41 + b85 29/29（顺手修好该套件写死的 `v1.4.0`/`b86` 陈旧断言，改成从 package.json 与源码动态读取）+ b90 滚动契约 29/29 |
| 兼容性 | engines.dsh 不变（`>=0.2.0-rc.1 <0.3.0-0`）；新能力在无 `shortcuts` 服务的宿主上自动降级，不影响 0.2.0/0.2.1 线 |
| GitHub | tag v1.5.0 未推；Release 页待建 |
| 本机切换 | ✅ **已切到本地 1.5.0**（`file:D:/code/.dist/local-dsh-panel-pins-1.5.0.tgz`，SRC==INST SHA256 一致）；**待 1.5.0 发布后**再切回 registry `^1.5.0` |
| 旧 scoped 包 | ✅ **2026-11-25 已废弃全部 9 个版本**（含 latest=1.2.1），文案指向裸名包；`latest` 保留仍可装，只打 warning。见下方「2026-11-25 分发动作 ①」 |
| 收录 PR | 待更新：补 `pinyin` / `shortcut` / `main-panel` 关键词（见下方「2026-11-25 分发动作」②） |

## 历史状态（2026-11-25，已发布 v1.4.8）

| 项 | 值 |
| --- | --- |
| npm 主包 | **`dsh-panel-pins@1.4.8`**（latest，2026-11-25 20:4x 用户浏览器 OTP 后 publish 成功）；shasum `648a46960ae39b3c9312c9e5ee8fbe2d66215bc1` 与用户终端输出一致 ✓；包内 README 已含 20:44 新增的亮点区块（commit 2e998b8，README.md 20.0kB） |
| GitHub | tag v1.4.8 已推 ✓；Release 页 https://github.com/QDNBD/dsh-panel-pins/releases/tag/v1.4.8 ✓ |
| registry 核验 | ✓ `dist-tags.latest = 1.4.8`（发布后约 2–4 分钟 CDN 传播完成）；✓ tarball https://registry.npmjs.org/dsh-panel-pins/-/dsh-panel-pins-1.4.8.tgz |
| 本机切换 | ✓ profile 依赖已从 file:.dist tgz 切回 registry `^1.4.8`（pnpm --registry 官方源重算 lockfile，14.7s；安装副本 BUILD=b94，SRC==INST SHA256 一致）；备份 `.bak-reg-1.4.8-20261125-204845` |
| 本次修复 | **v1.4.8（b94）** rc.5 限高列表滚轮失效（用户报告：工作区可以滑动、列表滑动不了；1.4.5–1.4.7 三版都未修好）。根因：① 1.4.4 起 rc.5 免驱动限高——宿主手令视口处理器 preventDefault 所有导航区滚轮事件，列表自身永远滚不了；② **1.4.7 致命样式表事故**——EXTRA_CSS 中 `html.dpp-rc3 [class$="_regionArea"] {` 被意外复制两遍，坏声明残余消费吞到顶层 `;`（本样式表没有），其后全部规则被静默丢弃。修复 = v1.4.4 基底 + LITE 驱动（吸收步 preventDefault+驱动列表、边界步放行、无 stopPropagation/无 viewport 代写），EXTRA_CSS 与 1.4.4 逐字节一致。回归：b90 更新至 b94 契约 29/29、b84 26/26、b86 41/41。**用户重启后确认「正常了」**。 |
| 发布过程事故 | EOTP 走的是 TOTP 6 位码路径（与 11-25 早间 1.4.4 的浏览器 OTP 流程不同）；用户选择自行在终端执行 publish 命令完成认证。 |
| 收录 PR | 无需更新（bugfix 不改收录描述） |

## 历史状态（2026-11-25，已发布 v1.4.4）

| 项 | 值 |
| --- | --- |
| npm 主包 | **`dsh-panel-pins@1.4.4`**（latest，2026-11-25 16:0x 用户浏览器 OTP 后 publish 成功）；shasum `b91339129db27e7a5e1ef0b2fe002933b6f74e45` 与用户终端输出一致 ✓ |
| GitHub | tag v1.4.4 已推 ✓；Release 页 https://github.com/QDNBD/dsh-panel-pins/releases/tag/v1.4.4 ✓ |
| registry 核验 | ✓ `dist-tags.latest = 1.4.4`；✓ tarball https://registry.npmjs.org/dsh-panel-pins/-/dsh-panel-pins-1.4.4.tgz（CDN 延迟约 3 分钟后核验通过） |
| 本机切换 | ✓ profile 依赖已从 file:.dist tgz 切到 registry `^1.4.4`（pnpm --registry 官方源重算 lockfile；安装副本 b90 与 git 字节一致）；备份 `.bak-reg-1.4.4-20261125-162812` |
| 本次修复 | rc.5 侧栏滚动契约：b79/b83 结构覆盖与 b81 滚轮劫持改由 `html.dpp-rc3` 门控（`detectScrollContract()` 按 `_scrollArea` 是否带 `data-sidebar-scrollport` 分类 rc5/rc3/null）。回归：b90 套件 16/16、b84 26/26、b86 41/41（b85 的 3 失败为测试陈旧断言，HEAD A/B 一致） |
| 事故记录 | ① 用户首报 publish E404：官方源 token 失效（`npm whoami` E401），npm 对无效凭据 PUT 报 404 且不出 OTP 提示——`npm login --registry` 重登后即恢复（同 11-22「token 已失效」旧账）；② ssh push 被代理 fake-ip 掐断（`198.18.0.92 port 443`），走 `git push https://x-access-token:$(gh auth token)@github.com/...` 通道成功 |
| 收录 PR | 无需更新（bugfix 不改收录描述） |

## 历史状态（2026-11-22，已发布 v1.4.3）

## 历史状态（2026-11-22，已发布 v1.4.3）

| 项 | 值 |
| --- | --- |
| npm 主包 | **`dsh-panel-pins@1.4.3`**（latest，2026-11-22 23:18）；GitHub Release 页 v1.4.3 ✓；本机 profile 已切回 registry `^1.4.3`（安装副本 b89 == git 字节一致） |
| **本次待发** | **v1.4.3（b89）**——构建号收为内部标识：设置页脚注与 issue 环境块只显示 `v1.4.3`，（b89）仅存于 `?dppdebug` 诊断。前线功能（13/13 桥接对齐）不变。发布前校验全绿：桥接套件 41/41、主套件 64/72（8 挂 = HEAD 基线遗留）、node --check ✓、dry-run 10 文件 99.0 kB ✓。GitHub Release 已发：tag v1.4.0/v1.4.1/v1.4.2 已推，Release 页 https://github.com/QDNBD/dsh-panel-pins/releases/tag/v1.4.2 ✓ |
| 状态 | **已发布**（2026-11-22 21:47，用户浏览器 2FA 认证后 publish 成功） |
| registry 核验 | ✓ version 1.4.2 = latest；✓ tarball https://registry.npmjs.org/dsh-panel-pins/-/dsh-panel-pins-1.4.2.tgz；✓ repository 回链 + engines.dsh 区间 |
| 本机切换 | ✓ profile 依赖已从 file:.dist tgz 切到 registry `^1.4.2`（pnpm --registry 官方源重算 lockfile，安装副本 BUILD=b88 与 git 字节一致） |
| 收录 PR | ✓ awesome-dsh-plugin 描述更新至 v1.4.2（设置页桥接完备 13/13）：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/17824 |
| 发布命令 | 仓库根 `npm publish --access public --registry https://registry.npmjs.org`（单发布）— **每次 publish 都需人工浏览器 OTP**（EOTP 待用户完成，非交互终端只能拿到掩码 URL） |
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

## 2026-11-25 分发动作（1.5.0 同步）

### ① 旧 scoped 包仍在分流新用户 —— 根因是 latest 没被标废弃

调研实测（npm 日曲线 2026-11-08 ~ 11-24）：

| 日期 | 裸名 `dsh-panel-pins` | scoped `@qdnbd/dsh-panel-pins` |
| --- | ---: | ---: |
| 11-16（裸名首发） | **555** | 230 |
| 11-17（scoped 最后一版 1.2.1） | 206 | 253 |
| 11-18 → 11-21 | 195 → 66 → 55 → 38 | 53 → 35 → 30 → 26 |
| 11-22（发 1.4.2） | **362** | 28 |
| 11-23 → 11-24 | 48 → 62 | 26 → 34 |

裸名包 11-16 才存在（之前全是 0）。scoped 包 11-17 之后从 253/天掉到 **26–34/天的地板**——不是切换尾巴，是一条平基线（切换前基线就是 40–70/天）。**约一半安装量仍落在冻结的 1.2.1 上**（~30/天 ≈ 900/月）。

**根因**（registry packument 实测）：scoped 包 9 个版本里**已有 8 个带 deprecation**（`0.0.0-stage`…`1.2.0`，文案一致），**唯独 `latest` = 1.2.1 没标废弃**。而 `npm install @qdnbd/dsh-panel-pins` 装的正是 latest → **毫无警告地装上冻结版**。

**排除项**（都干净，不用动）：
- 官方市场目录 `dsh-plugin-catalog`（6885 条）里**只有裸名一条**，无 scoped 条目；
- awesome-dsh-plugin 收录 YAML 指向裸名（`npm:` 字段自动采集自仓库 package.json）；
- 本机 `dshmarket` 插件不硬编码本插件条目。

**修复：一条命令，无需发版**（写操作要 OTP，用户在自己终端跑一次）：

```powershell
npm deprecate '@qdnbd/dsh-panel-pins@1.2.1' 'Scoped package frozen: install dsh-panel-pins (bare name) instead — all future versions ship there.' --registry https://registry.npmjs.org
```

> npm 会打印一个浏览器认证 URL，点完即完成（EOTP 流程）。**不必发 1.2.2**——不用改代码、不用升版本号，deprecate 只是包文档的元数据操作，可随时撤销（`npm deprecate ... ""`）。
>
> 顺带（同样免 OTP）：在 npmjs.com 网页端把 `@qdnbd/dsh-panel-pins` 的 README 换成 `publishing/scoped-migration/README.md` 的内容——**改 README 不产生新版本**，但 npm 页面会立刻显示迁移提示。

> **决策依据的变化**：2026-11-16 当时的「不 deprecate」理由是「deprecated 包会被市场索引降权，alias 必须保持干净」——那时 scoped 还是**主包**。11-17 单发布收敛后主包已换成裸名，且 scoped 包**已有 8 个版本被废弃**，把最后一个也标上只是补齐既定意图，不新增降权面。

**✅ 已执行（2026-11-25 22:2x，用户在自己终端完成 EOTP 浏览器认证）**。registry packument 回读核验：

| 核验项 | 结果 |
| --- | --- |
| `npm view '@qdnbd/dsh-panel-pins' deprecated` | ✅ `Scoped package frozen: install dsh-panel-pins (bare name) instead  all future versions ship there.` |
| `npm view '@qdnbd/dsh-panel-pins@1.2.1' deprecated` | ✅ 同上 |
| 9 个版本逐个检查 | ✅ **全部 9 个**（`0.0.0-stage` … `1.2.1`）都带 deprecation，无漏网 |
| `dist-tags.latest` | 仍是 `1.2.1`（**故意保留**：仍可安装，只是装时打 warning——不阻断、不断供） |
| 存储串字节 | 纯 ASCII；原本的 `—` 在 PowerShell 控制台编码往返中被吞成两个空格，其余文案无 mojibake，语义完整 |

**效果边界**（写在这里免得日后误判）：只影响**此后新执行一次 `npm install @qdnbd/dsh-panel-pins` 的人**，让 npm 打 `npm warn deprecated ...` 指向裸名包；**不阻断安装、不改代码、不升版本号、不动已发布 tarball**；**对已装的旧实例零影响**（老用户不会收到任何提示，且 pin 配置需自行导出 → 装裸名包 → 导入，不会自动迁移）。撤销方式：`npm deprecate '@qdnbd/dsh-panel-pins@1.2.1' '' --registry https://registry.npmjs.org`（注意必须显式带版本号，空串会废弃整包所有版本）。

### ② README 对照表从「四家」扩到「十一家」

- `README.md` / `README.zh.md` 的对照表已按 2026-11-25 的实测数据重写，纳入 `panel-compact` / `panel-tidy` / `panel-titlebar` 三个新对手，并如实标出它们各自的招牌（AI 分类 / 按钮行布局 / 标题栏模式 / 触屏长按拖动）。
- 「怎么选」表同步扩到十一家。
- 收录描述（`publishing/awesome-dsh-plugin--data-plugins-QDNBD__dsh-panel-pins.yml`）待 PR 更新：补 `pinyin` / `shortcut` / `main-panel` 关键词。

### ③ 1.5.0 发布状态

见下方「当前状态」表。npm / GitHub Release 均**未发布**——等待用户本机验证 + OTP publish。
