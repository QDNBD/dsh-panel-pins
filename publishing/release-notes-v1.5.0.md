## Added

- **Ctrl+K 进入宿主快捷键服务**（DSH 0.2.2-rc.5）：`Ctrl+K` 不再只是插件自己的 `document keydown` 监听，而是通过 `ctx.shortcuts.register` 注册进宿主自己的快捷键服务——它会出现在「设置 → 快捷键」里，用户可自行改键，键位冲突可见，宿主负责输入框 / 模态仲裁（`context.region` 由宿主计算，覆盖 shadow root 与 xterm，比插件自己嗅探 `event.target` 可靠）。
  - 降级路径：无 `shortcuts` 服务的旧宿主、或 `register()` 因键位被占而抛错时，自动回退插件自己的 DOM 监听，功能不丢。
  - `Alt+1..9` **刻意保留在插件侧**（不进宿主注册）：避免与宿主可能的 Alt+数字冲突导致 `register()` 抛错，也避免 Desktop 原生桥与 DOM 双触发。
- **拼音搜索**：搜索框现在支持**拼音首字母 / 全拼 / 模糊子序列**匹配，按 9 档相关度**在组内排序**（组序不变——`replayGroupFolds` 依赖「组头 + 相邻子项」相邻性；清空搜索框复原原序；同分保持原序）。
  - 字表是完整 **GB2312 6763 字**（含生僻字），由 `scripts/gen-pinyin.mjs` 在**构建期**生成并内联进 `lib/client.js`——插件仍是**零运行时依赖**，运行时不加载任何拼音库。
- **主面板入口**：只注册了根级 `main` 槽的第三方插件，现在进入启动器的「**主面板**」分组，点击走公开契约 `layout.selectPanel(key)`（未注册 key 会抛错，已 try/catch）。

> 右侧栏标签页**刻意不做**：宿主没有公开的 `openGuide` 类打开 API（`app.asar` 0.2.2-rc.5 中 0 命中），枚举出来也点不开——宁可不做，也不做点不动的死行。

## Compatibility

- 兼容区间不变：DSH ≥ 0.2.0-rc.1（`<0.3.0-0`）。
- 新能力在无 `shortcuts` 服务的宿主上**自动降级**，不影响 0.2.0 / 0.2.1 线。
- 只改显示层，卸载插件刷新页面后宿主外观与安装前一模一样。

## Upgrade

```sh
dsh plugin --profile <你的 profile> add dsh-panel-pins
```

**Full Changelog**: https://github.com/QDNBD/dsh-panel-pins/compare/v1.4.8...v1.5.0

---

**English summary**

- `Ctrl+K` is now registered with the host's own shortcut service (`ctx.shortcuts.register`): it shows up under *Settings → Shortcuts*, is rebindable, conflicts are visible, and the host arbitrates inputs and modals. Falls back to the plugin's own keydown listener on older hosts or when the binding is taken. `Alt+1..9` stays plugin-owned on purpose.
- Search understands **pinyin initials, full pinyin and fuzzy subsequences**, scored across 9 relevance tiers and sorted within each group. The GB2312 6763-char table is generated at build time and inlined — still **zero runtime dependencies**.
- Third-party plugins that register only a root-level **main panel** now join the launcher's *Main panels* group.
- Right-hand sidebar tabs are deliberately not enumerated: the host exposes no public open API for them, so those rows would be dead.
