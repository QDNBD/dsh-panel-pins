## Fixed

- **The sidebar's New-session button is centred again.** The plugin's own stylesheet matched the host's hashed class names with a *prefix* test — `[class*="_newSession"]` — and that matched six elements at once: the row, the button, and the button's inner label mask, content and label. The extra 8px margin landed on the button's inner elements, so the flex-centred "+ 新会话" text sat 8px above the button's vertical middle and the lower half of the pill looked empty.
  - The spacing now applies to the **row** only (`[class*="_newSessionRow"]`); the button and its contents are back to the host's own geometry.
  - Measured on the real desktop app: with the plugin's stylesheet on, the text centre sat **8px above** the button centre; with it off, the offset was **0**. After the fix the offset is 0.
  - Nothing else moved: the 8px gap between the New-session row and the panel list below it is unchanged.

## Compatibility

- Host range unchanged: DSH ≥ 0.2.0-rc.1 (`<0.3.0-0`).
- Display layer only; uninstalling leaves the host pixel-identical to before.

## Upgrade

```sh
dsh plugin --profile <your profile> add dsh-panel-pins
```

**Full Changelog**: https://github.com/QDNBD/dsh-panel-pins/compare/v1.6.0...v1.6.1

---

**中文摘要**

- 侧栏「**新会话**」按钮的文字回到正中。插件的样式表用**前缀匹配**宿主哈希类名（`[class*="_newSession"]`），一次命中 6 个元素（行、按钮、按钮内部的标签遮罩 / 内容 / 标签），多出来的 8px 下边距落在按钮内层，把 flex 居中的「+ 新会话」文字顶到垂直中心**上方 8px**，按钮下半截空出一大块，看着像半个空输入框。
  - 现在这条间距只作用在**行**上（`[class*="_newSessionRow"]`），按钮与内层恢复宿主原样。
  - 真机实测：样式表开时文字中心比按钮中心高 8px，关掉后偏差 0；修复后偏差 **0**。
  - 其他没变：按钮与下方面板列表之间的 8px 间距照旧。
