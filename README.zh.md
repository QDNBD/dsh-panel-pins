<p align="center"><img src="icon.svg" width="88" alt="dsh-panel-pins logo"></p>

# dsh-panel-pins

[![npm](https://img.shields.io/npm/v/@qdnbd/dsh-panel-pins)](https://www.npmjs.com/package/@qdnbd/dsh-panel-pins)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![platform](https://img.shields.io/badge/platform-Windows-blue)

[English](README.md) | **中文**

[DeepSeek Harness](https://www.deepseek.com/zh/harness) 侧栏面板管理插件——把所有面板行和第三方插件入口收进一个分组启动菜单，常用面板钉在侧栏，底部区可收紧，全部参数可在设置页调整。

## 功能

- **「面板」启动器**——侧栏一级行（与宿主行逐像素对齐），点开是分组菜单：
  - *全局面板*——所有官方面板行，当前打开的高亮标记；
  - *插件入口*——自动识别第三方插件注入的入口行（零硬编码选择器，按「新会话锚点 ↔ 面板列表」之间的结构推导），菜单里点击直接触发**原按钮**，各插件自己的打开逻辑不受影响；
  - 启动器徽标显示收纳总数，不会"悄悄丢东西"。
- **钉住 / 取消钉住，重启后保留**——在侧栏「更多」菜单里加钉住项；已钉的在侧栏原位，未钉的从菜单可达。
- **分组独立开关**——全局面板行、插件入口行可分别收纳，状态各自持久化。
- **紧凑底部区**（可开关，默认开）——底部插件动作区限高 15vh + 内部滚动，内联二维码缩小，品牌行与费用条收紧；二维码 / 品牌行 / 费用条各有细分开关，配高度滑块。
- **设置页分区**——*设置 → 面板收纳*：全部开关、四个实时滑块（面板列表 / 底部区 / 弹层 / 二维码尺寸）、**白名单常驻**（从真实入口勾选、精确匹配，命中项永远留在侧栏）、**钉住管理**（列出全部面板，已钉 / 未钉一视图，一键切换）、一键恢复默认。
- **主题友好**——菜单表面与滚动条消费宿主主题 token（`--dsw-menu-surface-fill`、磨砂、滚动条 token），与 `dsh-any-background` 等壁纸插件天然兼容，无硬编码白底灰条。

## 安装

在 DeepSeek Harness 桌面端：**设置 → 插件**，从列出本插件的插件市场安装 `@qdnbd/dsh-panel-pins`，或终端执行：

```sh
dsh plugin --profile <your-profile> add @qdnbd/dsh-panel-pins
```

重启应用。

## 使用

- 点侧栏带数字徽标的**「面板」**行 → 分组菜单打开任意面板 / 插件入口；
- **更多**菜单 → 钉住 / 取消钉住、开关收纳与紧凑底部区；
- **设置 → 面板收纳** → 完整控制台：开关、滑块、白名单、钉住管理、恢复默认。

## 配置

所有状态存在 `localStorage` 的 `dsh-panel-pins:` 前缀下，重启保留：

| 键 | 含义 |
| --- | --- |
| `rows-hidden-v2` | 全局面板行收进启动器 |
| `family-collected` | 插件入口行收进启动器 |
| `tidy` / `tidy-qr` / `tidy-brand` / `tidy-cost` | 紧凑底部区总开关 + 细分开关 |
| `panel-list-max` / `foot-max` / `overlay-max` / `qr-max` | 各区域限高（vh/px） |
| `whitelist` | 常驻侧栏的入口名（精确匹配） |
| `unpinned` / `label-ids` | 钉住状态与 label→id 记忆（钉住管理用） |

## 说明

- 底部入口**永不**收进菜单——原地保留，只对容器做限高滚动；
- 插件不逐帧改写宿主样式表，全部通过类名 / CSS 变量门控，切换即时、无闪烁。

## 许可

[MIT](LICENSE) © 2026 QDNBD
