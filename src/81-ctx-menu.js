    // ------------------------------------------------------------ row context menu

    let ctxMenuEl = null
    let ctxMenuCleanup = null

    function closeCtxMenu() {
      if (ctxMenuEl && ctxMenuEl.parentNode) ctxMenuEl.parentNode.removeChild(ctxMenuEl)
      ctxMenuEl = null
      if (ctxMenuCleanup) {
        try {
          ctxMenuCleanup()
        } catch (error) {
          /* ignore */
        }
        ctxMenuCleanup = null
      }
    }

    /**
     * v1.1.1 b69 display rename: an inline text editor rendered as a
     * BODY-LEVEL float anchored below the row's label element — NOT a node
     * inserted into the row. The row subtree is host React territory:
     * live-counter ticks re-render it constantly and any foreign node (plus
     * the b52 data-dpp-renaming guard) gets ripped out within milliseconds
     * (b68 walk evidence: editor vanished before the first keystroke, zero
     * DOM/storage effect). A body-level float survives host reconciliation.
     *
     * b69 contract:
     * - anchor  label.getBoundingClientRect(): left = rect.left,
     *           top = rect.bottom + 4, width = clamp(rect.width, 220, 300)
     * - rAF-merged reposition on resize / scroll / sidebar geometry changes
     *           (ResizeObserver on the panel nav); bottom flip when the
     *           viewport is short, everything clamped to an 8px safety band
     * - row detached or label rect collapsed to zero -> cancel dispose,
     *           no orphan nodes, no dangling listeners
     * - GLOBAL SINGLETON: re-triggering disposes the previous instance first
     * - every exit funnels through one dispose(): listeners off, guard
     *           interval off, focus handed back to the row
     * - commit never touches the row DOM — the next refreshAll/applyFold
     *           pass rewrites the label text from the rename store
     * Enter/blur commits (empty = reset), Escape cancels.
     */
    let renameFloat = null

    function disposeRenameFloat(commit, reason) {
      const st = renameFloat
      if (!st) return
      renameFloat = null
      if (st.raf) window.cancelAnimationFrame(st.raf)
      if (st.guard) clearInterval(st.guard)
      if (st.ro) {
        try {
          st.ro.disconnect()
        } catch (error) {
          /* ignore */
        }
      }
      window.removeEventListener('resize', st.schedule)
      window.removeEventListener('scroll', st.schedule, true)
      try {
        st.wrap.remove()
      } catch (error) {
        /* ignore */
      }
      // b69 evidence stub (kept from b68's CDP取证桩 — regression reads it).
      try {
        document.title = 'dpp-rename:DONE reason=' + reason + (commit ? ' commit=1' : ' commit=0')
      } catch (error) {
        /* ignore */
      }
      if (commit) {
        try {
          const map = readRenames()
          const value = st.editor.value.trim()
          if (!value || value === st.original) delete map[st.original]
          else map[st.original] = value
          writeRenames(map)
        } catch (error) {
          /* session-only */
        }
        // applyFold rewrites the row text on this pass — never edit row DOM here.
        refreshAll()
      }
      // Hand focus back to the originating row (any exit). Rows are plain
      // divs most of the time — focus() is a no-op there, never an error.
      if (st.row && st.row.isConnected) {
        try {
          st.row.focus({ preventScroll: true })
        } catch (error) {
          /* non-focusable row */
        }
      }
    }

    function beginRowRename(row, kind) {
      const entered = '' + (row && row.tagName) + '/' + (row && row.isConnected)
      const original = kind === 'family' ? rowLabel(row) : (row.getAttribute('aria-label') || rowLabel(row) || '').trim()
      if (!original) {
        document.title = 'dpp-rename:ENTERED ' + entered + ' label=EMPTY'
        return
      }
      if (!row.isConnected) {
        const fresh = findRowByLabel(original, kind)
        document.title = 'dpp-rename:ENTERED ' + entered + ' detached label=' + original + ' fresh=' + (fresh ? 'FOUND' : 'NULL')
        if (fresh) row = fresh
      } else {
        document.title = 'dpp-rename:ENTERED ' + entered + ' label=' + original
      }
      if (!row.isConnected) return
      // NOTE: the rename store is keyed by the ORIGINAL label, so rows that
      // genuinely share a label rename together — by design (the label is
      // the stable handle). findRowByLabel already prefers the first
      // connected row in DOM order, so the editor always anchors a live row.
      const renames = readRenames()
      const current = typeof renames[original] === 'string' && renames[original].trim() ? renames[original].trim() : original
      const nameEl = row.querySelector('[class$="_label"], .dpp-label') || row
      // b69: global singleton — a second trigger revokes the live instance
      // (cancel, not commit) before its own float exists.
      if (renameFloat) disposeRenameFloat(false, 'superseded')
      const wrap = document.createElement('div')
      wrap.className = 'dpp-rename-float'
      wrap.style.zIndex = '2147482000'
      const editor = document.createElement('input')
      editor.type = 'text'
      editor.value = current
      editor.className = 'dpp-row-rename'
      editor.setAttribute('aria-label', LABEL.renamePrompt)
      wrap.appendChild(editor)
      document.body.appendChild(wrap)
      // b69: the state object is registered as the global singleton BEFORE
      // the first reposition — a row-gone/rect-zero on that first pass must
      // find a live state to dispose, or the wrap + guard interval would
      // leak as orphans.
      const st = { wrap: wrap, editor: editor, row: row, original: original, schedule: null, raf: 0, guard: 0, ro: null }
      renameFloat = st
      let done = false
      let rafPending = false
      st.guard = setInterval(function () {
        // Low-rate liveness sweep (the plugin already runs one for the rest
        // of its DOM asserts): catches row removal / rect collapse with no
        // resize/scroll/RO trigger, so the float never outlives its row.
        schedule()
      }, 1000)
      const finish = function (commit, reason) {
        // Identity guard: a late blur from a JUST-SUPERSEDED instance must
        // not commit (and kill) the NEW float — only the instance the global
        // still points at may funnel into dispose.
        if (done || renameFloat !== st) return
        done = true
        disposeRenameFloat(commit, reason)
      }
      const reposition = function () {
        if (done) return
        try {
          // Row left the DOM (host re-render, hide, filter) -> cancel.
          if (!row.isConnected) {
            finish(false, 'row-gone')
            return
          }
          const q = nameEl.getBoundingClientRect()
          // Rect collapsed to zero (display:none ancestor, folded away) -> cancel.
          if (!q || (!q.width && !q.height)) {
            finish(false, 'rect-zero')
            return
          }
          const vw = window.innerWidth || 1280
          const vh = window.innerHeight || 800
          const w = Math.min(300, Math.max(220, Math.round(q.width)))
          const h = wrap.offsetHeight || 40
          // Anchor below the label; flip above when the bottom band is short.
          const below = q.bottom + 4
          const above = q.top - h - 4
          let top = below
          if (below + h > vh - 8 && above >= 8) top = above
          // 8px safety band on both axes.
          top = Math.min(Math.max(Math.round(top), 8), Math.max(8, vh - h - 8))
          const left = Math.min(Math.max(Math.round(q.left), 8), Math.max(8, vw - w - 8))
          wrap.style.left = left + 'px'
          wrap.style.top = top + 'px'
          wrap.style.width = w + 'px'
        } catch (error) {
          finish(false, 'measure-error')
        }
      }
      const schedule = function () {
        // rAF merge: bursts of resize/scroll/RO events collapse into one
        // reposition per frame.
        if (rafPending || done) return
        rafPending = true
        st.raf = window.requestAnimationFrame(function () {
          rafPending = false
          reposition()
        })
      }
      st.schedule = schedule
      // First paint position (after append, so offsetHeight is real).
      reposition()
      // Instant-cancel path (row gone / rect zero on first measure): the
      // dispose already ran — do NOT attach window listeners or focus an
      // editor inside a removed wrap (they would leak past this function).
      if (done || renameFloat !== st) return
      try {
        document.title = 'dpp-rename:FLOAT label=' + original + ' inDoc=' + editor.isConnected
      } catch (error) {
        /* ignore */
      }
      try {
        editor.focus()
        editor.select()
      } catch (error) {
        /* ignore */
      }
      // Sidebar geometry: folds and row removals change the nav's box.
      try {
        const nav = findPanelListNav()
        if (nav && typeof ResizeObserver === 'function') {
          st.ro = new ResizeObserver(schedule)
          st.ro.observe(nav)
        }
      } catch (error) {
        /* RO unavailable — scroll/resize/guard still cover it */
      }
      window.addEventListener('resize', schedule)
      window.addEventListener('scroll', schedule, true)
      editor.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          finish(true, 'enter')
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          finish(false, 'escape')
        }
      })
      editor.addEventListener('blur', function () {
        finish(true, 'blur')
      })
      editor.addEventListener('click', function (e) {
        e.stopPropagation()
      })
    }
    /** One context-menu line; reuses the overlay row metrics (.dpp-row). */
    function ctxRow(parent, iconPath, label, onClick, opts) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'dpp-row'
      btn.setAttribute('role', 'menuitem')
      const ico = document.createElement('span')
      ico.className = 'dpp-icon'
      ico.appendChild(iconSvgPath(iconPath, 14))
      btn.appendChild(ico)
      const lbl = document.createElement('span')
      lbl.className = 'dpp-label'
      lbl.textContent = label
      btn.appendChild(lbl)
      btn.addEventListener('click', function (event) {
        event.stopPropagation()
        closeCtxMenu()
        try {
          onClick()
        } catch (error) {
          // b69: never swallow silently — a thrown action (e.g. beginRowRename)
          // used to vanish without any observable signal. Surface it on the
          // console AND on the b68-style CDP title stub the regression reads.
          const msg = (error && error.message) || String(error)
          try {
            document.title = 'dpp-ctx-error: ' + msg
          } catch (titleError) {
            /* ignore */
          }
          try {
            console.error('[dsh-panel-pins] context action failed:', error)
          } catch (consoleError) {
            /* console unavailable */
          }
        }
      })
      if (opts && opts.title) {
        btn.title = opts.title
      }
      if (opts && opts.disabled) {
        btn.disabled = true
        if (!opts.title) btn.title = ''
      }
      parent.appendChild(btn)
      return btn
    }

    /**
     * Right-click menu on any sidebar row (panel row or plugin entry row):
     * open / pin-unpin / to-top / whitelist / collect-this-row. The whitelist
     * action stores the panel id when one resolves (locale-safe, v0.8.0).
     */
    function openCtxMenu(event, row, kind) {
      closeCtxMenu()
      const label = kind === 'family' ? rowLabel(row) : (row.getAttribute('aria-label') || rowLabel(row) || '').trim()
      if (!label) return
      const map = readLabelIdMap()
      const id = kind === 'family' ? null : map[label] || null

      const menu = document.createElement('div')
      menu.className = 'dpp-ctx'
      menu.setAttribute('role', 'menu')
      menu.dataset.plugin = 'dsh-panel-pins'
      const title = document.createElement('div')
      title.className = 'dpp-ctx-title'
      title.textContent = label
      menu.appendChild(title)

      // Open: click the original control (family rows unwrap; panel rows click).
      ctxRow(menu, ICON_CHEVRON_DOWN, LABEL.ctxOpen, function () {
        if (kind === 'family') triggerRow(row)
        else {
          try {
            row.click()
          } catch (error) {
            /* ignore */
          }
        }
      })

      // Pin management: only for panel rows with a resolvable id.
      if (id) {
        const unpinned = readUnpinned()
        const isPinned = !unpinned.has(id)
        ctxRow(menu, isPinned ? ICON_PIN_ALT : ICON_PIN, isPinned ? LABEL.ctxUnpin : LABEL.ctxPin, function () {
          const store = readUnpinned()
          if (isPinned) store.add(id)
          else store.delete(id)
          writeUnpinned(store)
          try {
            if (typeof bridge.onPinnedChange === 'function') bridge.onPinnedChange(id, !isPinned)
          } catch (error) {
            /* store still holds the state */
          }
          refreshAll()
        })
        const topPins = readTopPins()
        const isTop = topPins.some(function (e) {
          return e.id === id
        })
        if (isPinned) {
          ctxRow(menu, ICON_CHEVRON_UP, isTop ? LABEL.ctxTopOff : LABEL.ctxTop, function () {
            toggleTopPinStore(id, label)
            applyTopPins()
          })
        }
      }

      // Whitelist ("keep in sidebar"): toggle id-first, label fallback.
      const whitelisted = id ? isWhitelisted(label, id) : isWhitelistedLabelOrMapped(label)
      ctxRow(menu, ICON_PIN, whitelisted ? LABEL.ctxWhitelistOff : LABEL.ctxWhitelist, function () {
        toggleWhitelistEntryGlobal(label, id)
      })

      // v1.1.0: rename (display layer) — swaps the row into an inline input;
      // Enter/blur commits, Escape cancels. Original label stays the storage
      // key, so pins/groups/whitelist are unaffected.
      ctxRow(menu, ICON_EDIT, LABEL.ctxRename, function () {
        // b68: close the menu BEFORE inserting the editor. The editor grabs
        // focus; when the menu is torn down afterwards (its own outside-
        // interaction cleanup), the focus shuffle blurs the editor and the
        // blur-commit races the first keystroke — the editor vanished without
        // ever showing a caret (b67 walk111/walk112 evidence). Closing first
        // keeps editor.focus() the LAST focus operation.
        closeCtxMenu()
        beginRowRename(row, kind)
      })

      // v1.1.0: hide this row from the sidebar (restore from Settings).
      const isHidden = isRowHidden(label)
      ctxRow(menu, ICON_EYE_OFF, isHidden ? LABEL.ctxUnhide : LABEL.ctxHide, function () {
        const stillHidden = toggleRowHidden(label, id)
        showToast(
          stillHidden
            ? (zh ? '已隐藏「NAME」' : 'Hidden "NAME"').replace('NAME', displayNameFor(label))
            : (zh ? '已恢复显示「NAME」' : 'Restored "NAME"').replace('NAME', displayNameFor(label)),
        )
        refreshAll()
      })

      // v1.2.2: move to front — the touch/no-HTML5-DnD fallback for row
      // ordering (mirrors dsh-panel-layout's "move to top" arrow). Works for
      // every panel row regardless of pin state.
      ctxRow(menu, ICON_CHEVRON_UP, LABEL.ctxToFront, function () {
        try {
          moveRowInOrder(label, 0)
          showToast((zh ? '「NAME」已移到最前' : '"NAME" moved to front').replace('NAME', displayNameFor(label)))
          refreshAll()
        } catch (error) {
          /* storage unavailable */
        }
      }, { title: zh
        ? '把该行排到面板列表顶部（也可直接按住行拖动排序）'
        : 'Put this row at the top of the panel list (you can also drag rows to reorder)' })

      document.body.appendChild(menu)
      ctxMenuEl = menu
      // Position at the cursor, clamped to the viewport.
      const mw = menu.offsetWidth
      const mh = menu.offsetHeight
      const vw = window.innerWidth || 1280
      const vh = window.innerHeight || 800
      let left = event.clientX + 2
      let top = event.clientY + 2
      if (left + mw > vw - 8) left = Math.max(8, event.clientX - mw - 2)
      if (top + mh > vh - 8) top = Math.max(8, event.clientY - mh - 2)
      menu.style.left = left + 'px'
      menu.style.top = top + 'px'

      // Keyboard reachability (v0.11.0): focus lands on the first enabled
      // item; ↑↓ move between items, Home/End jump, Enter activates (native),
      // Esc/Tab close. Disabled rows are skipped (they are unfocusable).
      const items = function () {
        return Array.prototype.filter.call(
          menu.querySelectorAll('button.dpp-row'),
          function (b) {
            return !b.disabled
          },
        )
      }
      const focusAt = function (idx) {
        const list = items()
        if (list.length === 0) return
        const target = list[((idx % list.length) + list.length) % list.length]
        try {
          target.focus()
        } catch (error) {
          /* ignore */
        }
      }
      const firstIdx = items().indexOf(document.activeElement)
      if (firstIdx < 0) focusAt(0)
      menu.addEventListener('keydown', function (e) {
        const list = items()
        const cur = list.indexOf(document.activeElement)
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          e.stopPropagation()
          focusAt(cur < 0 ? 0 : cur + 1)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          e.stopPropagation()
          focusAt(cur < 0 ? list.length - 1 : cur - 1)
        } else if (e.key === 'Home') {
          e.preventDefault()
          e.stopPropagation()
          focusAt(0)
        } else if (e.key === 'End') {
          e.preventDefault()
          e.stopPropagation()
          focusAt(list.length - 1)
        } else if (e.key === 'Tab') {
          e.preventDefault()
          e.stopPropagation()
          closeCtxMenu()
        }
      })
      // Focus the first enabled item once the listeners are attached. The
      // focusAt call above may run before this menu is in the a11y tree —
      // repeat after paint for reliability.
      setTimeout(function () {
        if (ctxMenuEl === menu && !menu.contains(document.activeElement)) focusAt(0)
      }, 0)

      const onDown = function (e) {
        if (!ctxMenuEl) return
        if (ctxMenuEl.contains(e.target)) return
        closeCtxMenu()
      }
      const onKey = function (e) {
        if (e && e.key === 'Escape') closeCtxMenu()
      }
      const onScrollOrResize = function () {
        closeCtxMenu()
      }
      document.addEventListener('pointerdown', onDown, true)
      document.addEventListener('keydown', onKey, true)
      window.addEventListener('scroll', onScrollOrResize, true)
      window.addEventListener('resize', onScrollOrResize)
      ctxMenuCleanup = function () {
        document.removeEventListener('pointerdown', onDown, true)
        document.removeEventListener('keydown', onKey, true)
        window.removeEventListener('scroll', onScrollOrResize, true)
        window.removeEventListener('resize', onScrollOrResize)
      }
    }

    /** Module-level whitelist toggle for the context menu (settings page has
     * its own React-bound copy). Falls back to label when id is unknown. */
    function toggleWhitelistEntryGlobal(label, id) {
      const list = readWhitelist()
      const l = String(label || '').toLowerCase()
      const idx = list.findIndex(function (n) {
        if (id && n === id) return true
        if (l && n.toLowerCase() === l) return true
        if (id) {
          const mapped = readLabelIdMap()[n]
          if (mapped && mapped === id) return true
        }
        return false
      })
      if (idx >= 0) list.splice(idx, 1)
      else list.push(id || label)
      writeWhitelist(list)
      refreshAll()
    }

    /** b65: re-resolve a LIVE sidebar row by its original aria-label right
     * before an action mutates it (rename editor insertion). The row the
     * context menu captured may have been replaced by a host re-render while
     * the menu sat open. kind: 'panel' | 'family' — same matchers as
     * handleContext. Returns null when no connected row matches. */
    function findRowByLabel(label, kind) {
      if (typeof document === 'undefined' || !label) return null
      try {
        if (kind !== 'family') {
          const nav = findPanelListNav()
          if (nav) {
            for (const row of findPanelRows(nav)) {
              const l = (row.getAttribute('aria-label') || row.textContent || '').trim()
              if (l === label && row.isConnected) return row
            }
          }
        }
        for (const fam of findFamilyRows()) {
          const l = (fam.getAttribute('aria-label') || rowLabel(fam) || '').trim()
          if (l === label && fam.isConnected) return fam
        }
      } catch (error) {
        /* fall through */
      }
      return null
    }

    /** Global contextmenu listener: match sidebar rows via structural checks
     * (panel rows are buttons inside the panel-list nav; family rows via the
     * anchor-nav span). Non-matching right-clicks are ignored entirely. */
    function handleContext(event) {
      if (typeof document === 'undefined') return
      try {
        const nav = findPanelListNav()
        if (nav) {
          const panelRows = findPanelRows(nav)
          for (const row of panelRows) {
            if (row.contains(event.target)) {
              openCtxMenu(event, row, 'panel')
              return
            }
          }
        }
        for (const fam of findFamilyRows()) {
          if (fam.contains(event.target)) {
            openCtxMenu(event, fam, 'family')
            return
          }
        }
      } catch (error) {
        /* never break the host's own context menu on internal errors */
      }
    }

    // ---------------------------------------------------------- command palette

    // ---------------------------------------------------------- recent queue

    /** MRU queue of recently opened panel labels (C1, v0.13.0). */
    function readRecent() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]')
        if (!Array.isArray(parsed)) return []
        const seen = {}
        const out = []
        for (const item of parsed) {
          if (typeof item !== 'string' || !item || seen[item]) continue
          seen[item] = true
          out.push(item)
        }
        return out.slice(0, RECENT_CAP)
      } catch (error) {
        /* fall through */
      }
      return []
    }

    function writeRecent(arr) {
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, RECENT_CAP)))
      } catch (error) {
        /* session-only */
      }
    }

    /** Record a panel open: newest first, deduped, capped. Empty labels skip. */
    function recordRecent(label) {
      if (typeof label !== 'string' || !label.trim()) return
      const next = [label].concat(readRecent().filter(function (l) {
        return l !== label
      }))
      writeRecent(next)
    }

    // v1.1.0 b60: the entire "open host Settings" machinery
    // (openSettingsPage / domProbeOpenSettings / fiber / avatar / synthetic
    // event paths) was REMOVED. Every synthetic route is ignored by the
    // Electron host (isTrusted enforcement) and the settings trigger div is
    // not React-rendered (b59 diagnostics: "DIV fired=N" — no __reactProps$
    // key). The palette "Open Settings" command is gone with it.
    // scheduleSectionClick (settings-left-nav row clicker) was removed too:
    // with openSettingsPage gone it has no callers.

    /**
     * Ctrl+K command palette: the panels overlay in a centered palette shell
     * plus a quick-commands group. Reuses openOverlay's whole render path —
     * we flip a mode flag before calling it, and the shared builder appends
     * the command group and the centered class when the flag is set.
     */
    let paletteMode = false

    function openPalette() {
      closeCtxMenu()
      paletteMode = true
      try {
        openOverlay(null) // no launcher: palette positions centered
      } finally {
        paletteMode = false
      }
    }

    /** Toggle via host layout API when present, else fail soft with a toast. */
    function openPaletteSafe() {
      try {
        const nav = findPanelListNav()
        const famRows = findFamilyRows()
        if (!nav && famRows.length === 0) {
          showToast(zh ? '侧栏尚未就绪，稍后再试' : 'Sidebar is not ready yet — try again shortly')
          return
        }
        openPalette()
      } catch (error) {
        try {
          console.error('[dsh-panel-pins] palette failed:', error)
        } catch (ignored) {
          /* ignore */
        }
      }
    }

    /**
     * v1.9.0 (P1-1): register the single slash-menu command. Returns true
     * when registered (or definitively impossible), false when the caller
     * should retry — the commands service mounts later in boot than us.
     * Duplicate names throw at registration; the catch reports "done" so a
     * colliding name never turns into a retry loop.
     */
    let slashCommandRegistered = false
    function tryRegisterSlashCommand() {
      if (slashCommandRegistered) return true
      try {
        const commandUi = optionalService('commandUi')
        if (!commandUi || typeof commandUi.register !== 'function') return false
        commandUi.register({
          name: 'panel-launcher',
          label: function () {
            return LABEL.cmdLauncher
          },
          description: function () {
            return LABEL.cmdLauncherDesc
          },
          available: function () {
            return true
          },
            ui: {
                kind: 'action',
                // ActionSpec ignores the session; the palette self-guards
                // (openPaletteSafe toasts when the sidebar is not ready).
                run: function () {
                  openPaletteSafe()
                },
              },
        })
        slashCommandRegistered = true
        return true
      } catch (error) {
        // Duplicate name / contract drift: give up, the row is sugar.
        slashCommandRegistered = true
        return true
      }
    }

