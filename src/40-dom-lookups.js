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

    /**
     * b76: whether footer-area plugin entries (rc.3: the kanban button below
     * _footArea) are collected into the launcher. DEFAULT OFF — the original
     * plugin constraint was "footer entries are never collected"; the user
     * explicitly lifted it for these entries (they used to render at the top
     * of the sidebar before the rc.3 host moved the injection point).
     */
    function readFooter() {
      try {
        const raw = window.localStorage.getItem(FOOTER_KEY)
        if (raw === '1') return true
        if (raw === '0') return false
      } catch (error) {
        /* fall through to the default */
      }
      return false
    }

    function writeFooter(value) {
      try {
        window.localStorage.setItem(FOOTER_KEY, value ? '1' : '0')
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

    // -------------------------------------------------- scroll contract (v1.4.4)

    /**
     * Detected sidebar scroll contract: 'rc5' (wheel hand-off — viewport
     * scrolls the navigation away, then the workspace list seat scrolls),
     * 'rc3' (shared viewport holds list+region, plugin must restructure it),
     * or null (sidebar not mounted / unknown layout — no structural rules).
     * Detection: rc.5 marks its viewport with data-sidebar-scrollport and its
     * workspace list seat with data-sidebar-list-area; rc.3 has neither.
     * Exposed as window.__dppScrollContract for the jsdom regression.
     */
    let scrollContract = null

    function detectScrollContract() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (!root) return
      const scrollArea = document.querySelector('div[class$="_scrollArea"]')
      let next = null
      if (scrollArea) {
        next = scrollArea.hasAttribute('data-sidebar-scrollport') ? 'rc5' : 'rc3'
      }
      if (next !== scrollContract) {
        scrollContract = next
        try {
          window.__dppScrollContract = scrollContract
        } catch (error) { /* expose is diagnostic only */ }
      } else if (window.__dppScrollContract === undefined) {
        try {
          window.__dppScrollContract = scrollContract
        } catch (error) { /* expose is diagnostic only */ }
      }
      root.classList.toggle(RC3_CLASS, scrollContract === 'rc3')
      // v1.4.8: rc.5 marker dispatches the LITE nav-wheel driver in
      // ensureLauncher (no CSS is gated on this class — see RC5_CLASS).
      root.classList.toggle(RC5_CLASS, scrollContract === 'rc5')
    }

    /** Panel rows = nav button children, minus the More launcher and our launcher. */
    function findPanelRows(nav) {
      if (!nav) return []
      let rows = []
      try {
        // b75: rc.3 wraps every row button in a DIV[class*="_panelEntry"]
        // flex child (row BUTTON._panelRow + host-native unpin button).
        rows = Array.prototype.slice.call(nav.querySelectorAll('button[class*="_panelRow"]'))
      } catch (error) {
        rows = []
      }
      rows = rows.filter(function (b) {
        return !b.hasAttribute(LAUNCHER_ATTR) && b.getAttribute('aria-haspopup') !== 'menu'
      })
      if (rows.length) return rows
      // Legacy hosts: the row BUTTONs are direct nav children (may lack the
      // _panelRow marker class in very old builds).
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

    // ------------------------------------------- row unit helpers (b75)
    // A ROW UNIT is the flex child of the nav that visually owns a panel
    // row: legacy = the row BUTTON itself; rc.3 = the DIV._panelEntry
    // wrapper (row button + host unpin button). Visibility inline styles,
    // top-pin / row-order `order` values and drag marks must land on the
    // UNIT — writing them on a nested button has no flex effect.

    /** The nav flex child that visually owns `btn` (or null). */
    function rowUnitOf(nav, btn) {
      if (!nav || !btn) return null
      let el = btn
      for (let i = 0; el && el !== nav && i < 6; i++) {
        if (el.parentNode === nav) return el
        el = el.parentNode
      }
      return null
    }

    /** The row BUTTON inside a unit (the unit itself for legacy navs). */
    function rowBtnOf(unit) {
      if (!unit || !unit.querySelector) return null
      if (unit.tagName === 'BUTTON') return unit
      try {
        return unit.querySelector('button[class*="_panelRow"]') || unit.querySelector('button')
      } catch (error) {
        return null
      }
    }

    /** A row BUTTON: not our launcher, not the host More menu, not the
     * host unpin control. */
    function isRowButton(btn) {
      if (!btn || btn.tagName !== 'BUTTON') return false
      if (btn.hasAttribute(LAUNCHER_ATTR)) return false
      if (btn.getAttribute('aria-haspopup') === 'menu') return false
      const cls = String(btn.className || '')
      if (cls.indexOf('_panelUnpin') !== -1) return false
      return true
    }

    /** Sweep the row UNITS of a nav. fn(unit, btn, label) per row; our
     * launcher and the host More anchor are skipped. */
    function forEachRowUnit(nav, fn) {
      if (!nav) return
      Array.prototype.forEach.call(nav.children, function (unit) {
        if (!unit.getAttribute) return
        if (unit.hasAttribute(LAUNCHER_ATTR)) return
        const btn = rowBtnOf(unit)
        if (!isRowButton(btn)) return
        const label = ((btn.getAttribute('aria-label')) || btn.textContent || '').trim()
        fn(unit, btn, label)
      })
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
        if (!nav) return []
        // b75: rc.3 nests the nav inside DIV._scrollRegion, so the sidebar
        // root is the nearest ancestor that ALSO holds the new-session
        // anchor. Legacy hosts resolve on the first hop (nav.parentNode).
        let root = null
        let anchor = null
        for (let node = nav.parentNode, hop = 0; node && node !== document.body && hop < 8; node = node.parentNode, hop++) {
          const a = findAnchor(node)
          if (a) { root = node; anchor = a; break }
        }
        if (!root || !anchor) return []
        const kids = Array.prototype.slice.call(root.children)
        const ai = kids.indexOf(anchor)
        let ni = kids.indexOf(nav)
        if (ni < 0) {
          for (let i = 0; i < kids.length; i++) {
            if (kids[i].contains(nav)) { ni = i; break }
          }
        }
        if (ai < 0 || ni < 0 || ni <= ai + 1) return []
        const out = []
        for (let i = ai + 1; i < ni; i++) {
          if (isClickableRow(kids[i])) out.push(kids[i])
        }
        // b75: third-party rows may inject INSIDE the nav's container
        // (rc.3: scrollRegion), ahead of the scrollArea holding the nav —
        // scan those too, skipping host chrome (the scroll-fade decorator).
        const container = kids[ni]
        if (container !== nav) {
          const sub = Array.prototype.slice.call(container.children)
          let navSub = -1
          for (let i = 0; i < sub.length; i++) {
            if (sub[i].contains(nav)) { navSub = i; break }
          }
          for (let i = 0; i < navSub; i++) {
            const el = sub[i]
            if (!el.getAttribute) continue
            if (String(el.className).indexOf('_scrollFade') !== -1) continue
            if (isClickableRow(el)) out.push(el)
          }
        }
        return out
      } catch (error) {
        return []
      }
    }

    /**
     * b76: footer rows = clickable root children AFTER the child holding the
     * panel-list nav (rc.3: the kanban button following _footArea). Uses the
     * same anchor-root discovery as findFamilyRows; host chrome (_footArea)
     * and our own nodes are never listed. Returns [] when the structure
     * cannot be derived — never guess.
     */
    function findFooterRows() {
      try {
        const nav = findPanelListNav()
        if (!nav) return []
        let root = null
        for (let node = nav.parentNode, hop = 0; node && node !== document.body && hop < 8; node = node.parentNode, hop++) {
          if (findAnchor(node)) { root = node; break }
        }
        if (!root) return []
        const kids = Array.prototype.slice.call(root.children)
        let ni = kids.indexOf(nav)
        if (ni < 0) {
          for (let i = 0; i < kids.length; i++) {
            if (kids[i].contains(nav)) { ni = i; break }
          }
        }
        if (ni < 0) return []
        const out = []
        for (let i = ni + 1; i < kids.length; i++) {
          const el = kids[i]
          if (!el.getAttribute) continue
          if (el.hasAttribute(LAUNCHER_ATTR)) continue
          if (String(el.className).indexOf('_footArea') !== -1) continue
          if (isClickableRow(el)) out.push(el)
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
      // v1.3.2: the single-row hidden store is consulted here too — an
      // individually-hidden plugin entry needs the active exemption, and the
      // sweep must also UN-hide rows whose exemption no longer applies.
      const hiddenRows = readHiddenRows()
      // b78: position-agnostic — collect plugin entry rows wherever they sit
      // (top: between the new-session anchor and the panel list; bottom:
      // after the nav's container). One toggle covers both.
      findFamilyRows().concat(findFooterRows()).forEach(function (row) {
        // b52: skip rows with an in-place rename editor (observer race guard,
        // same as applyFold).
        if (row.getAttribute('data-dpp-renaming') === '1') return
        // Whitelisted entries stay in the sidebar no matter what. Family rows
        // have no panel id — match label + map-derived id equivalence.
        // b77: restore the hide computation — the b76 replacement ate this
        // line and every refreshAll pass threw "hide is not defined",
        // aborting the whole chain (launcher mount included).
        // v1.3.2: individually-hidden entries get the active-row exemption
        // through the same shouldHideRow contract as applyFold; the family
        // collection toggle itself never exempts (hiding rows wholesale IS
        // that feature).
        const familyLabel = rowLabel(row)
        const hide = shouldHideRow(familyLabel, hiddenRows.indexOf(familyLabel) !== -1, hidden)
        const want = hide ? 'none' : ''
        if (row.style.display === want) return
        row.style.display = want
        if (hide) row.dataset.dppHidden = '1'
        else delete row.dataset.dppHidden
      })
    }

    /**
     * b76: apply the opt-in footer-entry collection — same semantics as
     * applyFamily (inline display, whitelist still wins, hidden≠gone: the
     * entries stay listed in the launcher's family group).
     */
    function applyFooter() {
      // b78: footer entries merged into the single position-agnostic sweep.
      applyFamily()
    }

    /** Whitelist check for rows whose panel id is unknown: exact label, or
     * any whitelist entry that maps to a panel whose CURRENT label is this
     * one (label→id→reverse-label equivalence across locale switches). */
    function isWhitelistedLabelOrMapped(label) {
      if (isWhitelisted(label)) return true
      const map = readLabelIdMap()
      const id = map[label]
      if (!id) return false
      for (const entry of readWhitelist()) {
        if (map[entry] === id) return true
      }
      return false
    }

    const HIDDEN_MARK = 'dppHidden'

    /**
     * Sweep for rows we hid that drifted out of the structural derivation
     * (a plugin re-inserted or moved its entry). Anything still carrying our
     * marker whose label is now whitelisted gets restored — this is what
     * makes toggling a whitelist entry reliable even when the entry moved.
     * v1.3.2: the active-row exemption rides the same global sweep — a
     * marked row that IS the currently active panel (drift safety net; the
     * canonical per-pass paths are applyFold/applyFamily/applyHiddenRows)
     * must not stay hidden behind our marker.
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
          rowLabel(el).trim() ||
          (el.textContent || '').trim()
        if (isWhitelistedLabelOrMapped(label) || isActiveRowLabel(label)) {
          el.style.display = ''
          delete el.dataset.dppHidden
        }
      })
    }

