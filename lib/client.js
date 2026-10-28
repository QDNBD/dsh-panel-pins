/**
 * dsh-panel-pins — browser half.
 *
 * CLASSIC SCRIPT: registers a lazy factory with the page module loader (id must
 * equal the package name). The factory returns the Cordis plugin.
 *
 * What it does:
 *
 *   1. A "Panels" launcher (inspired by @weibaohui/dsh-sidebar-tidy). One row
 *      in the sidebar opens a floating menu listing every panel; clicking an
 *      item opens that panel. The panel rows themselves are hidden by default,
 *      so the session-history region gets the space back. Footer entries are
 *      deliberately left alone — only the global panel rows are collected.
 *
 *   2. Pin/unpin menu rows. The host sidebar renders one panel row per sidebar
 *      plugin, and the More menu (PanelMoreMenu) already passes `entries` (with
 *      `pinned` flags) and `onPinnedChange` into the `sidebar.panellist.actions`
 *      slot — but the official entry-customization bundle renders that slot
 *      "without pin controls", so there is no way to fold a panel away. This
 *      plugin registers its own component into the same slot and renders
 *      pin/unpin rows: unpinning a panel removes it from the panel list (the
 *      host's own filter: `id === "plugins" || !unpinned.includes(id)`) and it
 *      stays reachable through the More menu. The host keeps pins in a
 *      memory-only snapshot store (lost on restart), so we persist the
 *      unpinned id list in localStorage and re-assert it whenever the panel
 *      list changes.
 *
 *   3. Scrollable panel list. The host's `.panelList` has no max-height and no
 *      overflow, so many plugin rows squeeze the session-history region. We
 *      inject a stylesheet that caps the list height and lets it scroll.
 *      Selectors use `[class$="_panelList"]` (css-modules hash agnostic).
 *
 *   4. Fold/unfold the panel rows from the More menu (persisted in
 *      localStorage). Visibility only (el.style.display) — no elements are
 *      inserted into React-owned markup, and the state is re-applied on a light
 *      interval in case React swaps the nav node.
 *
 *   5. All icons are inline SVG (Fluent-style stroke), and rows copy the host
 *      menu-item metrics (16px icon, 8px gap, 13px text, hover fill, focus
 *      ring) via the host's design tokens, so they blend with official rows.
 *      NOTE: do NOT require('@deepseek-ai/dsh-client-ui-primitives') here —
 *      the dynamic plugin loader does not map that module name for third-party
 *      packages, and a failed require kills the whole plugin (verified by
 *      bisection: 0.1.0/0.2.2 without it render, 0.2.0/0.2.1 with it vanish).
 *
 *   6. Plugin entry rows ("family rows"), following weibaohui/dsh-sidebar-tidy
 *      v0.1.0 (https://github.com/weibaohui/dsh-sidebar-tidy). Third-party
 *      plugins inject clickable rows between the new-session anchor and the
 *      panel list (direct buttons or button-wrapping containers). These rows
 *      are listed in the Panels launcher under their own group and can be
 *      folded away with a persisted toggle (independent of the panel-row
 *      toggle). Items click the ORIGINAL button, so each panel's own open
 *      logic (including mid-column takeover views) is untouched. CONSTRAINT
 *      from the user: bottom (footer) entries are NEVER collected — only
 *      panel rows and plugin entry rows go into the menu; the settings area
 *      stays in place.
 *
 *   7. Compact footer ("sidebar tidy", ported from @weibaohui/dsh-sidebar-tidy).
 *      One CSS block, gated on an `html.dpp-tidy` class so it can be toggled
 *      without rewriting the stylesheet: caps the footer plugin-action area
 *      (`_footArea`) at 15vh with internal scrolling (user-tuned down from
 *      25vh), shrinks inline pairing QR codes to 132px, tightens the brand
 *      row (60→44px) and new-session margin, and compacts the cost-meter
 *      footer (`.cm-foot` 26px, balance box capped). Toggleable from the
 *      More menu and the Panels launcher; state persisted in localStorage,
 *      ON by default.
 *      CONSTRAINT: the footer ENTRIES themselves are never folded into the
 *      Panels launcher menu — they stay in place at the bottom; only their
 *      container gets a height cap and a scrollbar.
 *
 *   8. Settings page section ("面板收纳" column in the host Settings nav,
 *      registered into the `settings.section` slot — same contract as the
 *      official ui-settings-* packages). Exposes every tunable as a live
 *      control: the three fold/compact toggles plus height sliders for the
 *      panel list and the capped footer. All values persist in localStorage
 *      and are applied through CSS custom properties on <html>
 *      (--dpp-panel-list-max, --dpp-foot-max), so sliders update the sidebar
 *      instantly without touching the stylesheet.
 */
