    // ---------------------------------------------------------------------
    // v1.5.0 (b95): host-level shortcut registration.
    //
    // The host ships a first-class shortcut service (ctx.shortcuts): a
    // binding is declared per runtime/platform, the host computes the focus
    // region for us (input / textarea / contenteditable / terminal / shadow
    // root), arbitrates against open modals, detects conflicts with its own
    // commands, and the user can rebind the key in Settings -> Shortcuts.
    //
    // Until now Ctrl+K was a raw document keydown listener plus our own
    // "is the user typing?" sniffing — which is exactly what the host's
    // resolver exists for. Registering is therefore both a UX win (the key
    // becomes rebindable and shows up in the host's shortcut catalog) and a
    // correctness win (the region decision comes from the host).
    //
    // Registration can fail: hosts before 0.2.2 have no such service, and a
    // host that already binds Ctrl+K rejects an overlapping default. In both
    // cases we keep the legacy listener — the fallback is the contract, not
    // an error path.
    // ---------------------------------------------------------------------
    let hostShortcutDispose = null
    let hostShortcutActive = false
    // v1.9.0: a THROWN register (default conflict) is terminal — the legacy
    // listener takes over and the retry loop must stop scheduling.
    let hostShortcutGiveUp = false

    /** Open the palette, or close it when it is already open. */
    function togglePalette() {
      try {
        if (overlay) closeOverlay()
        else openPaletteSafe()
      } catch (error) {
        /* never break the host keyboard handling */
      }
    }

    /**
     * Register Ctrl+K with the host. Returns true when the host took over
     * the binding.
     *
     * Note the resolver does its own region/modal check: on Desktop the host
     * runs native bindings with priority and does NOT apply `regions`/
     * `modals` itself (only the Web path does), so the guard has to live
     * here or Ctrl+K would steal the key from the chat box.
     */
    function registerHostPaletteShortcut() {
      const shortcuts = optionalService('shortcuts')
      if (!shortcuts || typeof shortcuts.register !== 'function') return false
      try {
        const dispose = shortcuts.register({
          id: 'dsh-panel-pins.palette',
          label: function () {
            return zh ? '打开面板启动器' : 'Open panel launcher'
          },
          aliases: ['panel', 'launcher', 'palette', 'dpp', '面板'],
          defaults: {
            'desktop:macos': { code: 'KeyK', modifiers: ['primary'] },
            'desktop:windows': { code: 'KeyK', modifiers: ['primary'] },
            'desktop:linux': { code: 'KeyK', modifiers: ['primary'] },
            'web:macos': { code: 'KeyK', modifiers: ['primary'] },
            'web:windows': { code: 'KeyK', modifiers: ['primary'] },
            'web:linux': { code: 'KeyK', modifiers: ['primary'] },
          },
          regions: ['page'],
          modals: [],
          resolve: function (context) {
            const region = context && context.region
            const modal = context && context.modal
            // The host computed the region — trust it instead of sniffing
            // the event target ourselves.
            if (region === 'editable' || region === 'terminal') {
              return { status: 'pass' }
            }
            if (modal !== null && modal !== undefined) {
              return { status: 'pass' }
            }
            return { status: 'handled', run: togglePalette }
          },
        })
        hostShortcutDispose = typeof dispose === 'function' ? dispose : null
        hostShortcutActive = true
        return true
      } catch (error) {
        try {
          console.warn('[dsh-panel-pins] host shortcut registration failed:', error)
        } catch (ignored) {
          /* console unavailable */
        }
        // A thrown register is a DEFECTIVE default (name/platform conflict
        // with a host binding, e.g. session.search on desktop:macos), not a
        // "service not mounted yet" — retrying forever would spam the
        // console every 1.5s. The legacy document listener is the contract
        // fallback; settle into it permanently.
        hostShortcutGiveUp = true
        return false
      }
    }

    /** Global Ctrl+K capture. Registered once in apply(), inside the
     * defensive DOM block; capture phase so host shortcuts lose the race.
     *
     * v1.5.0: when the host owns the binding (ctx.shortcuts available), this
     * listener stands down for Ctrl+K — the host dispatches it, and a second
     * handler would toggle the palette twice. The palette's own search box
     * handles Ctrl+K locally instead (the host passes in editable regions).
     */
    function handleGlobalKey(event) {
      try {
        if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'k') {
          // Don't hijack Ctrl+K inside text inputs that belong to the HOST
          // (chat box etc.) — only fire when the focus is not an editable
          // field, or when our own palette/overlay is already open (Esc-like
          // re-press closes it).
          const t = event.target
          const editable = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t.isContentEditable === true))
          const inOurUi = overlay && t && overlay.contains(t)
          if (inOurUi) {
            event.preventDefault()
            event.stopPropagation()
            closeOverlay()
            return
          }
          // The host owns Ctrl+K now — leave it alone.
          if (hostShortcutActive) return
          if (editable) return
          event.preventDefault()
          event.stopPropagation()
          if (overlay) closeOverlay()
          else openPaletteSafe()
        }
      } catch (error) {
        /* never break host keyboard handling */
      }
    }

    function positionOverlay(launcher) {
      if (!overlay) return
      // Palette mode (launcher=null): centered via CSS class, nothing to do.
      if (!launcher) return
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
    /**
     * b81: rc.3 wheel interception workaround. The host binds a wheel handler
     * on _scrollArea (bindViewportRef) that calls preventDefault() and scrolls
     * its shared viewport manually — native wheel scrolling of ANY child
     * scroller, including our capped panel list, is suppressed (mechanical
     * scrollTop still works; real wheels do nothing). Drive the list scroll
     * ourselves from a capture-phase listener and stop the host handler from
     * also scrolling the shared viewport (double input).
     */
    function installNavWheelScroll(nav) {
      if (!nav || nav.__dppWheelScroll) return
      nav.__dppWheelScroll = true
      nav.addEventListener('wheel', function (event) {
        // Pixel deltas only; line/page modes stay native.
        let dy = event.deltaY
        if (event.deltaMode === 1) dy *= 16
        else if (event.deltaMode !== 0) return
        const max = nav.scrollHeight - nav.clientHeight
        if (max <= 0) return // nothing to scroll: let the event pass
        event.preventDefault()
        event.stopPropagation()
        nav.scrollTop = Math.max(0, Math.min(max, nav.scrollTop + dy))
      }, { capture: true, passive: false })
    }

    /**
     * v1.4.8: LITE nav-wheel driver for the rc.5 hand-off contract. The rc.5
     * viewport handler (scroll-handoff.ts) preventDefaults EVERY wheel event
     * over the sidebar nav and drives only the viewport, so the capped panel
     * list can never scroll ITSELF (v1.4.4 user report: 工作区可以滑动、列表
     * 滑动不了). The contract-safe way to fix it:
     *   - a step the capped list can absorb (not at its boundary in the
     *     gesture direction): preventDefault + drive the LIST. The host
     *     hand-off handler returns early on event.defaultPrevented, so it
     *     never double-drives.
     *   - a step AT the list boundary (end reached going down / top reached
     *     going up): pass through completely — no preventDefault, no
     *     stopPropagation, no viewport writes. The host hand-off observes
     *     the untouched event and runs its own gesture transition (nav
     *     scrolls away → workspace takes over; workspace returns to top →
     *     nav unrolls), exactly as designed.
     * v1.4.5's failure is precisely avoided: it stopPropagation'd AND
     * hand-wrote viewport.scrollTop, desynchronizing the host's gesture
     * state so the workspace seat never took the hand-off. Event ordering
     * makes this work without touching the host: this listener is CAPTURE on
     * the nav (fires first), the host's is a bubble listener on the viewport
     * ancestor (fires after) and exits on defaultPrevented.
     */
    function installNavWheelLite(nav) {
      if (!nav || nav.__dppWheelScroll) return
      nav.__dppWheelScroll = true
      nav.addEventListener('wheel', function (event) {
        // Pixel deltas only; line mode scales like the host, page/odd modes
        // stay native (the host driver translates them itself).
        let dy = event.deltaY
        if (event.deltaMode === 1) dy *= 16
        else if (event.deltaMode !== 0) return
        if (event.ctrlKey) return // pinch-zoom stays native
        const listMax = nav.scrollHeight - nav.clientHeight
        if (listMax <= 0) return // list fits: nothing to absorb; host handles it
        const atBottom = nav.scrollTop >= listMax - 1
        const atTop = nav.scrollTop <= 1
        const absorbing = (dy > 0 && !atBottom) || (dy < 0 && !atTop)
        if (!absorbing) return // boundary step: untouched pass-through, host hand-off runs
        event.preventDefault()
        // NO stopPropagation (v1.4.5's workspace killer): the host handler
        // still sees the event and exits on defaultPrevented.
        nav.scrollTop = Math.max(0, Math.min(listMax, nav.scrollTop + dy))
      }, { capture: true, passive: false })
    }

    function ensureLauncher() {
      if (typeof document === 'undefined') return null
      const nav = findPanelListNav()
      if (!nav) return null
      // b81/v1.4.8: keep the wheel driver attached to the live nav node,
      // dispatched by the detected scroll contract:
      //   rc3 (shared viewport): original capture-phase hijack — the host
      //     handler would double-scroll, so the event is fully consumed.
      //   rc5 (hand-off): LITE driver — absorb list-capable steps only,
      //     pass boundary steps through untouched so the host hand-off
      //     keeps its gesture state and drives the viewport/workspace.
      //   legacy/null: no driver — native scrolling everywhere.
      const htmlEl = document.documentElement
      if (htmlEl && htmlEl.classList.contains(RC3_CLASS)) {
        try {
          installNavWheelScroll(nav)
        } catch (error) {
          /* wheel drive stays unavailable; everything else unaffected */
        }
      } else if (htmlEl && htmlEl.classList.contains(RC5_CLASS)) {
        try {
          installNavWheelLite(nav)
        } catch (error) {
          /* lite driver stays unavailable; native hand-off remains */
        }
      }
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
      // The badge advertises EVERYTHING the menu holds — the merged panel
      // inventory (pinned + unpinned) AND collected plugin entry rows — so
      // nothing is silently "lost". Whitelisted entries stay in the sidebar
      // and don't count.
      // CRITICAL: only write when the value actually changed. The refresh
      // pass is driven by a MutationObserver — an unconditional textContent
      // write here would mutate the DOM every pass and feed back into the
      // observer, looping forever at the debounce rate.
      const allPanels = readPanelList().filter(function (entry) {
        // b63: mirror the menu's filter exactly (openOverlay 2796-2799) —
        // user-hidden rows must not be advertised by the badge either, or
        // the badge shows N while the menu shows N-3 and users read it as
        // "lost panels". Backfill guards inside readPanelList are not
        // enough: a hidden row's stored label may differ slightly from the
        // backfilled entry label, so filter here by the same rule.
        if (isRowHidden(entry.label)) return false
        return !isWhitelisted(entry.label, entry.idKnown ? entry.id : undefined)
      })
      const famCount = findFamilyRows().concat(findFooterRows()).filter(function (row) {
        if (isRowHidden(rowLabel(row))) return false // b61: hidden rows don't count
        return !isWhitelistedLabelOrMapped(rowLabel(row))
      }).length
      const badge = launcher.querySelector('.dpp-launcher-badge')
      const total = allPanels.length + famCount
      const badgeText = total > 0 ? String(total) : ''
      const rail = nav.getBoundingClientRect().width < 120
      const sig = badgeText + '|' + String(rail)
      if (launcher.__dppBadgeSig !== sig) {
        launcher.__dppBadgeSig = sig
        if (badge) badge.textContent = badgeText
        if (badge) {
          badge.setAttribute(
            'aria-label',
            LABEL.panels + ' ' + allPanels.length + ' · ' + LABEL.groupFamily + ' ' + famCount,
          )
        }
        launcher.classList.toggle('dpp-rail', rail)
      }
      return launcher
    }

