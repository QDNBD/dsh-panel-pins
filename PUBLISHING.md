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
| npm publish | ⬜ 待登录官方源后手工执行 |
| 收录 PR | ⬜ 未提（YAML 已备好：`publishing/awesome-dsh-plugin--data-plugins-QDNBD__dsh-panel-pins.yml`） |

## 剩余手工步骤（需要登录凭据，无法自动完成）

1. **npm 登录 + 发布** ⚠️ 本机 npm 默认源是 **npmmirror 镜像（CNPM）——镜像不允许注册/发布**。正确流程：

   ```powershell
   # ① 没有官方账号先注册：https://www.npmjs.com/signup
   cd D:\code\git\dsh-panel-pins
   # ② 登录官方源（注意 --registry 参数；打开的是 www.npmjs.com 授权页）
   npm login --registry https://registry.npmjs.org
   # ③ 验证（应显示你的 npmjs 用户名）
   npm whoami --registry https://registry.npmjs.org
   # ④ 发布（package.json 已加 publishConfig 强制官方源）
   npm publish --access public
   ```

   安装侧不受影响：国内用户装包走 npmmirror（镜像自动同步官方源的包）。

2. **GitHub 仓库元数据**（仓库页 About 齿轮，10 秒）：Description 填
   `Sidebar panel management for DeepSeek Harness: grouped panels launcher, persistent pin/unpin, compact footer, full Settings page.`
   Topics 加 `dsh-plugin`、`dsh`、`deepseek-harness`。

3. **提收录 PR**：打开 https://github.com/awesome-dsh-plugin/awesome-dsh-plugin → Add file → Create new file → 文件名
   `data/plugins/QDNBD__dsh-panel-pins.yml` → 粘贴 `publishing/` 里 YAML 的内容（去掉注释行）→ Commit（页面自动 fork 并建 PR）→ CI 绿后等人工审核。

4. **（可选）第二市场**：https://dsh-plugin.org/zh/submit （topic 加过后它也会自己爬到）。

## 发版 Runbook（以后每次更新）

1. 开发源 `D:\code\plugins\dsh-panel-pins` 改代码 → `node --check lib/client.js` → 跑 `D:\code\.tmp-dpp-test\test.js` 回归（jsdom 27+ 项断言）
2. 本机生效：跑 tgz 安装管线（见 MAINTENANCE.md），profile 三处 lockfile 指向新 tgz
3. 同步 git 仓：把 `lib/`、`locale/`、`icon.svg` 拷到 `D:\code\git\dsh-panel-pins`（**不要**拷 package.json 和 cordis.patch.yml——两边的包身份不同），确认仓库 package.json 的 `version` 同步递增 → commit + push（可 `npm version patch` 打 tag）
4. `npm publish --access public`（市场自动出现"可更新"，无需通知收录仓库）
5. 更新 PUBLISHING.md 状态表

## 双包名说明

| 场景 | 包名 | cordis.patch name | 位置 |
| --- | --- | --- | --- |
| 本机 file: tgz 开发安装 | `dsh-panel-pins` | `dsh-panel-pins` | `~/.dsh/profiles/desktop/node_modules/dsh-panel-pins` |
| npm 发布 / 收录 | `@qdnbd/dsh-panel-pins` | `@qdnbd/dsh-panel-pins` | registry |

`dsh` 客户端按包名关联加载 client bundle，所以**每个安装形态内部两处名字必须一致**；两边不一致没关系（`dsh-cli-bridge` 本机 `@local/`、发布 `@qdnbd/` 同款先例）。若日后想迁移本机到 npm 包：先 remove 旧名再 add 新名，**两包并存会重复注册设置分区，务必二选一**。
