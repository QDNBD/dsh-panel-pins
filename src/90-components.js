    // ---------------------------------------------------------------- menu rows

    // -------------------------------------------------------------------
    // v1.8.0 (P1-5): collapsed-sidebar toggle badge. Counts what the plugin
    // has folded OUT of the visible sidebar while it is collapsed — the
    // collected panel rows (rows-hidden) plus the collected plugin-entry
    // rows (family). 0 renders nothing, so hosts/users with everything
    // visible see no badge at all. The count is cheap to recompute and the
    // store keys are plain localStorage, so a short poll catches every
    // mutation path (menu toggles, presets, imports) without subscribing to
    // each one.
    // -------------------------------------------------------------------
    const BADGE_SLOT = 'sidebar.toggle.badge'

    function foldedBadgeCount() {
      let n = 0
      try {
        if (readRowsHidden()) n += readPanelList().length
      } catch (error) {
        /* sidebar not ready */
      }
      try {
        if (readFamily()) n += findFamilyRows().length
      } catch (error) {
        /* sidebar not ready */
      }
      return n
    }

    function ToggleBadgeRows() {
      const [count, setCount] = React.useState(function () { return foldedBadgeCount() })
      React.useEffect(function () {
        const timer = setInterval(function () {
          try {
            const next = foldedBadgeCount()
            setCount(function (prev) { return prev === next ? prev : next })
          } catch (error) {
            /* ignore */
          }
        }, 1500)
        return function () { clearInterval(timer) }
      }, [])
      if (!count) return null
      const title = LABEL.badgeTitle.replace('N', String(count))
      return h('span', { className: 'dpp-badge', title: title, 'aria-label': title }, String(count))
    }

    function PinMenuRows({ entries, onOpen, onPinnedChange, onDismiss }) {
      const [hidden, setHidden] = React.useState(readRowsHidden())
      // v1.7: with the host's native pin controls present we hide our own
      // per-entry pin rows (the host owns the interaction; we persist).
      const [nativePin, setNativePin] = React.useState(nativePinSeen)

      React.useEffect(function () {
        bridge.entries = Array.isArray(entries) ? entries : []
        bridge.onPinnedChange = onPinnedChange
        try {
          // Seed the persisted label→id map so the Settings pin manager works
          // even before this slot (the More menu) renders on a fresh session.
          if (Array.isArray(entries) && entries.length > 0) {
            mergeLabelIdMap(
              entries.map(function (entry) {
                return { id: entry && entry.id, label: entry && entry.label }
              }),
            )
          }
        } catch (error) {
          /* ignore */
        }
        // v1.7: probe for the host's native pin controls and pick the sync
        // mode. The probe re-runs on every mount of this slot, so a renderer
        // that was too slow on boot gets caught on the next menu open.
        if (!nativePinSeen && probeNativePinControls()) {
          nativePinSeen = true
          setNativePin(true)
        }
        if (nativePinSeen) {
          if (!mirrorArmed) {
            mirrorAdoptAndRestore(entries, onPinnedChange)
            mirrorArmed = true
          } else {
            mirrorFromHost(entries)
          }
        } else {
          syncIntoHost(entries, onPinnedChange)
        }
        // Late probe: sidebar rows may render after this effect on a cold
        // boot. One delayed re-check, then the next mount takes over anyway.
        if (!nativePinSeen) {
          window.setTimeout(function () {
            if (nativePinSeen) return
            try {
              if (probeNativePinControls()) {
                nativePinSeen = true
                setNativePin(true)
                if (
                  !mirrorArmed &&
                  typeof bridge.onPinnedChange === 'function' &&
                  Array.isArray(bridge.entries) &&
                  bridge.entries.length > 0
                ) {
                  mirrorAdoptAndRestore(bridge.entries, bridge.onPinnedChange)
                  mirrorArmed = true
                }
              }
            } catch (error) {
              /* cosmetic */
            }
          }, 300)
        }
      }, [entries, onPinnedChange])

      const toggleFold = function () {
        const next = !readRowsHidden()
        writeRowsHidden(next)
        applyFold()
        ensureLauncher()
        setHidden(next)
        try {
          if (typeof onDismiss === 'function') onDismiss()
        } catch (error) {
          /* ignore */
        }
      }

      const [tidy, setTidy] = React.useState(readTidy())
      const toggleTidy = function () {
        const next = !readTidy()
        writeTidy(next)
        applyTidy()
        setTidy(next)
        try {
          if (typeof onDismiss === 'function') onDismiss()
        } catch (error) {
          /* ignore */
        }
      }

      const [family, setFamily] = React.useState(readFamily())
      const toggleFamily = function () {
        const next = !readFamily()
        writeFamily(next)
        applyFamily()
        setFamily(next)
        try {
          if (typeof onDismiss === 'function') onDismiss()
        } catch (error) {
          /* ignore */
        }
      }

      const list = Array.isArray(entries) ? entries : []
      const rows = list.filter(function (entry) {
        return entry && entry.id !== 'plugins'
      })

      return h(
        React.Fragment,
        null,
        h(
          MenuRow,
          {
            key: '__fold__',
            icon: h(SvgIcon, { d: hidden ? ICON_CHEVRON_DOWN : ICON_CHEVRON_UP }),
            label: hidden ? LABEL.unfold : LABEL.fold,
            onSelect: toggleFold,
          },
        ),
        h(
          MenuRow,
          {
            key: '__tidy__',
            icon: h(SvgIcon, { d: ICON_COMPACT }),
            label: tidy ? LABEL.tidyOn : LABEL.tidyOff,
            detail: tidy ? 'ON' : 'OFF',
            onSelect: toggleTidy,
          },
        ),
        h(
          MenuRow,
          {
            key: '__family__',
            icon: h(SvgIcon, { d: ICON_STACK }),
            label: family ? LABEL.familyOff : LABEL.familyOn,
            detail: family ? 'ON' : 'OFF',
            onSelect: toggleFamily,
          },
        ),
        // v1.7: with the host's native pin controls on the sidebar rows (and
        // its own pin action in this very menu), our per-entry pin rows were a
        // second, conflicting control surface — hide them and let the mirror
        // own persistence. Fold/tidy/family rows are unrelated features and
        // stay. On hosts without native controls this renders unchanged.
        !nativePin &&
        rows.map(function (entry) {
          const pinned = entry.pinned !== false
          return h(MenuRow, {
            key: entry.id,
            icon: h(SvgIcon, { d: pinned ? ICON_PIN : ICON_PIN_ALT }),
            label: pinned ? LABEL.unpin : LABEL.pin,
            detail: entry.label,
            onSelect: function () {
              const unpinned = readUnpinned()
              if (pinned) unpinned.add(entry.id)
              else unpinned.delete(entry.id)
              writeUnpinned(unpinned)
              try {
                if (typeof onDismiss === 'function') onDismiss()
              } catch (error) {
                /* ignore */
              }
              try {
                onPinnedChange(entry.id, !pinned)
              } catch (error) {
                /* ignore */
              }
            },
          })
        }),
      )
    }

    /**
     * One menu row. Markup mirrors the host's MenuItemButton (icon column +
     * label + trailing detail) and its hover/selected treatment comes from the
     * injected stylesheet, so it stays theme-aware without any primitive import.
     */
    function MenuRow({ icon, label, detail, onSelect }) {
      return h(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          className: 'dpp-row',
          onClick: onSelect,
        },
        icon,
        h('span', { className: 'dpp-label' }, label),
        detail ? h('span', { className: 'dpp-detail' }, detail) : null,
      )
    }

