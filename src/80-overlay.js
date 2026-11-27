    /** Build the floating menu that lists every panel and plugin entry. */
    function openOverlay(launcher) {
      closeOverlay()
      const nav = findPanelListNav()
      // Palette mode passes launcher=null (centered positioning) — only bail
      // when there is genuinely nothing to show.
      if (!nav && !paletteMode) return
      if (!nav && paletteMode === false && !launcher) return
      const liveRows = nav ? findPanelRows(nav) : []
      const famRows = findFamilyRows().filter(function (row) {
        if (isRowHidden(rowLabel(row))) return false // v1.1.0 hidden rows
        return !isWhitelistedLabelOrMapped(rowLabel(row))
      })
      // b76: opt-in footer entries (kanban etc.) join the family group —
      // collected or not, the menu is where they stay reachable from the
      // top of the sidebar.
      findFooterRows().forEach(function (row) {
        if (isRowHidden(rowLabel(row))) return
        if (isWhitelistedLabelOrMapped(rowLabel(row))) return
        famRows.push(row)
      })
      // Merged FULL panel inventory (visible rows + unpinned store + host-fed
      // entries): the menu becomes the single place to reach any panel, even
      // unpinned ones. Whitelisted entries stay in the sidebar — not listed.
      // v1.1.0: user-hidden rows are excluded here too (Settings restores).
      const allPanels = readPanelList().filter(function (entry) {
        if (isRowHidden(entry.label)) return false
        return !isWhitelisted(entry.label, entry.idKnown ? entry.id : undefined)
      })
      // v1.6.0: the host's right-sidebar tab types. Enumerated here (before
      // the empty-menu guard) so a session whose ONLY reachable surfaces are
      // right-sidebar tabs still gets a menu.
      const rightTabs = rightSidebarAvailable() ? readRightSidebarTabs() : []
      if (allPanels.length === 0 && famRows.length === 0 && rightTabs.length === 0 && !paletteMode && bridgeSettings.entries.size === 0) return

      const box = document.createElement('div')
      box.className = paletteMode ? 'dpp-overlay dpp-palette' : 'dpp-overlay'
      // v1.7.1 ARIA: the overlay is a non-modal dialog that CONTAINS a
      // listbox — role="menu" was invalid here (an editable search input is
      // not a menu item) and left the rows' options without a proper owner.
      box.setAttribute('role', 'dialog')
      box.setAttribute('aria-label', paletteMode ? LABEL.ovPalette : LABEL.ovMenu)
      box.dataset.plugin = 'dsh-panel-pins'

      // v0.10.7: middle scroll region. Every list child (group heads, items,
      // empty state) appends here; the search input stays above it and the
      // footer rows + Ctrl+K hint stay below it — neither ever scrolls away
      // nor gets clipped by --dpp-overlay-max.
      const body = document.createElement('div')
      body.className = 'dpp-ov-body'
      body.setAttribute('role', 'listbox')
      body.setAttribute('id', 'dpp-ov-list')
      box.appendChild(body)

      // Searchable registry of every row the menu renders. Built while the
      // groups are appended; drives the filter box and ↑↓ navigation below.
      const menuItems = []

      // v1.0.0 b40: preset NAME-MODE state at openOverlay scope. The palette
      // cmd block assigns enterPresetNameMode later (it needs `search`,
      // declared further down); the keydown handler near the search input
      // reads both. Declaring them here keeps one scope for flag + function.
      let presetNameMode = false
      let enterPresetNameMode = null

      // Palette mode: quick-commands group first (toggle actions that
      // otherwise live at the overlay's bottom or deep in Settings).
      if (paletteMode) {
        makeGroupHead(body, 'cmd', LABEL.cmdTitle, '')
        function cmdItem(iconD, text, action) {
          const item = document.createElement('button')
          item.type = 'button'
          item.className = 'dpp-ov-item'
          item.setAttribute('role', 'option')
          item.setAttribute('aria-selected', 'false')
          const ico = document.createElement('span')
          ico.className = 'dpp-ov-ico'
          ico.appendChild(iconSvgPath(iconD, 16))
          item.appendChild(ico)
          const lbl = document.createElement('span')
          lbl.className = 'dpp-ov-lbl'
          lbl.textContent = text
          item.appendChild(lbl)
          item.addEventListener('click', function () {
            // v1.0.0 b40: preset naming needs the overlay to STAY OPEN (the
            // search input becomes the name field), so the save command opts
            // out of the auto-close. Every other command keeps the original
            // close-then-run behavior.
            const keepOpen = text === LABEL.cmdPresetSave
            if (!keepOpen) closeOverlay()
            try {
              action()
            } catch (error) {
              /* ignore */
            }
          })
          body.appendChild(item)
          menuItems.push({ el: item, text: text, group: 'cmd' })
        }
        cmdItem(ICON_CHEVRON_DOWN, readRowsHidden() ? LABEL.cmdShowRows : LABEL.cmdHideRows, function () {
          writeRowsHidden(!readRowsHidden())
          applyFold()
          ensureLauncher()
          adviseIfNoRows()
        })
        cmdItem(ICON_STACK, LABEL.cmdToggleFamily, function () {
          writeFamily(!readFamily())
          applyFamily()
        })
        cmdItem(ICON_GRID, LABEL.setIconOnly, function () {
          writeFlag(ICONONLY_KEY, !readIconOnly())
          applyIconOnly()
        })
        cmdItem(ICON_COMPACT, LABEL.cmdToggleTidy, function () {
          writeTidy(!readTidy())
          applyTidy()
        })
        // v1.3.3: palette feedback command. Opens the settings card's home
        // channels: the GitHub issue (primary) — the survey/diagnostics stay
        // on the card where the user can read the privacy note before acting.
        cmdItem(ICON_FEEDBACK, LABEL.cmdFeedback, function () {
          openFeedbackIssue()
        })
        // v1.1.0 b60: palette "Open Settings" command removed — the host
        // ignores every synthetic path (keyboard/mouse/React fiber) because
        // Electron requires isTrusted events and the trigger div is not
        // React-rendered (b59 diagnostics: "DIV fired=N").
        // v1.0.0 layout presets: one "save" command + one switch command per
        // stored preset. window.prompt is NOT available in Electron renderer
        // ("prompt() is and will not be supported"), so the save path reuses
        // the search input as a name field. The name-mode wiring itself lives
        // right after the search input is created (see PRESET NAME MODE
        // below) — it must attach listeners there because `search` is a
        // later const; touching it here would be a TDZ ReferenceError.
        // v1.0.0 b40 scope fix: the flag itself also lives at openOverlay
        // scope (declared near the top of this function) so the name-mode
        // keydown handler attached further down can see it — this if-block
        // closes before `search` exists.
        enterPresetNameMode = function () {
          presetNameMode = true
          search.value = ''
          search.placeholder = LABEL.cmdPresetSavePrompt
          applyFilter()
          try {
            search.focus()
          } catch (error) {
            /* ignore */
          }
        }
        cmdItem(ICON_PIN, LABEL.cmdPresetSave, function () {
          enterPresetNameMode()
        })
        const presetNames = Object.keys(readPresets())
        if (presetNames.length === 0) {
          cmdItem(ICON_PIN, LABEL.cmdPresetNone, function () {
            showToast(LABEL.presetEmptyHint)
          })
        } else {
          presetNames.forEach(function (pn) {
            cmdItem(ICON_PIN, LABEL.cmdPresetPrefix + pn, function () {
              try {
                if (applyPreset(pn)) {
                  showToast(LABEL.presetApplied.replace('NAME', pn))
                  return
                }
              } catch (error) {
                /* fall through to the fallback */
              }
              showToast(LABEL.presetApplyFailed.replace('NAME', pn))
            })
          })
        }
      }

      // C1 (v0.13.0): Recent group — MRU panel opens, rendered before the
      // full panel group in BOTH modes (palette and overlay). Only labels
      // that still resolve to an inventory entry are shown; every click
      // re-records (newest first). Search, keyboard nav, Alt+N and fold
      // memory all work automatically because the rows go through the same
      // menuItems/group-head machinery.
      const recentLabels = readRecent().filter(function (rl) {
        return allPanels.some(function (e) { return (e.label || '') === rl })
      })
      if (recentLabels.length > 1 || (recentLabels.length === 1 && allPanels.length > 1)) {
        makeGroupHead(body, 'recent', LABEL.recentTitle, '')
        recentLabels.forEach(function (rl) {
          const entry = allPanels.filter(function (e) { return (e.label || '') === rl })[0]
          if (!entry) return
          const item = document.createElement('button')
          item.type = 'button'
          item.className = 'dpp-ov-item'
          item.setAttribute('role', 'option')
          item.setAttribute('aria-selected', 'false')

          const ico = document.createElement('span')
          ico.className = 'dpp-ov-ico'
          const row = rowForEntry(entry, liveRows)
          const svg = row ? svgClone(row, 16) : null
          if (svg) ico.appendChild(svg)
          else ico.appendChild(letterBadge(rl))
          item.appendChild(ico)

          const lbl = document.createElement('span')
          lbl.className = 'dpp-ov-lbl'
          lbl.textContent = rl
          item.appendChild(lbl)

          if (row && row.getAttribute('aria-current') === 'page') {
            const dot = document.createElement('span')
            dot.className = 'dpp-ov-dot'
            item.appendChild(dot)
          }

          item.addEventListener('click', function () {
            closeOverlay()
            openPanelEntry(entry, row) // openPanelEntry records the recency
          })
          body.appendChild(item)
          menuItems.push({ el: item, text: rl, group: 'recent' })
        })
      }

      // v1.0.0 custom groups: entries assigned to a user group are pulled out
      // of the global list and rendered under their own group heads (inserted
      // right after the global group). One shared row builder keeps every
      // group's items identical (icon, dot, hover actions, click behavior).
      const cgAssigned = customGroupedLabels()
      const globalPanels = []
      const cgRows = {} // gid -> [{entry, label}]
      allPanels.forEach(function (entry) {
        const label = entry.label || LABEL.unnamed
        if (cgAssigned[label]) {
          Object.keys(readCustomGroups()).forEach(function (gid) {
            const g = readCustomGroups()[gid]
            if (g && Array.isArray(g.labels) && g.labels.indexOf(label) !== -1) {
              if (!cgRows[gid]) cgRows[gid] = []
              cgRows[gid].push({ entry: entry, label: label })
            }
          })
        } else {
          globalPanels.push(entry)
        }
      })

      // b74: the menu must agree with the sidebar's VISUAL order. The
      // sidebar paints top pins (-20000..) first, then drag-reordered rows
      // (row-order store, -15000..), then the host default. The merged
      // inventory arrives in host DOM order, so without a sort the menu
      // listed rows in an order the sidebar no longer showed.
      const roLabels = readRowOrder()
      const tpins = readTopPins()
      const lmap = readLabelIdMap()
      const menuRank = globalPanels.map(function (entry, i) {
        const label = entry.label || ''
        const ti = topPinIndexFor(label, lmap, tpins)
        if (ti !== -1) return { entry: entry, i: i, rank: 0, idx: ti }
        const ri = roLabels.indexOf(label)
        if (ri !== -1) return { entry: entry, i: i, rank: 1, idx: ri }
        return { entry: entry, i: i, rank: 2, idx: 0 }
      })
      menuRank.sort(function (a, b) {
        if (a.rank !== b.rank) return a.rank - b.rank
        if (a.rank === 2) return a.i - b.i // unordered rows keep host order
        if (a.idx !== b.idx) return a.idx - b.idx
        return a.i - b.i
      })
      globalPanels.length = 0
      menuRank.forEach(function (x) { globalPanels.push(x.entry) })

      // Global group head: badge must count what this group actually RENDERS
      // (globalPanels), not the merged inventory — assigned entries moved to
      // their own groups would otherwise inflate the number by one each.
      // Hidden entirely when every panel lives in a custom group (non-palette
      // keeps the head for parity with the old always-show behavior only when
      // no custom groups claim anything).
      let cgRowCount = 0
      Object.keys(cgRows).forEach(function (gid) {
        cgRowCount += cgRows[gid].length
      })
      if (globalPanels.length > 0 || (cgRowCount === 0 && paletteMode === false)) {
        makeGroupHead(body, 'panel', LABEL.groupPanels, globalPanels.length > 0 ? String(globalPanels.length) : '')
      }

      function buildPanelItem(entry, label) {
        const item = document.createElement('button')
        item.type = 'button'
        item.className = 'dpp-ov-item'
        item.setAttribute('role', 'option')
        item.setAttribute('aria-selected', 'false')

        const ico = document.createElement('span')
        ico.className = 'dpp-ov-ico'
        const row = rowForEntry(entry, liveRows)
        const svg = row ? svgClone(row, 16) : null
        if (svg) ico.appendChild(svg)
        else ico.appendChild(letterBadge(label))
        item.appendChild(ico)

        const lbl = document.createElement('span')
        lbl.className = 'dpp-ov-lbl'
        lbl.textContent = displayNameFor(label)
        item.appendChild(lbl)

        if (!entry.pinned) {
          item.classList.add('dpp-ov-unpinned')
        }

        if (row && row.getAttribute('aria-current') === 'page') {
          const dot = document.createElement('span')
          dot.className = 'dpp-ov-dot'
          item.appendChild(dot)
        }

        // Hover actions: pin/unpin + to-top (desktop pointer only; CSS shows
        // them on hover, buttons remain keyboard-reachable via tab order).
        if (entry.idKnown) {
          item.appendChild(buildOverlayActs(entry, launcher))
        }

        item.addEventListener('click', function () {
          closeOverlay()
          openPanelEntry(entry, row)
        })
        return item
      }

      // Panel items come from the MERGED inventory (visible + unpinned),
      // minus the ones a custom group claims. Unpinned entries open via
      // temporary-pin "peek" (openPanelEntry). v1.1.0: hidden rows are
      // excluded (they live in Settings' restore list until unhidden).
      globalPanels.forEach(function (entry) {
        const label = entry.label || LABEL.unnamed
        if (isRowHidden(label)) return
        const item = buildPanelItem(entry, label)
        body.appendChild(item)
        menuItems.push({ el: item, text: label, group: 'panel' })
      })

      // v1.5.0 (b95): third-party panels registered in the root `main` slot.
      // They have no sidebar row of their own, so without this group they
      // are unreachable from the launcher. The group only appears when the
      // layout service can actually open a panel.
      const mainPanels = readMainPanels()
      if (mainPanels.length > 0 && (function () {
        try {
          const layout = optionalService('layout')
          return !!(layout && typeof layout.selectPanel === 'function')
        } catch (error) {
          return false
        }
      })()) {
        makeGroupHead(body, 'main', LABEL.groupMain, String(mainPanels.length))
        mainPanels.forEach(function (entry) {
          const item = document.createElement('button')
          item.type = 'button'
          item.className = 'dpp-ov-item'
          item.setAttribute('role', 'option')
          item.setAttribute('aria-selected', 'false')
          const ico = document.createElement('span')
          ico.className = 'dpp-ov-ico'
          ico.appendChild(letterBadge(entry.label))
          item.appendChild(ico)
          const lbl = document.createElement('span')
          lbl.className = 'dpp-ov-lbl'
          lbl.textContent = entry.label
          item.appendChild(lbl)
          item.addEventListener('click', function () {
            closeOverlay()
            try {
              const layout = optionalService('layout')
              if (layout && typeof layout.selectPanel === 'function') {
                layout.selectPanel(entry.key)
                return
              }
            } catch (error) {
              showToast(
                zh ? '这个面板已不可用' : 'That panel is no longer available',
              )
              return
            }
            showToast(zh ? '宿主未提供面板切换能力' : 'The host cannot switch panels')
          })
          body.appendChild(item)
          menuItems.push({ el: item, text: entry.label, group: 'main' })
        })
      }

      // v1.6.0: the host's right-sidebar tab types (page types only). They
      // live in the right column, not the sidebar, but they are the same kind
      // of thing the launcher exists for: a panel you cannot reach by
      // clicking around. The group only appears when the host can actually
      // open a tab right now.
      if (rightTabs.length > 0) {
        makeGroupHead(body, 'right', LABEL.groupRight, String(rightTabs.length))
        rightTabs.forEach(function (entry) {
          const item = document.createElement('button')
          item.type = 'button'
          item.className = 'dpp-ov-item'
          item.setAttribute('role', 'option')
          item.setAttribute('aria-selected', 'false')
          const ico = document.createElement('span')
          ico.className = 'dpp-ov-ico'
          ico.appendChild(letterBadge(entry.label))
          item.appendChild(ico)
          const lbl = document.createElement('span')
          lbl.className = 'dpp-ov-lbl'
          lbl.textContent = entry.label
          item.appendChild(lbl)
          item.addEventListener('click', function () {
            closeOverlay()
            if (openRightSidebarTab(entry.kind)) return
            showToast(zh ? '这个标签页已不可用' : 'That tab is no longer available')
          })
          body.appendChild(item)
          menuItems.push({ el: item, text: entry.label, group: 'right' })
        })
      }

      // Custom group heads + their items, after the global group.
      const groups = readCustomGroups()
      Object.keys(groups).forEach(function (gid) {
        const rows = cgRows[gid]
        if (!rows || rows.length === 0) return // empty groups stay hidden
        makeGroupHead(body, 'cg:' + gid, groups[gid].name || gid, String(rows.length))
        rows.forEach(function (pair) {
          const item = buildPanelItem(pair.entry, pair.label)
          body.appendChild(item)
          menuItems.push({ el: item, text: pair.label, group: 'cg:' + gid })
        })
      })

      // v1.4.0: bridged settings pages — one group, only while entries exist
      // and the toggle is ON. Clicking selects the bridge panel (no sidebar
      // row exists to click through); the layout service is mandatory here,
      // so without it the whole group hides (no dead rows).
      if (readBridge() && bridgeSettings.entries.size > 0 && (function () {
        try {
          const layout = optionalService('layout')
          return !!(layout && typeof layout.selectPanel === 'function')
        } catch (error) {
          return false
        }
      })()) {
        makeGroupHead(body, 'bridge', LABEL.bridgeGroup, String(bridgeSettings.entries.size))
        bridgeSettings.entries.forEach(function (record, bridgeId) {
          const label = record.label || record.sectionId
          const item = document.createElement('button')
          item.type = 'button'
          item.className = 'dpp-ov-item dpp-ov-unpinned'
          item.setAttribute('role', 'option')
          item.setAttribute('aria-selected', 'false')
          item.dataset.dppBridge = bridgeId
          const ico = document.createElement('span')
          ico.className = 'dpp-ov-ico'
          ico.appendChild(letterBadge(label))
          item.appendChild(ico)
          const lbl = document.createElement('span')
          lbl.className = 'dpp-ov-lbl'
          lbl.textContent = label
          item.appendChild(lbl)
          item.addEventListener('click', function () {
            closeOverlay()
            try {
              const layout = optionalService('layout')
              if (layout && typeof layout.selectPanel === 'function') {
                layout.selectPanel(bridgeId)
              }
            } catch (error) {
              /* selectPanel throws for unregistered keys (rc.5 contract) —
                 the bridge row is gone but the overlay closed cleanly */
            }
          })
          body.appendChild(item)
          menuItems.push({ el: item, text: label, group: 'bridge' })
        })
      }

      // Plugin entry rows (family rows), grouped separately. Clicking an item
      // fires the ORIGINAL control; bottom entries are never listed here.
      // (Rows stay listed even while collected/hidden — that's where to find
      // them: hidden ≠ gone.)
      if (famRows.length > 0) {
        makeGroupHead(body, 'family', LABEL.groupFamily, String(famRows.length))
        famRows.forEach(function (row) {
          const label = rowLabel(row) || LABEL.unnamed
          const item = document.createElement('button')
          item.type = 'button'
          item.className = 'dpp-ov-item'
          item.setAttribute('role', 'option')
          item.setAttribute('aria-selected', 'false')

          const ico = document.createElement('span')
          ico.className = 'dpp-ov-ico'
          const svg = rowIcon(row)
          if (svg) ico.appendChild(svg)
          else ico.appendChild(letterBadge(label))
          item.appendChild(ico)

          const lbl = document.createElement('span')
          lbl.className = 'dpp-ov-lbl'
          lbl.textContent = displayNameFor(label)
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
          body.appendChild(item)
          menuItems.push({ el: item, text: label, group: 'family' })
        })
      }

      // v1.1.1 (b67): hidden rows finally have a reachable restore surface.
      // A display:none row can never receive a right-click, so the ctx
      // menu's own "Unhide" item is dead UI once the hide took effect —
      // this group (alongside the Settings card) is the always-reachable
      // way back. Click = restore (writes + toast + refreshAll).
      const hiddenEntries = readHiddenEntries()
      if (hiddenEntries.length > 0) {
        makeGroupHead(body, 'hidden', LABEL.groupHidden, String(hiddenEntries.length))
        const hidMap = readLabelIdMap()
        hiddenEntries.forEach(function (entry) {
          const label = resolveEntryLabel(entry, hidMap) || entry.label
          const item = document.createElement('button')
          item.type = 'button'
          item.className = 'dpp-ov-item dpp-ov-unpinned'
          item.setAttribute('role', 'option')
          item.setAttribute('aria-selected', 'false')
          const ico = document.createElement('span')
          ico.className = 'dpp-ov-ico'
          ico.appendChild(letterBadge(label))
          item.appendChild(ico)
          const lbl = document.createElement('span')
          lbl.className = 'dpp-ov-lbl'
          lbl.textContent = displayNameFor(label)
          item.appendChild(lbl)
          item.addEventListener('click', function () {
            closeOverlay()
            const rows = readHiddenRows()
            const idx = rows.indexOf(label)
            if (idx !== -1) rows.splice(idx, 1)
            writeHiddenRows(rows)
            showToast((zh ? '已恢复显示「NAME」' : 'Restored "NAME"').replace('NAME', displayNameFor(label)))
            refreshAll()
          })
          body.appendChild(item)
          menuItems.push({ el: item, text: label, group: 'hidden' })
        })
      }

      // Filter + keyboard navigation. The search input sits ABOVE the
      // scrollable body (flex row pinned at the top); typing hides
      // non-matching items (and a group head with no visible children); ↑↓
      // move a highlight, Enter activates, Esc closes.
      const search = document.createElement('input')
      search.type = 'text'
      search.className = 'dpp-ov-search'
      search.placeholder = paletteMode ? LABEL.searchPh : LABEL.searchPh
      search.setAttribute('aria-label', LABEL.searchPh)
      // v1.7.1 ARIA: combobox pattern — the input owns the listbox below it
      // and exposes the keyboard highlight via aria-activedescendant.
      search.setAttribute('role', 'combobox')
      search.setAttribute('aria-expanded', 'true')
      search.setAttribute('aria-haspopup', 'listbox')
      search.setAttribute('aria-autocomplete', 'list')
      search.setAttribute('aria-controls', 'dpp-ov-list')
      search.setAttribute('autocomplete', 'off')
      search.setAttribute('spellcheck', 'false')
      box.insertBefore(search, body)

      const empty = document.createElement('div')
      empty.className = 'dpp-ov-empty'
      empty.textContent = LABEL.searchEmpty
      empty.setAttribute('role', 'status')
      empty.style.display = 'none'
      body.appendChild(empty)

      // C3 (v0.12.0): search hit highlight. Splits the row label around the
      // query and wraps matches in <mark class="dpp-mark">; rebuilding is
      // cheap (only the label span changes) and keeps the icon, dot and
      // hover-action cluster untouched. Escaping is unnecessary — the label
      // never enters innerHTML; every fragment goes through textContent.
      function applyMark(mi, q) {
        const lbl = mi.el.querySelector('.dpp-ov-lbl')
        if (!lbl) return
        const text = mi.display || mi.text
        if (!q) {
          // Restore the plain label and drop the query cache, or a repeat of
          // the same query would early-return below and skip the re-mark.
          if (lbl.firstChild && lbl.childNodes.length !== 1) {
            lbl.textContent = text
          } else if (lbl.textContent !== text) {
            lbl.textContent = text
          }
          lbl.removeAttribute('data-dpp-mark-q')
          return
        }
        const lower = text.toLowerCase()
        const idx = lower.indexOf(q)
        if (idx < 0) {
          if (lbl.textContent !== text) lbl.textContent = text
          return
        }
        if (lbl.getAttribute('data-dpp-mark-q') === q) return // already marked for this query
        lbl.textContent = ''
        lbl.setAttribute('data-dpp-mark-q', q)
        if (idx > 0) lbl.appendChild(document.createTextNode(text.slice(0, idx)))
        const mark = document.createElement('mark')
        mark.className = 'dpp-mark'
        mark.textContent = text.slice(idx, idx + q.length)
        lbl.appendChild(mark)
        if (idx + q.length < text.length) {
          lbl.appendChild(document.createTextNode(text.slice(idx + q.length)))
        }
      }

      let kbIndex = -1
      /** Which group a head belongs to: reads the group key we stamped on it. */
      function groupKeyOfHead(h) {
        return h.getAttribute('data-dpp-group') || ''
      }
      /**
       * Replay persisted fold states onto the built overlay: chevron, aria
       * AND the group body items. forceExpand=true shows everything (search
       * mode). This must run AFTER all groups/items are appended —
       * makeGroupHead's inline apply collapses an empty body and is lost as
       * items arrive later.
       */
      function replayGroupFolds(forceExpand) {
        const folds = forceExpand ? {} : readGroupFolds()
        for (const el of body.children) {
          if (!el.classList || !el.classList.contains('dpp-ov-ghead')) continue
          const key = el.getAttribute('data-dpp-group')
          const collapse = folds[key] === true
          el.setAttribute('aria-expanded', collapse ? 'false' : 'true')
          // Rotate the PATH (as makeGroupHead.apply does) — a transform on
          // the root <svg> is interpreted in the parent coordinate system
          // and throws the 12px glyph out of view.
          const chev = el.querySelector('.dpp-ov-gchev svg path')
          if (chev) chev.setAttribute('transform', collapse ? 'rotate(-90 10 10)' : '')
          let node = el.nextElementSibling
          while (node && !node.classList.contains('dpp-ov-ghead')) {
            if (node.classList.contains('dpp-ov-item')) {
              node.style.display = collapse ? 'none' : ''
            }
            node = node.nextElementSibling
          }
        }
      }
      /**
       * Rank the hits INSIDE each group. The group order never changes, so a
       * folded group keeps its place and the group heads stay adjacent to
       * their rows (replayGroupFolds walks head -> next sibling).
       *
       * With no query the original build order is restored — a previous
       * ranked search moved DOM nodes around, and clearing the box must put
       * everything back where the user left it.
       */
      function reorderGroups(scores, ranked) {
        const groups = new Map()
        menuItems.forEach(function (mi) {
          const key = mi.group || ''
          if (!groups.has(key)) groups.set(key, [])
          groups.get(key).push(mi)
        })
        groups.forEach(function (list) {
          if (list.length < 2) return
          let ordered = list
          if (ranked) {
            // Array.prototype.sort is stable: equal scores keep the original
            // order, so the ranking never shuffles equal rows.
            ordered = list.slice().sort(function (a, b) {
              return (scores.get(b.el) || 0) - (scores.get(a.el) || 0)
            })
          }
          const parent = list[0].el.parentNode
          if (!parent) return
          const anchor = list[0].el
          // Inserting each element right before the anchor keeps the sorted
          // order (the first insert lands closest to the anchor's old slot).
          ordered.forEach(function (mi) {
            try {
              parent.insertBefore(mi.el, anchor)
            } catch (error) {
              /* a detached row must not break the filter */
            }
          })
        })
      }
      function applyFilter() {
        const q = search.value.trim().toLowerCase()
        const heads = []
        for (const el of body.children) {
          if (el.classList && el.classList.contains('dpp-ov-head')) heads.push(el)
        }
        // While searching, fold states lose: every matching item must show.
        // replayGroupFolds(true) must run BEFORE the filter pass — it resets
        // item display wholesale, so running it after the filter resurrects
        // rows the filter just hid (b29 regression the v0.12.0 walkthrough
        // caught: search looked like it did nothing at all).
        if (q.length > 0) replayGroupFolds(true)
        let visibleCount = 0
        const scores = new Map()
        menuItems.forEach(function (mi) {
          // Match the DISPLAY name, not the raw label: a renamed row is what
          // the user sees, and the pinyin forms come from it too.
          mi.display = displayNameFor(mi.text)
          const match =
            q.length === 0 ? { hit: true, score: 0, mark: -1 } : matchLabel(mi.display, q)
          mi.el.style.display = match.hit ? '' : 'none'
          // Only a literal hit has a substring to highlight — sound hits
          // (pinyin) have no contiguous span in the label.
          applyMark(mi, match.mark >= 0 ? q : '')
          scores.set(mi.el, match.score)
          if (match.hit) visibleCount++
        })
        reorderGroups(scores, q.length > 0)
        if (q.length > 0) {
          heads.forEach(function (h) {
            h.style.display = ''
          })
        } else {
          // Restore persisted folds; then hide heads whose whole group is
          // folded OR fully filtered out.
          replayGroupFolds(false)
          heads.forEach(function (h) {
            let any = false
            let node = h.nextElementSibling
            while (node && !node.classList.contains('dpp-ov-head')) {
              if (node.style.display !== 'none') {
                any = true
                break
              }
              node = node.nextElementSibling
            }
            const folded = h.classList.contains('dpp-ov-ghead') &&
              h.getAttribute('aria-expanded') === 'false'
            h.style.display = any && !folded ? '' : 'none'
          })
        }
        empty.style.display = visibleCount === 0 ? '' : 'none'
        kbIndex = -1
        clearKb()
      }
      function visibleItems() {
        return menuItems.filter(function (mi) {
          return mi.el.style.display !== 'none'
        })
      }
      function clearKb() {
        for (const mi of menuItems) {
          mi.el.classList.remove('dpp-kb')
          mi.el.setAttribute('aria-selected', 'false')
        }
        try {
          search.removeAttribute('aria-activedescendant')
        } catch (error) {
          /* ignore */
        }
      }
      // v1.7.1 ARIA: options need stable ids for aria-activedescendant.
      let kbOptSeq = 0
      function setKb(idx) {
        const vis = visibleItems()
        if (vis.length === 0) return
        kbIndex = ((idx % vis.length) + vis.length) % vis.length
        clearKb()
        const target = vis[kbIndex]
        target.el.classList.add('dpp-kb')
        target.el.setAttribute('aria-selected', 'true')
        try {
          if (!target.el.id) target.el.id = 'dpp-ov-opt-' + String(++kbOptSeq)
          search.setAttribute('aria-activedescendant', target.el.id)
        } catch (error) {
          /* ignore */
        }
        try {
          target.el.scrollIntoView({ block: 'nearest' })
        } catch (error) {
          /* older engines without options */
        }
      }
      search.addEventListener('input', applyFilter)
      search.addEventListener('keydown', function (event) {
        // v1.5.0 (b95): the host's shortcut resolver passes in editable
        // regions, and our own search box IS an editable region — so the
        // palette closes here instead of through the host binding.
        if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'k') {
          event.preventDefault()
          event.stopPropagation()
          closeOverlay()
          return
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          event.stopPropagation()
          setKb(kbIndex + 1)
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          event.stopPropagation()
          setKb(kbIndex - 1)
        } else if (event.key === 'Enter') {
          event.preventDefault()
          event.stopPropagation()
          const vis = visibleItems()
          if (kbIndex >= 0 && kbIndex < vis.length) vis[kbIndex].el.click()
          else if (vis.length === 1) vis[0].el.click()
        }
      })
      // PRESET NAME MODE (v1.0.0 b40): while entering a preset name the
      // search input is repurposed — Enter commits, Escape cancels. This
      // handler runs after the navigation handler above; in name mode Enter
      // is consumed here (stopPropagation) so keyboard activation cannot
      // fire while naming. presetNameMode/enterPresetNameMode are shared
      // with the palette cmd block via openOverlay scope.
      search.addEventListener('keydown', function (event) {
        if (!presetNameMode) return
        if (event.key === 'Enter') {
          event.preventDefault()
          event.stopPropagation()
          const n = search.value.trim()
          presetNameMode = false
          search.placeholder = LABEL.searchPh
          search.value = ''
          applyFilter()
          if (!n) {
            showToast(LABEL.presetNameRequired)
            return
          }
          try {
            if (savePreset(n)) showToast(LABEL.presetSavedAs.replace('NAME', n))
          } catch (error) {
            /* ignore */
          }
        } else if (event.key === 'Escape') {
          // Leave name mode without saving (Esc also closes the overlay via
          // the document handler; stopping here keeps the box clean).
          presetNameMode = false
          search.placeholder = LABEL.searchPh
          search.value = ''
          applyFilter()
        }
      })

      // Bottom toggle rows: skipped in palette mode (quick-commands already
      // cover them, and the palette searches those too).
      if (!paletteMode) {
        const foot = document.createElement('button')
        foot.type = 'button'
        foot.className = 'dpp-ov-item dpp-ov-foot'
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
          adviseIfNoRows()
        })
        box.appendChild(foot)

        // Plugin-rows toggle: fold/unfold the third-party entry rows between
        // the new-session anchor and the panel list. Bottom entries stay put.
        const fam = document.createElement('button')
        fam.type = 'button'
        fam.className = 'dpp-ov-item'
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

        // Shortcut discoverability: one muted hint line at the very bottom.
        // v1.2.1: documents the full keyboard surface (search/Enter/Esc/Alt+N),
        // not just Ctrl+K — the exclusive features deserve findability.
        // v1.2.2: documents row drag, since a hover-less gesture is invisible
        // without a written hint.
        const hint = document.createElement('div')
        hint.className = 'dpp-ov-hint'
        hint.textContent = zh
          ? '输入即搜 · Enter 打开 · Esc 关闭 · Alt+数字直达 · Ctrl+K 快速命令 · 按住侧栏行可拖动排序'
          : 'Type to search · Enter opens · Esc closes · Alt+N jumps · Ctrl+K quick commands · drag sidebar rows to reorder'
        box.appendChild(hint)
      }

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
        if (!event) return
        if (event.key === 'Escape') {
          closeOverlay()
          return
        }
        // C2 (v0.12.0): Alt+1..9 activates the Nth visible item directly.
        // Runs BEFORE the search-input guard on purpose — the palette opens
        // with the search box focused, and this shortcut must work from
        // there. Digits match by event.code too (layout-stable, covers
        // numpad); Ctrl/Meta combos are left to the host.
        if (
          event.altKey && !event.ctrlKey && !event.metaKey &&
          (/^[1-9]$/.test(event.key) || /^Digit[1-9]$/.test(event.code) || /^Numpad[1-9]$/.test(event.code))
        ) {
          const n = Number((/^Digit|^Numpad/.test(event.code) ? event.code.slice(-1) : event.key)) - 1
          const vis = visibleItems()
          if (vis[n]) {
            event.preventDefault()
            event.stopPropagation()
            vis[n].el.click()
            return
          }
          // Out of range: fall through (don't swallow host shortcuts).
        }
        if (event.target === search) return // the input handles its own keys
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setKb(kbIndex + 1)
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          setKb(kbIndex - 1)
        } else if (event.key === 'Enter') {
          const vis = visibleItems()
          if (kbIndex >= 0 && kbIndex < vis.length) {
            event.preventDefault()
            vis[kbIndex].el.click()
          }
        }
      }
      document.addEventListener('pointerdown', onDown, true)
      document.addEventListener('keydown', onKey, true)
      overlayCleanup = function () {
        document.removeEventListener('pointerdown', onDown, true)
        document.removeEventListener('keydown', onKey, true)
      }
      // Re-apply persisted group folds AFTER every group and item exists.
      // makeGroupHead's initial apply(true) runs while its group body is still
      // empty (items are appended after the head), so it collapses nothing —
      // the folded state must be replayed here or re-opens lose the memory.
      try {
        replayGroupFolds()
      } catch (error) {
        /* fold memory is cosmetic */
      }
      // Focus the search box so typing filters immediately (re-open keeps
      // this behavior — the box is rebuilt every open).
      try {
        search.focus()
      } catch (error) {
        /* focus can fail on hidden containers */
      }
    }