window.__ModuleLoader__.load({
  id: 'dsh-panel-pins',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const SLOT = 'sidebar.panellist.actions'
    const SLOT_ID = 'panel-pins'
    const STORE_KEY = 'dsh-panel-pins:unpinned'

    // Whether the panel ROWS are hidden (collected into the Panels launcher).
    // Deliberately NOT migrated from the old 'panellist-folded-v2' key: that
    // key used to mean "collapse the whole nav", and an even older one could
    // lock the sidebar collapsed with no way out.
    const ROWS_HIDDEN_KEY = 'dsh-panel-pins:rows-hidden-v2'

    // Whether the "compact footer" layout patch (rule group 7) is applied.
    const TIDY_KEY = 'dsh-panel-pins:tidy'
    const TIDY_CLASS = 'dpp-tidy'

    // Whether third-party plugin entry rows (family rows between the
    // new-session anchor and the panel list) are collected into the launcher.
    const FAMILY_KEY = 'dsh-panel-pins:family-collected'

    // Numeric tunables (vh/px), edited from the Settings page section and
    // applied as CSS custom properties on <html>.
    const PANEL_MAX_KEY = 'dsh-panel-pins:panel-list-max'
    const FOOT_MAX_KEY = 'dsh-panel-pins:foot-max'
    const PANEL_MAX_DEFAULT = 20
    const FOOT_MAX_DEFAULT = 15
    const OVERLAY_MAX_KEY = 'dsh-panel-pins:overlay-max'
    const QR_SIZE_KEY = 'dsh-panel-pins:qr-size'
    const OVERLAY_MAX_DEFAULT = 60
    const QR_SIZE_DEFAULT = 132

    // Whitelist: entry labels containing any of these names stay in the
    // sidebar (never collected, never hidden).
    const WHITELIST_KEY = 'dsh-panel-pins:whitelist'

    // Persisted label→id map for panels, seeded every time the host feeds the
    // More-menu slot. The Settings pin list needs ids to toggle pins, and the
    // host only renders that slot when the More menu opens — so the map makes
    // the pin list work even before that.
    const LABEL_ID_MAP_KEY = 'dsh-panel-pins:label-id-map'

    // Granular compact-footer sub-toggles (each rule group gated on its own
    // html class AND the master dpp-tidy class).
    const TIDY_QR_KEY = 'dsh-panel-pins:tidy-qr'
    const TIDY_BRAND_KEY = 'dsh-panel-pins:tidy-brand'
    const TIDY_METER_KEY = 'dsh-panel-pins:tidy-meter'
    const TIDY_QR_CLASS = 'dpp-tidy-qr'
    const TIDY_BRAND_CLASS = 'dpp-tidy-brand'
    const TIDY_METER_CLASS = 'dpp-tidy-meter'

    const STYLE_ID = 'dsh-panel-pins-style'
    const LAUNCHER_ATTR = 'data-dpp-launcher'
    const BUILD = 'b17'

    const zh = (function () {
      try {
        return String((navigator && navigator.language) || '').toLowerCase().indexOf('zh') === 0
      } catch (error) {
        return false
      }
    })()
    const LABEL = {
      pin: zh ? '钉住在侧栏' : 'Pin to sidebar',
      unpin: zh ? '从侧栏取消钉住' : 'Unpin from sidebar',
      fold: zh ? '收起面板列表' : 'Hide panel list',
      unfold: zh ? '展开面板列表' : 'Show panel list',
      panels: zh ? '面板' : 'Panels',
      panelsMenu: zh ? '打开面板菜单' : 'Open panels menu',
      showRows: zh ? '显示面板行' : 'Show panel rows',
      hideRows: zh ? '隐藏面板行' : 'Hide panel rows',
      tidyOn: zh ? '收紧底部插件区' : 'Compact footer area',
      tidyOff: zh ? '还原底部插件区' : 'Restore footer area',
      familyOn: zh ? '收纳插件入口行' : 'Collect plugin rows',
      familyOff: zh ? '还原插件入口行' : 'Restore plugin rows',
      groupPanels: zh ? '全局面板' : 'Global panels',
      groupFamily: zh ? '插件入口' : 'Plugin entries',
      setTitle: zh ? '面板收纳' : 'Panel Pins',
      setIntro: zh
        ? '调整侧栏收纳与紧凑布局的各项参数，改动即时生效并自动保存。'
        : 'Tune sidebar collection and the compact layout. Changes apply live and save automatically.',
      setRows: zh ? '收纳面板行' : 'Collect panel rows',
      setRowsDetail: zh ? '全局面板行收进「面板」菜单' : 'Fold global panel rows into the Panels menu',
      setFamily: zh ? '收纳插件入口行' : 'Collect plugin rows',
      setFamilyDetail: zh ? '第三方插件入口行收进「面板」菜单' : 'Fold third-party entry rows into the Panels menu',
      setTidy: zh ? '紧凑底部区' : 'Compact footer',
      setTidyDetail: zh ? '底部插件区限高 + 内部滚动，二维码缩小' : 'Cap the footer area with internal scrolling; shrink QR codes',
      setPanelMax: zh ? '面板列表限高' : 'Panel list max height',
      setFootMax: zh ? '底部插件区限高' : 'Footer area max height',
      setOverlayMax: zh ? '弹层菜单限高' : 'Panels menu max height',
      setQrSize: zh ? '二维码尺寸' : 'QR code size',
      setWhitelist: zh ? '白名单常驻' : 'Keep entries pinned',
      setWhitelistDetail: zh
        ? '打开开关的入口留在侧栏原位，不收进「面板」菜单'
        : 'Entries switched on stay in the sidebar and are never collected',
      setPickEmpty: zh
        ? '尚未发现侧栏入口（打开侧栏后重试）'
        : 'No sidebar entries found yet — open the sidebar and retry',
      setPinManage: zh ? '钉住管理' : 'Pin management',
      setPinManageDetail: zh
        ? '列出全部面板：已钉住的在侧栏原位，未钉住的只在「更多」菜单里'
        : 'All panels: pinned ones sit in the sidebar, unpinned ones live in the More menu',
      setPinRestore: zh ? '钉住' : 'Pin',
      setPinUnpin: zh ? '取消钉住' : 'Unpin',
      setPinNeedMenu: zh
        ? '打开一次「更多」菜单以识别该面板后即可操作'
        : 'Open the More menu once so this panel can be identified',
      setPinEmpty: zh ? '尚未发现面板' : 'No panels found yet',
      setSubQr: zh ? '二维码缩放' : 'Shrink QR codes',
      setSubBrand: zh ? '品牌行收紧' : 'Tighten brand row',
      setSubMeter: zh ? '费用条紧凑' : 'Compact cost meter',
      setSubNote: zh ? '以下细分在「紧凑底部区」开启时生效' : 'These apply while Compact footer is on',
      setReset: zh ? '恢复默认' : 'Reset to defaults',
      unnamed: zh ? '未命名' : 'Unnamed',
    }

    // Bridge between the React slot component (which knows panel ids and pin
    // state) and the DOM launcher (which knows the live panel rows). The slot
    // component refreshes `bridge` on every render.
    const bridge = {
      entries: [],
      onPinnedChange: null,
    }

    /**
     * The full panel list for the Settings pin manager, merged from three
     * sources: visible panel rows (pinned, label→id via the persisted map),
     * the unpinned store (ids), and the host-fed bridge entries whenever the
     * More menu has rendered. Rows whose id is still unknown are flagged so
     * the UI can disable their toggle until the More menu identifies them.
     */
    function readPanelList() {
      const unpinned = readUnpinned()
      const map = readLabelIdMap()
      const byId = {}
      Object.keys(map).forEach(function (label) {
        const id = map[label]
        if (id && !(id in byId)) byId[id] = label
      })
      const list = []
      function findItem(pred) {
        for (let i = 0; i < list.length; i++) {
          if (pred(list[i])) return list[i]
        }
        return null
      }
      try {
        const nav = findPanelListNav()
        if (nav) {
          findPanelRows(nav).forEach(function (row) {
            const label = (row.getAttribute('aria-label') || row.textContent || '').trim()
            if (label.length === 0) return
            const id = map[label]
            list.push({
              id: id || label,
              label: label,
              pinned: !unpinned.has(id || label),
              idKnown: typeof id === 'string' && id.length > 0,
            })
          })
        }
      } catch (error) {
        /* sidebar not ready */
      }
      Array.from(unpinned).forEach(function (id) {
        const existing = findItem(function (item) {
          return item.id === id
        })
        if (existing) {
          existing.pinned = false
          existing.idKnown = true
          return
        }
        list.push({ id: id, label: byId[id] || id, pinned: false, idKnown: true })
      })
      if (Array.isArray(bridge.entries)) {
        bridge.entries.forEach(function (entry) {
          if (!entry || !entry.id) return
          const existing =
            findItem(function (item) {
              return item.id === entry.id
            }) ||
            findItem(function (item) {
              return !item.idKnown && item.label === entry.label
            })
          if (existing) {
            existing.id = entry.id
            existing.idKnown = true
            if (entry.label) existing.label = entry.label
            existing.pinned = !unpinned.has(entry.id)
          } else {
            list.push({
              id: entry.id,
              label: entry.label || entry.id,
              pinned: !unpinned.has(entry.id),
              idKnown: true,
            })
          }
        })
      }
      return list
    }

    // ------------------------------------------------------------ persisted pins

    function readUnpinned() {
      try {
        const raw = window.localStorage.getItem(STORE_KEY)
        const parsed = raw ? JSON.parse(raw) : null
        const out = new Set()
        if (Array.isArray(parsed)) {
          parsed.forEach(function (id) {
            if (typeof id === 'string' && id.length > 0) out.add(id)
          })
        }
        return out
      } catch (error) {
        return new Set()
      }
    }

    function writeUnpinned(set) {
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(Array.from(set)))
      } catch (error) {
        /* storage unavailable: pins stay session-only */
      }
    }

    // The host's pins are memory-only; we mirror ours into them on mount and
    // whenever the entry list changes (new plugin installed, ids renamed).
    function syncIntoHost(entries, onPinnedChange) {
      if (typeof onPinnedChange !== 'function' || !Array.isArray(entries)) return
      const unpinned = readUnpinned()
      entries.forEach(function (entry) {
        if (!entry || entry.id === 'plugins') return
        const entryPinned = entry.pinned !== false
        const wantPinned = !unpinned.has(entry.id)
        if (entryPinned !== wantPinned) onPinnedChange(entry.id, wantPinned)
      })
    }

    // ---------------------------------------------------------------- row state

    /**
     * Whether the panel ROWS are hidden (collected into the Panels launcher).
     * Defaults to hidden: the original complaint was that the panel rows filled
     * the sidebar and pushed the session history out of view.
     */
    function readRowsHidden() {
      try {
        const raw = window.localStorage.getItem(ROWS_HIDDEN_KEY)
        if (raw === '1') return true
        if (raw === '0') return false
      } catch (error) {
        /* fall through to the default */
      }
      return true
    }

    function writeRowsHidden(value) {
      try {
        window.localStorage.setItem(ROWS_HIDDEN_KEY, value ? '1' : '0')
      } catch (error) {
        /* session-only */
      }
    }

    // ----------------------------------------------------------- compact footer

    /**
     * Whether the compact-footer patch is applied. ON by default: footer
     * plugins (cost meter, pairing QR, …) grow unbounded and squeeze the
     * session history out of view — the same complaint that motivated the
     * panel-row collection above.
     */
    function readTidy() {
      try {
        const raw = window.localStorage.getItem(TIDY_KEY)
        if (raw === '0') return false
        if (raw === '1') return true
      } catch (error) {
        /* fall through to the default */
      }
      return true
    }

    function writeTidy(value) {
      try {
        window.localStorage.setItem(TIDY_KEY, value ? '1' : '0')
      } catch (error) {
        /* session-only */
      }
    }

    // Granular compact-footer sub-toggles. Each gates its own CSS rule group;
    // all groups additionally require the master dpp-tidy class, so turning
    // the master off wins over every sub-toggle.
    function readTidyQr() {
      return readFlag(TIDY_QR_KEY)
    }
    function readTidyBrand() {
      return readFlag(TIDY_BRAND_KEY)
    }
    function readTidyMeter() {
      return readFlag(TIDY_METER_KEY)
    }

    /**
     * Apply (or remove) the `html.dpp-tidy` class that gates the compact-footer
     * CSS block. Toggling a class keeps the stylesheet immutable — no style
     * rewriting, no flicker, and React cannot lose it.
     */
    function applyTidy() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (!root) return
      root.classList.toggle(TIDY_CLASS, readTidy())
      root.classList.toggle(TIDY_QR_CLASS, readTidyQr())
      root.classList.toggle(TIDY_BRAND_CLASS, readTidyBrand())
      root.classList.toggle(TIDY_METER_CLASS, readTidyMeter())
    }

    // ------------------------------------------------------------- theme probe

    /**
     * Best-effort dark-surface detection, used only to pick the OPAQUE base
     * color under the popup menu. Two signals, in order:
     *   1. computed `color-scheme` on <body>/<html> (the host usually sets it);
     *   2. fallback: luminance of the body background color.
     * Never throws; defaults to light.
     */
    function isDarkSurface() {
      try {
        const cs = window.getComputedStyle(document.body).colorScheme ||
          window.getComputedStyle(document.documentElement).colorScheme
        if (cs) return /dark/i.test(cs) && !/light/i.test(cs)
      } catch (error) {
        /* fall through */
      }
      try {
        const bg = window.getComputedStyle(document.body).backgroundColor
        const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(bg)
        if (m) return (Number(m[1]) + Number(m[2]) + Number(m[3])) < 384
      } catch (error) {
        /* fall through */
      }
      return false
    }

    const DARK_CLASS = 'dpp-dark'

    /** Toggle html.dpp-dark so the opaque menu base follows the host theme. */
    function applyTheme() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (!root) return
      root.classList.toggle(DARK_CLASS, isDarkSurface())
    }

    // ------------------------------------------------------------- numeric config

    function clampNum(v, min, max) {
      return Math.min(max, Math.max(min, v))
    }

    /** Read a persisted integer, clamped; falls back to `def` on any problem. */
    function readNum(key, def, min, max) {
      try {
        const raw = window.localStorage.getItem(key)
        const n = raw === null ? NaN : Number(raw)
        if (Number.isFinite(n)) return clampNum(Math.round(n), min, max)
      } catch (error) {
        /* fall through */
      }
      return def
    }

    /** Generic persisted boolean flag, default ON ('0' = off). */
    function readFlag(key) {
      try {
        return window.localStorage.getItem(key) !== '0'
      } catch (error) {
        return true
      }
    }

    function writeFlag(key, value) {
      try {
        window.localStorage.setItem(key, value ? '1' : '0')
      } catch (error) {
        /* session-only */
      }
    }

    function readPanelMax() {
      return readNum(PANEL_MAX_KEY, PANEL_MAX_DEFAULT, 8, 80)
    }

    function readFootMax() {
      return readNum(FOOT_MAX_KEY, FOOT_MAX_DEFAULT, 5, 60)
    }

    function readOverlayMax() {
      return readNum(OVERLAY_MAX_KEY, OVERLAY_MAX_DEFAULT, 30, 90)
    }

    function readQrSize() {
      return readNum(QR_SIZE_KEY, QR_SIZE_DEFAULT, 80, 256)
    }

    function writePanelMax(v) {
      try {
        window.localStorage.setItem(PANEL_MAX_KEY, String(clampNum(Math.round(v), 8, 80)))
      } catch (error) {
        /* session-only */
      }
    }

    function writeFootMax(v) {
      try {
        window.localStorage.setItem(FOOT_MAX_KEY, String(clampNum(Math.round(v), 5, 60)))
      } catch (error) {
        /* session-only */
      }
    }

    function writeOverlayMax(v) {
      try {
        window.localStorage.setItem(OVERLAY_MAX_KEY, String(clampNum(Math.round(v), 30, 90)))
      } catch (error) {
        /* session-only */
      }
    }

    function writeQrSize(v) {
      try {
        window.localStorage.setItem(QR_SIZE_KEY, String(clampNum(Math.round(v), 80, 256)))
      } catch (error) {
        /* session-only */
      }
    }

    // ----------------------------------------------------------------- whitelist

    /** Persisted whitelist: an array of non-empty name strings. */
    function readWhitelist() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(WHITELIST_KEY) || '[]')
        if (Array.isArray(parsed)) {
          return parsed
            .filter(function (n) {
              return typeof n === 'string' && n.trim().length > 0
            })
            .map(function (n) {
              return n.trim()
            })
        }
      } catch (error) {
        /* fall through */
      }
      return []
    }

    function writeWhitelist(list) {
      try {
        window.localStorage.setItem(WHITELIST_KEY, JSON.stringify(list || []))
      } catch (error) {
        /* session-only */
      }
    }

    /** Persisted label→id map (plain object). Missing key → empty object. */
    function readLabelIdMap() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(LABEL_ID_MAP_KEY) || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
      } catch (error) {
        /* fall through */
      }
      return {}
    }

    function mergeLabelIdMap(pairs) {
      try {
        const map = readLabelIdMap()
        let changed = false
        pairs.forEach(function (pair) {
          if (pair && pair.id && pair.label && map[pair.label] !== pair.id) {
            map[pair.label] = pair.id
            changed = true
          }
        })
        if (changed) window.localStorage.setItem(LABEL_ID_MAP_KEY, JSON.stringify(map))
      } catch (error) {
        /* session-only */
      }
    }

    /** Whether an entry label matches the whitelist (case-insensitive contains). */
    /**
     * Whether an entry label is whitelisted. EXACT match (case-insensitive):
     * the picker offers real entry labels, and a "contains" match made
     * 「插件」 also capture 「插件市场」.
     */
    function isWhitelisted(label) {
      const l = String(label || '').trim().toLowerCase()
      if (l.length === 0) return false
      return readWhitelist().some(function (n) {
        return n.toLowerCase() === l
      })
    }

    /**
     * Every selectable sidebar entry label: global panel rows + plugin entry
     * rows (family rows), de-duplicated. This is what the Settings whitelist
     * picker offers — no free-text typing needed.
     */
    function readAvailableEntries() {
      const out = []
      const seen = {}
      function push(label) {
        const l = String(label || '').trim()
        if (l.length === 0) return
        const key = l.toLowerCase()
        if (seen[key]) return
        seen[key] = true
        out.push(l)
      }
      try {
        const nav = findPanelListNav()
        if (nav) {
          findPanelRows(nav).forEach(function (row) {
            push(row.getAttribute('aria-label') || row.textContent)
          })
        }
        findFamilyRows().forEach(function (row) {
          push(rowLabel(row))
        })
      } catch (error) {
        /* sidebar not ready: empty list */
      }
      return out
    }

    /**
     * Push the numeric tunables into CSS custom properties on <html>. The
     * stylesheet reads var(--dpp-panel-list-max) / var(--dpp-foot-max) etc.,
     * so this is the whole "apply" path — no stylesheet rewriting, instant.
     */
    function applyConfig() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (!root || !root.style) return
      try {
        root.style.setProperty('--dpp-panel-list-max', readPanelMax() + 'vh')
        root.style.setProperty('--dpp-foot-max', readFootMax() + 'vh')
        root.style.setProperty('--dpp-overlay-max', readOverlayMax() + 'vh')
        root.style.setProperty('--dpp-qr-size', readQrSize() + 'px')
      } catch (error) {
        /* ignore */
      }
    }

    // ------------------------------------------------------ plugin entry rows

    /**
     * Whether third-party plugin entry rows are collected into the launcher.
     * ON by default: the same complaint as the panel rows — every sidebar
     * plugin injects an entry row and the list grows unbounded.
     */
    function readFamily() {
      try {
        const raw = window.localStorage.getItem(FAMILY_KEY)
        if (raw === '0') return false
        if (raw === '1') return true
      } catch (error) {
        /* fall through to the default */
      }
      return true
    }

    function writeFamily(value) {
      try {
        window.localStorage.setItem(FAMILY_KEY, value ? '1' : '0')
      } catch (error) {
        /* session-only */
      }
    }

    // ------------------------------------------------------------ host DOM lookups

    function findPanelListNav() {
      // css-modules hash agnostic: class is "<hash>_panelList".
      try {
        return document.querySelector('nav[class$="_panelList"]')
      } catch (error) {
        return null
      }
    }

    /** Panel rows = nav button children, minus the More launcher and our launcher. */
    function findPanelRows(nav) {
      if (!nav) return []
      const kids = Array.prototype.slice.call(nav.children)
      const out = []
      for (let i = 0; i < kids.length; i++) {
        const el = kids[i]
        if (!el.getAttribute) continue
        if (el.hasAttribute(LAUNCHER_ATTR)) continue
        if (el.getAttribute('aria-haspopup') === 'menu') continue
        if (el.tagName !== 'BUTTON') continue
        out.push(el)
      }
      return out
    }

    // ------------------------------------------------- family row lookups
    // Structural derivation, zero literal selectors (per weibaohui/
    // dsh-sidebar-tidy v0.1.0): the new-session container is the anchor, the
    // sidebar root is its container that also directly holds the panel-list
    // nav, and family rows are the CLICKABLE root children strictly between
    // the anchor and the nav — direct <button>s or containers wrapping one
    // button (wrapped third-party injections). Bottom/footer entries are
    // never considered: they live outside this span.

    /** The root child that holds the new-session control (or null). */
    function findAnchor(root) {
      if (!root) return null
      try {
        const el = document.querySelector('[class$="_newSession"]')
        if (!el) return null
        let node = el
        for (let i = 0; node && node !== document.body && i < 8; i++) {
          if (node.parentNode === root) return node
          node = node.parentNode
        }
      } catch (error) {
        /* ignore */
      }
      return null
    }

    /** Whether the element triggers something: a button or wraps one. */
    function isClickableRow(el) {
      if (!el || !el.querySelector) return false
      if (el.tagName === 'BUTTON') return true
      if (el.hasAttribute(LAUNCHER_ATTR)) return false
      // A wrapped injection: the container's first meaningful child is a button.
      return el.querySelector(':scope > button') !== null
    }

    /**
     * Family rows = clickable root children strictly between the new-session
     * anchor and the panel-list nav. Returns [] when the structure cannot be
     * derived (anchor or nav missing) — never guess.
     */
    function findFamilyRows() {
      try {
        const nav = findPanelListNav()
        if (!nav || !nav.parentNode) return []
        const root = nav.parentNode
        const anchor = findAnchor(root)
        if (!anchor) return []
        const kids = Array.prototype.slice.call(root.children)
        const ai = kids.indexOf(anchor)
        const ni = kids.indexOf(nav)
        if (ai < 0 || ni < 0 || ni <= ai + 1) return []
        const out = []
        for (let i = ai + 1; i < ni; i++) {
          if (isClickableRow(kids[i])) out.push(kids[i])
        }
        return out
      } catch (error) {
        return []
      }
    }

    /** Click the ORIGINAL control behind a row (unwrap wrapped injections). */
    function triggerRow(row) {
      try {
        const btn = row.tagName === 'BUTTON' ? row : row.querySelector('button')
        if (btn) btn.click()
      } catch (error) {
        /* ignore */
      }
    }

    function rowLabel(row) {
      const btn = row.tagName === 'BUTTON' ? row : row.querySelector('button')
      const el = btn || row
      return ((el.getAttribute && el.getAttribute('aria-label')) || el.textContent || '').trim()
    }

    function rowIcon(row) {
      const btn = row.tagName === 'BUTTON' ? row : row.querySelector('button')
      return svgClone(btn || row, 16)
    }

    /** Apply the persisted family-row visibility (inline display, replayed). */
    function applyFamily() {
      if (typeof document === 'undefined') return
      const hidden = readFamily()
      findFamilyRows().forEach(function (row) {
        // Whitelisted entries stay in the sidebar no matter what.
        const hide = hidden && !isWhitelisted(rowLabel(row))
        row.style.display = hide ? 'none' : ''
        if (hide) row.dataset.dppHidden = '1'
        else delete row.dataset.dppHidden
      })
    }

    const HIDDEN_MARK = 'dppHidden'

    /**
     * Sweep for rows we hid that drifted out of the structural derivation
     * (a plugin re-inserted or moved its entry). Anything still carrying our
     * marker whose label is now whitelisted gets restored — this is what
     * makes toggling a whitelist entry reliable even when the entry moved.
     */
    function restoreWhitelistedEverywhere() {
      if (typeof document === 'undefined') return
      let marked
      try {
        marked = document.querySelectorAll('[data-dpp-hidden="1"]')
      } catch (error) {
        return
      }
      Array.prototype.forEach.call(marked, function (el) {
        const label =
          (el.getAttribute && el.getAttribute('aria-label')) ||
          (el.textContent || '').trim()
        if (isWhitelisted(label)) {
          el.style.display = ''
          delete el.dataset.dppHidden
        }
      })
    }

    // ---------------------------------------------------------------- fold state
    /**
     * Apply the persisted row-visibility state.
     *
     * The host renders the panel rows AND the "More" button (PanelMoreMenu) as
     * children of the same nav (dsh-client-ui-sidebar/lib/client.js:471-500).
     * Hiding the whole nav would hide the More button too — and that button is
     * the only way to unfold again, so the sidebar would lock itself collapsed
     * with no way out. We therefore hide only the panel rows and always keep
     * the More button (and our own launcher) visible.
     */
    function applyFold() {
      if (typeof document === 'undefined') return
      const nav = findPanelListNav()
      if (!nav) return
      const hidden = readRowsHidden()
      const rows = findPanelRows(nav)
      rows.forEach(function (row) {
        // Whitelisted panels stay in the sidebar no matter what.
        const label = (row.getAttribute('aria-label') || row.textContent || '').trim()
        const hide = hidden && !isWhitelisted(label)
        row.style.display = hide ? 'none' : ''
        if (hide) row.dataset.dppHidden = '1'
        else delete row.dataset.dppHidden
      })
    }

    // ---------------------------------------------------------------- scroll css

    const EXTRA_CSS = [
      // Cap the global panel list so many plugin rows cannot squeeze the
      // session-history region below it; let the list scroll instead.
      // NOTE: no scrollbar-width/scrollbar-color here — in Chromium 121+ the
      // standard properties DISABLE ::-webkit-scrollbar styling below.
      '[class$="_panelList"] {',
      '  max-height: var(--dpp-panel-list-max, 20vh);',
      '  overflow-y: auto;',
      '  overflow-x: hidden;',
      '}',
      // Themed thin scrollbars for every area we cap (panel list, capped
      // footer, panels popup). Capsule thumb, transparent track. Colors come
      // from the host's own scrollbar tokens (--dsh-scrollbar-thumb / -hover,
      // which the sidebar root derives from --dsw-alias-scrollbar-*-l2), so
      // they follow the theme and dsh-any-background's palette; the
      // --dpp-scrollbar pair remains only as a last-resort fallback.
      'html { --dpp-scrollbar: rgba(127,127,127,.4); --dpp-scrollbar-hover: rgba(127,127,127,.6); }',
      'html.dpp-dark { --dpp-scrollbar: rgba(255,255,255,.26); --dpp-scrollbar-hover: rgba(255,255,255,.46); }',
      '[class$="_panelList"]::-webkit-scrollbar,',
      'html.dpp-tidy [class*="_footArea"]::-webkit-scrollbar,',
      'html.dpp-tidy .cm-bbox::-webkit-scrollbar,',
      '.dpp-overlay::-webkit-scrollbar {',
      '  width: 7px;',
      '  height: 7px;',
      '}',
      '[class$="_panelList"]::-webkit-scrollbar-track,',
      'html.dpp-tidy [class*="_footArea"]::-webkit-scrollbar-track,',
      'html.dpp-tidy .cm-bbox::-webkit-scrollbar-track,',
      '.dpp-overlay::-webkit-scrollbar-track {',
      '  background: transparent;',
      '}',
      '[class$="_panelList"]::-webkit-scrollbar-thumb,',
      'html.dpp-tidy [class*="_footArea"]::-webkit-scrollbar-thumb,',
      'html.dpp-tidy .cm-bbox::-webkit-scrollbar-thumb,',
      '.dpp-overlay::-webkit-scrollbar-thumb {',
      '  background-color: var(--dsh-scrollbar-thumb, var(--dpp-scrollbar, rgba(127,127,127,.4)));',
      '  border-radius: 8px;',
      '  border: 2px solid transparent;',
      '  background-clip: padding-box;',
      '  min-height: 24px;',
      '  min-width: 24px;',
      '}',
      '[class$="_panelList"]::-webkit-scrollbar-thumb:hover,',
      'html.dpp-tidy [class*="_footArea"]::-webkit-scrollbar-thumb:hover,',
      'html.dpp-tidy .cm-bbox::-webkit-scrollbar-thumb:hover,',
      '.dpp-overlay::-webkit-scrollbar-thumb:hover {',
      '  background-color: var(--dsh-scrollbar-thumb-hover, var(--dpp-scrollbar-hover, rgba(127,127,127,.6)));',
      '  border: 2px solid transparent;',
      '  background-clip: padding-box;',
      '}',
      // Compact footer ("sidebar tidy", ported from @weibaohui/dsh-sidebar-tidy).
      // Gated on html.dpp-tidy so the toggle only flips one class. Host class
      // names are css-modules hashes (_2H3hWW_footArea); the suffix is stable,
      // so the rules match with [class*="_footArea"]. Footer ENTRIES stay in
      // place — only their container gets a height cap and a scrollbar.
      'html.dpp-tidy [class*="_footArea"] {',
      '  max-height: var(--dpp-foot-max, 15vh) !important;',
      '  overflow-y: auto !important;',
      '  overscroll-behavior: contain;',
      '}',
      'html.dpp-tidy.dpp-tidy-qr img[alt*="二维码"], html.dpp-tidy.dpp-tidy-qr img[alt*="QR"] {',
      '  width: var(--dpp-qr-size, 132px) !important;',
      '  height: auto !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-qr [class*="KV--Pq_qr"] {',
      '  width: var(--dpp-qr-size, 132px) !important;',
      '  height: auto !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-qr [class*="KV--Pq_content"] {',
      '  padding: 10px 0 !important;',
      '  gap: 8px !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-brand [class*="_logoRow"] {',
      '  height: 44px !important;',
      '  margin-bottom: 0 !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-brand [class*="_newSession"] {',
      '  margin-bottom: 8px !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-meter .cm-foot {',
      '  height: 26px !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-meter .cm-bbox {',
      '  max-height: 128px;',
      '  overflow-y: auto;',
      '}',
      // Our launcher row: matches the host panel row metrics. `order: -1`
      // pins it to the top of the flex column while keeping it as the LAST
      // DOM child — React only ever appends new rows to the end, so this
      // avoids fighting the host renderer over sibling order.
      // Metrics mirror _2H3hWW_panelRow exactly (margin 0 2px, padding 7px 8px,
      // gap 8px, 16px glyph when wide / 18px in rail) so the label aligns with
      // the host rows' text column — a wider icon pushed it 2px right.
      '.dpp-launcher {',
      '  order: -1;',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  box-sizing: border-box;',
      '  width: calc(100% - 4px);',
      '  min-height: 36px;',
      '  margin: 0 2px;',
      '  padding: 7px 8px;',
      '  border: none;',
      '  border-radius: var(--dsw-radius-md, 8px);',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 14px;',
      '  text-align: left;',
      '  cursor: pointer;',
      '}',
      '.dpp-launcher:hover, .dpp-launcher:focus-visible {',
      '  background-color: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '  outline: none;',
      '}',
      '.dpp-launcher .dpp-icon {',
      '  flex: none;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 16px;',
      '  height: 16px;',
      '  color: var(--dsw-alias-label-secondary, inherit);',
      '}',
      '.dpp-launcher svg { width: 16px; height: 16px; }',
      // Rail mode (collapsed sidebar): host rows switch back to 18px glyphs.
      '.dpp-launcher.dpp-rail .dpp-icon { width: 18px; height: 18px; }',
      '.dpp-launcher.dpp-rail svg { width: 18px; height: 18px; }',
      '.dpp-launcher .dpp-launcher-label {',
      '  flex: 1 1 auto;',
      '  min-width: 0;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      '.dpp-launcher .dpp-launcher-badge {',
      '  flex: none;',
      '  min-width: 16px;',
      '  padding: 0 5px;',
      '  border-radius: 8px;',
      '  font-size: 11px;',
      '  line-height: 16px;',
      '  text-align: center;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  background: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '}',
      '.dpp-launcher .dpp-launcher-badge:empty { display: none; }',
      // Rail mode (collapsed sidebar, 56px): icon only.
      '.dpp-launcher.dpp-rail {',
      '  width: 36px;',
      '  min-width: 36px;',
      '  justify-content: center;',
      '  gap: 0;',
      '  padding: 0;',
      '}',
      '.dpp-launcher.dpp-rail .dpp-launcher-label,',
      '.dpp-launcher.dpp-rail .dpp-launcher-badge { display: none; }',
      // Floating panels menu.
      '.dpp-overlay {',
      '  position: fixed;',
      '  z-index: 2147482000;',
      '  box-sizing: border-box;',
      '  min-width: 220px;',
      '  max-width: 300px;',
      '  max-height: var(--dpp-overlay-max, 60vh);',
      '  overflow: auto;',
      '  padding: 6px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));',
      '  border-radius: 10px;',
      '  /* Theme-inherited menu surface (dsh-any-background compatible): consume',
      '     the SAME tokens the host MenuSurface paints from. The wallpaper /',
      '     card-opacity / menu-blur sliders of dsh-any-background retint this',
      '     surface exactly like host menus — no hardcoded white/dark base. */',
      '  background-color: var(--dsw-menu-surface-fill, var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2, transparent)));',
      '  -webkit-backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(150%));',
      '  backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(150%));',
      '  box-shadow: 0 12px 32px rgba(0,0,0,.35);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font-size: 13px;',
      '  /* Host scrollbar tokens (declared by the sidebar root for its own',
      '     scrollers) re-declared here because this overlay lives on <body>,',
      '     outside that inheritance scope. */',
      '  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2, rgba(127,127,127,.4));',
      '  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2, rgba(127,127,127,.6));',
      '}',
      '.dpp-ov-head {',
      '  padding: 6px 8px 3px;',
      '  font-size: 11px;',
      '  line-height: 16px;',
      '  opacity: .55;',
      '  white-space: nowrap;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '}',
      '.dpp-ov-item {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  width: 100%;',
      '  min-height: 34px;',
      '  padding: 6px 8px;',
      '  border: none;',
      '  border-radius: var(--dsw-radius-md, 8px);',
      '  background: transparent;',
      '  color: inherit;',
      '  font: inherit;',
      '  font-size: 13px;',
      '  text-align: left;',
      '  cursor: pointer;',
      '}',
      '.dpp-ov-item:hover, .dpp-ov-item:focus-visible {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '  outline: none;',
      '}',
      '.dpp-ov-ico {',
      '  flex: none;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 18px;',
      '  height: 18px;',
      '}',
      '.dpp-ov-ico svg { width: 16px; height: 16px; }',
      '.dpp-ov-letter {',
      '  flex: none;',
      '  width: 16px;',
      '  height: 16px;',
      '  border-radius: 50%;',
      '  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.15));',
      '  font-size: 10px;',
      '  line-height: 14px;',
      '  text-align: center;',
      '  opacity: .75;',
      '}',
      '.dpp-ov-lbl {',
      '  flex: 1 1 auto;',
      '  min-width: 0;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      '.dpp-ov-dot {',
      '  flex: none;',
      '  width: 6px;',
      '  height: 6px;',
      '  border-radius: 50%;',
      '  background: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '}',
      '.dpp-ov-foot {',
      '  margin-top: 4px;',
      '  padding-top: 4px;',
      '  border-top: 0.5px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08));',
      '}',
      // Our menu rows: match the host MenuItemButton metrics exactly.
      '.dpp-row {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  width: 100%;',
      '  padding: 0 12px;',
      '  min-height: 32px;',
      '  border: none;',
      '  border-radius: var(--dsw-radius-sm, 6px);',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 13px;',
      '  text-align: left;',
      '  cursor: pointer;',
      '  box-sizing: border-box;',
      '}',
      '.dpp-row:hover, .dpp-row:focus-visible {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '  outline: none;',
      '}',
      '.dpp-row .dpp-icon {',
      '  flex: none;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 16px;',
      '  height: 16px;',
      '  color: var(--dsw-alias-label-secondary, inherit);',
      '}',
      '.dpp-row .dpp-label { min-width: 0; }',
      '.dpp-row .dpp-detail {',
      '  margin-left: auto;',
      '  padding-left: 12px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '  white-space: nowrap;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '}',
      // Settings page section (dpp-set-*): plain host-token styling, no
      // primitives import (see note at item 5 in the header).
      '.dpp-set {',
      '  max-width: 760px;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 12px;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '}',
      '.dpp-set-title { margin: 0; font-size: 18px; font-weight: 600; }',
      '.dpp-set-intro {',
      '  margin: 0;',
      '  font-size: 13px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set-card {',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12));',
      '  border-radius: 10px;',
      '  padding: 2px 14px;',
      '  background: var(--dsw-alias-bg-layer-1, transparent);',
      '}',
      '.dpp-set-row {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 12px;',
      '  min-height: 46px;',
      '}',
      '.dpp-set-row + .dpp-set-row {',
      '  border-top: 0.5px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08));',
      '}',
      '.dpp-set-texts { flex: 1 1 auto; min-width: 0; }',
      '.dpp-set-label { font-size: 13px; }',
      '.dpp-set-detail {',
      '  font-size: 12px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set input[type="range"] {',
      '  flex: none;',
      '  width: 160px;',
      '  accent-color: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '}',
      '.dpp-set-val {',
      '  flex: none;',
      '  min-width: 44px;',
      '  text-align: right;',
      '  font-size: 12px;',
      '  font-variant-numeric: tabular-nums;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set-switch {',
      '  flex: none;',
      '  width: 36px;',
      '  height: 20px;',
      '  box-sizing: border-box;',
      '  border: none;',
      '  border-radius: 10px;',
      '  padding: 0;',
      '  position: relative;',
      '  cursor: pointer;',
      '  background: var(--dsw-alias-border-l2, rgba(127,127,127,.4));',
      '  transition: background .15s ease;',
      '}',
      '.dpp-set-switch::after {',
      '  content: "";',
      '  position: absolute;',
      '  top: 2px;',
      '  left: 2px;',
      '  width: 16px;',
      '  height: 16px;',
      '  border-radius: 50%;',
      '  background: #fff;',
      '  box-shadow: 0 1px 2px rgba(0,0,0,.25);',
      '  transition: transform .15s ease;',
      '}',
      '.dpp-set-switch[data-on="true"] {',
      '  background: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '}',
      '.dpp-set-switch[data-on="true"]::after { transform: translateX(16px); }',
      '.dpp-set-reset {',
      '  align-self: flex-start;',
      '  padding: 6px 14px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,.15));',
      '  border-radius: 8px;',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 13px;',
      '  cursor: pointer;',
      '}',
      '.dpp-set-reset:hover {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '}',
      // Settings dialog: let the LEFT NAV scroll when many plugin sections
      // register. The host .navList already declares overflow-y:auto but its
      // flex chain has no height bound (nav is flex:none, navList has no
      // flex/min-height), so a long rail overflows the panel instead of
      // scrolling. Scoped with :has(.dpp-set) so the rules only apply to the
      // settings dialog that hosts our own section. The panel already declares
      // --dsh-scrollbar-thumb vars, so the thumb follows the theme.
      '[class$="_panel"]:has(.dpp-set) nav[class$="_nav"] {',
      '  min-height: 0;',
      '}',
      '[class$="_panel"]:has(.dpp-set) nav[class$="_nav"] > [class$="_navList"] {',
      '  flex: 1 1 auto;',
      '  min-height: 0;',
      '  overscroll-behavior: contain;',
      '}',
      '[class$="_panel"]:has(.dpp-set) [class$="_navList"]::-webkit-scrollbar {',
      '  width: 7px;',
      '  height: 7px;',
      '}',
      '[class$="_panel"]:has(.dpp-set) [class$="_navList"]::-webkit-scrollbar-track {',
      '  background: transparent;',
      '}',
      '[class$="_panel"]:has(.dpp-set) [class$="_navList"]::-webkit-scrollbar-thumb {',
      '  background-color: var(--dsh-scrollbar-thumb, var(--dpp-scrollbar, rgba(127,127,127,.4)));',
      '  border-radius: 8px;',
      '  border: 2px solid transparent;',
      '  background-clip: padding-box;',
      '  min-height: 24px;',
      '}',
      '.dpp-set-note {',
      '  padding: 6px 0 2px;',
      '  font-size: 12px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set-inputrow {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  padding: 8px 0;',
      '}',
      '.dpp-set-input {',
      '  flex: 1 1 auto;',
      '  min-width: 0;',
      '  box-sizing: border-box;',
      '  height: 30px;',
      '  padding: 4px 10px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));',
      '  border-radius: 8px;',
      '  background: var(--dsw-alias-bg-layer-1, transparent);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 13px;',
      '}',
      '.dpp-set-input:focus-visible {',
      '  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d6bfe));',
      '  outline-offset: 1px;',
      '}',
      '.dpp-set-add {',
      '  flex: none;',
      '  padding: 5px 14px;',
      '  border: none;',
      '  border-radius: 8px;',
      '  background: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '  color: var(--dsw-alias-label-on-business, #fff);',
      '  font: inherit;',
      '  font-size: 13px;',
      '  cursor: pointer;',
      '}',
      '.dpp-set-add:hover { filter: brightness(1.08); }',
      '.dpp-set-chip {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  min-height: 38px;',
      '}',
      '.dpp-set-chip + .dpp-set-chip {',
      '  border-top: 0.5px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08));',
      '}',
      '.dpp-set-x {',
      '  flex: none;',
      '  padding: 4px 10px;',
      '  border: none;',
      '  border-radius: 6px;',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '  font: inherit;',
      '  font-size: 12px;',
      '  cursor: pointer;',
      '}',
      '.dpp-set-x:hover {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '}',
      '.dpp-set-x[disabled] {',
      '  opacity: .45;',
      '  cursor: default;',
      '}',
      '.dpp-set-x[disabled]:hover {',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set-empty {',
      '  padding: 8px 0;',
      '  font-size: 12px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set-subrow { padding-left: 14px; }',
    ].join('\n')

    // ---------------------------------------------------------------- debug

    /**
     * Runtime diagnostics, enabled only with ?dppdebug in the page URL.
     *
     * The host has no DevTools in production builds (F12 is disabled and the
     * CDP ports are closed), so this overlay is the only way to inspect the
     * live sidebar DOM from the outside.
     */
    const DEBUG_ENABLED = (function () {
      try {
        return /[?&]dppdebug\b/.test(window.location.search || '')
      } catch (error) {
        return false
      }
    })()

    function debugText() {
      const nav = findPanelListNav()
      const out = []
      if (!nav) {
        out.push('nav NOT FOUND')
        return out.join('\n')
      }
      const ncs = window.getComputedStyle(nav)
      const nr = nav.getBoundingClientRect()
      out.push(
        'nav rect=' +
          [nr.top, nr.left, nr.width, nr.height].map(Math.round).join(',') +
          ' ovy=' +
          ncs.overflowY +
          ' scrollTop=' +
          nav.scrollTop +
          ' scrollH=' +
          nav.scrollHeight +
          ' clientH=' +
          nav.clientHeight +
          ' fd=' +
          ncs.flexDirection +
          ' wrap=' +
          ncs.flexWrap,
      )
      const l = nav.querySelector('[' + LAUNCHER_ATTR + ']')
      Array.prototype.slice.call(nav.children).forEach(function (el, i) {
        const ecs = window.getComputedStyle(el)
        const er = el.getBoundingClientRect()
        out.push(
          (el === l ? '*' : ' ') +
            i +
            ' ' +
            el.tagName +
            ' inlineOrd=' +
            (el.style && el.style.order ? el.style.order : '-') +
            ' csOrd=' +
            ecs.order +
            ' disp=' +
            ecs.display +
            ' top=' +
            Math.round(er.top) +
            ' h=' +
            Math.round(er.height) +
            ' lbl=' +
            String(el.getAttribute ? el.getAttribute('aria-label') || '' : '').slice(0, 10),
        )
      })
      if (l) {
        const r = l.getBoundingClientRect()
        out.push('launcher rect=' + [r.top, r.left, r.width, r.height].map(Math.round).join(','))
        const cx = Math.round(r.left + r.width / 2)
        const cy = Math.round(r.top + r.height / 2)
        const hit = document.elementFromPoint(cx, cy)
        out.push('hit@' + cx + ',' + cy + '=' + (hit ? hit.tagName + '.' + String(hit.className || '').slice(0, 40) : 'null'))
      }
      out.push('rowsHidden=' + readRowsHidden())
      out.push('tidy=' + readTidy() + ' family=' + readFamily() + ' famRows=' + findFamilyRows().length)
      out.push('dark=' + isDarkSurface())
      out.push('BUILD=' + BUILD)
      const styleTag = document.getElementById(STYLE_ID)
      out.push('styleTag=' + (styleTag ? 'yes len=' + String(styleTag.textContent || '').length : 'NO'))
      const ov = document.querySelector('.dpp-overlay')
      if (ov) {
        const ocs = window.getComputedStyle(ov)
        out.push(
          'overlay bg=' +
            ocs.backgroundColor +
            ' bgImage=' +
            ocs.backgroundImage +
            ' z=' +
            ocs.zIndex +
            ' pos=' +
            ocs.position +
            ' shadow=' +
            ocs.boxShadow.slice(0, 40),
        )
        const v = getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-bg-layer-2')
        out.push('var bg-layer-2=' + String(v))
        const v2 = getComputedStyle(document.documentElement).getPropertyValue('--dsw-elevation-prominent')
        out.push('var elevation=' + String(v2))
        const v3 = getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-border-l2')
        out.push('var border-l2=' + String(v3))
      } else {
        out.push('overlay: not open')
      }
      const keys = []
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i)
          if (k && k.indexOf('dsh-panel-pins') === 0) keys.push(k + '=' + String(window.localStorage.getItem(k)).slice(0, 60))
        }
      } catch (error) {
        /* ignore */
      }
      out.push('ls: ' + keys.join(' | '))
      return out.join('\n')
    }

    function updateDebug() {
      if (typeof document === 'undefined') return
      // The window title is a cheap, always-on status channel: production
      // builds have no DevTools, so this is the only externally readable
      // signal of what the plugin believes about the live sidebar.
      try {
        const nav = findPanelListNav()
        document.title =
          'dpp ' +
          BUILD +
          ' hidden=' +
          readRowsHidden() +
          ' rows=' +
          (nav ? findPanelRows(nav).length : -1) +
          ' kids=' +
          (nav ? nav.children.length : -1)
      } catch (error) {
        /* ignore */
      }
      if (!DEBUG_ENABLED) return
      let box = document.getElementById('dsh-panel-pins-debug')
      if (!box) {
        box = document.createElement('pre')
        box.id = 'dsh-panel-pins-debug'
        box.style.cssText =
          'position:fixed;left:8px;bottom:8px;z-index:2147483000;margin:0;max-width:560px;max-height:46vh;overflow:auto;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.86);color:#d8f7d0;font:11px/1.45 Consolas,monospace;white-space:pre-wrap;word-break:break-all;'
        document.body.appendChild(box)
      }
      box.textContent = debugText()
    }

    function injectStyle() {
      if (typeof document === 'undefined') return
      if (document.getElementById(STYLE_ID)) return
      const tag = document.createElement('style')
      tag.id = STYLE_ID
      tag.dataset.plugin = 'dsh-panel-pins'
      tag.dataset.pluginCss = 'dsh-panel-pins/panellist'
      tag.textContent = EXTRA_CSS
      document.head.appendChild(tag)
    }

    // ---------------------------------------------------------------- svg icons

    /** Fluent-style 20x20 stroke icon rendered inline (16px display). */
    function SvgIcon({ d, filled }) {
      return h(
        'span',
        { className: 'dpp-icon', 'aria-hidden': 'true' },
        h(
          'svg',
          {
            width: 16,
            height: 16,
            viewBox: '0 0 20 20',
            fill: filled ? 'currentColor' : 'none',
            stroke: 'currentColor',
            strokeWidth: 1.4,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          h('path', { d }),
        ),
      )
    }

    // Fluent-ish pin: head + stem, matching the host pin metaphor.
    const ICON_PIN =
      'M10.5 2.8c.2-.2.5-.2.7 0l2.5 2.5c.2.2.2.5 0 .7l-.4.4.6 3 2.4 2.4c.2.2.2.5 0 .7l-.7.7-3.4-1.1-3.1 3.1c-.3.3-.8.3-1.1 0L5.6 12.8 3 15.4'
    const ICON_PIN_ALT =
      'M10.5 2.8c.2-.2.5-.2.7 0l2.5 2.5c.2.2.2.5 0 .7l-.4.4.6 3 2.4 2.4c.2.2.2.5 0 .7l-.7.7-3.4-1.1-3.1 3.1c-.3.3-.8.3-1.1 0L5.6 12.8 3 15.4M13 7.5 7.5 13'
    const ICON_CHEVRON_UP = 'M5 12.2 10 7.2l5 5'
    const ICON_CHEVRON_DOWN = 'M5 7.8l5 5 5-5'
    const ICON_GRID =
      'M4 4.5h4.2v4.2H4zM11.8 4.5H16v4.2h-4.2zM4 11.3h4.2v4.2H4zM11.8 11.3H16v4.2h-4.2z'
    // Compact: two arrows pointing at each other vertically.
    const ICON_COMPACT =
      'M6.5 7.2 10 3.7l3.5 3.5M6.5 12.8 10 16.3l3.5-3.5M10 4.5v11'
    // Stack: three rows, like a list of plugin entries.
    const ICON_STACK =
      'M4 5h12M4 10h12M4 15h8'

    // ---------------------------------------------------------------- launcher

    let overlay = null
    let overlayCleanup = null

    function closeOverlay() {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay)
      overlay = null
      if (overlayCleanup) {
        try {
          overlayCleanup()
        } catch (error) {
          /* ignore */
        }
        overlayCleanup = null
      }
    }

    function svgClone(node, size) {
      try {
        const svg = node && node.querySelector ? node.querySelector('svg') : null
        if (!svg) return null
        const copy = svg.cloneNode(true)
        copy.setAttribute('width', String(size || 16))
        copy.setAttribute('height', String(size || 16))
        return copy
      } catch (error) {
        return null
      }
    }

    function letterBadge(label) {
      const span = document.createElement('span')
      span.className = 'dpp-ov-letter'
      const first = String(label || '').trim().charAt(0)
      span.textContent = (first || '?').toUpperCase()
      return span
    }

    /** Build the floating menu that lists every panel and plugin entry. */
    function openOverlay(launcher) {
      closeOverlay()
      const nav = findPanelListNav()
      if (!nav || !launcher) return
      // Whitelisted entries are visible in the sidebar already — not listed.
      const rows = findPanelRows(nav).filter(function (row) {
        return !isWhitelisted((row.getAttribute('aria-label') || row.textContent || '').trim())
      })
      const famRows = findFamilyRows().filter(function (row) {
        return !isWhitelisted(rowLabel(row))
      })
      if (rows.length === 0 && famRows.length === 0) return

      const box = document.createElement('div')
      box.className = 'dpp-overlay'
      box.setAttribute('role', 'menu')
      box.dataset.plugin = 'dsh-panel-pins'

      const head = document.createElement('div')
      head.className = 'dpp-ov-head'
      head.textContent = LABEL.groupPanels + ' · ' + rows.length
      box.appendChild(head)

      rows.forEach(function (row) {
        const label = (row.getAttribute('aria-label') || row.textContent || '').trim() || LABEL.unnamed
        const item = document.createElement('button')
        item.type = 'button'
        item.className = 'dpp-ov-item'
        item.setAttribute('role', 'menuitem')

        const ico = document.createElement('span')
        ico.className = 'dpp-ov-ico'
        const svg = svgClone(row, 16)
        if (svg) ico.appendChild(svg)
        else ico.appendChild(letterBadge(label))
        item.appendChild(ico)

        const lbl = document.createElement('span')
        lbl.className = 'dpp-ov-lbl'
        lbl.textContent = label
        item.appendChild(lbl)

        if (row.getAttribute('aria-current') === 'page') {
          const dot = document.createElement('span')
          dot.className = 'dpp-ov-dot'
          item.appendChild(dot)
        }

        item.addEventListener('click', function () {
          closeOverlay()
          try {
            row.click()
          } catch (error) {
            /* ignore */
          }
        })
        box.appendChild(item)
      })

      // Plugin entry rows (family rows), grouped separately. Clicking an item
      // fires the ORIGINAL control; bottom entries are never listed here.
      // (Rows stay listed even while collected/hidden — that's where to find
      // them: hidden ≠ gone.)
      if (famRows.length > 0) {
        const famHead = document.createElement('div')
        famHead.className = 'dpp-ov-head'
        famHead.textContent = LABEL.groupFamily + ' · ' + famRows.length
        box.appendChild(famHead)
        famRows.forEach(function (row) {
          const label = rowLabel(row) || LABEL.unnamed
          const item = document.createElement('button')
          item.type = 'button'
          item.className = 'dpp-ov-item'
          item.setAttribute('role', 'menuitem')

          const ico = document.createElement('span')
          ico.className = 'dpp-ov-ico'
          const svg = rowIcon(row)
          if (svg) ico.appendChild(svg)
          else ico.appendChild(letterBadge(label))
          item.appendChild(ico)

          const lbl = document.createElement('span')
          lbl.className = 'dpp-ov-lbl'
          lbl.textContent = label
          item.appendChild(lbl)

          const btn = row.tagName === 'BUTTON' ? row : row.querySelector('button')
          if (btn && btn.getAttribute('aria-current') === 'page') {
            const dot = document.createElement('span')
            dot.className = 'dpp-ov-dot'
            item.appendChild(dot)
          }

          item.addEventListener('click', function () {
            closeOverlay()
            triggerRow(row)
          })
          box.appendChild(item)
        })
      }

      const foot = document.createElement('button')
      foot.type = 'button'
      foot.className = 'dpp-ov-item dpp-ov-foot'
      foot.setAttribute('role', 'menuitem')
      const footIco = document.createElement('span')
      footIco.className = 'dpp-ov-ico'
      foot.appendChild(footIco)
      const footLbl = document.createElement('span')
      footLbl.className = 'dpp-ov-lbl'
      footLbl.textContent = readRowsHidden() ? LABEL.showRows : LABEL.hideRows
      foot.appendChild(footLbl)
      foot.addEventListener('click', function () {
        closeOverlay()
        writeRowsHidden(!readRowsHidden())
        applyFold()
        ensureLauncher()
      })
      box.appendChild(foot)

      // Plugin-rows toggle: fold/unfold the third-party entry rows between
      // the new-session anchor and the panel list. Bottom entries stay put.
      const fam = document.createElement('button')
      fam.type = 'button'
      fam.className = 'dpp-ov-item'
      fam.setAttribute('role', 'menuitem')
      const famIco = document.createElement('span')
      famIco.className = 'dpp-ov-ico'
      const famSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      famSvg.setAttribute('width', '16')
      famSvg.setAttribute('height', '16')
      famSvg.setAttribute('viewBox', '0 0 20 20')
      famSvg.setAttribute('fill', 'none')
      famSvg.setAttribute('stroke', 'currentColor')
      famSvg.setAttribute('stroke-width', '1.4')
      famSvg.setAttribute('stroke-linecap', 'round')
      famSvg.setAttribute('stroke-linejoin', 'round')
      const famPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      famPath.setAttribute('d', ICON_STACK)
      famSvg.appendChild(famPath)
      famIco.appendChild(famSvg)
      fam.appendChild(famIco)
      const famLbl = document.createElement('span')
      famLbl.className = 'dpp-ov-lbl'
      famLbl.textContent = readFamily() ? LABEL.familyOff : LABEL.familyOn
      fam.appendChild(famLbl)
      fam.addEventListener('click', function () {
        closeOverlay()
        writeFamily(!readFamily())
        applyFamily()
      })
      box.appendChild(fam)

      // Compact-footer toggle. Only the container is capped/scrolled — the
      // footer entries themselves never move into this menu.
      const tidy = document.createElement('button')
      tidy.type = 'button'
      tidy.className = 'dpp-ov-item'
      tidy.setAttribute('role', 'menuitem')
      const tidyIco = document.createElement('span')
      tidyIco.className = 'dpp-ov-ico'
      const tidySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      tidySvg.setAttribute('width', '16')
      tidySvg.setAttribute('height', '16')
      tidySvg.setAttribute('viewBox', '0 0 20 20')
      tidySvg.setAttribute('fill', 'none')
      tidySvg.setAttribute('stroke', 'currentColor')
      tidySvg.setAttribute('stroke-width', '1.4')
      tidySvg.setAttribute('stroke-linecap', 'round')
      tidySvg.setAttribute('stroke-linejoin', 'round')
      const tidyPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      tidyPath.setAttribute('d', ICON_COMPACT)
      tidySvg.appendChild(tidyPath)
      tidyIco.appendChild(tidySvg)
      tidy.appendChild(tidyIco)
      const tidyLbl = document.createElement('span')
      tidyLbl.className = 'dpp-ov-lbl'
      tidyLbl.textContent = readTidy() ? LABEL.tidyOn : LABEL.tidyOff
      tidy.appendChild(tidyLbl)
      tidy.addEventListener('click', function () {
        closeOverlay()
        writeTidy(!readTidy())
        applyTidy()
      })
      box.appendChild(tidy)

      document.body.appendChild(box)
      overlay = box
      positionOverlay(launcher)

      const onDown = function (event) {
        if (!overlay) return
        const target = event.target
        if (overlay.contains(target)) return
        if (launcher && launcher.contains(target)) return
        closeOverlay()
      }
      const onKey = function (event) {
        if (event && event.key === 'Escape') closeOverlay()
      }
      document.addEventListener('pointerdown', onDown, true)
      document.addEventListener('keydown', onKey, true)
      overlayCleanup = function () {
        document.removeEventListener('pointerdown', onDown, true)
        document.removeEventListener('keydown', onKey, true)
      }
    }

    function positionOverlay(launcher) {
      if (!overlay || !launcher) return
      const rect = launcher.getBoundingClientRect()
      overlay.style.visibility = 'hidden'
      const pw = overlay.offsetWidth
      const ph = overlay.offsetHeight
      const vw = window.innerWidth || 1280
      const vh = window.innerHeight || 800
      let top = rect.bottom + 6
      if (top + ph > vh - 8) top = Math.max(8, rect.top - ph - 6)
      let left = rect.left
      if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8)
      overlay.style.left = left + 'px'
      overlay.style.top = top + 'px'
      overlay.style.visibility = ''
    }

    /**
     * Create (or refresh) the launcher row inside the panel list nav.
     *
     * It is appended as the LAST DOM child and pulled to the top with CSS
     * `order: -1`. Appending (rather than inserting first) is deliberate: the
     * host renderer appends new panel rows at the end of the nav, so an
     * appended foreign node keeps a stable relative position and never causes
     * the host to reorder or drop one of its own rows.
     */
    function ensureLauncher() {
      if (typeof document === 'undefined') return null
      const nav = findPanelListNav()
      if (!nav) return null
      let launcher = nav.querySelector('[' + LAUNCHER_ATTR + ']')
      if (!launcher) {
        launcher = document.createElement('button')
        launcher.type = 'button'
        launcher.setAttribute(LAUNCHER_ATTR, '')
        launcher.className = 'dpp-launcher'
        launcher.setAttribute('aria-haspopup', 'menu')
        launcher.setAttribute('aria-label', LABEL.panelsMenu)
        const glyph = document.createElement('span')
        glyph.className = 'dpp-icon'
        glyph.setAttribute('aria-hidden', 'true')
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('width', '18')
        svg.setAttribute('height', '18')
        svg.setAttribute('viewBox', '0 0 20 20')
        svg.setAttribute('fill', 'none')
        svg.setAttribute('stroke', 'currentColor')
        svg.setAttribute('stroke-width', '1.4')
        svg.setAttribute('stroke-linejoin', 'round')
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', ICON_GRID)
        svg.appendChild(path)
        glyph.appendChild(svg)
        launcher.appendChild(glyph)
        const text = document.createElement('span')
        text.className = 'dpp-launcher-label'
        text.textContent = LABEL.panels
        launcher.appendChild(text)
        const badge = document.createElement('span')
        badge.className = 'dpp-launcher-badge'
        launcher.appendChild(badge)
        launcher.addEventListener('click', function (event) {
          event.stopPropagation()
          if (overlay) closeOverlay()
          else openOverlay(launcher)
        })
        nav.appendChild(launcher)
      }
      // Keep the badge in sync with the live row count and the rail mode.
      // The badge advertises EVERYTHING the menu holds — global panel rows
      // AND collected plugin entry rows — so nothing is silently "lost".
      // Whitelisted entries stay in the sidebar and don't count.
      const rows = findPanelRows(nav).filter(function (row) {
        return !isWhitelisted((row.getAttribute('aria-label') || row.textContent || '').trim())
      })
      const famCount = findFamilyRows().filter(function (row) {
        return !isWhitelisted(rowLabel(row))
      }).length
      const badge = launcher.querySelector('.dpp-launcher-badge')
      const total = rows.length + famCount
      if (badge) badge.textContent = total > 0 ? String(total) : ''
      if (badge) badge.setAttribute('aria-label', LABEL.panels + ' ' + rows.length + ' · ' + LABEL.groupFamily + ' ' + famCount)
      const rail = nav.getBoundingClientRect().width < 120
      launcher.classList.toggle('dpp-rail', rail)
      return launcher
    }

    // ---------------------------------------------------------------- menu rows

    function PinMenuRows({ entries, onOpen, onPinnedChange, onDismiss }) {
      const [hidden, setHidden] = React.useState(readRowsHidden())

      React.useEffect(function () {
        bridge.entries = Array.isArray(entries) ? entries : []
        bridge.onPinnedChange = onPinnedChange
        try {
          // Seed the persisted label→id map so the Settings pin manager works
          // even before this slot (the More menu) renders on a fresh session.
          if (Array.isArray(entries) && entries.length > 0) {
            mergeLabelIdMap(
              entries.map(function (entry) {
                return { id: entry && entry.id, label: entry && entry.label }
              }),
            )
          }
        } catch (error) {
          /* ignore */
        }
        syncIntoHost(entries, onPinnedChange)
      }, [entries, onPinnedChange])

      const toggleFold = function () {
        const next = !readRowsHidden()
        writeRowsHidden(next)
        applyFold()
        ensureLauncher()
        setHidden(next)
        try {
          if (typeof onDismiss === 'function') onDismiss()
        } catch (error) {
          /* ignore */
        }
      }

      const [tidy, setTidy] = React.useState(readTidy())
      const toggleTidy = function () {
        const next = !readTidy()
        writeTidy(next)
        applyTidy()
        setTidy(next)
        try {
          if (typeof onDismiss === 'function') onDismiss()
        } catch (error) {
          /* ignore */
        }
      }

      const [family, setFamily] = React.useState(readFamily())
      const toggleFamily = function () {
        const next = !readFamily()
        writeFamily(next)
        applyFamily()
        setFamily(next)
        try {
          if (typeof onDismiss === 'function') onDismiss()
        } catch (error) {
          /* ignore */
        }
      }

      const list = Array.isArray(entries) ? entries : []
      const rows = list.filter(function (entry) {
        return entry && entry.id !== 'plugins'
      })

      return h(
        React.Fragment,
        null,
        h(
          MenuRow,
          {
            key: '__fold__',
            icon: h(SvgIcon, { d: hidden ? ICON_CHEVRON_DOWN : ICON_CHEVRON_UP }),
            label: hidden ? LABEL.unfold : LABEL.fold,
            onSelect: toggleFold,
          },
        ),
        h(
          MenuRow,
          {
            key: '__tidy__',
            icon: h(SvgIcon, { d: ICON_COMPACT }),
            label: tidy ? LABEL.tidyOn : LABEL.tidyOff,
            detail: tidy ? 'ON' : 'OFF',
            onSelect: toggleTidy,
          },
        ),
        h(
          MenuRow,
          {
            key: '__family__',
            icon: h(SvgIcon, { d: ICON_STACK }),
            label: family ? LABEL.familyOff : LABEL.familyOn,
            detail: family ? 'ON' : 'OFF',
            onSelect: toggleFamily,
          },
        ),
        rows.map(function (entry) {
          const pinned = entry.pinned !== false
          return h(MenuRow, {
            key: entry.id,
            icon: h(SvgIcon, { d: pinned ? ICON_PIN : ICON_PIN_ALT }),
            label: pinned ? LABEL.unpin : LABEL.pin,
            detail: entry.label,
            onSelect: function () {
              const unpinned = readUnpinned()
              if (pinned) unpinned.add(entry.id)
              else unpinned.delete(entry.id)
              writeUnpinned(unpinned)
              try {
                if (typeof onDismiss === 'function') onDismiss()
              } catch (error) {
                /* ignore */
              }
              try {
                onPinnedChange(entry.id, !pinned)
              } catch (error) {
                /* ignore */
              }
            },
          })
        }),
      )
    }

    /**
     * One menu row. Markup mirrors the host's MenuItemButton (icon column +
     * label + trailing detail) and its hover/selected treatment comes from the
     * injected stylesheet, so it stays theme-aware without any primitive import.
     */
    function MenuRow({ icon, label, detail, onSelect }) {
      return h(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          className: 'dpp-row',
          onClick: onSelect,
        },
        icon,
        h('span', { className: 'dpp-label' }, label),
        detail ? h('span', { className: 'dpp-detail' }, detail) : null,
      )
    }

    // ------------------------------------------------------------ settings page

    /** Host-style switch, pure CSS (`.dpp-set-switch`), no primitives import. */
    function SettingsSwitch({ on, onToggle, label }) {
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': !!on,
        'aria-label': label,
        className: 'dpp-set-switch',
        'data-on': on ? 'true' : 'false',
        onClick: onToggle,
      })
    }

    /** One "label + range slider + value" row; onChange fires per input event. */
    function SettingsSliderRow({ label, value, min, max, onChange, unit }) {
      return h(
        'div',
        { className: 'dpp-set-row' },
        h('span', { className: 'dpp-set-label' }, label),
        h('input', {
          type: 'range',
          min: min,
          max: max,
          step: 1,
          value: value,
          'aria-label': label,
          onInput: function (event) {
            const n = Number(event.target.value)
            if (Number.isFinite(n)) onChange(n)
          },
        }),
        h('span', { className: 'dpp-set-val' }, value + (unit || '')),
      )
    }

    /**
     * The Settings page section body. Registered into `settings.section`
     * (same contract as the official ui-settings-* packages): the host shows
     * it as its own column in the Settings navigation. Every control writes
     * straight to localStorage and re-applies live.
     */
    function PanelPinsSettingsSection() {
      const [rowsHid, setRowsHid] = React.useState(readRowsHidden())
      const [family, setFamily] = React.useState(readFamily())
      const [tidy, setTidy] = React.useState(readTidy())
      const [tidyQr, setTidyQr] = React.useState(readTidyQr())
      const [tidyBrand, setTidyBrand] = React.useState(readTidyBrand())
      const [tidyMeter, setTidyMeter] = React.useState(readTidyMeter())
      const [panelMax, setPanelMax] = React.useState(readPanelMax())
      const [footMax, setFootMax] = React.useState(readFootMax())
      const [overlayMax, setOverlayMax] = React.useState(readOverlayMax())
      const [qrSize, setQrSize] = React.useState(readQrSize())
      const [whitelist, setWhitelist] = React.useState(readWhitelist())
      const [available] = React.useState(readAvailableEntries())
      const [panelList, setPanelList] = React.useState(readPanelList())

      function refreshAfterWhitelist() {
        restoreWhitelistedEverywhere()
        applyFold()
        applyFamily()
        ensureLauncher()
      }
      function toggleRows() {
        const next = !readRowsHidden()
        writeRowsHidden(next)
        applyFold()
        ensureLauncher()
        setRowsHid(next)
      }
      function toggleFamily() {
        const next = !readFamily()
        writeFamily(next)
        applyFamily()
        ensureLauncher()
        setFamily(next)
      }
      function toggleTidy() {
        const next = !readTidy()
        writeTidy(next)
        applyTidy()
        setTidy(next)
      }
      function toggleTidyQr() {
        const next = !readTidyQr()
        writeFlag(TIDY_QR_KEY, next)
        applyTidy()
        setTidyQr(next)
      }
      function toggleTidyBrand() {
        const next = !readTidyBrand()
        writeFlag(TIDY_BRAND_KEY, next)
        applyTidy()
        setTidyBrand(next)
      }
      function toggleTidyMeter() {
        const next = !readTidyMeter()
        writeFlag(TIDY_METER_KEY, next)
        applyTidy()
        setTidyMeter(next)
      }
      function changePanelMax(v) {
        writePanelMax(v)
        applyConfig()
        setPanelMax(v)
      }
      function changeFootMax(v) {
        writeFootMax(v)
        applyConfig()
        setFootMax(v)
      }
      function changeOverlayMax(v) {
        writeOverlayMax(v)
        applyConfig()
        setOverlayMax(v)
      }
      function changeQrSize(v) {
        writeQrSize(v)
        applyConfig()
        setQrSize(v)
      }
      function toggleWhitelistEntry(label) {
        const list = readWhitelist()
        const l = label.toLowerCase()
        const idx = list.findIndex(function (n) {
          return n.toLowerCase() === l
        })
        if (idx >= 0) list.splice(idx, 1)
        else list.push(label)
        writeWhitelist(list)
        setWhitelist(list)
        refreshAfterWhitelist()
      }
      function togglePin(id, currentlyPinned) {
        const unpinned = readUnpinned()
        if (currentlyPinned) unpinned.add(id)
        else unpinned.delete(id)
        writeUnpinned(unpinned)
        try {
          if (typeof bridge.onPinnedChange === 'function') bridge.onPinnedChange(id, !currentlyPinned)
        } catch (error) {
          /* host callback absent: the store still holds the state */
        }
        setPanelList(readPanelList())
      }
      function reset() {
        writeRowsHidden(true)
        writeFamily(true)
        writeTidy(true)
        writeFlag(TIDY_QR_KEY, true)
        writeFlag(TIDY_BRAND_KEY, true)
        writeFlag(TIDY_METER_KEY, true)
        writePanelMax(PANEL_MAX_DEFAULT)
        writeFootMax(FOOT_MAX_DEFAULT)
        writeOverlayMax(OVERLAY_MAX_DEFAULT)
        writeQrSize(QR_SIZE_DEFAULT)
        writeWhitelist([])
        applyFold()
        ensureLauncher()
        applyFamily()
        applyTidy()
        applyConfig()
        setRowsHid(true)
        setFamily(true)
        setTidy(true)
        setTidyQr(true)
        setTidyBrand(true)
        setTidyMeter(true)
        setPanelMax(PANEL_MAX_DEFAULT)
        setFootMax(FOOT_MAX_DEFAULT)
        setOverlayMax(OVERLAY_MAX_DEFAULT)
        setQrSize(QR_SIZE_DEFAULT)
        setWhitelist([])
        setPanelList(readPanelList())
      }

      function switchRow(label, detail, on, onToggle, extraClass) {
        return h(
          'div',
          { className: 'dpp-set-row' + (extraClass ? ' ' + extraClass : '') },
          h(
            'div',
            { className: 'dpp-set-texts' },
            h('div', { className: 'dpp-set-label' }, label),
            detail ? h('div', { className: 'dpp-set-detail' }, detail) : null,
          ),
          h(SettingsSwitch, { on: on, onToggle: onToggle, label: label }),
        )
      }

      return h(
        'div',
        { className: 'dpp-set' },
        h('h2', { className: 'dpp-set-title' }, LABEL.setTitle),
        h('p', { className: 'dpp-set-intro' }, LABEL.setIntro),
        h(
          'div',
          { className: 'dpp-set-card' },
          switchRow(LABEL.setRows, LABEL.setRowsDetail, rowsHid, toggleRows),
          switchRow(LABEL.setFamily, LABEL.setFamilyDetail, family, toggleFamily),
          switchRow(LABEL.setTidy, LABEL.setTidyDetail, tidy, toggleTidy),
        ),
        h(
          'div',
          { className: 'dpp-set-card' },
          h('div', { className: 'dpp-set-note' }, LABEL.setSubNote),
          switchRow(LABEL.setSubQr, null, tidyQr, toggleTidyQr, 'dpp-set-subrow'),
          switchRow(LABEL.setSubBrand, null, tidyBrand, toggleTidyBrand, 'dpp-set-subrow'),
          switchRow(LABEL.setSubMeter, null, tidyMeter, toggleTidyMeter, 'dpp-set-subrow'),
        ),
        h(
          'div',
          { className: 'dpp-set-card' },
          h(SettingsSliderRow, {
            label: LABEL.setPanelMax,
            value: panelMax,
            min: 8,
            max: 60,
            onChange: changePanelMax,
            unit: 'vh',
          }),
          h(SettingsSliderRow, {
            label: LABEL.setFootMax,
            value: footMax,
            min: 5,
            max: 40,
            onChange: changeFootMax,
            unit: 'vh',
          }),
          h(SettingsSliderRow, {
            label: LABEL.setOverlayMax,
            value: overlayMax,
            min: 30,
            max: 90,
            onChange: changeOverlayMax,
            unit: 'vh',
          }),
          h(SettingsSliderRow, {
            label: LABEL.setQrSize,
            value: qrSize,
            min: 80,
            max: 256,
            onChange: changeQrSize,
            unit: 'px',
          }),
        ),
        h(
          'div',
          { className: 'dpp-set-card' },
          h(
            'div',
            { className: 'dpp-set-row' },
            h(
              'div',
              { className: 'dpp-set-texts' },
              h('div', { className: 'dpp-set-label' }, LABEL.setWhitelist),
              h('div', { className: 'dpp-set-detail' }, LABEL.setWhitelistDetail),
            ),
          ),
          available.length === 0
            ? h('div', { className: 'dpp-set-empty' }, LABEL.setPickEmpty)
            : available.map(function (label) {
                return switchRow(
                  label,
                  null,
                  isWhitelisted(label),
                  function () {
                    toggleWhitelistEntry(label)
                  },
                  'dpp-set-subrow',
                )
              }),
        ),
        h(
          'div',
          { className: 'dpp-set-card' },
          h(
            'div',
            { className: 'dpp-set-row' },
            h(
              'div',
              { className: 'dpp-set-texts' },
              h('div', { className: 'dpp-set-label' }, LABEL.setPinManage),
              h('div', { className: 'dpp-set-detail' }, LABEL.setPinManageDetail),
            ),
          ),
          panelList.length === 0
            ? h('div', { className: 'dpp-set-empty' }, LABEL.setPinEmpty)
            : panelList.map(function (panel) {
                return h(
                  'div',
                  { className: 'dpp-set-chip', key: panel.id },
                  h('span', { className: 'dpp-set-label' }, panel.label),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x',
                      disabled: !panel.idKnown,
                      title: panel.idKnown ? undefined : LABEL.setPinNeedMenu,
                      onClick: function () {
                        togglePin(panel.id, panel.pinned)
                      },
                    },
                    panel.pinned ? LABEL.setPinUnpin : LABEL.setPinRestore,
                  ),
                )
              }),
        ),
        h('button', { type: 'button', className: 'dpp-set-reset', onClick: reset }, LABEL.setReset),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject(SLOT, function () {
          return ctx.slots.register({ name: SLOT, id: SLOT_ID, order: 900 }, PinMenuRows)
        })
        // Settings page column (see header item 8). The label thunk avoids
        // any locale-service dependency; copy inside the section uses the
        // plugin's own zh/en LABEL dict.
        ctx.slots.inject('settings.section', function () {
          return ctx.slots.register(
            {
              name: 'settings.section',
              id: SLOT_ID,
              order: 90,
              label: function () {
                return zh ? '面板收纳' : 'Panel Pins'
              },
            },
            PanelPinsSettingsSection,
          )
        })
        // Style + row visibility + launcher live outside React: a stylesheet
        // tag, a visibility toggle on the panel rows, and one launcher button.
        // Re-apply periodically in case React replaces the nav node.
        if (typeof document !== 'undefined') {
          injectStyle()
          applyConfig()
          applyTheme()
          applyTidy()
          applyFamily()
          applyFold()
          ensureLauncher()
          updateDebug()
          setInterval(function () {
            injectStyle()
            applyConfig()
            applyTheme()
            applyTidy()
            restoreWhitelistedEverywhere()
            applyFamily()
            applyFold()
            ensureLauncher()
            updateDebug()
          }, 1500)
        }
      },
    }
  },
})
