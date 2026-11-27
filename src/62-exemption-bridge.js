    // -------------------------------------------- active-row exemption (v1.3.2)

    /**
     * The currently active panel id, read from the host layout service's
     * public observable (`panelInfo.getSnapshot().activePanelId` — the same
     * contract dsh-panellist and dsh-panel-control consume). Returns null
     * when the service is absent, the snapshot is missing, or the id is not
     * a string — callers treat null as "no exemption".
     */
    function activePanelId() {
      try {
        const layout = optionalService('layout')
        const info = layout && layout.panelInfo
        const snapshot =
          info && typeof info.getSnapshot === 'function' ? info.getSnapshot() : info
        return snapshot && typeof snapshot.activePanelId === 'string'
          ? snapshot.activePanelId
          : null
      } catch (error) {
        return null
      }
    }

    /**
     * Whether the panel row with `label` is the active panel. The label
     * resolves to a panel id through the slot-seeded label→id map; rows
     * whose id is unknown can never match (no guessing — an unknown id must
     * not exempt the wrong row).
     */
    function isActiveRowLabel(label) {
      const active = activePanelId()
      if (!active) return false
      if (label === active) return true // raw-id label fallback (locale lag)
      const id = readLabelIdMap()[label]
      return !!id && id === active
    }

    /**
     * Single-row hide decision with the v1.3.2 exemption. Contract:
     * - Whitelist wins over everything (rows stay visible, never collected).
     * - Collection ON (rows-hidden / family fold) suppresses unconditionally
     *   — the dsh-panellist suppressed-wins rule: collected rows have their
     *   launcher drawer as the entry point, so the active row must NOT pop
     *   back into the sidebar and break the collection contract.
     * - Collection OFF + individually hidden: exempt while the row IS the
     *   active panel ("you are on this page" — the dsh-panellist
     *   hidden-vs-active rule); hidden otherwise.
     */
    function shouldHideRow(label, individuallyHidden, collectionOn) {
      // Whitelist predicate: the FULL isWhitelisted(label, mappedId) form —
      // it covers label matches, direct id entries AND whitelist labels that
      // map to the same id (locale-switch safe). isWhitelistedLabelOrMapped
      // is its strict subset (no `entry === id` check), so using the full
      // form preserves applyFold's original behavior exactly and only
      // strengthens the family-row sweep (whose rows have no id, where the
      // extra clause is inert).
      if (isWhitelisted(label, readLabelIdMap()[label])) return false
      if (collectionOn) return true
      if (individuallyHidden) return !isActiveRowLabel(label)
      return false
    }

    // Test hook: the jsdom regression drives these closures directly (same
    // pattern as window.__dppTransfer).
    try {
      window.__dppActive = {
        activePanelId: activePanelId,
        isActiveRowLabel: isActiveRowLabel,
        shouldHideRow: shouldHideRow,
        setCtx: function (ctx) { ctxRef = ctx },
      }
    } catch (error) {
      /* non-window context */
    }

    // ---------------------------------------- settings-page bridge (v1.4.0)
    // dsh-panel-control's bridged-settings-pages mechanism, adapted: bridge
    // rows do NOT join the sidebar — they surface only inside this plugin's
    // Panels launcher overlay. The host's settings dialog state is private
    // (no API can aim it at one section), so "click a row, land on that
    // page" is only achievable by owning a real main-keyed panel.

    /** Bridge master toggle (default ON). */
    function readBridge() {
      try {
        const raw = window.localStorage.getItem(BRIDGE_KEY)
        if (raw === '0') return false
        if (raw === '1') return true
      } catch (error) {
        /* fall through to the default */
      }
      return true
    }

    function writeBridge(value) {
      try {
        window.localStorage.setItem(BRIDGE_KEY, value ? '1' : '0')
      } catch (error) {
        /* ignore */
      }
    }

    /**
     * Sections of the settings.section slot, with the registration face.
     * `inject`, `store`, `locale` and `children` sit on the ENTRY, next to
     * `options` (host StoredEntry shape — dsh-panel-control 0.9.3 incident:
     * reading them from `options` silently yields undefined and the bridged
     * page renders without translations, store or error boundary). `order`
     * is read too: the settings dialog sorts its nav by it, and the launcher
     * group must mirror that order row for row (v1.4.1 parity).
     */
    function readBridgeSections() {
      if (!ctxSlots || typeof ctxSlots.entriesOfSlot !== 'function') return []
      try {
        const raw = ctxSlots.entriesOfSlot(SLOT_SETTINGS) || []
        return raw
          .map(function (entry) {
            const options = (entry && entry.options) || {}
            return {
              id: typeof options.id === 'string' ? options.id : '',
              order: typeof options.order === 'number' ? options.order : 0,
              label: options.label,
              component: entry && entry.component,
              inject: entry && entry.inject,
              store: entry && entry.store,
              locale: entry && entry.locale,
              children: entry && entry.children,
            }
          })
          .filter(function (section) {
            return section.id !== ''
          })
      } catch (error) {
        return []
      }
    }

    function resolveLabelOption(label, fallbackId) {
      try {
        if (typeof label === 'function') label = label()
      } catch (error) {
        label = null
      }
      if (typeof label === 'string' && label.length > 0) return label
      return fallbackId
    }

    /**
     * EVERY settings section becomes a launcher row (v1.4.1 full parity with
     * the settings dialog: the dialog nav is exactly this slot sorted by
     * `order`, so the group mirrors it 1:1 — same rows, same order, same
     * count). v1.4.0 excluded core host pages, sections whose plugin owned a
     * sidebar/main entry, and child-slot declarers; v1.4.1 b88 also bridges
     * OUR OWN settings column (panel-pins): the section is a plain React
     * card column with no slot machinery, so rendering it inside the bridge
     * shell is safe — the earlier "self-nesting" worry was wrong, and count
     * parity was requested explicitly. The single remaining guard: a section
     * without a callable component has nothing to render.
     * The section's OWN child slots (models' provider-card, plugins' tab…)
     * were declared by its original registration and live in the global slot
     * registry — our bridge slot re-renders the same component, so those
     * renderSlots resolve against the original declarations unchanged.
     * Stable sort by `order` (stable so equal orders keep slot order, like
     * the dialog's Array.sort which is stable per spec).
     */
    function bridgeCandidates() {
      const out = []
      const taken = new Set()
      readBridgeSections()
        .filter(function (section) {
          return typeof section.component === 'function'
        })
        .sort(function (a, b) {
          return a.order - b.order
        })
        .forEach(function (section) {
          const label = resolveLabelOption(section.label, section.id)
          const bridgeId = BRIDGE_PREFIX + section.id
          if (taken.has(bridgeId)) return
          taken.add(bridgeId)
          out.push({
            bridgeId: bridgeId,
            sectionId: section.id,
            label: label,
            component: section.component,
            inject: section.inject,
            store: section.store,
            locale: section.locale,
          })
        })
      return out
    }

    /** The bridge lives at factory scope: the overlay reads it on every open. */
    const bridgeSettings = {
      entries: new Map(), // bridgeId -> { sectionId, label, slotName, disposers[] }
      unsub: null,
      timers: [],
      syncing: false,
      declaredHooked: false,
    }

    /** Landing back on the conversation; safe when layout is absent. */
    function bridgeBackToConversation() {
      try {
        const layout = optionalService('layout')
        if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(null)
      } catch (error) {
        /* already on the conversation */
      }
    }

    function disposeBridgeEntry(bridgeId) {
      const record = bridgeSettings.entries.get(bridgeId)
      if (!record) return
      bridgeSettings.entries.delete(bridgeId)
      record.disposers.slice().reverse().forEach(function (dispose) {
        try {
          dispose()
        } catch (error) {
          /* half-disposed pair */
        }
      })
      // The main key is gone: a reader sitting on it would stare at an empty
      // center column. selectPanel(null) is the only safe landing.
      if (activePanelId() === bridgeId) bridgeBackToConversation()
    }

    /** The bridge shell: back bar + the section rendered through OUR slot. */
    function makeBridgePanel(candidate, slotName) {
      return function BridgePanel(props) {
        const renderSlot = props && typeof props.renderSlot === 'function' ? props.renderSlot : null
        let node = null
        try {
          if (renderSlot) node = renderSlot(slotName, { close: bridgeBackToConversation }, {})
        } catch (error) {
          /* renderSlot absent / section threw: shell stays up */
        }
        return h(
          'div',
          { className: 'dpp-bridge' },
          h(
            'div',
            { className: 'dpp-bridge-bar' },
            h(
              'button',
              {
                type: 'button',
                className: 'dpp-bridge-back',
                onClick: bridgeBackToConversation,
              },
              LABEL.bridgeBack,
            ),
            h('span', { className: 'dpp-bridge-tag' }, LABEL.bridgeTag),
            h('span', { className: 'dpp-bridge-from' }, candidate.sectionId),
          ),
          node
            ? h('div', { className: 'dpp-bridge-body' }, node)
            : h('div', { className: 'dpp-bridge-body' }, h('p', { className: 'dpp-bridge-missing' }, LABEL.bridgeMissing)),
        )
      }
    }

    function syncBridgeSettings() {
      const slots = ctxSlots
      if (!slots || typeof slots.register !== 'function' || bridgeSettings.syncing) return
      bridgeSettings.syncing = true
      try {
        watchSettingsSection()
        const enabled = readBridge()
        const desired = new Map()
        if (enabled) {
          bridgeCandidates().forEach(function (candidate) {
            desired.set(candidate.bridgeId, candidate)
          })
        }
        // Remove first (desired may have shrunk), then add. Reconcile only —
        // re-registering an unchanged row would remount it mid-interaction.
        Array.from(bridgeSettings.entries.keys()).forEach(function (bridgeId) {
          if (!desired.has(bridgeId)) disposeBridgeEntry(bridgeId)
        })
        desired.forEach(function (candidate, bridgeId) {
          if (bridgeSettings.entries.has(bridgeId)) return
          const slotName = BRIDGE_SLOT_PREFIX + candidate.sectionId
          const record = { sectionId: candidate.sectionId, label: candidate.label, slotName: slotName, disposers: [] }
          try {
            record.disposers.push(
              slots.register(
                {
                  name: SLOT_MAIN,
                  key: bridgeId,
                  children: (function () { const c = {}; c[slotName] = { kind: 'single', scope: 'root' }; return c })(),
                },
                makeBridgePanel(candidate, slotName),
              ),
            )
            // Re-register the SAME component with its TOP-LEVEL registration
            // face into our own child slot: the host then supplies inject,
            // locale `t`, store, and the error boundary exactly as it does
            // inside the settings dialog.
            record.disposers.push(
              slots.register(
                {
                  name: slotName,
                  inject: candidate.inject,
                  store: candidate.store,
                  locale: candidate.locale,
                },
                candidate.component,
              ),
            )
            bridgeSettings.entries.set(bridgeId, record)
          } catch (error) {
            // Pair-rollback: a half-registered bridge is worse than none, and
            // a leaked register throw inside loader.start() aborts the whole
            // boot (documented incident).
            record.disposers.slice().reverse().forEach(function (dispose) {
              try {
                dispose()
              } catch (ignored) {
                /* already half gone */
              }
            })
            try {
              console.error('[dsh-panel-pins] bridge register failed for "' + candidate.sectionId + '":', error)
            } catch (ignored) {
              /* console unavailable */
            }
          }
        })
      } catch (error) {
        /* sync must never throw into the caller (refreshAll passes) */
      } finally {
        bridgeSettings.syncing = false
      }
    }

    /**
     * Subscribe to the settings.section registry. `subscribe` is trustworthy
     * only once the slot is DECLARED — pins may apply before the bridged
     * plugin does, and an early subscription observes nothing forever. The
     * declaration-callback retry (this runs again from inside the slot's
     * inject thunk, which the host calls when the slot is declared) plus the
     * boot rescan schedule cover both orders.
     */
    function watchSettingsSection() {
      if (bridgeSettings.unsub) return
      if (!ctxSlots || typeof ctxSlots.subscribe !== 'function') return
      try {
        const dispose = ctxSlots.subscribe(SLOT_SETTINGS, function () {
          scheduleBridgeSync()
        })
        bridgeSettings.unsub = typeof dispose === 'function' ? dispose : null
      } catch (error) {
        /* not declared yet; rescan schedule retries */
      }
    }

    function unwatchSettingsSection() {
      try {
        if (typeof bridgeSettings.unsub === 'function') bridgeSettings.unsub()
      } catch (error) {
        /* ignore */
      }
      bridgeSettings.unsub = null
    }

    function scheduleBridgeSync() {
      if (bridgeSettings.timer) clearTimeout(bridgeSettings.timer)
      bridgeSettings.timer = setTimeout(function () {
        bridgeSettings.timer = null
        syncBridgeSettings()
      }, 120)
    }

    /** Boot rescan: plugins apply in any order, so a declared-later section
     * must still be caught within ~1s of its registration. */
    function scheduleBridgeRescans() {
      bridgeSettings.timers = bridgeSettings.timers || []
      BRIDGE_RESCAN_SCHEDULE.forEach(function (ms) {
        bridgeSettings.timers.push(
          setTimeout(function () {
            syncBridgeSettings()
          }, ms),
        )
      })
    }

    function teardownBridgeTimers() {
      if (bridgeSettings.timer) clearTimeout(bridgeSettings.timer)
      bridgeSettings.timer = null
      ;(bridgeSettings.timers || []).forEach(function (t) {
        clearTimeout(t)
      })
      bridgeSettings.timers = []
    }

    function disposeAllBridges() {
      Array.from(bridgeSettings.entries.keys()).forEach(function (bridgeId) {
        disposeBridgeEntry(bridgeId)
      })
    }

    // Test hook: the jsdom regression drives identification, paired
    // registration, toggle retraction and the back-to-conversation path
    // directly against a fake ctx.
    try {
      window.__dppBridge = {
        readBridge: readBridge,
        writeBridge: writeBridge,
        bridgeCandidates: bridgeCandidates,
        syncBridgeSettings: syncBridgeSettings,
        disposeAllBridges: disposeAllBridges,
        teardownBridgeTimers: teardownBridgeTimers,
        unwatchSettingsSection: unwatchSettingsSection,
        bridgeBackToConversation: bridgeBackToConversation,
        state: bridgeSettings,
      }
    } catch (error) {
      /* non-window context */
    }


