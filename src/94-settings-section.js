    /**
     * The Settings page section body. Registered into `settings.section`
     * (same contract as the official ui-settings-* packages): the host shows
     * it as its own column in the Settings navigation. Every control writes
     * straight to localStorage and re-applies live.
     */
    function PanelPinsSettingsSection() {
      const [rowsHid, setRowsHid] = React.useState(readRowsHidden())
      const [family, setFamily] = React.useState(readFamily())
      const [iconOnly, setIconOnly] = React.useState(readIconOnly())
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
      // v1.0.0: layout presets + custom panel groups (own cards below).
      const [presets, setPresets] = React.useState(function () {
        try {
          return readPresets()
        } catch (error) {
          return {}
        }
      })
      const [cgroups, setCgroups] = React.useState(function () {
        try {
          return readCustomGroups()
        } catch (error) {
          return {}
        }
      })
      // v1.1.0: user-hidden rows (restore list) + display renames (reset list).
      const [hiddenRows, setHiddenRows] = React.useState(function () {
        try {
          return readHiddenRows()
        } catch (error) {
          return []
        }
      })
      const [renames, setRenames] = React.useState(function () {
        try {
          return readRenames()
        } catch (error) {
          return {}
        }
      })
      // v1.2.2: custom row order — the card shows itself only while non-empty.
      const [rowOrder, setRowOrder] = React.useState(function () {
        try {
          return readRowOrder()
        } catch (error) {
          return []
        }
      })
      // v1.4.0: settings-page bridge toggle.
      const [bridgeOn, setBridgeOn] = React.useState(readBridge())
      // v1.6.0: follow a host language change while this section stays open.
      // The section's own copy lives in the plugin's LABEL table, which
      // refreshLocale() rebuilds in place; this state bump is what makes
      // React re-render the section against the new labels.
      const [, setLocaleRev] = React.useState(0)
      React.useEffect(function () {
        return onLocaleChange(function () {
          setLocaleRev(function (rev) {
            return rev + 1
          })
        })
      }, [])
      // b67: these two cards used to snapshot localStorage ONCE at mount and
      // never hear about writes made elsewhere (ctx menu hide/rename, overlay
      // restore) — the "card says empty but the store has data" bug. The DOM
      // `storage` event does not fire in the writing document, so writers
      // dispatch 'dpp:store-changed' instead (see notifyStoreChange).
      React.useEffect(function () {
        const handler = function (event) {
          try {
            const key = event && event.detail && event.detail.key
            if (key === 'hidden') setHiddenRows(readHiddenRows())
            else if (key === 'renames') setRenames(readRenames())
            else if (key === 'row-order') setRowOrder(readRowOrder())
          } catch (error) {
            /* React guard */
          }
        }
        window.addEventListener('dpp:store-changed', handler)
        return function () { window.removeEventListener('dpp:store-changed', handler) }
      }, [])
      // Self-diagnosis for top pins: how many stored pins matched sidebar rows.
      let topStats = { stored: 0, matched: 0 }
      try {
        const topNav = findPanelListNav()
        if (topNav) topStats = applyTopPinsToNav(topNav)
      } catch (error) {
        /* sidebar not ready */
      }

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
      // v1.4.0: bridge toggle — retracts or rebuilds every bridged page on
      // flip; the overlay group follows the same store on its next open.
      function toggleBridge() {
        const next = !readBridge()
        writeBridge(next)
        syncBridgeSettings()
        setBridgeOn(next)
      }
      function toggleIconOnly() {
        const next = !readIconOnly()
        writeFlag(ICONONLY_KEY, next)
        applyIconOnly()
        setIconOnly(next)
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
      function toggleWhitelistEntry(label, id) {
        // Store the ID when known (stable across UI-language switches); fall
        // back to the label for entries with no resolvable id yet. Toggling
        // removes ANY matching entry (id, label, or legacy label now mapped
        // to this id) so duplicates never accumulate across locale switches.
        const list = readWhitelist()
        const l = String(label || '').toLowerCase()
        const key = id || null
        const idx = list.findIndex(function (n) {
          if (key && n === key) return true
          if (l && n.toLowerCase() === l) return true
          if (key) {
            const mapped = readLabelIdMap()[n]
            if (mapped && mapped === key) return true
          }
          return false
        })
        if (idx >= 0) list.splice(idx, 1)
        else list.push(key || label)
        writeWhitelist(list)
        setWhitelist(readWhitelist())
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

      // ------- v1.0.0 layout presets (settings-page card) -------
      function savePresetFromInput() {
        try {
          const input = document.getElementById('dpp-preset-name')
          const n = input ? String(input.value || '').trim() : ''
          if (!n) {
            showToast(LABEL.presetNameRequired)
            return
          }
          if (savePreset(n)) {
            if (input) input.value = ''
            setPresets(readPresets())
            showToast(LABEL.presetSavedAs.replace('NAME', n))
          }
        } catch (error) {
          /* React guard */
        }
      }
      function applyPresetFromCard(name) {
        try {
          if (applyPreset(name)) {
            setPresets(readPresets())
            showToast(LABEL.presetApplied.replace('NAME', name))
          }
        } catch (error) {
          /* React guard */
        }
      }
      function deletePresetFromCard(name) {
        try {
          if (deletePreset(name)) {
            setPresets(readPresets())
            showToast(LABEL.presetDeleted.replace('NAME', name))
          }
        } catch (error) {
          /* React guard */
        }
      }

      // ------- v1.0.0 custom panel groups (settings-page card) -------
      function addGroupFromInput() {
        try {
          const input = document.getElementById('dpp-cg-name')
          const n = input ? String(input.value || '').trim() : ''
          if (!n) {
            showToast(LABEL.presetNameRequired)
            return
          }
          const groups = readCustomGroups()
          const gid = 'cg-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e4).toString(36)
          groups[gid] = { name: n, labels: [] }
          writeCustomGroups(groups)
          if (input) input.value = ''
          setCgroups(readCustomGroups())
          showToast(LABEL.cgSaved)
        } catch (error) {
          /* React guard */
        }
      }
      /**
       * Inline rename (v1.0.0 b39): window.prompt is not available in the
       * Electron renderer ("prompt() is and will not be supported"), so the
       * group title swaps to a text input in place; Enter commits, blur or
       * Escape cancels. Renaming state is tracked per group id.
       */
      const [renamingGid, setRenamingGid] = React.useState('')
      function renameGroup(gid) {
        setRenamingGid(gid)
      }
      function commitRename(gid, value) {
        const n = String(value || '').trim()
        setRenamingGid('')
        if (!n) return
        try {
          const groups = readCustomGroups()
          if (!groups[gid]) return
          groups[gid].name = n
          writeCustomGroups(groups)
          setCgroups(readCustomGroups())
          showToast(LABEL.cgSaved)
        } catch (error) {
          /* React guard */
        }
      }
      function deleteGroup(gid) {
        try {
          const groups = readCustomGroups()
          if (!groups[gid]) return
          delete groups[gid]
          writeCustomGroups(groups)
          setCgroups(readCustomGroups())
          showToast(LABEL.cgDeleted)
        } catch (error) {
          /* React guard */
        }
      }
      function addPanelToGroup(gid, label) {
        try {
          if (!label) return
          const groups = readCustomGroups()
          if (!groups[gid] || !Array.isArray(groups[gid].labels)) return
          if (groups[gid].labels.indexOf(label) !== -1) return
          groups[gid].labels.push(label)
          writeCustomGroups(groups)
          setCgroups(readCustomGroups())
          showToast(LABEL.cgSaved)
        } catch (error) {
          /* React guard */
        }
      }
      function removePanelFromGroup(gid, label) {
        try {
          const groups = readCustomGroups()
          if (!groups[gid] || !Array.isArray(groups[gid].labels)) return
          const idx = groups[gid].labels.indexOf(label)
          if (idx === -1) return
          groups[gid].labels.splice(idx, 1)
          writeCustomGroups(groups)
          setCgroups(readCustomGroups())
          showToast(LABEL.cgSaved)
        } catch (error) {
          /* React guard */
        }
      }
      /** Panels not yet claimed by ANY group — the add-panel dropdown source. */
      function ungroupedPanels() {
        try {
          const assigned = customGroupedLabels()
          return readPanelList().filter(function (p) {
            return !assigned[p.label]
          })
        } catch (error) {
          return []
        }
      }
      function toggleTopPin(id, label) {
        toggleTopPinStore(id, label)
        applyTopPins()
        setPanelList(readPanelList())
      }
      function reorderTopPins(srcId, dstId) {
        // Reorder TOP_KEY so srcId takes dstId's slot: remove src, insert
        // before dst. Then re-apply the CSS order replay. Both ids must be
        // top-pinned; anything else is a no-op.
        const list = readTopPins()
        const srcIdx = list.findIndex(function (e) {
          return e.id === srcId
        })
        const dstIdx = list.findIndex(function (e) {
          return e.id === dstId
        })
        if (srcIdx < 0 || dstIdx < 0) return
        const moved = list.splice(srcIdx, 1)[0]
        const newDstIdx = list.findIndex(function (e) {
          return e.id === dstId
        })
        list.splice(newDstIdx, 0, moved)
        writeTopPins(list)
        applyTopPins()
        setPanelList(readPanelList())
      }
      function reset() {
        // Layout reset only: toggles + sliders back to defaults. Pin and
        // whitelist DATA is deliberately kept — clearing it silently destroyed
        // the user's pin list, which read like a bug ("reset did not reset"
        // the other way: it reset too much). Use "Clear pins & whitelist"
        // below to wipe data explicitly.
        writeRowsHidden(true)
        writeFamily(true)
        writeFlag(ICONONLY_KEY, false)
        writeTidy(true)
        writeFlag(TIDY_QR_KEY, true)
        writeFlag(TIDY_BRAND_KEY, true)
        writeFlag(TIDY_METER_KEY, true)
        writePanelMax(PANEL_MAX_DEFAULT)
        writeFootMax(FOOT_MAX_DEFAULT)
        writeOverlayMax(OVERLAY_MAX_DEFAULT)
        writeQrSize(QR_SIZE_DEFAULT)
        applyFold()
        ensureLauncher()
        applyFamily()
        applyIconOnly()
        applyTidy()
        applyConfig()
        setRowsHid(true)
        setFamily(true)
        setIconOnly(false)
        setTidy(true)
        setTidyQr(true)
        setTidyBrand(true)
        setTidyMeter(true)
        setPanelMax(PANEL_MAX_DEFAULT)
        setFootMax(FOOT_MAX_DEFAULT)
        setOverlayMax(OVERLAY_MAX_DEFAULT)
        setQrSize(QR_SIZE_DEFAULT)
      }

      function clearData() {
        // Explicit data wipe: unpinned store, top pins and whitelist. Also
        // re-asserts pins into the host's memory-only store so panels come
        // back in the sidebar immediately.
        writeUnpinned(new Set())
        writeTopPins([])
        writeWhitelist([])
        try {
          const nav = findPanelListNav()
          if (nav) {
            Array.prototype.forEach.call(nav.children, function (el) {
              if (!el.getAttribute) return
              if (el.getAttribute('data-dpp-top') === '1') {
                el.removeAttribute('data-dpp-top')
                el.style.removeProperty('order')
              }
            })
          }
        } catch (error) {
          /* sidebar not ready */
        }
        Array.prototype.forEach.call(document.querySelectorAll('[data-dpp-hidden="1"]'), function (el) {
          el.style.display = ''
          delete el.dataset.dppHidden
        })
        if (typeof bridge.onPinnedChange === 'function' && Array.isArray(bridge.entries)) {
          bridge.entries.forEach(function (entry) {
            if (!entry || !entry.id || entry.id === 'plugins') return
            try {
              bridge.onPinnedChange(entry.id, true)
            } catch (error) {
              /* ignore */
            }
          })
        }
        setWhitelist([])
        setPanelList(readPanelList())
      }

      function refreshSettingsState() {
        // Re-read every persisted value into React state after a full import
        // (clipboard or file), so an open Settings page shows the imported
        // layout immediately.
        setRowsHid(readRowsHidden())
        setFamily(readFamily())
        setIconOnly(readIconOnly())
        setTidy(readTidy())
        setTidyQr(readTidyQr())
        setTidyBrand(readTidyBrand())
        setTidyMeter(readTidyMeter())
        setPanelMax(readPanelMax())
        setFootMax(readFootMax())
        setOverlayMax(readOverlayMax())
        setQrSize(readQrSize())
        setWhitelist(readWhitelist())
        setPanelList(readPanelList())
        // v1.2.2: row-order card follows imports and drag edits too.
        try {
          setRowOrder(readRowOrder())
        } catch (error) {
          /* card state is cosmetic */
        }
        // v1.0.0: refresh the preset/group cards after a full import.
        try {
          setPresets(readPresets())
          setCgroups(readCustomGroups())
        } catch (error) {
          /* card state is cosmetic */
        }
      }

      function exportSettings() {
        exportSettingsToClipboard()
      }

      function exportSettingsFile() {
        // v1.2.0: download the dump as a JSON file (factory-level).
        exportSettingsToFile()
      }

      function applyImportedDump(dump) {
        // Thin wrapper: factory-level replay (localStorage write + appliers),
        // then refresh the open Settings page's own React state.
        const ok = applyImportedDumpShared(dump)
        if (ok) refreshSettingsState()
        return ok
      }

      function importSettings() {
        // Read the clipboard, validate, write every key back, re-apply all.
        importSettingsFromClipboard()
      }

      function importSettingsFile() {
        // v1.2.0: pick a previously exported settings JSON file (factory-level
        // importSettingsFromFile opens the one-shot input).
        importSettingsFromFile()
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

      // v1.2.1: drag a settings JSON file onto the section to import it —
      // same sentinel validation and replay chain as the file-picker channel.
      // All handlers are defensive: drag UX must never throw into React.
      const dropHandlers = {
        onDragOver: function (event) {
          try {
            if (event && event.dataTransfer && Array.prototype.indexOf.call((event.dataTransfer.types || []), 'Files') !== -1) {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }
          } catch (error) {
            /* ignore */
          }
        },
        onDrop: function (event) {
          try {
            const dt = event && event.dataTransfer
            if (!dt) return
            const file = dt.files && dt.files[0]
            if (!file) return
            event.preventDefault()
            const reader = new FileReader()
            reader.onload = function () {
              const ok = importSettingsFromText(String(reader.result || ''), 'file')
              if (ok) refreshSettingsState()
            }
            reader.onerror = function () {
              showToast(zh ? '导入失败' : 'Import failed')
            }
            try {
              reader.readAsText(file)
            } catch (error) {
              showToast(zh ? '导入失败' : 'Import failed')
            }
          } catch (error) {
            /* ignore */
          }
        },
      }

      return h(
        'div',
        Object.assign({ className: 'dpp-set' }, dropHandlers),
        h('h2', { className: 'dpp-set-title' }, LABEL.setTitle),
        h('p', { className: 'dpp-set-intro' }, LABEL.setIntro),
        h(
          'div',
          { className: 'dpp-set-card' },
          switchRow(LABEL.setRows, LABEL.setRowsDetail, rowsHid, toggleRows),
          switchRow(LABEL.setFamily, LABEL.setFamilyDetail, family, toggleFamily),
          switchRow(LABEL.setIconOnly, LABEL.setIconOnlyDetail, iconOnly, toggleIconOnly),
          switchRow(LABEL.setTidy, LABEL.setTidyDetail, tidy, toggleTidy),
          switchRow(LABEL.bridgeTitle, LABEL.bridgeDetail, bridgeOn, toggleBridge),
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
            max: 80, // keep in sync with readPanelMax/writePanelMax clamp (8–80)
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
            : available.map(function (avail) {
                const rowId = avail.id || null
                return switchRow(
                  avail.label,
                  null,
                  isWhitelisted(avail.label, rowId),
                  function () {
                    toggleWhitelistEntry(avail.label, rowId)
                  },
                  'dpp-set-subrow',
                )
              }),
        ),
        // v1.0.0: layout presets card.
        h(
          'div',
          { className: 'dpp-set-card' },
          h(
            'div',
            { className: 'dpp-set-row' },
            h(
              'div',
              { className: 'dpp-set-texts' },
              h('div', { className: 'dpp-set-label' }, LABEL.presetTitle),
              h('div', { className: 'dpp-set-detail' }, LABEL.presetDetail),
            ),
          ),
          h(
            'div',
            { className: 'dpp-set-inputrow' },
            h('input', {
              id: 'dpp-preset-name',
              type: 'text',
              className: 'dpp-set-input',
              placeholder: LABEL.presetNamePh,
              onKeyDown: function (event) {
                if (event && event.key === 'Enter') {
                  event.preventDefault()
                  savePresetFromInput()
                }
              },
            }),
            h('button', { type: 'button', className: 'dpp-set-add', onClick: savePresetFromInput }, LABEL.presetSave),
          ),
          Object.keys(presets).length === 0
            ? h('div', { className: 'dpp-set-empty' }, LABEL.presetEmpty)
            : Object.keys(presets).map(function (name) {
                const active = readActivePreset() === name
                return h(
                  'div',
                  { className: 'dpp-set-row dpp-set-subrow', key: 'preset-' + name },
                  h(
                    'div',
                    { className: 'dpp-set-texts' },
                    h('div', { className: 'dpp-set-label' }, name + (active ? LABEL.presetActiveFlag : '')),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x',
                      disabled: active,
                      title: active ? LABEL.presetActiveFlag : LABEL.presetApply,
                      onClick: function () {
                        applyPresetFromCard(name)
                      },
                    },
                    LABEL.presetApply,
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x dpp-set-danger',
                      title: LABEL.presetDeleteTitle,
                      onClick: function (event) {
                        // Two-step confirm: first click arms, second deletes.
                        const btn = event.currentTarget
                        if (btn.getAttribute('data-dpp-armed') === '1') {
                          deletePresetFromCard(name)
                          return
                        }
                        btn.setAttribute('data-dpp-armed', '1')
                        btn.textContent = LABEL.presetDeleteConfirm
                        setTimeout(function () {
                          if (btn.isConnected) {
                            btn.removeAttribute('data-dpp-armed')
                            btn.textContent = LABEL.presetDelete
                          }
                        }, 3000)
                      },
                    },
                    LABEL.presetDelete,
                  ),
                )
              }),
        ),
        // v1.0.0: custom panel groups card.
        h(
          'div',
          { className: 'dpp-set-card' },
          h(
            'div',
            { className: 'dpp-set-row' },
            h(
              'div',
              { className: 'dpp-set-texts' },
              h('div', { className: 'dpp-set-label' }, LABEL.cgTitle),
              h('div', { className: 'dpp-set-detail' }, LABEL.cgDetail),
            ),
          ),
          h(
            'div',
            { className: 'dpp-set-inputrow' },
            h('input', {
              id: 'dpp-cg-name',
              type: 'text',
              className: 'dpp-set-input',
              placeholder: LABEL.cgNamePh,
              onKeyDown: function (event) {
                if (event && event.key === 'Enter') {
                  event.preventDefault()
                  addGroupFromInput()
                }
              },
            }),
            h('button', { type: 'button', className: 'dpp-set-add', onClick: addGroupFromInput }, LABEL.cgAdd),
          ),
          Object.keys(cgroups).length === 0
            ? h('div', { className: 'dpp-set-empty' }, LABEL.cgEmpty)
            : Object.keys(cgroups).map(function (gid) {
                const g = cgroups[gid] || { name: gid, labels: [] }
                const labels = Array.isArray(g.labels) ? g.labels : []
                const free = ungroupedPanels()
                return h(
                  'div',
                  { className: 'dpp-set-row dpp-set-subrow', key: 'cg-' + gid },
                  h(
                    'div',
                    { className: 'dpp-set-texts' },
                    renamingGid === gid
                      ? h('input', {
                          type: 'text',
                          className: 'dpp-set-input',
                          defaultValue: g.name || gid,
                          placeholder: LABEL.cgNamePh,
                          autoFocus: true,
                          onKeyDown: function (event) {
                            if (event && event.key === 'Enter') {
                              event.preventDefault()
                              commitRename(gid, event.target.value)
                            } else if (event && event.key === 'Escape') {
                              event.preventDefault()
                              setRenamingGid('')
                            }
                          },
                          onBlur: function (event) {
                            commitRename(gid, event.target.value)
                          },
                        })
                      : h('div', { className: 'dpp-set-label' }, g.name || gid),
                    labels.length === 0
                      ? h('div', { className: 'dpp-set-detail' }, LABEL.cgNoMembers)
                      : h(
                          'div',
                          { style: { marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' } },
                          labels.map(function (l) {
                            return h(
                              'span',
                              { className: 'dpp-set-chip', key: 'cg-chip-' + l },
                              h('span', { className: 'dpp-set-label' }, l),
                              h('span', {
                                className: 'dpp-set-x',
                                title: LABEL.cgRemovePanel,
                                onClick: function () {
                                  removePanelFromGroup(gid, l)
                                },
                              }, '×'),
                            )
                          }),
                        ),
                  ),
                  labels.length > 0 || free.length > 0
                    ? h(
                        'select',
                        {
                          className: 'dpp-set-input',
                          style: { maxWidth: '45%', flex: 'none', alignSelf: 'center' },
                          value: '',
                          onChange: function (event) {
                            addPanelToGroup(gid, event.target.value)
                            event.target.value = ''
                          },
                        },
                        h('option', { value: '' }, LABEL.cgAddPanel),
                        free.map(function (p) {
                          return h('option', { value: p.label, key: 'opt-' + p.id }, p.label)
                        }),
                      )
                    : null,
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x',
                      title: LABEL.cgRename,
                      onClick: function () {
                        renameGroup(gid)
                      },
                    },
                    LABEL.cgRename,
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x dpp-set-danger',
                      title: LABEL.cgDeleteTitle,
                      onClick: function (event) {
                        const btn = event.currentTarget
                        if (btn.getAttribute('data-dpp-armed') === '1') {
                          deleteGroup(gid)
                          return
                        }
                        btn.setAttribute('data-dpp-armed', '1')
                        btn.textContent = LABEL.presetDeleteConfirm
                        setTimeout(function () {
                          if (btn.isConnected) {
                            btn.removeAttribute('data-dpp-armed')
                            btn.textContent = LABEL.cgDelete
                          }
                        }, 3000)
                      },
                    },
                    LABEL.cgDelete,
                  ),
                )
              }),
          Object.keys(cgroups).length > 0
            ? h('div', { className: 'dpp-set-note' }, LABEL.cgAssignedNote)
            : null,
        ),
        // v1.1.0: hidden rows card — restore entries hidden from the context
        // menu. Shows the display name with the original label as detail.
        h(
          'div',
          { className: 'dpp-set-card' },
          h(
            'div',
            { className: 'dpp-set-row' },
            h(
              'div',
              { className: 'dpp-set-texts' },
              h('div', { className: 'dpp-set-label' }, LABEL.hiddenTitle),
              h('div', { className: 'dpp-set-detail' }, LABEL.hiddenDetail),
            ),
          ),
          hiddenRows.length === 0
            ? h('div', { className: 'dpp-set-empty' }, LABEL.hiddenEmpty)
            : hiddenRows.length >= 2
              ? h(
                  'div',
                  { className: 'dpp-set-row' },
                  h('div', { className: 'dpp-set-texts' }),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x',
                      onClick: function () {
                        try {
                          writeHiddenRows([])
                          setHiddenRows([])
                          showToast(LABEL.hiddenRestoreAllDone)
                          refreshAll()
                        } catch (error) {
                          /* React guard */
                        }
                      },
                    },
                    LABEL.hiddenRestoreAll,
                  ),
                )
              : null,
          hiddenRows.length === 0
            ? h('div', { className: 'dpp-set-empty' }, LABEL.hiddenEmpty)
            : hiddenRows.map(function (label) {
                return h(
                  'div',
                  { className: 'dpp-set-row dpp-set-subrow', key: 'hid-' + label },
                  h(
                    'div',
                    { className: 'dpp-set-texts' },
                    h('div', { className: 'dpp-set-label' }, displayNameFor(label)),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x',
                      onClick: function () {
                        try {
                          const rows = readHiddenRows()
                          const idx = rows.indexOf(label)
                          if (idx !== -1) rows.splice(idx, 1)
                          writeHiddenRows(rows)
                          setHiddenRows(rows.slice())
                          showToast((zh ? '已恢复显示「NAME」' : 'Restored "NAME"').replace('NAME', displayNameFor(label)))
                          refreshAll()
                        } catch (error) {
                          /* React guard */
                        }
                      },
                    },
                    LABEL.hiddenRestore,
                  ),
                )
              }),
        ),
        // v1.1.0: renamed rows card — reset display names back to originals.
        h(
          'div',
          { className: 'dpp-set-card' },
          h(
            'div',
            { className: 'dpp-set-row' },
            h(
              'div',
              { className: 'dpp-set-texts' },
              h('div', { className: 'dpp-set-label' }, LABEL.renamesTitle),
              h('div', { className: 'dpp-set-detail' }, LABEL.renamesDetail),
            ),
          ),
          Object.keys(renames).length === 0
            ? h('div', { className: 'dpp-set-empty' }, LABEL.renamesEmpty)
            : Object.keys(renames).map(function (label) {
                return h(
                  'div',
                  { className: 'dpp-set-row dpp-set-subrow', key: 'ren-' + label },
                  h(
                    'div',
                    { className: 'dpp-set-texts' },
                    h('div', { className: 'dpp-set-label' }, renames[label]),
                    h('div', { className: 'dpp-set-detail' }, label),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x',
                      onClick: function () {
                        try {
                          const map = readRenames()
                          delete map[label]
                          writeRenames(map)
                          setRenames(readRenames())
                          showToast((zh ? '已恢复「NAME」原名' : 'Reset "NAME"').replace('NAME', label))
                          refreshAll()
                        } catch (error) {
                          /* React guard */
                        }
                      },
                    },
                    LABEL.renamesReset,
                  ),
                )
              }),
        ),
        // v1.2.2: custom row order management — visible only while a custom
        // order exists, so it never nags users who never reordered.
        rowOrder.length > 0
          ? h(
              'div',
              { className: 'dpp-set-card' },
              h(
                'div',
                { className: 'dpp-set-row' },
                h(
                  'div',
                  { className: 'dpp-set-texts' },
                  h('div', { className: 'dpp-set-label' }, LABEL.rowOrderTitle),
                  h(
                    'div',
                    { className: 'dpp-set-detail' },
                    LABEL.rowOrderDetail,
                    h('br'),
                    (zh ? '已自定义 ' : '') + rowOrder.length + (zh ? ' 行的顺序' : ' rows reordered'),
                  ),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dpp-set-x',
                    title: LABEL.rowOrderDetail,
                    onClick: function () {
                      try {
                        writeRowOrder([])
                        setRowOrder([])
                        showToast(LABEL.rowOrderResetDone)
                        refreshAll()
                      } catch (error) {
                        /* React guard */
                      }
                    },
                  },
                  LABEL.rowOrderReset,
                ),
              ),
            )
          : null,
        // v1.3.3: feedback card — issue / survey / manual diagnostics copy.
        // All click-triggered; the diagnostics copy is explicit because the
        // dump contains the user's panel labels and renames.
        h(
          'div',
          { className: 'dpp-set-card' },
          h(
            'div',
            { className: 'dpp-set-row' },
            h(
              'div',
              { className: 'dpp-set-texts' },
              h('div', { className: 'dpp-set-label' }, LABEL.fbTitle),
              h('div', { className: 'dpp-set-detail' }, LABEL.fbDetail),
            ),
          ),
          h(
            'div',
            { className: 'dpp-set-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'dpp-set-reset',
                title: LABEL.fbIssueTitle,
                onClick: function () {
                  try {
                    openFeedbackIssue()
                  } catch (error) {
                    /* React guard */
                  }
                },
              },
              LABEL.fbIssue,
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dpp-set-reset',
                title: LABEL.fbSurveyTitle,
                onClick: function () {
                  try {
                    openFeedbackSurvey()
                  } catch (error) {
                    /* React guard */
                  }
                },
              },
              LABEL.fbSurvey,
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dpp-set-reset',
                title: LABEL.fbDiagTitle,
                onClick: function () {
                  try {
                    copyFeedbackDiagnostics()
                  } catch (error) {
                    /* React guard */
                  }
                },
              },
              LABEL.fbDiag,
            ),
          ),
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
                // Drag-to-reorder top pins (v0.10.0): drag a top-pinned row
                // onto another top-pinned row to reorder TOP_KEY. HTML5 DnD,
                // guarded — the pin manager must never throw into React.
                const draggable = panel.top && panel.idKnown
                return h(
                  'div',
                  {
                    className: 'dpp-set-chip' + (draggable ? ' dpp-draggable' : ''),
                    key: panel.id,
                    draggable: draggable ? 'true' : 'false',
                    'data-dpp-topid': draggable ? panel.id : undefined,
                    title: draggable ? LABEL.setDragHint : undefined,
                    onDragStart: draggable
                      ? function (event) {
                          try {
                            event.dataTransfer.setData('text/plain', panel.id)
                            event.dataTransfer.effectAllowed = 'move'
                          } catch (error) {
                            /* ignore */
                          }
                        }
                      : undefined,
                    onDragOver: draggable
                      ? function (event) {
                          try {
                            event.preventDefault()
                            event.dataTransfer.dropEffect = 'move'
                          } catch (error) {
                            /* ignore */
                          }
                        }
                      : undefined,
                    onDrop: draggable
                      ? function (event) {
                          try {
                            event.preventDefault()
                            event.currentTarget.classList.remove('dpp-droptarget')
                            const srcId = event.dataTransfer.getData('text/plain')
                            if (!srcId || srcId === panel.id) return
                            reorderTopPins(srcId, panel.id)
                          } catch (error) {
                            /* ignore */
                          }
                        }
                      : undefined,
                    onDragEnter: draggable
                      ? function (event) {
                          try {
                            event.preventDefault()
                            event.currentTarget.classList.add('dpp-droptarget')
                          } catch (error) {
                            /* ignore */
                          }
                        }
                      : undefined,
                    onDragLeave: draggable
                      ? function (event) {
                          try {
                            event.currentTarget.classList.remove('dpp-droptarget')
                          } catch (error) {
                            /* ignore */
                          }
                        }
                      : undefined,
                  },
                  h(
                    'span',
                    { className: 'dpp-set-label' },
                    panel.top ? panel.label + LABEL.topFlag : panel.label,
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpp-set-x',
                      disabled: !panel.idKnown || !panel.pinned,
                      title: !panel.idKnown
                        ? LABEL.setPinNeedMenu
                        : !panel.pinned
                          ? LABEL.setTopNeedPin
                          : undefined,
                      onClick: function () {
                        toggleTopPin(panel.id, panel.label)
                      },
                    },
                    panel.top ? LABEL.setTopOff : LABEL.setTop,
                  ),
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
        topStats.stored > 0 && topStats.matched === 0
          ? h('div', { className: 'dpp-set-empty' }, LABEL.setTopNoMatch)
          : null,
        ),
        h(
          'div',
          { className: 'dpp-set-actions' },
          h('button', { type: 'button', className: 'dpp-set-reset', onClick: reset }, LABEL.setReset),
          h(
            'button',
            {
              type: 'button',
              className: 'dpp-set-reset dpp-set-danger',
              title: LABEL.setResetDataTitle,
              onClick: clearData,
            },
            LABEL.setResetData,
          ),
          h('button', { type: 'button', className: 'dpp-set-reset', onClick: exportSettings }, LABEL.setExport),
          h(
            'button',
            {
              type: 'button',
              className: 'dpp-set-reset',
              title: LABEL.setImportTitle,
              onClick: importSettings,
            },
            LABEL.setImport,
          ),
          h('button', { type: 'button', className: 'dpp-set-reset', onClick: exportSettingsFile }, LABEL.setExportFile),
          h(
            'button',
            {
              type: 'button',
              className: 'dpp-set-reset',
              title: LABEL.setImportFileTitle,
              onClick: importSettingsFile,
            },
            LABEL.setImportFile,
          ),
        ),
        h(
          'p',
          { className: 'dpp-set-intro dpp-set-version' },
          // v1.4.2: build tag is internal-only — the footnote shows the plain
          // version (official installs carry exactly one build per version).
          // The ?dppdebug overlay still carries the full BUILD line for
          // troubleshooting (local-vs-registry divergence diagnosis).
          'dsh-panel-pins v' + VERSION,
        ),
      )
    }

