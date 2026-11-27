    // ------------------------------------------------------- locale plumbing
    // v1.6.0. `LABEL` is rebuilt IN PLACE, so the object identity never
    // changes and every existing LABEL.x reference keeps working untouched.
    // The settings section subscribes so an open settings page repaints in the
    // new language instead of waiting for a remount; the launcher button and
    // the overlay/context menus are rebuilt from LABEL on open anyway.

    const localeSubscribers = []

    /** Subscribe to UI-language changes; returns an unsubscribe function. */
    function onLocaleChange(listener) {
      if (typeof listener !== 'function') return function () {}
      localeSubscribers.push(listener)
      return function () {
        const index = localeSubscribers.indexOf(listener)
        if (index >= 0) localeSubscribers.splice(index, 1)
      }
    }

    /**
     * Re-evaluate the UI language and repaint everything that cached it.
     * A no-op when the effective language did not move, so it is safe to call
     * on every host locale notification.
     */
    function refreshLocale() {
      const next = detectChinese()
      if (next === zh) return false
      zh = next
      const nextLabels = buildLabels()
      for (const key of Object.keys(LABEL)) delete LABEL[key]
      Object.assign(LABEL, nextLabels)
      repaintLauncherLabels()
      for (const listener of localeSubscribers.slice()) {
        try {
          listener()
        } catch (error) {
          /* one bad listener must not block the rest */
        }
      }
      applyConfig()
      applyTheme()
      return true
    }

    /** The launcher button caches its label at creation time; refresh it. */
    function repaintLauncherLabels() {
      if (typeof document === 'undefined') return
      try {
        const launcher = document.querySelector('[' + LAUNCHER_ATTR + ']')
        if (!launcher) return
        launcher.setAttribute('aria-label', LABEL.panelsMenu)
        const text = launcher.querySelector('.dpp-launcher-label')
        if (text) text.textContent = LABEL.panels
      } catch (error) {
        /* the launcher may not be mounted yet */
      }
    }

    // Bridge between the React slot component (which knows panel ids and pin
    // state) and the DOM launcher (which knows the live panel rows). The slot
    // component refreshes `bridge` on every render.
    const bridge = {
      entries: [],
      onPinnedChange: null,
    }

    // Live ctx.slots handle (captured in apply) — used to seed the label→id
    // map from the authoritative sidebar.panellist slot.
    let ctxSlots = null

    // Live ctx handle (v1.3.2, captured in apply) — lets the DOM layer read
    // optional services (layout) without declaring them in inject. Reading an
    // undeclared service throws on some cordis versions, so every access goes
    // through optionalService() below; absence degrades to "no exemption".
    let ctxRef = null

    /**
     * Cordis service access that tolerates absence. `ctx.get(name)` throws
     * for an undeclared service on some cords versions and returns undefined
     * on others (dsh-panellist src/client/service.ts documents both); never
     * declare optional services in `inject` — a missing declared service
     * parks the fiber and the plugin never loads.
     */
    function optionalService(name) {
      const ctx = ctxRef
      if (!ctx) return undefined
      try {
        if (typeof ctx.get === 'function') {
          const value = ctx.get(name)
          if (value) return value
        }
      } catch (error) {
        /* not injected / not present on this cords version */
      }
      try {
        return ctx[name]
      } catch (error) {
        return undefined
      }
    }

    /**
     * Seed the label→id map straight from the sidebar.panellist slot.
     * The More-menu bridge cannot be trusted for this: its entry labels may
     * be missing (observed in the wild: map stayed EMPTY while ids like
     * "cli-bridge" got pinned, so top-pin matching had no label to match).
     * The sidebar renders its rows from THIS slot, so labels resolved here
     * are the exact row aria-labels — the matching key for top pins.
     */
    function seedMapFromSlots() {
      if (!ctxSlots || typeof ctxSlots.entriesOfSlot !== 'function') return
      try {
        const entries = ctxSlots.entriesOfSlot('sidebar.panellist')
        if (!Array.isArray(entries) || entries.length === 0) return
        const pairs = []
        entries.forEach(function (entry) {
          const options = entry && entry.options
          if (!options || typeof options.id !== 'string' || options.id.length === 0) return
          let label = options.label
          try {
            if (typeof label === 'function') label = label()
          } catch (error) {
            label = null
          }
          if (typeof label !== 'string' || label.length === 0) return
          pairs.push({ id: options.id, label: label })
        })
        if (pairs.length > 0) mergeLabelIdMap(pairs)
      } catch (error) {
        /* slots API unavailable: the More-menu bridge stays the fallback */
      }
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
            // b61: rows the user hid via the context menu stay in the nav DOM
            // (display:none via applyHiddenRows) — they must not inflate the
            // launcher badge, which advertises what the menu can offer.
            if (isRowHidden(label)) return
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
        // b62: a hidden row must not re-enter the inventory through the
        // unpinned backfill — the badge counts this list, and the menu skips
        // hidden labels at render time, so the numbers would drift apart.
        const backfillLabel = byId[id] || id
        if (isRowHidden(backfillLabel)) return
        list.push({ id: id, label: backfillLabel, pinned: false, idKnown: true })
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
            // b62: same hidden-row guard as the unpinned backfill — bridge
            // entries must not re-inflate the badge for rows the user hid.
            if (isRowHidden(entry.label || entry.id)) return
            list.push({
              id: entry.id,
              label: entry.label || entry.id,
              pinned: !unpinned.has(entry.id),
              idKnown: true,
            })
          }
        })
      }
      const topPins = readTopPins()
      list.forEach(function (item) {
        item.top = topPins.indexOf(item.id) !== -1
      })
      return list
    }

