    // ------------------------------------------------------------ settings page

    /**
     * Top-pin ordering. The host panel list is a flex column, so a negative
     * CSS `order` lifts a row to the top WITHOUT touching DOM structure —
     * React re-renders don't fight it, and the interval replay re-asserts it
     * after the host replaces nodes. Stored pins are panel ids (same universe
     * as the pin store); sidebar rows are matched by label through the
     * persisted label→id map. The two launchers (ours, host More) get fixed
     * orders so top-pinned rows slot between the launcher and the rest.
     */
    const ORDER_LAUNCHER = '-30000'
    /**
     * Apply top-pin ordering to one panel-list nav; returns {stored, matched}.
     * Matching needs no map indirection in the common case (the stored label
     * IS the row's aria-label — captured at toggle time from the same source).
     */
    function applyTopPinsToNav(nav) {
      const map = readLabelIdMap()
      const topPins = readTopPins()
      let matched = 0
      // Our launcher always stays first (visual anchor; never jumps).
      const launcher = nav.querySelector('[' + LAUNCHER_ATTR + ']')
      if (launcher && launcher.style.order !== ORDER_LAUNCHER) launcher.style.order = ORDER_LAUNCHER
      // b75: sweep row UNITS (rc.3 wrapper divs, legacy row buttons). The
      // host More anchor is skipped inside forEachRowUnit; pre-rc.3 hosts
      // keep the More button outside the nav entirely.
      forEachRowUnit(nav, function (unit, btn, label) {
        const idx = label ? topPinIndexFor(label, map, topPins) : -1
        if (idx !== -1) {
          matched++
          if (unit.getAttribute('data-dpp-top') !== '1') unit.setAttribute('data-dpp-top', '1')
          // -20000, -19999, …: stored order wins among top-pinned rows.
          const want = String(-(20000 - idx))
          if (unit.style.order !== want) unit.style.order = want
        } else if (unit.getAttribute('data-dpp-top') === '1') {
          unit.removeAttribute('data-dpp-top')
          unit.style.removeProperty('order')
        }
      })
      return { stored: topPins.length, matched: matched }
    }
    function applyTopPins() {
      if (typeof document === 'undefined') return
      let nav = null
      try {
        nav = findPanelListNav()
      } catch (error) {
        return
      }
      if (!nav) return
      applyTopPinsToNav(nav)
    }

