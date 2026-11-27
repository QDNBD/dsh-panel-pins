    // ---------------------------------------------------- row drag reorder
    // v1.2.2: HTML5 drag-and-drop on the sidebar panel rows themselves —
    // the one capability every competing panel manager ships and we deferred
    // since v1.2.0. Document-level delegation (rows are host-rendered React
    // nodes; we never attach per-row listeners that re-render would orphan).
    // Drop writes ROW_ORDER_KEY; applyRowOrderToNav turns it into CSS order.
    const DROP_LINE_ID = 'dsh-panel-pins-drop-line'

    function ensureDropLine() {
      let line = document.getElementById(DROP_LINE_ID)
      if (!line) {
        line = document.createElement('div')
        line.id = DROP_LINE_ID
        line.style.cssText =
          'position:fixed;height:2px;left:0;right:0;z-index:2147483000;pointer-events:none;' +
          'background:var(--dsw-alias-brand-primary,#4d6bfe);border-radius:1px;display:none;'
        document.body.appendChild(line)
      }
      return line
    }

    function showDropLine(nav, row, before) {
      try {
        const line = ensureDropLine()
        const r = row.getBoundingClientRect()
        if (!r || (!r.height && !r.top)) return
        const nr = nav.getBoundingClientRect()
        line.style.display = 'block'
        line.style.left = nr.left + 'px'
        line.style.width = nr.width + 'px'
        line.style.top = (before ? r.top : r.bottom) + 'px'
      } catch (error) {
        /* layout not ready */
      }
    }

    function hideDropLine() {
      try {
        const line = document.getElementById(DROP_LINE_ID)
        if (line) line.style.display = 'none'
      } catch (error) {
        /* ignore */
      }
    }

    /**
     * v1.8.0: shared drop commit for BOTH input paths — the mouse's HTML5
     * DnD (drop handler below) and the touch/pen long-press drag. dst is the
     * target row unit; dropping on the upper half inserts before, the lower
     * half after (mirrors dsh-panel-layout).
     */
    function commitRowDrop(src, dst, before) {
      if (!src || !dst || src === dst) return
      const srcLabel = rowLabel(src).trim()
      const dstLabel = rowLabel(dst).trim()
      if (!srcLabel || !dstLabel) return
      // Row order semantics follow the row-order array (known labels first).
      const order = readRowOrder()
      let idx = order.indexOf(dstLabel)
      if (idx === -1) {
        // Unordered target: build the array from current DOM order so the
        // first drag does not jump rows to arbitrary positions.
        const nav = findPanelListNav()
        const domLabels = []
        forEachRowUnit(nav, function (unit, btn, label) {
          if (label) domLabels.push(label)
        })
        const di = domLabels.indexOf(dstLabel)
        order.length = 0
        Array.prototype.push.apply(order, domLabels)
        idx = di
        if (!before) idx += 1
        const si = order.indexOf(srcLabel)
        if (si !== -1) order.splice(si, 1)
        if (idx > si) idx -= 1
        order.splice(Math.max(0, Math.min(idx, order.length)), 0, srcLabel)
        writeRowOrder(order)
      } else {
        if (!before) idx += 1
        moveRowInOrder(srcLabel, idx)
      }
      applyRowOrder()
      refreshAll()
    }

    function panelRowFromEventTarget(target) {
      // Walk up from the event target to the nav-row BUTTON (drag images and
      // text selection can make the target a child node).
      let el = target
      while (el && el.tagName !== 'BUTTON') el = el.parentNode
      if (!el || !el.getAttribute) return null
      // b74: the host More button is not a panel row — never a drag source
      // or drop target (b73 marked it draggable via the refresh sweep).
      if (el.getAttribute('aria-haspopup') === 'menu') return null
      if (!isRowButton(el)) return null
      const nav = findPanelListNav()
      if (!nav) return null
      // b75: rc.3 wraps row buttons in DIV._panelEntry flex children — the
      // drag identity is the UNIT (flex child); the label lives on the button.
      return rowUnitOf(nav, el)
    }

    function applyRowOrderToNav(nav) {
      const map = readLabelIdMap()
      const order = readRowOrder()
      // NOTE: no early return when `order` is empty — that would leak the
      // previous inline order/marker on every nav row after the user clears
      // the store. Empty array must still sweep the cleanup branch below.
      forEachRowUnit(nav, function (unit, btn, label) {
        // b73: HTML5 DnD needs draggable=true BEFORE the gesture starts —
        // mark the row BUTTON proactively during refresh (the drag source).
        if (!btn.draggable) btn.setAttribute('draggable', 'true')
        // b74: top pins stay authoritative. applyTopPinsToNav ran earlier in
        // this refresh pass and set -20000..; the b73 code fell through and
        // overwrote that with the -15000 band, visibly demoting top-pinned
        // rows under non-pinned ones (the 1.2.2 "rows shuffled" regression).
        // Skip: keep the top-pin order untouched. The row may still carry a
        // row-order entry for the day its top pin is removed.
        if (unit.getAttribute('data-dpp-top') === '1') return
        const idx = label ? order.indexOf(label) : -1
        if (idx !== -1) {
          // -15000.. : above host default order (0), below top pins
          // (-20000..). Rows that are BOTH top-pinned and user-ordered keep
          // the top-pin placement (handled by the skip above).
          const want = String(-(15000 - idx))
          if (unit.style.order !== want) unit.style.order = want
          if (unit.getAttribute('data-dpp-roworder') !== '1') unit.setAttribute('data-dpp-roworder', '1')
        } else if (unit.getAttribute('data-dpp-roworder') === '1') {
          unit.removeAttribute('data-dpp-roworder')
          unit.style.removeProperty('order')
        }
      })
    }

    function applyRowOrder() {
      if (typeof document === 'undefined') return
      let nav = null
      try {
        nav = findPanelListNav()
      } catch (error) {
        return
      }
      if (!nav) return
      applyRowOrderToNav(nav)
    }

    function installRowDrag() {
      if (typeof document === 'undefined') return
      if (document.__dppRowDragInstalled) return
      document.__dppRowDragInstalled = true

      // HTML5 DnD only fires dragstart on elements already marked
      // draggable=true at the time the gesture starts. Host rows are plain
      // React buttons without the attribute, so setting it inside dragstart
      // (the b72 approach) was always too late — the gesture never began.
      // Fix (b73): proactively mark rows during refresh, plus a pointerdown
      // belt-and-suspenders pass right before a potential gesture.
      const markDraggable = function (row) {
        // b75: mark the row BUTTON (the drag source); in rc.3 the row is a
        // wrapper unit and the button lives one level down.
        const btn = row && row.tagName === 'BUTTON' ? row : rowBtnOf(row)
        if (btn && btn.getAttribute('aria-haspopup') !== 'menu' && !btn.draggable) {
          btn.setAttribute('draggable', 'true')
        }
      }

      document.addEventListener('dragstart', function (event) {
        try {
          const row = panelRowFromEventTarget(event.target)
          if (!row) return
          row.setAttribute('data-dpp-dragging', '1')
          try {
            event.dataTransfer.setData('text/plain', rowLabel(row) || '')
            event.dataTransfer.effectAllowed = 'move'
          } catch (error) {
            /* dataTransfer unavailable in some synthetic events */
          }
        } catch (error) {
          /* ignore */
        }
      }, true)

      document.addEventListener('pointerdown', function (event) {
        // User intent signal: a press on a panel row. Marking here guarantees
        // draggable is set before the browser's drag-threshold fires, even on
        // the very first drag after a host re-render (refreshAll pass may not
        // have run yet for a freshly mounted row).
        try {
          const row = panelRowFromEventTarget(event.target)
          if (row) markDraggable(row)
        } catch (error) {
          /* ignore */
        }
      }, true)

      document.addEventListener('dragover', function (event) {
        try {
          if (!readRowOrder().length && !document.querySelector('[data-dpp-dragging="1"]')) return
          const row = panelRowFromEventTarget(event.target)
          if (!row) {
            hideDropLine()
            return
          }
          event.preventDefault()
          const r = row.getBoundingClientRect()
          const before = (event.clientY - r.top) < r.height / 2
          showDropLine(findPanelListNav(), row, before)
          row.__dppDropBefore = before
          row.__dppDropTarget = true
        } catch (error) {
          /* ignore */
        }
      }, true)

    document.addEventListener('drop', function (event) {
      try {
        const src = document.querySelector('[data-dpp-dragging="1"]')
        hideDropLine()
        if (!src) return
        const row = panelRowFromEventTarget(event.target)
        if (row && row !== src) {
          event.preventDefault()
          commitRowDrop(src, row, row.__dppDropBefore !== false)
        }
      } catch (error) {
        /* ignore */
      }
    }, true)

      document.addEventListener('dragend', function () {
        try {
          const src = document.querySelector('[data-dpp-dragging="1"]')
          if (src) src.removeAttribute('data-dpp-dragging')
          hideDropLine()
        } catch (error) {
          /* ignore */
        }
      }, true)
    }

    // -------------------------------------------------------------------
    // v1.8.0 (P1-2): touch/pen LONG-PRESS drag. The mouse keeps the native
    // HTML5 DnD path above (identical feel, zero regression); touch never
    // fires DnD, so rows were previously immovable on phones/tablets.
    //
    // Gesture (mirrors dsh-panel-tidy's long-press model):
    //   press a row -> 500ms hold ARMS it (haptic tick where available);
    //   moving >8px while armed engages the drag (blue insertion line, live,
    //   page scroll suppressed via preventDefault on touchmove);
    //   releasing armed-but-not-moved opens the SAME row context menu a
    //   mouse right-click opens (a synthetic contextmenu on the row button);
    //   moving >10px BEFORE the timer cancels everything — the sidebar
    //   scroll wins, exactly like a plain swipe.
    // Native long-press contextmenus (and the tap-click after a long press)
    // are suppressed while one of our gestures is armed, so the menu opens
    // exactly once.
    // -------------------------------------------------------------------
    const TOUCH_HOLD_MS = 500
    const TOUCH_CANCEL_PX = 10
    const TOUCH_DRAG_PX = 8
    let touchGesture = null
    let touchSuppressClickUntil = 0

    function endTouchGesture() {
      if (!touchGesture) return
      try {
        if (touchGesture.timer) clearTimeout(touchGesture.timer)
      } catch (error) {
        /* ignore */
      }
      try {
        if (touchGesture.dragging && touchGesture.src.getAttribute('data-dpp-dragging') === '1') {
          touchGesture.src.removeAttribute('data-dpp-dragging')
        }
      } catch (error) {
        /* ignore */
      }
      hideDropLine()
      try {
        window.removeEventListener('touchmove', onTouchMove, { passive: false })
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend', onTouchEnd)
        window.removeEventListener('touchcancel', onTouchCancel)
      } catch (error) {
        /* ignore */
      }
      touchGesture = null
    }

    function updateTouchDragPoint(x, y) {
      const el = document.elementFromPoint(x, y)
      const row = panelRowFromEventTarget(el)
      if (!row || row === touchGesture.src) {
        hideDropLine()
        return
      }
      const r = row.getBoundingClientRect()
      const before = (y - r.top) < r.height / 2
      showDropLine(findPanelListNav(), row, before)
      row.__dppDropTarget = true
      touchGesture.dst = row
      touchGesture.dstBefore = before
    }

    function onTouchStart(event) {
      try {
        if (touchGesture) endTouchGesture()
        if (!event.touches || event.touches.length !== 1) return
        const src = panelRowFromEventTarget(event.target)
        if (!src) return
        const t = event.touches[0]
        touchGesture = {
          src: src,
          startX: t.clientX,
          startY: t.clientY,
          armed: false,
          dragging: false,
          dst: null,
          dstBefore: false,
          timer: setTimeout(function () {
            if (!touchGesture) return
            touchGesture.armed = true
            try {
              if (navigator.vibrate) navigator.vibrate(30)
            } catch (error) {
              /* no haptics */
            }
          }, TOUCH_HOLD_MS),
        }
        // Non-passive listeners live on the window ONLY while a gesture is
        // running (removed in endTouchGesture) — normal scrolling elsewhere
        // keeps its compositor fast path.
        window.addEventListener('touchmove', onTouchMove, { passive: false })
        window.addEventListener('touchend', onTouchEnd, { passive: false })
        window.addEventListener('touchcancel', onTouchCancel, { passive: false })
      } catch (error) {
        touchGesture = null
      }
    }

    function onTouchMove(event) {
      try {
        if (!touchGesture) return
        const t = event.touches && event.touches[0]
        if (!t) return
        const dx = t.clientX - touchGesture.startX
        const dy = t.clientY - touchGesture.startY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (!touchGesture.armed) {
          // Not armed yet: a real swipe cancels the pending hold — the
          // sidebar scroll wins untouched.
          if (dist > TOUCH_CANCEL_PX) endTouchGesture()
          return
        }
        // Armed: the gesture is ours — stop the page from scrolling.
        event.preventDefault()
        if (!touchGesture.dragging) {
          if (dist < TOUCH_DRAG_PX) return
          touchGesture.dragging = true
          touchGesture.src.setAttribute('data-dpp-dragging', '1')
        }
        updateTouchDragPoint(t.clientX, t.clientY)
      } catch (error) {
        /* ignore */
      }
    }

    function onTouchEnd(event) {
      try {
        if (!touchGesture) return
        const t = event.changedTouches && event.changedTouches[0]
        if (touchGesture.dragging) {
          const dst = touchGesture.dst
          const before = touchGesture.dstBefore
          const src = touchGesture.src
          endTouchGesture()
          if (dst) commitRowDrop(src, dst, before)
          return
        }
        if (touchGesture.armed) {
          // Long-press without moving: the same menu a mouse right-click
          // opens. Dispatched AFTER the gesture is torn down so the global
          // contextmenu handler processes it normally.
          const btn = rowBtnOf(touchGesture.src) || touchGesture.src
          const r = btn.getBoundingClientRect()
          const cx = t ? t.clientX : r.left + r.width / 2
          const cy = t ? t.clientY : r.top + r.height / 2
          endTouchGesture()
          touchSuppressClickUntil = Date.now() + 400
          const ev = new window.MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: cx,
            clientY: cy,
          })
          btn.dispatchEvent(ev)
          return
        }
        endTouchGesture()
      } catch (error) {
        endTouchGesture()
      }
    }

    function onTouchCancel() {
      endTouchGesture()
    }

    // Native long-press contextmenus must not stack with our synthetic one.
    document.addEventListener('contextmenu', function (event) {
      try {
        if (touchGesture && touchGesture.armed) {
          event.preventDefault()
          event.stopImmediatePropagation()
        }
      } catch (error) {
        /* ignore */
      }
    }, true)

    // A long-press release must not ALSO click the row open.
    document.addEventListener('click', function (event) {
      try {
        if (Date.now() < touchSuppressClickUntil) {
          touchSuppressClickUntil = 0
          event.preventDefault()
          event.stopImmediatePropagation()
        }
      } catch (error) {
        /* ignore */
      }
    }, true)

    document.addEventListener('touchstart', onTouchStart, { passive: true })

