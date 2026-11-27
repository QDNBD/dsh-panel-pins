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

    // ------------------------------------------------------------ top pins

    /** Persisted top pins: ordered [{id, label?}] entries (top order = array order).
     * v0.7.4 stored bare id strings; those normalize to {id, label: null}. */
    function readTopPins() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(TOP_KEY) || '[]')
        if (!Array.isArray(parsed)) return []
        return parsed
          .map(function (item) {
            if (typeof item === 'string' && item.length > 0) return { id: item, label: null }
            if (item && typeof item.id === 'string' && item.id.length > 0) {
              return {
                id: item.id,
                label: typeof item.label === 'string' && item.label.length > 0 ? item.label : null,
              }
            }
            return null
          })
          .filter(function (e) {
            return e !== null
          })
      } catch (error) {
        return []
      }
    }

    function writeTopPins(list) {
      try {
        window.localStorage.setItem(TOP_KEY, JSON.stringify(list))
      } catch (error) {
        /* storage unavailable: top pins stay session-only */
      }
    }

    /** Toggle `id` in the top-pin list; returns whether it is now top-pinned.
     * `label` is stored alongside so row matching does not depend on the
     * label→id map (which can lag behind locale changes). */
    function toggleTopPinStore(id, label) {
      const list = readTopPins()
      const idx = list.findIndex(function (e) {
        return e.id === id
      })
      if (idx >= 0) list.splice(idx, 1)
      else list.push({ id: id, label: label || null })
      writeTopPins(list)
      return idx < 0
    }

    /**
     * Match a sidebar row (by its aria-label) against the top-pin list.
     * Direct stored-label hit first, then id equivalence via the map (covers
     * rows whose aria-label is the raw panel id when locale resolution lags).
     * Returns the index in the top-pin order, or -1.
     */
    function topPinIndexFor(label, map, topPins) {
      for (let i = 0; i < topPins.length; i++) {
        const entry = topPins[i]
        if (entry.label && entry.label === label) return i
        if (map[label] && map[label] === entry.id) return i
        if (entry.id === label) return i
      }
      return -1
    }

    // The host's pins are memory-only; we mirror ours into them on mount and
    // whenever the entry list changes (new plugin installed, ids renamed).
    // ------------------------------------------------------- native pin mirror
    // v1.7 (dual-source convergence, scheme "host wins on interaction"): since
    // DSH 0.2.2-rc.5 the host ships its own native pin controls on the sidebar
    // panel rows (SidebarRoot.tsx `css.panelUnpin`, hashed to `*_panelUnpin`)
    // plus a pin action in the More menu (entry-customization). The host's pin
    // store is memory-only (panel-pins.ts, reset on reload), so our persisted
    // set remains the only durable copy. With native controls present we stop
    // rendering our own pin/unpin menu rows and turn this store into a pure
    // mirror: first mount of a session restores the persisted intent (the
    // host just forgot it), and every later sync RECORDS the host's state
    // instead of pushing ours — a native unpin can no longer be resurrected.
    // Without native controls (older hosts) everything behaves exactly as
    // before: our rows render and syncIntoHost pushes on every mount.
    const NATIVE_PIN_SELECTOR = 'button[class$="_panelUnpin"]'

    // Session latches. nativePinSeen never unsets (a host update removing the
    // controls resets it on the next renderer reload); mirrorArmed is reset by
    // full-state writers (import / layout presets) so the next mount restores
    // the freshly written store instead of mirroring the stale host state.
    let nativePinSeen = false
    let mirrorArmed = false

    function probeNativePinControls() {
      try {
        return !!document.querySelector(NATIVE_PIN_SELECTOR)
      } catch (error) {
        return false
      }
    }

    /**
     * Host wins: reconcile our persisted set with the host's current pin
     * flags. Only called once the mirror is armed — a host-side change at
     * this point can only come from the user acting on the native controls
     * (or our own settings page, which pushes and then re-matches here).
     */
    function mirrorFromHost(entries) {
      if (!Array.isArray(entries)) return
      let changed = false
      const set = readUnpinned()
      entries.forEach(function (entry) {
        if (!entry || !entry.id || entry.id === 'plugins') return
        const hostPinned = entry.pinned !== false
        if (!hostPinned && !set.has(entry.id)) {
          set.add(entry.id)
          changed = true
        } else if (hostPinned && set.has(entry.id)) {
          set.delete(entry.id)
          changed = true
        }
      })
      if (changed) writeUnpinned(set)
    }

    /**
     * First mount of a session (mirror not armed yet): adopt unpinned ids the
     * host knows but we don't (a native unpin that happened before our slot
     * ever mounted), then restore the persisted intent — the host's memory
     * store resets on every restart, so a "host says pinned, we say unpinned"
     * mismatch at first mount means the host forgot, not that the user pinned.
     */
    function mirrorAdoptAndRestore(entries, onPinnedChange) {
      if (typeof onPinnedChange !== 'function' || !Array.isArray(entries)) return
      const set = readUnpinned()
      entries.forEach(function (entry) {
        if (!entry || !entry.id || entry.id === 'plugins') return
        if (entry.pinned === false && !set.has(entry.id)) set.add(entry.id)
      })
      writeUnpinned(set)
      entries.forEach(function (entry) {
        if (!entry || !entry.id || entry.id === 'plugins') return
        const entryPinned = entry.pinned !== false
        const wantPinned = !set.has(entry.id)
        if (entryPinned !== wantPinned) {
          try {
            onPinnedChange(entry.id, wantPinned)
          } catch (error) {
            /* host refused: keep our intent for the next mount */
          }
        }
      })
    }

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

    // ------------------------------------------------------- icon-only rows

    function readIconOnly() {
      return readFlag(ICONONLY_KEY)
    }

    /** Apply the html.dpp-icononly gate: panel rows collapse to glyphs. */
    function applyIconOnly() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (!root) return
      root.classList.toggle(ICONONLY_CLASS, readIconOnly())
    }

    // ------------------------------------------------------------- theme probe

    /**
     * The host's own color scheme, when we know it ('light' | 'dark'; '' = unknown).
     *
     * v1.6.0: the host applies its palette by writing THREE attributes — and
     * none of them is a class on <html>:
     *   documentElement.style.colorScheme       (dsh-client-ui-layout/src/client/theme-presenter.ts:71)
     *   documentElement[data-ds-theme-source]   (:72-73)
     *   body[data-ds-dark-theme]                 (:75-76)
     * The old class-only MutationObserver could never see those, so a theme
     * switch only reached us through the 5s fallback sweep. The host publishes
     * the same information as a public event ('theme/change', ui-theme
     * src/client/index.ts:144/438) and as a service (ctx.provide('theme'),
     * :609) whose snapshot carries `active.colorScheme` — read that instead
     * and keep the DOM probe only as the fallback for hosts without it.
     */
    let hostColorScheme = ''

    /** Read the host's current color scheme out of the theme service, if any. */
    function readThemeServiceScheme() {
      try {
        const theme = optionalService('theme')
        if (!theme) return ''
        const snapshot = typeof theme.getTheme === 'function' ? theme.getTheme() : null
        if (!snapshot) return ''
        const active = snapshot.active || snapshot
        const scheme = active && (active.colorScheme || active.scheme)
        if (scheme === 'dark' || scheme === 'light') return scheme
      } catch (error) {
        /* service absent on this host build */
      }
      return ''
    }

    /**
     * The host's color scheme, read from the DOM attributes the host
     * ACTUALLY writes. '' when it wrote none of them.
     *
     * The runtime palette application writes
     *   <html>[data-ds-theme-source]  ('dark' | 'light' | 'system')
     *   <html>.style.colorScheme
     *   <body>[data-ds-dark-theme]    (present only when the RESOLVED scheme
     *                                   is dark)
     * (dsh-client-ui-layout/src/client/theme-presenter.ts:69-76). With the
     * 'system' preference the resolved scheme still decides, and it decides
     * through the body attribute — so that attribute is authoritative in
     * every case, while `data-ds-theme-source` only speaks for the explicit
     * choices.
     */
    function readDomColorScheme() {
      try {
        const root = document.documentElement
        const body = document.body
        if (!root || !body) return ''
        const source = root.getAttribute('data-ds-theme-source')
        if (source === 'dark' || source === 'light') return source
        if (body.hasAttribute('data-ds-dark-theme')) return 'dark'
        if (source === 'system') return 'light'
      } catch (error) {
        /* fall through */
      }
      return ''
    }

    /**
     * The host's RESOLVED color scheme, read LIVE from the signals the host's
     * own theme presenter writes. Never cached.
     *
     * The presenter (dsh-client-ui-layout/src/client/theme-presenter.ts:69-76)
     * writes the RESOLVED scheme to
     *   <html>.style.colorScheme / getComputedStyle(<html>).colorScheme
     *   <html>[data-ds-theme-source]  (the resolved scheme, or 'system')
     *   <body>[data-ds-dark-theme]    (present only when it resolved to dark)
     * so those are the authoritative "what is actually on screen" signals.
     *
     * The theme SERVICE is deliberately the LAST resort, not the primary: a
     * third-party custom theme (e.g. a wallpaper plugin registering its own
     * 'custom-color' theme) can make theme.getTheme().active.colorScheme
     * disagree with the palette in use, and caching that value shadows the
     * live signals — which is exactly how the plugin stayed light while the
     * host had already gone dark.
     *
     * '' when the host wrote none of them.
     */
    function readHostSchemeLive() {
      try {
        const root = document.documentElement
        if (!root) return ''
        const inline = root.style && root.style.colorScheme
        if (inline === 'dark' || inline === 'light') return inline
        // <html>, NOT <body>: a body-level color-scheme declaration does not
        // inherit, so reading body reports 'light' inside a dark palette.
        const cs = window.getComputedStyle(root).colorScheme
        if (cs === 'dark' || cs === 'light') return cs
      } catch (error) {
        /* fall through */
      }
      return readDomColorScheme()
    }

    /**
     * Best-effort dark-surface detection, used only to pick the OPAQUE base
     * color under the popup menu. Four signals, in order:
     *   1. the host's own resolved scheme (live, from its presenter);
     *   2. the theme service's answer (fallback for hosts with no presenter);
     *   3. computed `color-scheme` on <html>;
     *   4. fallback: luminance of the body background color.
     * Never throws; defaults to light.
     */
    function isDarkSurface() {
      // 1. the host's own resolved scheme — read live, never cached: the host
      //    REMOVES body[data-ds-dark-theme] when it switches back to light, and
      //    a cached answer would keep the popup dark.
      const live = readHostSchemeLive()
      if (live === 'dark') return true
      if (live === 'light') return false
      // 2. the theme service (a third-party custom theme may not match the
      //    palette in use, so this is a fallback, not the primary)
      if (hostColorScheme === 'dark') return true
      if (hostColorScheme === 'light') return false
      // 3. computed `color-scheme` on <html>
      try {
        const cs = window.getComputedStyle(document.documentElement).colorScheme
        if (cs) return /dark/i.test(cs) && !/light/i.test(cs)
      } catch (error) {
        /* fall through */
      }
      // 4. fallback: luminance of the body background color
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

    /**
     * The MutationObserver constructor to use.
     *
     * The bare global is correct in a browser, but a plugin that runs inside
     * another window's realm (the jsdom regression harness, or any host that
     * evaluates us in a sandbox) has no global MutationObserver — `new
     * MutationObserver` would throw ReferenceError and the observer would
     * silently never exist. Prefer the window we were handed.
     */
    function mutationObserverFor(callback) {
      try {
        if (typeof window !== 'undefined' && typeof window.MutationObserver === 'function') {
          return new window.MutationObserver(callback)
        }
      } catch (error) {
        /* fall through to the global */
      }
      try {
        if (typeof MutationObserver === 'function') return new MutationObserver(callback)
      } catch (error) {
        /* no observer available at all */
      }
      return null
    }

    /** Toggle html.dpp-dark so the opaque menu base follows the host theme. */
    function applyTheme() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (!root) return
      // The theme service may be provided a tick after our fiber starts, so
      // re-read it on every pass. Only the SERVICE answer is cached: the DOM
      // attributes are read live inside isDarkSurface(), because the host
      // removes them when it switches back.
      const service = readThemeServiceScheme()
      if (service) hostColorScheme = service
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

    // Cache for the parsed whitelist (invalidated on every write path):
    // isWhitelisted() runs per row per refresh pass, and re-parsing the whole
    // JSON array per row multiplied that cost for no benefit.
    let whitelistCache = null

    /** Persisted whitelist: an array of non-empty name strings. */
    function readWhitelist() {
      // Cached: isWhitelisted() runs per row per refresh tick, and parsing the
      // whole JSON array for every row multiplied that cost. The cache is
      // invalidated on every write path, so it cannot go stale.
      if (whitelistCache) return whitelistCache
      try {
        const parsed = JSON.parse(window.localStorage.getItem(WHITELIST_KEY) || '[]')
        if (Array.isArray(parsed)) {
          whitelistCache = parsed
            .filter(function (n) {
              return typeof n === 'string' && n.trim().length > 0
            })
            .map(function (n) {
              return n.trim()
            })
          return whitelistCache
        }
      } catch (error) {
        /* fall through */
      }
      whitelistCache = []
      return whitelistCache
    }

    function writeWhitelist(list) {
      whitelistCache = null
      try {
        window.localStorage.setItem(WHITELIST_KEY, JSON.stringify(list || []))
      } catch (error) {
        /* session-only */
      }
    }

    /** Persisted label→id map (plain object). Missing key → empty object. */
    // Cached like the whitelist: isWhitelisted(label, id) reads it per row
    // per pass; invalidated on every write path.
    let labelIdMapCache = null
    function readLabelIdMap() {
      if (labelIdMapCache) return labelIdMapCache
      try {
        const parsed = JSON.parse(window.localStorage.getItem(LABEL_ID_MAP_KEY) || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          labelIdMapCache = parsed
          return labelIdMapCache
        }
      } catch (error) {
        /* fall through */
      }
      labelIdMapCache = {}
      return labelIdMapCache
    }

    function mergeLabelIdMap(pairs) {
      try {
        const map = readLabelIdMap()
        let changed = false
        pairs.forEach(function (pair) {
          if (pair && pair.id && pair.label) {
            // b67: keep ONE current label per id — after a locale switch the
            // stale-label key would linger and id-first lookups (hidden/
            // renames) would resolve to a dead string.
            Object.keys(map).forEach(function (label) {
              if (label !== pair.label && map[label] === pair.id) {
                delete map[label]
                changed = true
              }
            })
            if (map[pair.label] !== pair.id) {
              map[pair.label] = pair.id
              changed = true
            }
          }
        })
        if (changed) {
          window.localStorage.setItem(LABEL_ID_MAP_KEY, JSON.stringify(map))
          labelIdMapCache = null // keep the isWhitelisted fast path honest
        }
      } catch (error) {
        /* session-only */
      }
    }

    // ------------------------------------------------------- layout presets

    /**
     * Snapshot the whole panel layout (v1.0.0). Captured state:
     * unpinned store, top pins, overlay group folds, whitelist, icon-only,
     * compact-footer master. NOT captured: numeric sliders (they are visual
     * tuning, not layout identity) and the Recent queue (behavioral, not
     * spatial) — the same trade layout-organizer makes for its presets.
     */
    function captureLayoutSnapshot() {
      return {
        unpinned: Array.from(readUnpinned()),
        topPins: readTopPins(),
        folds: readGroupFolds(),
        whitelist: readWhitelist(),
        iconOnly: readFlag(ICONONLY_KEY),
        tidy: readTidy(),
      }
    }

    /**
     * Apply a snapshot atomically: write every captured key, invalidate the
     * caches, re-run every applier, and let the refresh pass replay the
     * sidebar rows. Rows whose id the snapshot mentions but the host no
     * longer shows simply match nothing (no error, no residue).
     */
    function applyLayoutSnapshot(snap) {
      if (!snap || typeof snap !== 'object') return
      try {
        writeUnpinned(new Set(Array.isArray(snap.unpinned) ? snap.unpinned : []))
        // v1.7: this wrote a full new pin intent — disarm the mirror so the
        // next slot mount RESTORES it to the host instead of recording the
        // host's stale state over it.
        mirrorArmed = false
        writeTopPins(Array.isArray(snap.topPins) ? snap.topPins : [])
        writeGroupFolds(snap.folds && typeof snap.folds === 'object' ? snap.folds : {})
        writeWhitelist(Array.isArray(snap.whitelist) ? snap.whitelist : [])
        writeFlag(ICONONLY_KEY, snap.iconOnly !== false)
        writeTidy(snap.tidy !== false)
        // Caches + every applier, mirroring importSettings' replay list.
        whitelistCache = null
        labelIdMapCache = null
        applyConfig()
        applyTidy()
        applyIconOnly()
        restoreWhitelistedEverywhere()
        applyFold()
        applyFamily()
        applyTopPins()
        ensureLauncher()
        // If a menu is open, close it: the next open rebuilds from scratch and
        // replays the snapshot's fold states (replayGroupFolds is an openOverlay
        // closure, unreachable from here — closing is the clean replay path).
        try {
          if (overlay) closeOverlay()
        } catch (error) {
          /* ignore */
        }
      } catch (error) {
        /* preset application is cosmetic: never break the host */
      }
    }

    function readPresets() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(PRESETS_KEY) || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
      } catch (error) {
        /* fall through */
      }
      return {}
    }

    function writePresets(obj) {
      try {
        window.localStorage.setItem(PRESETS_KEY, JSON.stringify(obj || {}))
      } catch (error) {
        /* session-only */
      }
    }

    function savePreset(name) {
      const n = String(name || '').trim()
      if (!n) return false
      const presets = readPresets()
      presets[n] = captureLayoutSnapshot()
      writePresets(presets)
      try {
        window.localStorage.setItem(PRESET_NAME_KEY, n)
      } catch (error) {
        /* active-marker is cosmetic */
      }
      return true
    }

    function applyPreset(name) {
      const presets = readPresets()
      const snap = presets[name]
      if (!snap) return false
      applyLayoutSnapshot(snap)
      try {
        window.localStorage.setItem(PRESET_NAME_KEY, String(name))
      } catch (error) {
        /* active-marker is cosmetic */
      }
      return true
    }

    function deletePreset(name) {
      const presets = readPresets()
      if (!(name in presets)) return false
      delete presets[name]
      writePresets(presets)
      try {
        if (window.localStorage.getItem(PRESET_NAME_KEY) === name) {
          window.localStorage.removeItem(PRESET_NAME_KEY)
        }
      } catch (error) {
        /* ignore */
      }
      return true
    }

    function readActivePreset() {
      try {
        return window.localStorage.getItem(PRESET_NAME_KEY) || ''
      } catch (error) {
        return ''
      }
    }

    // ------------------------------------------------------- custom groups

    /** {groupId: {name, labels:[...]}} — labels are panel aria-labels. */
    function readCustomGroups() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_GROUPS_KEY) || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
      } catch (error) {
        /* fall through */
      }
      return {}
    }

    function writeCustomGroups(obj) {
      try {
        window.localStorage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify(obj || {}))
      } catch (error) {
        /* session-only */
      }
    }

    /** Labels already assigned to SOME custom group (set-like object). */
    function customGroupedLabels() {
      const groups = readCustomGroups()
      const assigned = {}
      Object.keys(groups).forEach(function (gid) {
        const labels = groups[gid] && groups[gid].labels
        if (!Array.isArray(labels)) return
        labels.forEach(function (l) {
          if (typeof l === 'string' && l.length > 0) assigned[l] = true
        })
      })
      return assigned
    }


    /**
     * Whether an entry is whitelisted. Entries are stored id-FIRST since
     * v0.8.0 (stable across UI-language switches); entries written by older
     * builds are plain labels, still matched case-insensitively-exact. A
     * legacy label entry that now maps to `id` in the label→id map also
     * matches — so a whitelist kept in Chinese keeps working after switching
     * the UI to English, and vice versa. Pass both label and id whenever the
     * id is known; label-only callers (arbitrary DOM sweep) still work.
     */
    function isWhitelisted(label, id) {
      const l = String(label || '').trim().toLowerCase()
      if (l.length === 0 && !id) return false
      const list = readWhitelist()
      const map = id ? readLabelIdMap() : null
      for (let i = 0; i < list.length; i++) {
        const entry = list[i]
        if (id && entry === id) return true
        if (l.length > 0 && entry.toLowerCase() === l) return true
        if (id && map[entry] === id) return true
      }
      return false
    }

    /**
     * Every selectable sidebar entry: {label, id|null}. Global panel rows
     * resolve id via the persisted label→id map; plugin entry (family) rows
     * have no panel id — they stay label-keyed. De-duplicated by label. This
     * is what the Settings whitelist picker offers — no free-text typing.
     */
    function readAvailableEntries() {
      const out = []
      const seen = {}
      function push(label, id) {
        const l = String(label || '').trim()
        if (l.length === 0) return
        const key = l.toLowerCase()
        if (seen[key]) return
        seen[key] = true
        out.push({ label: l, id: id || null })
      }
      try {
        const map = readLabelIdMap()
        const nav = findPanelListNav()
        if (nav) {
          findPanelRows(nav).forEach(function (row) {
            const l = (row.getAttribute('aria-label') || row.textContent || '').trim()
            push(l, map[l])
          })
        }
        findFamilyRows().concat(findFooterRows()).forEach(function (row) {
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

    // ---------------------------------------------------- settings transfer
    // v1.2.0: clipboard and file export/import share one dump builder and one
    // replay chain. Lives at factory scope so it works before the Settings
    // component ever renders; the Settings section wraps these with a React
    // state refresh. A window.__dppTransfer hook exposes the closures for the
    // jsdom regression (React is stubbed there, so the component never runs).

    function buildDump() {
      // Every plugin-owned localStorage key as one JSON blob. Restores are
      // full-value (no merging): import replaces.
      const dump = { __plugin: 'dsh-panel-pins', __version: VERSION }
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key && key.indexOf('dsh-panel-pins:') === 0) {
          dump[key] = window.localStorage.getItem(key)
        }
      }
      return JSON.stringify(dump, null, 2)
    }

    // ------------------------------------------------------------- feedback
    // v1.3.3: click-triggered feedback channels. No timers, no network calls
    // of our own — window.open happens synchronously inside the click handler
    // (async-opened popups are blocked by the webview), everything else is
    // string building around data the page already has.

    function hostClientVersion() {
      try {
        const v = window.__DSH_CLIENT_VERSION__
        if (typeof v === 'string' && v.length > 0) return v
      } catch (error) {
        /* ignore */
      }
      return 'unknown'
    }

    function clientLanguage() {
      try {
        const lang = document.documentElement && document.documentElement.lang
        if (lang) return String(lang)
      } catch (error) {
        /* fall through */
      }
      try {
        return (navigator && navigator.language) || 'unknown'
      } catch (error) {
        return 'unknown'
      }
    }

    /**
     * One paragraph of environment facts for the issue body / diagnostics
     * copy. Deliberately minimal and user-deletable: plugin version, host
     * version, UA, language. NEVER includes session content, panel labels,
     * renames or any localStorage values — those stay manual-only (the dump
     * the user may paste contains labels, so copying it is the user's call).
     */
    function feedbackEnvBody() {
      const lines = [
        '### ' + LABEL.fbEnvTitle,
        '- dsh-panel-pins v' + VERSION,
        '- DSH: ' + hostClientVersion(),
        '- Platform: ' + (typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : 'unknown'),
        '- Language: ' + clientLanguage(),
      ]
      return lines.join('\n')
    }

    function openFeedbackIssue() {
      try {
        const url = new URL(FEEDBACK_ISSUE_URL)
        url.searchParams.set('title', '[feedback] v' + VERSION)
        url.searchParams.set('body', feedbackEnvBody() + '\n\n### ' + LABEL.fbProblem + '\n\n\n### ' + LABEL.fbSteps + '\n\n')
        window.open(url.href, '_blank', 'noopener,noreferrer')
      } catch (error) {
        /* URL constructor or open failed — degrade silently */
      }
    }

    function readSurveyConfig() {
      try {
        const config = window.__DSH_CONTACT_CONFIG__
        if (config && typeof config === 'object' && typeof config.contactFormUrl === 'string' && /^https:\/\//.test(config.contactFormUrl)) {
          return config
        }
      } catch (error) {
        /* ignore */
      }
      return null
    }

    function openFeedbackSurvey() {
      try {
        // The plugin owner's own form (see FEEDBACK_SURVEY_URL note). The
        // shell's contactSource is attribution context only — never the
        // destination.
        const config = readSurveyConfig()
        const url = new URL(FEEDBACK_SURVEY_URL)
        // Host questionnaire contract (panel-layout precedent): hidden fields
        // are declared with hide_<name>=1 and carried with prefill_<name>.
        url.searchParams.set('hide_source', '1')
        const source = config && typeof config.contactSource === 'string' ? config.contactSource : ''
        url.searchParams.set('prefill_source', 'dsh-panel-pins' + (source ? '/' + source : ''))
        url.searchParams.set('hide_device_info', '1')
        let ratio = 1
        let sw = 0
        let sh = 0
        try {
          ratio = window.devicePixelRatio && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1
          sw = Math.round((window.screen && window.screen.width) * ratio)
          sh = Math.round((window.screen && window.screen.height) * ratio)
        } catch (error) {
          /* ignore */
        }
        const device = [typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '']
        if (sw > 0 && sh > 0) device.push('screen_resolution=' + sw + 'x' + sh)
        url.searchParams.set('prefill_device_info', device.filter(Boolean).join('; '))
        window.open(url.href, '_blank', 'noopener,noreferrer')
      } catch (error) {
        /* degrade silently */
      }
    }

    function copyFeedbackDiagnostics() {
      // The full settings dump + the environment block. Clipboard-write only;
      // if the webview refuses, say so — never fall back to pasting anywhere.
      let text = ''
      try {
        text = buildDump() + '\n\n' + feedbackEnvBody()
      } catch (error) {
        showToast(LABEL.fbDiagFail)
        return
      }
      const fail = function () {
        showToast(LABEL.fbDiagFail)
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          Promise.resolve(navigator.clipboard.writeText(text)).then(
            function () {
              showToast(LABEL.fbDiagDone)
            },
            fail,
          )
          return
        }
      } catch (error) {
        /* fall through to the textarea fallback */
      }
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        let ok = false
        try {
          ok = document.execCommand('copy')
        } catch (error) {
          ok = false
        }
        document.body.removeChild(ta)
        if (ok) showToast(LABEL.fbDiagDone)
        else fail()
      } catch (error) {
        fail()
      }
    }


    function exportSettingsToClipboard() {
      try {
        const json = buildDump()
        const write = function (text) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text)
          }
          // Fallback: hidden textarea + execCommand (older webviews).
          const ta = document.createElement('textarea')
          ta.value = text
          ta.style.position = 'fixed'
          ta.style.opacity = '0'
          document.body.appendChild(ta)
          ta.select()
          try {
            document.execCommand('copy')
          } catch (error) {
            /* ignore */
          }
          document.body.removeChild(ta)
          return Promise.resolve()
        }
        Promise.resolve(write(json)).then(
          function () {
            showToast(LABEL.setExportDone)
          },
          function () {
            showToast(zh ? '复制失败：剪贴板不可用' : 'Copy failed: clipboard unavailable')
          },
        )
      } catch (error) {
        showToast(zh ? '导出失败' : 'Export failed')
      }
    }

    function exportSettingsToFile() {
      // Download the dump as a JSON file (a real file survives machine swaps
      // better than a clipboard buffer).
      let json = null
      try {
        json = buildDump()
      } catch (error) {
        showToast(zh ? '导出失败' : 'Export failed')
        return
      }
      try {
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'dsh-panel-pins-settings.json'
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.setTimeout(function () {
          URL.revokeObjectURL(url)
        }, 4000)
        showToast(LABEL.setExportDone)
      } catch (error) {
        showToast(LABEL.setExportFileFail)
      }
    }

    function applyImportedDumpShared(dump) {
      // Write every key back, invalidate every cache, re-apply everything.
      // Returns true on success; callers own toasts and the Settings state
      // refresh (see applyImportedDump in the Settings section).
      try {
        Object.keys(dump).forEach(function (key) {
          if (key.indexOf('dsh-panel-pins:') !== 0) return
          const value = dump[key]
          if (typeof value === 'string') window.localStorage.setItem(key, value)
        })
        // v1.7: an import overwrites the whole unpinned store — disarm the
        // mirror so the next slot mount restores the imported intent to the
        // host (see applyLayoutSnapshot).
        mirrorArmed = false
        whitelistCache = null
        labelIdMapCache = null
        applyConfig()
        applyTidy()
        applyIconOnly()
        applyTheme()
        applyFold()
        applyFamily()
        applyTopPins()
        ensureLauncher()
        restoreWhitelistedEverywhere()
        applyFold()
        applyFamily()
        ensureLauncher()
        return true
      } catch (error) {
        return false
      }
    }

    function importSettingsFromClipboard() {
      // Read the clipboard, validate against the __plugin sentinel, replay.
      const read = navigator.clipboard && navigator.clipboard.readText
        ? navigator.clipboard.readText()
        : Promise.reject(new Error('no clipboard api'))
      Promise.resolve(read).then(
        function (text) {
          let dump = null
          try {
            dump = JSON.parse(String(text || ''))
          } catch (error) {
            dump = null
          }
          if (!dump || dump.__plugin !== 'dsh-panel-pins' || typeof dump !== 'object') {
            showToast(LABEL.setImportBad)
            return
          }
          if (applyImportedDumpShared(dump)) {
            showToast(LABEL.setImportDone)
          } else {
            showToast(zh ? '导入失败' : 'Import failed')
          }
        },
        function () {
          showToast(zh ? '无法读取剪贴板：请手动复制后重试' : 'Cannot read clipboard — copy again and retry')
        },
      )
    }

    function importSettingsFromText(text, sourceLabel) {
      // Shared validation + replay for every text-bearing import channel
      // (clipboard / file / drag-drop). sourceLabel picks the rejection toast.
      let dump = null
      try {
        dump = JSON.parse(String(text || ''))
      } catch (error) {
        dump = null
      }
      if (!dump || dump.__plugin !== 'dsh-panel-pins' || typeof dump !== 'object') {
        showToast(sourceLabel === 'file' ? LABEL.setImportFileBad : LABEL.setImportBad)
        return false
      }
      if (applyImportedDumpShared(dump)) {
        showToast(sourceLabel === 'file' ? LABEL.setImportFileDone : LABEL.setImportDone)
        return true
      }
      showToast(zh ? '导入失败' : 'Import failed')
      return false
    }

    function importSettingsFromFile() {
      // Pick a previously exported settings JSON file. A one-shot
      // <input type="file"> is appended to the body on demand; the change
      // handler validates and re-applies, and a cancel (no change event)
      // leaves nothing behind — a 120s safety net removes it anyway.
      let input = null
      try {
        input = document.createElement('input')
        input.type = 'file'
        input.accept = 'application/json,.json'
        input.style.display = 'none'
        let done = false
        input.addEventListener('change', function () {
          done = true
          const file = input.files && input.files[0]
          if (!file) {
            document.body.removeChild(input)
            return
          }
          const reader = new FileReader()
          reader.onload = function () {
            try {
              document.body.removeChild(input)
            } catch (error) {
              /* already detached */
            }
            importSettingsFromText(String(reader.result || ''), 'file')
          }
          reader.onerror = function () {
            try {
              document.body.removeChild(input)
            } catch (error) {
              /* already detached */
            }
            showToast(zh ? '导入失败' : 'Import failed')
          }
          try {
            reader.readAsText(file)
          } catch (error) {
            showToast(zh ? '导入失败' : 'Import failed')
          }
        })
        document.body.appendChild(input)
        window.setTimeout(function () {
          if (!done && input && input.parentNode) document.body.removeChild(input)
        }, 120000)
        input.click()
      } catch (error) {
        if (input && input.parentNode) {
          try {
            document.body.removeChild(input)
          } catch (cleanupError) {
            /* ignore */
          }
        }
        showToast(zh ? '导入失败' : 'Import failed')
      }
    }

    // Test hook: the jsdom regression drives these closures directly (React
    // is stubbed there, so the Settings section never renders).
    try {
      window.__dppTransfer = {
        buildDump: buildDump,
        exportSettingsFile: exportSettingsToFile,
        importSettingsFile: importSettingsFromFile,
        importSettingsFromText: importSettingsFromText,
        applyImportedDump: applyImportedDumpShared,
      }
    } catch (error) {
      /* non-window context */
    }

    // v1.3.3 test hook: the jsdom regression drives the feedback closures
    // directly (React is stubbed, the Settings card never renders; window.open
    // and clipboard.writeText are stubbed per-test).
    try {
      window.__dppFeedback = {
        feedbackEnvBody: feedbackEnvBody,
        openFeedbackIssue: openFeedbackIssue,
        openFeedbackSurvey: openFeedbackSurvey,
        copyFeedbackDiagnostics: copyFeedbackDiagnostics,
        hostClientVersion: hostClientVersion,
        readSurveyConfig: readSurveyConfig,
      }
    } catch (error) {
      /* non-window context */
    }

