<p align="center"><img src="icon.svg" width="88" alt="dsh-panel-pins logo"></p>

# dsh-panel-pins

[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![platform](https://img.shields.io/badge/platform-Windows-blue)

**English** | [中文](README.zh.md)

Sidebar panel management for [DeepSeek Harness](https://www.deepseek.com/zh/harness) — collect every panel row and third-party plugin entry into one grouped launcher menu, pin the ones you love, keep the sidebar compact, and tune it all from a dedicated Settings page.

## Features

- **Panels launcher** — a first-class row in the sidebar (pixel-aligned with host rows) opens a grouped menu:
  - *Global panels* — every official panel row, with the currently open one highlighted.
  - *Plugin entries* — third-party plugin entry rows are auto-detected (zero hard-coded selectors; derived structurally between the new-session anchor and the panel list) and can be opened via the menu; clicking fires the **original** button so each plugin's own open logic is untouched.
  - The launcher badge counts everything collected, so nothing is silently "lost".
- **Pin / unpin that survives restarts** — adds pin/unpin rows to the sidebar's *More* menu; pinned panels sit in the sidebar, unpinned ones stay reachable via the menu.
- **Per-group fold toggles** — hide global panel rows and/or plugin entry rows independently; both persisted.
- **Compact footer** (toggleable, on by default) — caps the footer plugin-action area (15vh, internal scroll), shrinks inline pairing QR codes, tightens the brand row and cost-meter. Sub-toggles for QR scaling / brand row / cost meter, plus height sliders.
- **Settings page section** — *Settings → 面板收纳*: all toggles, four live height sliders (panel list / footer / popup / QR size), a **whitelist** to keep specific entries permanently in the sidebar (checkbox picker over real entries, exact match), and a **pin management** list showing every panel — pinned and unpinned — with one-click toggle.
- **Theme-friendly** — menu surface and scrollbars consume host theme tokens (`--dsw-menu-surface-fill`, backdrop filter, scrollbar tokens), so it plays nicely with themes and plugins like `dsh-any-background`. No hard-coded white/gray.

## Install

In DeepSeek Harness Desktop: **Settings → Plugins** and install `dsh-panel-pins` (or via a plugin market that lists it). Restart the app.

## Usage

- Click the **Panels** row (with the count badge) in the sidebar → grouped menu of every panel and plugin entry.
- Right-click / open the **More** menu → pin or unpin any panel; toggle compact footer and row collection.
- Open **Settings → 面板收纳** for the full control panel: toggles, sliders, whitelist, pin management, reset to defaults.

## Configuration

All state lives in `localStorage` under the `dsh-panel-pins:` prefix and survives restarts:

| Key | Meaning |
| --- | --- |
| `rows-hidden-v2` | Global panel rows collected into the launcher |
| `family-collected` | Plugin entry rows collected into the launcher |
| `tidy` / `tidy-qr` / `tidy-brand` / `tidy-cost` | Compact footer master + sub-toggles |
| `panel-list-max` / `foot-max` / `overlay-max` / `qr-max` | Height caps (vh/px) |
| `whitelist` | Entry labels that stay in the sidebar, exact match |
| `unpinned` / `label-ids` | Pin state and label→id memory for pin management |

## Notes

- Bottom footer entries are **never** folded into the menu — they stay in place; only their container gets a height cap with internal scrolling.
- The plugin never rewrites host stylesheets per frame; everything is gated on classes / CSS custom properties, so toggling is instant and flicker-free.

## License

[MIT](LICENSE) © 2026 QDNBD
