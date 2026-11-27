/**
 * dsh-panel-pins — browser half.
 *
 * CLASSIC SCRIPT: registers a lazy factory with the page module loader (id must
 * equal the package name). The factory returns the Cordis plugin.
 *
 * What it does:
 *
 *   1. A "Panels" launcher (inspired by @weibaohui/dsh-sidebar-tidy). One row
 *      in the sidebar opens a floating menu listing every panel; clicking an
 *      item opens that panel. The panel rows themselves are hidden by default,
 *      so the session-history region gets the space back. Footer entries are
 *      deliberately left alone — only the global panel rows are collected.
 *
 *   2. Pin/unpin menu rows. The host sidebar renders one panel row per sidebar
 *      plugin, and the More menu (PanelMoreMenu) already passes `entries` (with
 *      `pinned` flags) and `onPinnedChange` into the `sidebar.panellist.actions`
 *      slot — but the official entry-customization bundle renders that slot
 *      "without pin controls", so there is no way to fold a panel away. This
 *      plugin registers its own component into the same slot and renders
 *      pin/unpin rows: unpinning a panel removes it from the panel list (the
 *      host's own filter: `id === "plugins" || !unpinned.includes(id)`) and it
 *      stays reachable through the More menu. The host keeps pins in a
 *      memory-only snapshot store (lost on restart), so we persist the
 *      unpinned id list in localStorage and re-assert it whenever the panel
 *      list changes.
 *
 *   3. Scrollable panel list. The host's `.panelList` has no max-height and no
 *      overflow, so many plugin rows squeeze the session-history region. We
 *      inject a stylesheet that caps the list height and lets it scroll.
 *      Selectors use `[class$="_panelList"]` (css-modules hash agnostic).
 *
 *   4. Fold/unfold the panel rows from the More menu (persisted in
 *      localStorage). Visibility only (el.style.display) — no elements are
 *      inserted into React-owned markup, and the state is re-applied on a light
 *      interval in case React swaps the nav node.
 *
 *   5. All icons are inline SVG (Fluent-style stroke), and rows copy the host
 *      menu-item metrics (16px icon, 8px gap, 13px text, hover fill, focus
 *      ring) via the host's design tokens, so they blend with official rows.
 *      NOTE: do NOT require('@deepseek-ai/dsh-client-ui-primitives') here —
 *      the dynamic plugin loader does not map that module name for third-party
 *      packages, and a failed require kills the whole plugin (verified by
 *      bisection: 0.1.0/0.2.2 without it render, 0.2.0/0.2.1 with it vanish).
 *
 *   6. Plugin entry rows ("family rows"), following weibaohui/dsh-sidebar-tidy
 *      v0.1.0 (https://github.com/weibaohui/dsh-sidebar-tidy). Third-party
 *      plugins inject clickable rows between the new-session anchor and the
 *      panel list (direct buttons or button-wrapping containers). These rows
 *      are listed in the Panels launcher under their own group and can be
 *      folded away with a persisted toggle (independent of the panel-row
 *      toggle). Items click the ORIGINAL button, so each panel's own open
 *      logic (including mid-column takeover views) is untouched. CONSTRAINT
 *      from the user: bottom (footer) entries are NEVER collected — only
 *      panel rows and plugin entry rows go into the menu; the settings area
 *      stays in place.
 *
 *   7. Compact footer ("sidebar tidy", ported from @weibaohui/dsh-sidebar-tidy).
 *      One CSS block, gated on an `html.dpp-tidy` class so it can be toggled
 *      without rewriting the stylesheet: caps the footer plugin-action area
 *      (`_footArea`) at 15vh with internal scrolling (user-tuned down from
 *      25vh), shrinks inline pairing QR codes to 132px, tightens the brand
 *      row (60→44px) and new-session margin, and compacts the cost-meter
 *      footer (`.cm-foot` 26px, balance box capped). Toggleable from the
 *      More menu and the Panels launcher; state persisted in localStorage,
 *      ON by default.
 *      CONSTRAINT: the footer ENTRIES themselves are never folded into the
 *      Panels launcher menu — they stay in place at the bottom; only their
 *      container gets a height cap and a scrollbar.
 *
 *   8. Settings page section ("面板收纳" column in the host Settings nav,
 *      registered into the `settings.section` slot — same contract as the
 *      official ui-settings-* packages). Exposes every tunable as a live
 *      control: the three fold/compact toggles plus height sliders for the
 *      panel list and the capped footer. All values persist in localStorage
 *      and are applied through CSS custom properties on <html>
 *      (--dpp-panel-list-max, --dpp-foot-max), so sliders update the sidebar
 *      instantly without touching the stylesheet.
 *
 *   9. Settings transfer (v1.2.0): the whole plugin-owned localStorage dump
 *      can be exported/imported four ways — clipboard copy/paste and a real
 *      file (Blob download / <input type="file">). Clipboard and file share
 *      one dump builder and one replay chain (applyImportedDump); the dump
 *      carries a `__plugin` sentinel so foreign JSON is rejected. A
 *      window.__dppTransfer hook exposes the closures for jsdom regression.
 *
 *  10. Active-row exemption (v1.3.2): a user-hidden row that IS the currently
 *      active panel stays visible — "you are on this page, its entry must not
 *      vanish" (the dsh-panellist hidden-vs-active rule). The active panel id
 *      comes from the host layout service (`panelInfo.getSnapshot()
 *      .activePanelId`), read through a throw-tolerant accessor — the service
 *      is deliberately NOT declared in `inject`, because a missing declared
 *      service parks the whole fiber (dsh-panellist's documented reason) and
 *      this plugin must load everywhere. Contract (mirrors dsh-panellist's
 *      hidden-vs-suppressed split): whitelist wins over everything; collection
 *      ON (rows-hidden / family fold) suppresses unconditionally — collected
 *      rows have the launcher drawer as their entry point, so the active row
 *      must not pop back and break the collection contract; collection OFF +
 *      an individually-hidden row is exempted while it IS the active panel
 *      and re-hides on leaving. Display-layer only: the hidden store is
 *      untouched, so the exemption never leaks into badge counts, menu
 *      listing or Alt+N. A window.__dppActive hook exposes the readers for
 *      the jsdom regression.
 *
 *  11. Feedback (v1.3.3): click-triggered entry points only, zero automatic
 *      reporting — a pre-filled GitHub issue (title + environment body via
 *      URL params), the host questionnaire (the shell's
 *      __DSH_CONTACT_CONFIG__ contract — contactFormUrl/contactSource with
 *      prefill_/hide_ fields — same as dsh-panel-layout's entry, falling
 *      back to the shell form), and a manual "copy diagnostics" that puts
 *      the settings dump + environment facts on the clipboard (pasting is
 *      the user's decision; never auto-attached to URLs). Entries: a
 *      Settings feedback card and one palette command. A
 *      window.__dppFeedback hook exposes the closures for the jsdom
 *      regression.
 *
 *  12. Settings-page bridge (v1.4.0): third-party plugins that register ONLY
 *      into `settings.section` have no reachable surface outside the host's
 *      private settings dialog — this plugin bridges them into the Panels
 *      launcher. For every candidate section it registers a `main`-keyed
 *      panel (`dpp-bridge-<section id>`) declaring its OWN child slot, and
 *      re-registers the section's component into that slot with the entry's
 *      TOP-LEVEL `inject`/`store`/`locale` fields (they sit next to
 *      `options`, never inside it — reading from `options` silently yields
 *      undefined and the page renders "English and half-broken", the
 *      dsh-panel-control 0.9.3 incident). Ownership heuristics (dsh-panel-
 *      control precedent): a section is skipped when its id, its id minus a
 *      `-settings` suffix, or a panel id ending in `-<base>` matches a
 *      sidebar panel, or its label equals a panel label; built-ins
 *      (account/general/models/agent-presets/plugins), our own section, and
 *      sections declaring their own `children` are excluded (the child slot
 *      name is globally owned; re-declaring throws). Launcher overlay gains
 *      a "设置页" group; clicking calls layout.selectPanel(bridgeId) — the
 *      back bar lands on selectPanel(null). Sync is add/remove reconciliation
 *      only (never re-register a live row): 120ms debounce, a
 *      settings.section subscription (retried until the slot is declared —
 *      pre-declaration subscribe sees nothing), and boot rescans at
 *      [350, 900, 2000, 4200, 8000, 15000]ms. Every slots.register is
 *      try/caught and paired-rolled-back: a thrown registration inside
 *      loader.start() aborts the whole boot, so the bridge may never leak
 *      one. Toggle: dsh-panel-pins:bridge (default ON), Settings card.
 *      Dispose pairs both registrations and, if a bridged page was active,
 *      first selectPanel(null) — selecting a key that no longer exists
 *      would strand the user on an empty column.
 *
 *  13. Host scroll-contract detection (v1.4.4): the rc.3-era structural
 *      overrides (b79 flex layout on _scrollArea, b83 workspace-root
 *      unbounding, b81 nav wheel hijack) broke DSH 0.2.2-rc.5, which
 *      redesigned the sidebar into a wheel hand-off: the viewport
 *      (_scrollArea, a GRID bound to scroll-handoff + a scroll-state
 *      container) scrolls the navigation away first, then the workspace
 *      list seat ([data-sidebar-list-area]) takes over via
 *      @container scroll-state(scrollable: bottom). Forcing flex onto the
 *      viewport and hijacking nav wheels left the workspace region unable
 *      to scroll ("左侧工作区滑动不下去"). The overrides now apply only
 *      under html.dpp-rc3, set at runtime when a _scrollArea exists WITHOUT
 *      the rc.5 data attributes; rc.5 hosts keep just the panel-list cap,
 *      which coexists with the hand-off (the capped list chains into the
 *      viewport natively). window.__dppScrollContract exposes the detected
 *      contract for the jsdom regression.
 *
 *      v1.4.4 reality check: on rc.5 the hand-off viewport handler
 *      preventDefaults EVERY wheel event over the sidebar nav and drives
 *      only the viewport — so the capped panel list could never scroll
 *      ITSELF ("工作区可以滑动、列表滑动不了").
 *
 *      v1.4.5 (b91) chained driver fixed the list but stopPropagation'd
 *      AND hand-wrote viewport.scrollTop, desynchronizing the host's
 *      gesture state — the workspace seat never took the hand-off again
 *      ("工作区又不行了"). v1.4.6 (b92) stepped aside entirely (no cap,
 *      no driver) — functional, but the user wanted the capped list back.
 *      v1.4.7 (b93) restored it with a LITE driver, but its EXTRA_CSS
 *      rewrite duplicated the `html.dpp-rc3 [class$="_regionArea"] {`
 *      line; inside a declaration block that stray selector is a bad
 *      declaration whose remnant consumption swallows balanced blocks
 *      until the next top-level ";" — and this stylesheet has none, so
 *      EVERY rule after that point (scrollbar theming, tidy footer cap,
 *      icon-only rows, .dpp-launcher, the whole overlay) was silently
 *      dropped by the CSS parser.
 *
 *      v1.4.8 (b94): v1.4.4's stylesheet, UNTOUCHED, plus the LITE
 *      driver. A step the capped list can absorb gets preventDefault +
 *      list scroll (the host handler exits on defaultPrevented — no
 *      double drive); a step AT the list boundary passes through
 *      completely untouched, so the host hand-off runs its own gesture
 *      transition with full event visibility. No stopPropagation, no
 *      viewport writes — the exact two things that broke the workspace
 *      in v1.4.5. rc.3 keeps its hijack; legacy hosts stay native.
 *
 *      v1.5.0 (b95): three additions, all built on public host contracts.
 *        1. Ctrl+K moves to the HOST shortcut service (ctx.shortcuts) when
 *           it exists: the binding becomes rebindable in Settings ->
 *           Shortcuts, and the host's own resolver decides whether the key
 *           may fire (focus region, open modals) instead of our target
 *           sniffing. The legacy document listener stays as the fallback
 *           for hosts without the service (>=0.2.0-rc.1) and for hosts that
 *           already bind Ctrl+K.
 *        2. Search understands PINYIN: literal text, pinyin initials
 *           (msn -> 面板收纳) and full pinyin (mianban -> 面板), plus a fuzzy
 *           subsequence tier. Matches are ranked inside their group, so the
 *           best hit is the first row (and Alt+1).
 *        3. Panels registered in the root `main` keyed slot by third-party
 *           plugins become reachable: the host enumerates that slot with
 *           ctx.slots.entries('main') (see ui-layout's retainMainPanels),
 *           and we open a panel with layout.selectPanel(key) — the same
 *           call the settings bridge already makes. A plugin that ships a
 *           full page but no sidebar row was installed and unreachable.
 */
