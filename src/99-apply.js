    return {
      inject: ['slots'],
      apply(ctx) {
        // Slot registrations first (they must survive even if the DOM layer
        // below fails).
        ctxSlots = ctx.slots
        // v1.3.2: archive the whole ctx for optionalService() reads (layout
        // panelInfo). Deliberately NOT added to `inject` — see the header
        // note: a missing declared service parks the fiber; a read of an
        // absent one just throws and degrades to "no exemption".
        ctxRef = ctx || null
        ctx.slots.inject(SLOT, function () {
          return ctx.slots.register({ name: SLOT, id: SLOT_ID, order: 900 }, PinMenuRows)
        })
        // v1.8.0 (P1-5): collapsed-sidebar toggle badge. The host renders
        // this occupant while collapsed (SidebarRoot.tsx:302, slot declared
        // 'single'/root in index.ts:99). Hosts without the slot simply never
        // render it — injecting an unknown slot name is inert, and the
        // try/catch keeps even a hostile slots shape from breaking activate.
        try {
          ctx.slots.inject(BADGE_SLOT, function () {
            return ctx.slots.register(
              { name: BADGE_SLOT, id: SLOT_ID + '-badge', order: 900 },
              ToggleBadgeRows,
            )
          })
        } catch (error) {
          /* slot unavailable on this host: the badge is sugar, skip it */
        }
        // v1.9.0 (P1-1): one row in the host's slash menu — an `action`
        // command that opens OUR OWN Ctrl+K palette (pinyin search stays
        // ours; the host shell has no pinyin). The commands service mounts
        // LATER in the boot order than us (the host's own consumer waits via
        // ctx.inject), so a one-shot optionalService read at apply time
        // misses it — real-app verified: the "/" menu opened with only host
        // rows. Use the same bounded-retry pattern as the v1.5.0 shortcut
        // registration; the actual registration lives in
        // tryRegisterSlashCommand() and label/description are thunks
        // (contract: row copy is read on every candidate pass), so a locale
        // switch reaches the next menu open without re-registration.
        let slashRetry = null
        let slashTries = 0
        const scheduleSlashRetry = function () {
          if (tryRegisterSlashCommand() || slashTries >= 20) return
          slashTries += 1
          if (!slashRetry) {
            slashRetry = setTimeout(function () {
              slashRetry = null
              scheduleSlashRetry()
            }, 1500)
          }
        }
        try {
          scheduleSlashRetry()
        } catch (error) {
          /* commands service absent or hostile shape: the slash row is sugar */
        }
        // Settings page column (see header item 8). The label thunk avoids
        // any locale-service dependency; copy inside the section uses the
        // plugin's own zh/en LABEL dict.
        ctx.slots.inject('settings.section', function () {
          return ctx.slots.register(
            {
              name: 'settings.section',
              id: SLOT_ID,
              order: 90,
              label: function () {
                return zh ? '面板收纳' : 'Panel Pins'
              },
            },
            PanelPinsSettingsSection,
          )
        })
        // DOM layer (style, visibility, launcher, observers, timers). Fully
        // defensive: this plugin is decorative — ANY activation-phase error
        // here must degrade to "no DOM extras" (b20 behavior), never break
        // the host's web boot (b21 regression: one thrown error during apply
        // fails the whole entry).
        if (typeof document !== 'undefined') {
          try {
            refreshAll()
          // v1.4.0: boot rescans — the plugin may apply before the plugins it
          // bridges; the subscription cannot observe pre-declaration
          // registrations, so a bounded rescan schedule reconciles once the
          // rest of the boot has applied.
          try {
            scheduleBridgeRescans()
          } catch (error) {
            /* rescan is best-effort */
          }
          let refreshTimer = null
          const scheduleRefresh = function () {
            if (refreshTimer) return
            refreshTimer = setTimeout(function () {
              refreshTimer = null
              refreshAll()
            }, 120)
          }
          let observer = null
          try {
            observer = mutationObserverFor(scheduleRefresh)
            const sidebarRoot = findPanelListNav() && findPanelListNav().parentNode
            if (sidebarRoot) {
              observer.observe(sidebarRoot, { childList: true, subtree: true })
              observer.__dppRoot = sidebarRoot
            } else {
              // Sidebar not mounted yet (early apply): watch <body> briefly so
              // the first render is caught; the anchor timer below re-anchors
              // the observer to the real sidebar root once the nav exists.
              observer.observe(document.body, { childList: true, subtree: true })
              observer.__dppOnBody = true
            }
          } catch (error) {
            observer = null
          }
          // Safety net at a humane rate: replaces the old 1.5s full sweep.
          const fallback = setInterval(refreshAll, 5000)
          // v1.3.2 active-row exemption: switching panels does not touch the
          // sidebar DOM, so the MutationObserver cannot see it. Subscribe to
          // the host layout observable (panelInfo) and schedule a refresh on
          // every flip; the 5s fallback interval remains the net if the
          // service or subscribe channel is absent. Best-effort by design:
          // any throw here degrades to interval-driven exemption updates.
          let panelSubDispose = null
          // v1.5.0 (b95): pending retry for the host shortcut registration.
          let shortcutRetry = null
          try {
            const layout = optionalService('layout')
            const info = layout && layout.panelInfo
            if (info && typeof info.subscribe === 'function') {
              const off = info.subscribe(function () {
                scheduleRefresh()
              })
              panelSubDispose = typeof off === 'function' ? off : null
            }
          } catch (error) {
            panelSubDispose = null
          }
          // Theme probe. The host applies its palette by writing <html>.style,
          // <html>[data-ds-theme-source] and <body>[data-ds-dark-theme]
          // (dsh-client-ui-layout/src/client/theme-presenter.ts:69-76) — never
          // a class on <html> — so the old class-only filter could not fire on
          // a theme switch. Observe the real attributes AND take the host's own
          // 'theme/change' event when the theme service is present; the DOM
          // watch stays as the fallback for hosts without that service.
          let attrObserver = null
          try {
            attrObserver = mutationObserverFor(applyTheme)
            if (!attrObserver) throw new Error('no MutationObserver available')
            attrObserver.observe(document.documentElement, {
              attributes: true,
              attributeFilter: ['class', 'style', 'data-ds-theme-source'],
            })
            if (document.body) {
              attrObserver.observe(document.body, {
                attributes: true,
                attributeFilter: ['data-ds-dark-theme'],
              })
            }
          } catch (error) {
            attrObserver = null
          }
          // v1.6.0: the host publishes every theme change as 'theme/change'
          // with a snapshot carrying `active.colorScheme` (ui-theme
          // src/client/index.ts:144/438). Prefer it — instant, public, no DOM
          // sniffing. The event fires on ctx regardless of service ordering,
          // so a late-provided theme service still reaches us.
          let themeEventOff = null
          try {
            const ctx = ctxRef
            if (ctx && typeof ctx.on === 'function') {
              themeEventOff = ctx.on('theme/change', function (snapshot) {
                const active = snapshot && (snapshot.active || snapshot)
                const scheme = active && (active.colorScheme || active.scheme)
                if (scheme !== 'dark' && scheme !== 'light') return
                hostColorScheme = scheme
                applyTheme()
              })
            }
          } catch (error) {
            themeEventOff = null
          }
          // v1.6.0: follow the host's language. The host's locale runtime
          // publishes 'locale/change' when the effective language moves
          // (dsh-client-locale/src/client/index.ts:88-99, :506) and also
          // offers a store-style subscribe() (index.ts:239-242). The event is
          // primary; the store is a second channel for hosts that ship one
          // without the other. refreshLocale() is a no-op unless the
          // effective language actually moved, so a duplicate signal is free.
          let localeEventOff = null
          let localeStoreOff = null
          try {
            const ctx = ctxRef
            if (ctx && typeof ctx.on === 'function') {
              localeEventOff = ctx.on('locale/change', function () {
                refreshLocale()
              })
            }
            const locale = optionalService('locale')
            if (locale && typeof locale.subscribe === 'function') {
              localeStoreOff = locale.subscribe(function () {
                refreshLocale()
              })
            }
          } catch (error) {
            /* no locale service or no event channel: the plugin keeps the
               language it detected at mount */
          }
          // The module-level LABEL table was built BEFORE ctx existed, so it
          // could only see navigator.language. Now that the host locale
          // service is reachable, re-evaluate: a host set to 中文 while the
          // browser reports en-US must render Chinese.
          refreshLocale()
          // Re-anchor: upgrade from the <body> watch to the real sidebar root
          // once it exists, and re-anchor again whenever React replaces the
          // whole sidebar root. One querySelector per 2s is negligible.
          const anchorTimer = setInterval(function () {
            try {
              if (!observer) {
                clearInterval(anchorTimer)
                return
              }
              const nav = findPanelListNav()
              const root = nav && nav.parentNode
              if (root && observer.__dppRoot !== root) {
                observer.disconnect()
                observer.observe(root, { childList: true, subtree: true })
                observer.__dppRoot = root
                observer.__dppOnBody = false
              }
            } catch (error) {
              /* keep the fallback interval as the net */
            }
          }, 2000)
          // Row context menu: capture-phase listener on document.
          try {
            document.addEventListener('contextmenu', handleContext, true)
            document.addEventListener('keydown', handleGlobalKey, true)
          } catch (error) {
            /* listener registration is best-effort */
          }
          // v1.5.0 (b95): hand Ctrl+K to the host's shortcut service when it
          // exists — the binding becomes rebindable in Settings -> Shortcuts
          // and the host decides whether the key may fire. The service can be
          // provided a tick after our fiber starts, so retry once before we
          // settle for the legacy document listener.
          const tryRegisterHostShortcut = function () {
            if (hostShortcutActive || hostShortcutGiveUp) return
            if (registerHostPaletteShortcut()) return
            if (!shortcutRetry) {
              shortcutRetry = setTimeout(function () {
                shortcutRetry = null
                tryRegisterHostShortcut()
              }, 1500)
            }
          }
          tryRegisterHostShortcut()
          // Row drag reorder (v1.2.2): document-level delegation, installed
          // once per page.
          try {
            installRowDrag()
          } catch (error) {
            /* drag stays unavailable; everything else unaffected */
          }
          // Dispose: cordis teardown must not leave timers, observers, the
          // style tag or the launcher button behind. Everything the plugin
          // inserted is removable; row inline styles are cleared so the host
          // reclaims its rows untouched. Registered through whichever dispose
          // channel this cordis fork exposes (ctx.dispose callback or the
          // 'dispose' event); if neither exists the behavior matches old
          // builds (cleanup on restart only) — no regression.
          const disposeCleanup = function () {
            clearInterval(fallback)
            clearInterval(anchorTimer)
            if (refreshTimer) clearTimeout(refreshTimer)
            // v1.4.0: bridged settings pages — paired dispose of every main
            // key + child slot, subscription and rescan timers, so the host
            // never keeps ghost panels selectable.
            try {
              disposeAllBridges()
            } catch (error) {
              /* ignore */
            }
            try {
              unwatchSettingsSection()
            } catch (error) {
              /* ignore */
            }
            try {
              teardownBridgeTimers()
            } catch (error) {
              /* ignore */
            }
            // v1.3.2: unsubscribe the panelInfo listener (declared service or
            // not, a live subscription must not outlive the plugin).
            try {
              if (typeof panelSubDispose === 'function') panelSubDispose()
            } catch (error) {
              /* ignore */
            }
            panelSubDispose = null
            // v1.6.0: the 'theme/change' subscription must not outlive the
            // plugin either — a live listener keeps re-toggling a class on a
            // document the plugin no longer owns.
            try {
              if (typeof themeEventOff === 'function') themeEventOff()
            } catch (error) {
              /* ignore */
            }
            themeEventOff = null
            // v1.6.0: same for the locale channels.
            try {
              if (typeof localeEventOff === 'function') localeEventOff()
            } catch (error) {
              /* ignore */
            }
            localeEventOff = null
            try {
              if (typeof localeStoreOff === 'function') localeStoreOff()
            } catch (error) {
              /* ignore */
            }
            localeStoreOff = null
            // v1.5.0 (b95): the host shortcut registration must not outlive
            // the plugin — an orphan binding would keep Ctrl+K reserved.
            try {
              if (shortcutRetry) clearTimeout(shortcutRetry)
              shortcutRetry = null
            } catch (error) {
              /* ignore */
            }
            try {
              if (typeof hostShortcutDispose === 'function') hostShortcutDispose()
              hostShortcutDispose = null
              hostShortcutActive = false
            } catch (error) {
              /* ignore */
            }
            try {
              if (observer) observer.disconnect()
              if (attrObserver) attrObserver.disconnect()
            } catch (error) {
              /* ignore */
            }
            try {
              document.removeEventListener('contextmenu', handleContext, true)
              document.removeEventListener('keydown', handleGlobalKey, true)
            } catch (error) {
              /* ignore */
            }
            try {
              closeCtxMenu()
            } catch (error) {
              /* ignore */
            }
            try {
              if (overlay) closeOverlay()
            } catch (error) {
              /* ignore */
            }
            try {
              const tag = document.getElementById(STYLE_ID)
              if (tag) tag.remove()
            } catch (error) {
              /* ignore */
            }
            try {
              const launcher = document.querySelector('[' + LAUNCHER_ATTR + ']')
              if (launcher) launcher.remove()
            } catch (error) {
              /* ignore */
            }
            try {
              const line = document.getElementById(DROP_LINE_ID)
              if (line) line.remove()
              document.querySelectorAll('[data-dpp-dragging="1"]').forEach(function (el) {
                el.removeAttribute('data-dpp-dragging')
              })
              document.querySelectorAll('[data-dpp-roworder="1"]').forEach(function (el) {
                el.removeAttribute('data-dpp-roworder')
                el.style.removeProperty('order')
              })
            } catch (error) {
              /* ignore */
            }
            try {
              document.querySelectorAll('[data-dpp-hidden="1"]').forEach(function (el) {
                el.style.display = ''
                delete el.dataset.dppHidden
              })
              document.querySelectorAll('[data-dpp-top="1"]').forEach(function (el) {
                el.removeAttribute('data-dpp-top')
                el.style.removeProperty('order')
              })
            } catch (error) {
              /* ignore */
            }
          }
          // Lifecycle cleanup registration. CORRECT cordis API: the 'dispose'
          // EVENT (ctx.on) fires on teardown. NEVER call ctx.dispose(cb) —
          // that is the immediate-teardown COMMAND (it unloads the plugin on
          // the spot); calling it during apply() self-destructs the plugin
          // mid-activation and the host reports "entry did not activate"
          // (regression b21, fixed in b22). Best-effort only: if the event
          // channel is absent, cleanup falls back to restart-time — the b20
          // behavior — instead of risking activation.
          try {
            if (typeof ctx.on === 'function') ctx.on('dispose', disposeCleanup)
          } catch (error) {
            /* event channel unavailable: cleanup on restart only */
          }
        } catch (error) {
          // Swallow but surface: the debug overlay (if ?dppdebug) and the
          // console remain the only trace. Activation still counts as OK.
          try {
            console.error('[dsh-panel-pins] DOM layer failed to initialize:', error)
          } catch (ignored) {
            /* ignore */
          }
        }
        }
      },
    }
  },
})
