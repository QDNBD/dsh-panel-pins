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
