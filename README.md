<p align="center"><img src="icon.svg" width="88" alt="dsh-panel-pins logo"></p>

# dsh-panel-pins

[![npm](https://img.shields.io/npm/v/@qdnbd/dsh-panel-pins)](https://www.npmjs.com/package/@qdnbd/dsh-panel-pins)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![platform](https://img.shields.io/badge/platform-Windows-blue)

**English** | [中文](README.zh.md)

Sidebar panel management for [DeepSeek Harness](https://www.deepseek.com/zh/harness) — collect every panel row and third-party plugin entry into one grouped launcher menu, pin the ones you love, keep the sidebar compact, and tune it all from a dedicated Settings page.

## Features

- **Panels launcher** — a first-class row in the sidebar (pixel-aligned with host rows) opens a grouped menu:
  - *Global panels* — the **full panel inventory** (pinned and unpinned alike), with the currently open one highlighted; unpinned panels open via a temporary-pin "peek" that restores your pin state afterwards.
  - *Plugin entries* — third-party plugin entry rows are auto-detected (zero hard-coded selectors; derived structurally between the new-session anchor and the panel list) and can be opened via the menu; clicking fires the **original** button so each plugin's own open logic is untouched.
  - **In-menu search** with full keyboard navigation (type to filter, ↑↓ to move, Enter to open, Esc to close) and **search-hit highlighting** — the matched substring lights up in the theme accent color.
  - **Alt+1..9 direct activation** — while the menu or palette is open, jump straight to the Nth *visible* item (folded/filtered items are skipped).
  - **Collapsible groups with memory** — fold each group; the state survives menu re-opens and app restarts.
  - Hover any line for quick **pin / unpin / to-top** actions.
  - The launcher badge counts everything collected, so nothing is silently "lost".
- **Ctrl+K command palette** — the same inventory plus quick commands (collect rows, icon-only mode, compact footer, open Settings), centered and keyboard-first. Host text inputs are never hijacked.
- **Recent group** — the menu and palette list your last-used panels (MRU, cap 5, persisted) at the top for one-click return; stays in sync with search, keyboard navigation and Alt+N jumps.
- **Right-click context menu** on any sidebar row — open / pin / unpin / to-top / keep-in-sidebar, all keyboard-reachable (arrows, Home/End, Enter).
- **Icon-only panel rows** — keep every panel row as a compact 18px glyph column; a gentler middle ground between full rows and full collection.
- **Pin / unpin that survives restarts** — adds pin/unpin rows to the sidebar's *More* menu; pinned panels sit in the sidebar, unpinned ones stay reachable via the menu.
- **Top-pinning with drag-to-reorder** — pin chosen panels to the very top (works in the collapsed icon rail too); reorder them by drag & drop in Settings. Implemented with negative CSS `order`, so no DOM surgery and no fights with host re-renders.
- **Per-group fold toggles** — hide global panel rows and/or plugin entry rows independently; both persisted.
- **Compact footer** (toggleable, on by default) — caps the footer plugin-action area (15vh, internal scroll), shrinks inline pairing QR codes, tightens the brand row and cost-meter. Sub-toggles for QR scaling / brand row / cost meter, plus height sliders.
- **Settings page section** — *Settings → 面板收纳*: all toggles, four live height sliders (panel list / footer / popup / QR size), a **whitelist** to keep specific entries permanently in the sidebar (id-first storage, so it survives UI language switches), a **pin management** list with drag-to-reorder, and **settings export/import** (clipboard JSON) to move your setup between machines.
- **Theme-friendly** — menu surface and scrollbars consume host theme tokens (`--dsw-menu-surface-fill`, backdrop filter, scrollbar tokens), so it plays nicely with themes and plugins like `dsh-any-background`. No hard-coded white/gray.

## Install

In DeepSeek Harness Desktop: **Settings → Plugins** and install `@qdnbd/dsh-panel-pins` from a plugin market that lists it, or from a terminal:

```sh
dsh plugin --profile <your-profile> add @qdnbd/dsh-panel-pins
```

Restart the app.

## Usage

- Click the **Panels** row (with the count badge) in the sidebar → grouped, searchable menu of every panel and plugin entry (pinned and unpinned).
- Press **Ctrl+K** anywhere → the centered command palette (quick commands + full inventory).
- **Right-click** any sidebar row → open / pin / to-top / keep-in-sidebar.
- Open **Settings → 面板收纳** for the full control panel: toggles, sliders, whitelist, drag-to-reorder pin management, export/import, reset layout.

## Configuration

All state lives in `localStorage` under the `dsh-panel-pins:` prefix and survives restarts:

| Key | Meaning |
| --- | --- |
| `rows-hidden-v2` | Global panel rows collected into the launcher |
| `family-collected` | Plugin entry rows collected into the launcher |
| `icon-only` | Panel rows collapse to 18px glyphs |
| `overlay-groups-folded` | Per-group fold memory for the launcher menu |
| `tidy` / `tidy-qr` / `tidy-brand` / `tidy-meter` | Compact footer master + sub-toggles |
| `panel-list-max` / `foot-max` / `overlay-max` / `qr-size` | Height caps (vh/px) |
| `whitelist` | Entries that stay in the sidebar (panel ids first, labels as legacy fallback) |
| `unpinned` / `label-id-map` | Pin state and label→id memory for pin management |
| `top` | Ordered list of top-pinned panel ids (array order = display order) |

## Notes

- Bottom footer entries are **never** folded into the menu — they stay in place; only their container gets a height cap with internal scrolling.
- The plugin never rewrites host stylesheets per frame; everything is gated on classes / CSS custom properties, so toggling is instant and flicker-free.

## License

[MIT](LICENSE) © 2026 QDNBD
