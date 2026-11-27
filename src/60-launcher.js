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
    // Pencil: display rename (v1.1.0).
    const ICON_EDIT =
      'M12.8 3.6a1.6 1.6 0 0 1 2.3 2.3L7.6 13.4 4 14.5l1.1-3.6zM4 17h12'
    // Eye with a slash: hide row (v1.1.0).
    const ICON_EYE_OFF =
      'M4 4l12 12M9.9 5.2A8.6 8.6 0 0 1 10 5.2c3.2 0 5.9 2 7 4.8a8.4 8.4 0 0 1-2 2.9M6.7 6.7A8.3 8.3 0 0 0 3 10a9.5 9.5 0 0 0 3.4 3.4A8.9 8.9 0 0 0 10 14.8c1.2 0 2.3-.2 3.3-.7M8.2 8.2a2.6 2.6 0 0 0 3.6 3.6'
    const ICON_GRID =
      'M4 4.5h4.2v4.2H4zM11.8 4.5H16v4.2h-4.2zM4 11.3h4.2v4.2H4zM11.8 11.3H16v4.2h-4.2z'
    // Compact: two arrows pointing at each other vertically.
    const ICON_COMPACT =
      'M6.5 7.2 10 3.7l3.5 3.5M6.5 12.8 10 16.3l3.5-3.5M10 4.5v11'
    // Stack: three rows, like a list of plugin entries.
    const ICON_STACK =
      'M4 5h12M4 10h12M4 15h8'
    // Feedback (v1.3.3): speech bubble with a tail — matches the 20x20
    // stroke-icon set used across the overlay and palette.
    const ICON_FEEDBACK =
      'M4.5 5.5h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H9l-3.4 3v-3h-1.1a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1zM7 9h6M7 11.4h4'

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

    /** Inline stroke SVG from a path d (used by overlay action buttons). */
    function iconSvgPath(d, size) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('width', String(size || 14))
      svg.setAttribute('height', String(size || 14))
      svg.setAttribute('viewBox', '0 0 20 20')
      svg.setAttribute('fill', 'none')
      svg.setAttribute('stroke', 'currentColor')
      svg.setAttribute('stroke-width', '1.4')
      svg.setAttribute('stroke-linecap', 'round')
      svg.setAttribute('stroke-linejoin', 'round')
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', d)
      svg.appendChild(path)
      return svg
    }

    /** Find the live sidebar row backing a merged panel entry (label first,
     * then id equivalence via the persisted map). */
    function rowForEntry(entry, liveRows) {
      const map = readLabelIdMap()
      for (let i = 0; i < liveRows.length; i++) {
        const label = (liveRows[i].getAttribute('aria-label') || liveRows[i].textContent || '').trim()
        if (label === entry.label) return liveRows[i]
        if (entry.idKnown && (map[label] === entry.id || entry.id === label)) return liveRows[i]
      }
      return null
    }

    /**
     * Open a panel from the merged menu. Visible rows click directly; an
     * unpinned panel has no row, so "peek": temporarily pin it via the host
     * callback, click the row once React mounts it (polled up to ~1.8s), then
     * restore the stored pin state — the panel opens without stealing a
     * permanent sidebar slot.
     */
    function openPanelEntry(entry, row) {
      // C1 (v0.13.0): every explicit open feeds the Recent queue — both the
      // row-click path and the temporary-pin "peek" path.
      try {
        recordRecent(entry.label)
      } catch (error) {
        /* cosmetic */
      }
      if (row) {
        try {
          row.click()
        } catch (error) {
          /* ignore */
        }
        return
      }
      if (!entry.idKnown || typeof bridge.onPinnedChange !== 'function') return
      try {
        bridge.onPinnedChange(entry.id, true)
      } catch (error) {
        return
      }
      const restore = function () {
        if (entry.pinned) return // was pinned: nothing to restore
        try {
          bridge.onPinnedChange(entry.id, false)
        } catch (error) {
          /* ignore */
        }
      }
      let tries = 0
      const timer = setInterval(function () {
        tries++
        const nav = findPanelListNav()
        const found = nav && rowForEntry(entry, findPanelRows(nav))
        if (found) {
          clearInterval(timer)
          try {
            found.click()
          } catch (error) {
            /* ignore */
          }
          setTimeout(restore, 800)
        } else if (tries > 12) {
          clearInterval(timer)
          restore()
          showToast(zh ? '「' + entry.label + '」暂时无法打开' : 'Could not open "' + entry.label + '" right now')
        }
      }, 150)
    }

    // ------------------------------------------------------------- toast

    /**
     * After "show panel rows": if the sidebar still has no visible panel
     * rows, every panel is unpinned (v0.7.7 merged inventory made unpinning
     * easy) and the toggle looks like a no-op. Point the user at the fix.
     */
    function adviseIfNoRows() {
      try {
        if (readRowsHidden()) return // just hid them: silence is correct
        const nav = findPanelListNav()
        const visible = nav ? findPanelRows(nav).filter(function (row) {
          if (row.style.display === 'none') return false
          // b75: rc.3 hides via the wrapper unit, not the button.
          const unit = rowUnitOf(nav, row)
          return !unit || unit.style.display !== 'none'
        }).length : 0
        if (visible === 0) showToast(LABEL.noRowsAfterShow)
      } catch (error) {
        /* advisory only */
      }
    }

