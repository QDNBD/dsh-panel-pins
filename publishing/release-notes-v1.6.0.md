## Added

- **The host's right-sidebar tab types join the launcher menu.** A new *Right sidebar* group lists them next to the panels, and clicking one opens it through the host's own navigation controller.
  - Only **page types** are listed. A *resource* type is opened by **address**, not by name — `openTab()` would synthesize a page address and mount a body that throws, so listing one would open a broken tab.
  - The group appears only when the host can actually open a tab right now: no controller, or no session on screen, means no dead rows.
  - The type is re-checked at click time, so a type unloaded between opening the menu and clicking is not opened.
- **The UI language follows the host's own language setting.** The host ships 8 languages and lets you switch them in-app; the plugin read `navigator.language` once at load and froze its copy, so a host set to 中文 with an English browser answered in English — and nothing could change while the plugin was mounted. Now the plugin reads the host's locale and repaints the moment you switch it.
- **The theme follows the host instantly.** The old observer watched a `<html>` class the host never touches; the host actually writes `<html>.style`, `<html>[data-ds-theme-source]` and `<body>[data-ds-dark-theme]`, so a theme switch could take up to five seconds to land. The plugin now subscribes to the host's own `theme/change` event and falls back to reading those attributes on hosts with no theme service.

## Fixed

- `new MutationObserver(...)` resolved the **global** constructor, which does not exist when the plugin runs inside another window realm — the observer was silently never installed. It now prefers the window the plugin was handed.
- The launcher's own label and accessible name were cached at creation time and did not follow a language switch.

## Compatibility

- Host range unchanged: DSH ≥ 0.2.0-rc.1 (`<0.3.0-0`).
- Every new capability degrades on hosts that do not ship the matching service: no locale service → the browser decides, no theme service → the host's DOM attributes decide, no right-sidebar controller → the group is absent. The new services are read as optional and are **not** declared as load-bearing dependencies.
- Display layer only; uninstalling leaves the host pixel-identical to before.

## Upgrade

```sh
dsh plugin --profile <你的 profile> add dsh-panel-pins
```

**Full Changelog**: https://github.com/QDNBD/dsh-panel-pins/compare/v1.5.0...v1.6.0

---

**English summary**

- The host's **right-sidebar tab types** now join the launcher menu in a group of their own. Only *page* types are listed — a resource type is opened by address, and opening one by name would mount a body that throws. The group only appears when a session is actually on screen.
- The **UI language follows the host's language setting** (8 languages, switchable in-app) instead of a one-shot `navigator.language` read, and repaints the moment you switch.
- The **theme follows the host instantly**. The host applies its palette by writing `<html>.style.colorScheme`, `<html>[data-ds-theme-source]` and `<body>[data-ds-dark-theme]` — never a class on `<html>`, which is what the old observer watched, so a theme switch could take up to five seconds to land. The plugin now reads the host's **resolved** scheme from those signals on every repaint (and repaints on the host's own `theme/change` event), so it stays in step even when a third-party plugin registers a custom theme whose `colorScheme` does not match the palette on screen.
- Fixed the `MutationObserver` constructor lookup so the observers are actually installed outside a plain browser global scope.
