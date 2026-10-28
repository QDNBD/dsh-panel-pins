# 发布状态与 Runbook（dsh-panel-pins）

> 记录公开发布的当前状态与后续发版步骤。发布流程与 `dsh-cli-bridge` 完全同构（见其 PUBLISHING.md 的流程调研）。

## 当前状态（2026-10-28）

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

## 双包名说明

| 场景 | 包名 | cordis.patch name | 位置 |
| --- | --- | --- | --- |
| 本机 file: tgz 开发安装 | `dsh-panel-pins` | `dsh-panel-pins` | `~/.dsh/profiles/desktop/node_modules/dsh-panel-pins` |
| npm 发布 / 收录 | `@qdnbd/dsh-panel-pins` | `@qdnbd/dsh-panel-pins` | registry |

`dsh` 客户端按包名关联加载 client bundle，所以**每个安装形态内部两处名字必须一致**；两边不一致没关系（`dsh-cli-bridge` 本机 `@local/`、发布 `@qdnbd/` 同款先例）。若日后想迁移本机到 npm 包：先 remove 旧名再 add 新名，**两包并存会重复注册设置分区，务必二选一**。
