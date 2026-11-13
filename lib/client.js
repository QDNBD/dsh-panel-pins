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
 */
window.__ModuleLoader__.load({
  id: 'dsh-panel-pins',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const SLOT = 'sidebar.panellist.actions'
    const SLOT_ID = 'panel-pins'
    const STORE_KEY = 'dsh-panel-pins:unpinned'

    // Ordered top pins: panel ids in display order. Applied as negative CSS
    // `order` on the panel rows (the host panel list is a flex column), which
    // reorders visually without touching DOM structure — see applyTopPins.
    const TOP_KEY = 'dsh-panel-pins:top'

    // Whether the panel ROWS are hidden (collected into the Panels launcher).
    // Deliberately NOT migrated from the old 'panellist-folded-v2' key: that
    // key used to mean "collapse the whole nav", and an even older one could
    // lock the sidebar collapsed with no way out.
    const ROWS_HIDDEN_KEY = 'dsh-panel-pins:rows-hidden-v2'

    // Whether the "compact footer" layout patch (rule group 7) is applied.
    const TIDY_KEY = 'dsh-panel-pins:tidy'
    const TIDY_CLASS = 'dpp-tidy'

    // Whether third-party plugin entry rows (family rows between the
    // new-session anchor and the panel list) are collected into the launcher.
    const FAMILY_KEY = 'dsh-panel-pins:family-collected'

    // Overlay group fold states (v0.10.0): {"panel":bool,"family":bool,"cmd":bool}
    // true = collapsed. Persisted per group; independent of the search filter.
    const FOLD_GROUPS_KEY = 'dsh-panel-pins:overlay-groups-folded'

    // Recently used panels (v0.13.0): a capped MRU queue of panel labels,
    // rendered as its own group at the top of the overlay/palette. Labels are
    // stored (not ids) because ids may be unknown for unpinned entries; a
    // label that no longer resolves to an entry is simply skipped at render.
    const RECENT_KEY = 'dsh-panel-pins:recent-panels'
    const RECENT_CAP = 5

    // Display-layer overrides (v1.1.0): user-defined display names and
    // hidden rows. Both are keyed by the ORIGINAL label (the stable handle
    // across restarts; ids are not always resolvable for family rows) and
    // only affect what this plugin renders — the host's own rows, menus and
    // plugin registrations stay untouched. Hidden rows disappear from the
    // sidebar AND from the overlay inventory; they come back from Settings.
    const RENAMES_KEY = 'dsh-panel-pins:display-renames'
    const HIDDEN_KEY = 'dsh-panel-pins:hidden-rows'

    // Icon-only panel rows (v0.10.0): rows keep their slot but show only the
    // glyph. Gated on an html class like the tidy patch.
    const ICONONLY_KEY = 'dsh-panel-pins:icon-only'
    const ICONONLY_CLASS = 'dpp-icononly'

    // Numeric tunables (vh/px), edited from the Settings page section and
    // applied as CSS custom properties on <html>.
    const PANEL_MAX_KEY = 'dsh-panel-pins:panel-list-max'
    const FOOT_MAX_KEY = 'dsh-panel-pins:foot-max'
    const PANEL_MAX_DEFAULT = 20
    const FOOT_MAX_DEFAULT = 15
    const OVERLAY_MAX_KEY = 'dsh-panel-pins:overlay-max'
    const QR_SIZE_KEY = 'dsh-panel-pins:qr-size'
    const OVERLAY_MAX_DEFAULT = 60
    const QR_SIZE_DEFAULT = 132

    // Whitelist: entry labels containing any of these names stay in the
    // sidebar (never collected, never hidden).
    const WHITELIST_KEY = 'dsh-panel-pins:whitelist'

    // Persisted label→id map for panels, seeded every time the host feeds the
    // More-menu slot. The Settings pin list needs ids to toggle pins, and the
    // host only renders that slot when the More menu opens — so the map makes
    // the pin list work even before that.
    const LABEL_ID_MAP_KEY = 'dsh-panel-pins:label-id-map'

    // Layout presets (v1.0.0): named snapshots of the whole panel layout —
    // pin store, top pins, overlay group folds, whitelist, icon-only and the
    // compact-footer master. {name: snapshotObject}. Applied atomically from
    // the palette (quick commands) and managed on the Settings page.
    const PRESETS_KEY = 'dsh-panel-pins:layout-presets'
    const PRESET_NAME_KEY = 'dsh-panel-pins:active-preset'

    // Custom panel groups (v1.0.0): user-defined overlay groups mapping a
    // group id → {name, labels:[panel labels]}. Rendered after the global
    // panels group; a panel assigned to a custom group is hidden from that
    // group (it still appears in Recent).
    const CUSTOM_GROUPS_KEY = 'dsh-panel-pins:custom-groups'

    // Granular compact-footer sub-toggles (each rule group gated on its own
    // html class AND the master dpp-tidy class).
    const TIDY_QR_KEY = 'dsh-panel-pins:tidy-qr'
    const TIDY_BRAND_KEY = 'dsh-panel-pins:tidy-brand'
    const TIDY_METER_KEY = 'dsh-panel-pins:tidy-meter'
    const TIDY_QR_CLASS = 'dpp-tidy-qr'
    const TIDY_BRAND_CLASS = 'dpp-tidy-brand'
    const TIDY_METER_CLASS = 'dpp-tidy-meter'

    const STYLE_ID = 'dsh-panel-pins-style'
    const LAUNCHER_ATTR = 'data-dpp-launcher'
    const BUILD = 'b67'
    // Keep in sync with package.json — shown on the Settings page so an
    // installed build can be identified at a glance (verify-install aid).
    const VERSION = '1.1.1'
    const zh = (function () {
      try {
        return String((navigator && navigator.language) || '').toLowerCase().indexOf('zh') === 0
      } catch (error) {
        return false
      }
    })()
    const LABEL = {
      pin: zh ? '钉住在侧栏' : 'Pin to sidebar',
      unpin: zh ? '从侧栏取消钉住' : 'Unpin from sidebar',
      fold: zh ? '收起面板列表' : 'Hide panel list',
      unfold: zh ? '展开面板列表' : 'Show panel list',
      panels: zh ? '面板' : 'Panels',
      panelsMenu: zh ? '打开面板菜单' : 'Open panels menu',
      showRows: zh ? '显示面板行' : 'Show panel rows',
      hideRows: zh ? '隐藏面板行' : 'Hide panel rows',
      tidyOn: zh ? '收紧底部插件区' : 'Compact footer area',
      tidyOff: zh ? '还原底部插件区' : 'Restore footer area',
      familyOn: zh ? '收纳插件入口行' : 'Collect plugin rows',
      familyOff: zh ? '还原插件入口行' : 'Restore plugin rows',
      groupPanels: zh ? '全局面板' : 'Global panels',
      groupFamily: zh ? '插件入口' : 'Plugin entries',
      setTitle: zh ? '面板收纳' : 'Panel Pins',
      setIntro: zh
        ? '调整侧栏收纳与紧凑布局的各项参数，改动即时生效并自动保存。'
        : 'Tune sidebar collection and the compact layout. Changes apply live and save automatically.',
      setRows: zh ? '收纳面板行' : 'Collect panel rows',
      setRowsDetail: zh ? '全局面板行收进「面板」菜单' : 'Fold global panel rows into the Panels menu',
      setFamily: zh ? '收纳插件入口行' : 'Collect plugin rows',
      setFamilyDetail: zh ? '第三方插件入口行收进「面板」菜单' : 'Fold third-party entry rows into the Panels menu',
      setTidy: zh ? '紧凑底部区' : 'Compact footer',
      setTidyDetail: zh ? '底部插件区限高 + 内部滚动，二维码缩小' : 'Cap the footer area with internal scrolling; shrink QR codes',
      setPanelMax: zh ? '面板列表限高' : 'Panel list max height',
      setFootMax: zh ? '底部插件区限高' : 'Footer area max height',
      setOverlayMax: zh ? '弹层菜单限高' : 'Panels menu max height',
      setQrSize: zh ? '二维码尺寸' : 'QR code size',
      setWhitelist: zh ? '白名单常驻' : 'Keep entries pinned',
      setWhitelistDetail: zh
        ? '打开开关的入口留在侧栏原位，不收进「面板」菜单'
        : 'Entries switched on stay in the sidebar and are never collected',
      setPickEmpty: zh
        ? '尚未发现侧栏入口（打开侧栏后重试）'
        : 'No sidebar entries found yet — open the sidebar and retry',
      setPinManage: zh ? '钉住管理' : 'Pin management',
      setPinManageDetail: zh
        ? '列出全部面板：已钉住的在侧栏原位，未钉住的只在「更多」菜单里'
        : 'All panels: pinned ones sit in the sidebar, unpinned ones live in the More menu',
      setPinRestore: zh ? '钉住' : 'Pin',
      setPinUnpin: zh ? '取消钉住' : 'Unpin',
      setPinNeedMenu: zh
        ? '打开一次「更多」菜单以识别该面板后即可操作'
        : 'Open the More menu once so this panel can be identified',
      setPinEmpty: zh ? '尚未发现面板' : 'No panels found yet',
      setTop: zh ? '置顶' : 'To top',
      setTopOff: zh ? '取消置顶' : 'Unpin from top',
      setTopNeedPin: zh
        ? '先钉住该面板，才能置顶'
        : 'Pin the panel first — only pinned rows can be topped',
      setTopNoMatch: zh
        ? '置顶已保存，但尚未匹配到侧栏面板行——打开一次「更多」菜单后会自动生效'
        : 'Top pins saved, but no sidebar rows matched yet — open the More menu once to activate',
      topFlag: zh ? '（置顶）' : ' (top)',
      setSubQr: zh ? '二维码缩放' : 'Shrink QR codes',
      setSubBrand: zh ? '品牌行收紧' : 'Tighten brand row',
      setSubMeter: zh ? '费用条紧凑' : 'Compact cost meter',
      setSubNote: zh ? '以下细分在「紧凑底部区」开启时生效' : 'These apply while Compact footer is on',
      setReset: zh ? '恢复默认布局' : 'Reset layout',
      setResetData: zh ? '清除钉住与白名单' : 'Clear pins & whitelist',
      setResetDataTitle: zh
        ? '同时清除取消钉住、置顶与白名单数据，不可撤销'
        : 'Clears unpinned/top-pin/whitelist data. Cannot be undone.',
      setResetDone: zh ? '已恢复默认' : 'Reset done',
      searchPh: zh ? '搜索面板或插件…' : 'Search panels & plugins…',
      searchEmpty: zh ? '没有匹配项' : 'No matches',
      ctxOpen: zh ? '打开' : 'Open',
      ctxPin: zh ? '钉住' : 'Pin',
      ctxUnpin: zh ? '取消钉住' : 'Unpin',
      ctxTop: zh ? '置顶' : 'To top',
      ctxTopOff: zh ? '取消置顶' : 'Remove top',
      ctxWhitelist: zh ? '常驻侧栏' : 'Keep in sidebar',
      ctxWhitelistOff: zh ? '取消常驻' : 'Stop keeping in sidebar',
      // v1.1.0: display rename + hide (context menu).
      ctxRename: zh ? '重命名' : 'Rename',
      ctxHide: zh ? '隐藏此行' : 'Hide this row',
      ctxUnhide: zh ? '取消隐藏' : 'Unhide',
      renamePrompt: zh ? '输入新名称，留空恢复默认' : 'New name (empty to reset)',
      hiddenTitle: zh ? '隐藏的行' : 'Hidden rows',
      hiddenDetail: zh ? '从侧栏隐藏的入口在这里恢复显示' : 'Rows hidden from the sidebar; restore them here',
      hiddenEmpty: zh ? '没有隐藏任何行' : 'Nothing hidden',
      hiddenRestore: zh ? '恢复显示' : 'Restore',
      groupHidden: zh ? '已隐藏' : 'Hidden rows',
      renamesTitle: zh ? '重命名的行' : 'Renamed rows',
      renamesDetail: zh ? '显示名改动只影响本机显示；原名仍用于钉住/分组/白名单' : 'Display-only changes; the original label still keys pins/groups/whitelist',
      renamesReset: zh ? '恢复原名' : 'Reset name',
      renamesEmpty: zh ? '没有重命名的行' : 'No renames',
      cmdTitle: zh ? '快速命令' : 'Quick commands',
      recentTitle: zh ? '最近使用' : 'Recent',
      presetEmptyHint: zh ? '还没有预设，在设置页的「布局预设」卡里保存' : 'No presets yet — save one in Settings → Layout presets',
      presetApplyFailed: zh ? '预设 NAME 应用失败' : 'Failed to apply preset NAME',
      cmdShowRows: zh ? '显示面板行' : 'Show panel rows',
      cmdHideRows: zh ? '收纳面板行' : 'Collect panel rows',
      cmdToggleFamily: zh ? '切换插件入口收纳' : 'Toggle plugin-row collection',
      cmdToggleTidy: zh ? '切换紧凑底部区' : 'Toggle compact footer',
      setExport: zh ? '导出配置' : 'Export settings',
      setImport: zh ? '导入配置' : 'Import settings',
      setImportTitle: zh ? '粘贴此前导出的配置 JSON 后写入' : 'Paste a previously exported settings JSON, then apply',
      setExportDone: zh ? '配置已复制到剪贴板' : 'Settings copied to clipboard',
      setImportBad: zh ? '剪贴板内容不是有效的配置 JSON' : 'Clipboard does not hold a valid settings JSON',
      setImportDone: zh ? '配置已导入并生效' : 'Settings imported and applied',
      setIconOnly: zh ? '面板行仅图标' : 'Icon-only panel rows',
      setIconOnlyDetail: zh
        ? '面板行保留位置但只显示图标，比整行收纳更温和'
        : 'Panel rows keep their slot but show only the glyph — a middle ground',
      grpShow: zh ? '展开' : 'Show',
      grpHide: zh ? '收起' : 'Hide',
      setDragHint: zh ? '拖拽到其他置顶行上可调整顺序' : 'Drag onto another top row to reorder',
      noRowsAfterShow: zh
        ? '侧栏没有已钉住的面板——在「面板」菜单里悬停某行点图钉即可钉住'
        : 'No pinned panels — hover a line in the Panels menu and click the pin icon',
      unnamed: zh ? '未命名' : 'Unnamed',
      // Layout presets (v1.0.0)
      presetTitle: zh ? '布局预设' : 'Layout presets',
      presetDetail: zh
        ? '把整套面板布局（钉住/置顶/折叠/白名单/仅图标/紧凑）存成命名预设，随时一键切回'
        : 'Save the whole layout (pins/tops/folds/whitelist/icon-only/compact) as named presets and switch anytime',
      presetSave: zh ? '存为预设' : 'Save preset',
      presetApply: zh ? '应用' : 'Apply',
      presetDelete: zh ? '删除' : 'Delete',
      presetDeleteConfirm: zh ? '确认?' : 'Sure?',
      presetDeleteTitle: zh ? '再次点击确认删除' : 'Click again to confirm deletion',
      presetEmpty: zh ? '还没有预设——先调整布局，再点「存为预设」' : 'No presets yet — adjust the layout, then save one',
      presetSaved: zh ? '预设已保存' : 'Preset saved',
      presetSavedAs: zh ? '已存为预设「NAME」' : 'Saved as preset "NAME"',
      presetApplied: zh ? '已应用预设「NAME」' : 'Applied preset "NAME"',
      presetAppliedDefault: zh ? '已恢复当前布局（未套用预设）' : 'Restored the live layout (no preset)',
      presetDeleted: zh ? '预设已删除' : 'Preset deleted',
      presetNamePh: zh ? '预设名称（回车保存）' : 'Preset name (Enter to save)',
      presetNameRequired: zh ? '请输入预设名称' : 'Enter a preset name',
      presetActiveFlag: zh ? '（当前）' : ' (active)',
      presetNone: zh ? '（无）' : '(none)',
      // Palette: preset quick commands
      cmdPresetPrefix: zh ? '布局: ' : 'Layout: ',
      cmdPresetSave: zh ? '保存当前布局为预设' : 'Save current layout as preset',
      cmdPresetSavePrompt: zh ? '输入预设名称' : 'Preset name',
      cmdPresetNone: zh ? '（还没有预设）' : '(no presets yet)',
      // Custom groups (v1.0.0)
      cgTitle: zh ? '自定义分组' : 'Custom groups',
      cgDetail: zh
        ? '在「面板」菜单里自建分组：把面板归入你自己的分类，菜单按分组陈列'
        : 'Build your own groups in the Panels menu and file panels into them',
      cgAdd: zh ? '新建分组' : 'New group',
      cgNamePh: zh ? '分组名称（回车新建）' : 'Group name (Enter to create)',
      cgRename: zh ? '重命名' : 'Rename',
      cgDelete: zh ? '删除' : 'Delete',
      cgDeleteTitle: zh ? '再次点击确认删除' : 'Click again to confirm deletion',
      cgAddPanel: zh ? '＋面板' : '+ panel',
      cgRemovePanel: zh ? '移出' : 'Remove',
      cgEmpty: zh ? '还没有分组' : 'No groups yet',
      cgPickTitle: zh ? '选择要加入的面板：' : 'Pick panels to add:',
      cgSaved: zh ? '分组已保存' : 'Groups saved',
      cgDeleted: zh ? '分组已删除' : 'Group deleted',
      cgNoPanels: zh ? '尚无可用面板（打开一次「更多」菜单后重试）' : 'No panels available yet — open the More menu once and retry',
      cgNoMembers: zh ? '还没有面板成员，用右侧「+ 面板」下拉添加' : 'No members yet — add panels with the "+ panel" dropdown',
      cgAssignedNote: zh ? '已归组的面板不再出现在「全局面板」组里' : 'Panels in a custom group no longer repeat under Global panels',
    }

    // Bridge between the React slot component (which knows panel ids and pin
    // state) and the DOM launcher (which knows the live panel rows). The slot
    // component refreshes `bridge` on every render.
    const bridge = {
      entries: [],
      onPinnedChange: null,
    }

    // Live ctx.slots handle (captured in apply) — used to seed the label→id
    // map from the authoritative sidebar.panellist slot.
    let ctxSlots = null

    /**
     * Seed the label→id map straight from the sidebar.panellist slot.
     * The More-menu bridge cannot be trusted for this: its entry labels may
     * be missing (observed in the wild: map stayed EMPTY while ids like
     * "cli-bridge" got pinned, so top-pin matching had no label to match).
     * The sidebar renders its rows from THIS slot, so labels resolved here
     * are the exact row aria-labels — the matching key for top pins.
     */
    function seedMapFromSlots() {
      if (!ctxSlots || typeof ctxSlots.entriesOfSlot !== 'function') return
      try {
        const entries = ctxSlots.entriesOfSlot('sidebar.panellist')
        if (!Array.isArray(entries) || entries.length === 0) return
        const pairs = []
        entries.forEach(function (entry) {
          const options = entry && entry.options
          if (!options || typeof options.id !== 'string' || options.id.length === 0) return
          let label = options.label
          try {
            if (typeof label === 'function') label = label()
          } catch (error) {
            label = null
          }
          if (typeof label !== 'string' || label.length === 0) return
          pairs.push({ id: options.id, label: label })
        })
        if (pairs.length > 0) mergeLabelIdMap(pairs)
      } catch (error) {
        /* slots API unavailable: the More-menu bridge stays the fallback */
      }
    }

    /**
     * The full panel list for the Settings pin manager, merged from three
     * sources: visible panel rows (pinned, label→id via the persisted map),
     * the unpinned store (ids), and the host-fed bridge entries whenever the
     * More menu has rendered. Rows whose id is still unknown are flagged so
     * the UI can disable their toggle until the More menu identifies them.
     */
    function readPanelList() {
      const unpinned = readUnpinned()
      const map = readLabelIdMap()
      const byId = {}
      Object.keys(map).forEach(function (label) {
        const id = map[label]
        if (id && !(id in byId)) byId[id] = label
      })
      const list = []
      function findItem(pred) {
        for (let i = 0; i < list.length; i++) {
          if (pred(list[i])) return list[i]
        }
        return null
      }
      try {
        const nav = findPanelListNav()
        if (nav) {
          findPanelRows(nav).forEach(function (row) {
            const label = (row.getAttribute('aria-label') || row.textContent || '').trim()
            if (label.length === 0) return
            // b61: rows the user hid via the context menu stay in the nav DOM
            // (display:none via applyHiddenRows) — they must not inflate the
            // launcher badge, which advertises what the menu can offer.
            if (isRowHidden(label)) return
            const id = map[label]
            list.push({
              id: id || label,
              label: label,
              pinned: !unpinned.has(id || label),
              idKnown: typeof id === 'string' && id.length > 0,
            })
          })
        }
      } catch (error) {
        /* sidebar not ready */
      }
      Array.from(unpinned).forEach(function (id) {
        const existing = findItem(function (item) {
          return item.id === id
        })
        if (existing) {
          existing.pinned = false
          existing.idKnown = true
          return
        }
        // b62: a hidden row must not re-enter the inventory through the
        // unpinned backfill — the badge counts this list, and the menu skips
        // hidden labels at render time, so the numbers would drift apart.
        const backfillLabel = byId[id] || id
        if (isRowHidden(backfillLabel)) return
        list.push({ id: id, label: backfillLabel, pinned: false, idKnown: true })
      })
      if (Array.isArray(bridge.entries)) {
        bridge.entries.forEach(function (entry) {
          if (!entry || !entry.id) return
          const existing =
            findItem(function (item) {
              return item.id === entry.id
            }) ||
            findItem(function (item) {
              return !item.idKnown && item.label === entry.label
            })
          if (existing) {
            existing.id = entry.id
            existing.idKnown = true
            if (entry.label) existing.label = entry.label
            existing.pinned = !unpinned.has(entry.id)
          } else {
            // b62: same hidden-row guard as the unpinned backfill — bridge
            // entries must not re-inflate the badge for rows the user hid.
            if (isRowHidden(entry.label || entry.id)) return
            list.push({
              id: entry.id,
              label: entry.label || entry.id,
              pinned: !unpinned.has(entry.id),
              idKnown: true,
            })
          }
        })
      }
      const topPins = readTopPins()
      list.forEach(function (item) {
        item.top = topPins.indexOf(item.id) !== -1
      })
      return list
    }

    // ------------------------------------------------------------ persisted pins

    function readUnpinned() {
      try {
        const raw = window.localStorage.getItem(STORE_KEY)
        const parsed = raw ? JSON.parse(raw) : null
        const out = new Set()
        if (Array.isArray(parsed)) {
          parsed.forEach(function (id) {
            if (typeof id === 'string' && id.length > 0) out.add(id)
          })
        }
        return out
      } catch (error) {
        return new Set()
      }
    }

    function writeUnpinned(set) {
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(Array.from(set)))
      } catch (error) {
        /* storage unavailable: pins stay session-only */
      }
    }

    // ------------------------------------------------------------ top pins

    /** Persisted top pins: ordered [{id, label?}] entries (top order = array order).
     * v0.7.4 stored bare id strings; those normalize to {id, label: null}. */
    function readTopPins() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(TOP_KEY) || '[]')
        if (!Array.isArray(parsed)) return []
        return parsed
          .map(function (item) {
            if (typeof item === 'string' && item.length > 0) return { id: item, label: null }
            if (item && typeof item.id === 'string' && item.id.length > 0) {
              return {
                id: item.id,
                label: typeof item.label === 'string' && item.label.length > 0 ? item.label : null,
              }
            }
            return null
          })
          .filter(function (e) {
            return e !== null
          })
      } catch (error) {
        return []
      }
    }

    function writeTopPins(list) {
      try {
        window.localStorage.setItem(TOP_KEY, JSON.stringify(list))
      } catch (error) {
        /* storage unavailable: top pins stay session-only */
      }
    }

    /** Toggle `id` in the top-pin list; returns whether it is now top-pinned.
     * `label` is stored alongside so row matching does not depend on the
     * label→id map (which can lag behind locale changes). */
    function toggleTopPinStore(id, label) {
      const list = readTopPins()
      const idx = list.findIndex(function (e) {
        return e.id === id
      })
      if (idx >= 0) list.splice(idx, 1)
      else list.push({ id: id, label: label || null })
      writeTopPins(list)
      return idx < 0
    }

    /**
     * Match a sidebar row (by its aria-label) against the top-pin list.
     * Direct stored-label hit first, then id equivalence via the map (covers
     * rows whose aria-label is the raw panel id when locale resolution lags).
     * Returns the index in the top-pin order, or -1.
     */
    function topPinIndexFor(label, map, topPins) {
      for (let i = 0; i < topPins.length; i++) {
        const entry = topPins[i]
        if (entry.label && entry.label === label) return i
        if (map[label] && map[label] === entry.id) return i
        if (entry.id === label) return i
      }
      return -1
    }

    // The host's pins are memory-only; we mirror ours into them on mount and
    // whenever the entry list changes (new plugin installed, ids renamed).
    function syncIntoHost(entries, onPinnedChange) {
      if (typeof onPinnedChange !== 'function' || !Array.isArray(entries)) return
      const unpinned = readUnpinned()
      entries.forEach(function (entry) {
        if (!entry || entry.id === 'plugins') return
        const entryPinned = entry.pinned !== false
        const wantPinned = !unpinned.has(entry.id)
        if (entryPinned !== wantPinned) onPinnedChange(entry.id, wantPinned)
      })
    }

    // ---------------------------------------------------------------- row state

    /**
     * Whether the panel ROWS are hidden (collected into the Panels launcher).
     * Defaults to hidden: the original complaint was that the panel rows filled
     * the sidebar and pushed the session history out of view.
     */
    function readRowsHidden() {
      try {
        const raw = window.localStorage.getItem(ROWS_HIDDEN_KEY)
        if (raw === '1') return true
        if (raw === '0') return false
      } catch (error) {
        /* fall through to the default */
      }
      return true
    }

    function writeRowsHidden(value) {
      try {
        window.localStorage.setItem(ROWS_HIDDEN_KEY, value ? '1' : '0')
      } catch (error) {
        /* session-only */
      }
    }

    // ----------------------------------------------------------- compact footer

    /**
     * Whether the compact-footer patch is applied. ON by default: footer
     * plugins (cost meter, pairing QR, …) grow unbounded and squeeze the
     * session history out of view — the same complaint that motivated the
     * panel-row collection above.
     */
    function readTidy() {
      try {
        const raw = window.localStorage.getItem(TIDY_KEY)
        if (raw === '0') return false
        if (raw === '1') return true
      } catch (error) {
        /* fall through to the default */
      }
      return true
    }

    function writeTidy(value) {
      try {
        window.localStorage.setItem(TIDY_KEY, value ? '1' : '0')
      } catch (error) {
        /* session-only */
      }
    }

    // Granular compact-footer sub-toggles. Each gates its own CSS rule group;
    // all groups additionally require the master dpp-tidy class, so turning
    // the master off wins over every sub-toggle.
    function readTidyQr() {
      return readFlag(TIDY_QR_KEY)
    }
    function readTidyBrand() {
      return readFlag(TIDY_BRAND_KEY)
    }
    function readTidyMeter() {
      return readFlag(TIDY_METER_KEY)
    }

    /**
     * Apply (or remove) the `html.dpp-tidy` class that gates the compact-footer
     * CSS block. Toggling a class keeps the stylesheet immutable — no style
     * rewriting, no flicker, and React cannot lose it.
     */
    function applyTidy() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (!root) return
      root.classList.toggle(TIDY_CLASS, readTidy())
      root.classList.toggle(TIDY_QR_CLASS, readTidyQr())
      root.classList.toggle(TIDY_BRAND_CLASS, readTidyBrand())
      root.classList.toggle(TIDY_METER_CLASS, readTidyMeter())
    }

    // ------------------------------------------------------- icon-only rows

    function readIconOnly() {
      return readFlag(ICONONLY_KEY)
    }

    /** Apply the html.dpp-icononly gate: panel rows collapse to glyphs. */
    function applyIconOnly() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (!root) return
      root.classList.toggle(ICONONLY_CLASS, readIconOnly())
    }

    // ------------------------------------------------------------- theme probe

    /**
     * Best-effort dark-surface detection, used only to pick the OPAQUE base
     * color under the popup menu. Two signals, in order:
     *   1. computed `color-scheme` on <body>/<html> (the host usually sets it);
     *   2. fallback: luminance of the body background color.
     * Never throws; defaults to light.
     */
    function isDarkSurface() {
      try {
        const cs = window.getComputedStyle(document.body).colorScheme ||
          window.getComputedStyle(document.documentElement).colorScheme
        if (cs) return /dark/i.test(cs) && !/light/i.test(cs)
      } catch (error) {
        /* fall through */
      }
      try {
        const bg = window.getComputedStyle(document.body).backgroundColor
        const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(bg)
        if (m) return (Number(m[1]) + Number(m[2]) + Number(m[3])) < 384
      } catch (error) {
        /* fall through */
      }
      return false
    }

    const DARK_CLASS = 'dpp-dark'

    /** Toggle html.dpp-dark so the opaque menu base follows the host theme. */
    function applyTheme() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (!root) return
      root.classList.toggle(DARK_CLASS, isDarkSurface())
    }

    // ------------------------------------------------------------- numeric config

    function clampNum(v, min, max) {
      return Math.min(max, Math.max(min, v))
    }

    /** Read a persisted integer, clamped; falls back to `def` on any problem. */
    function readNum(key, def, min, max) {
      try {
        const raw = window.localStorage.getItem(key)
        const n = raw === null ? NaN : Number(raw)
        if (Number.isFinite(n)) return clampNum(Math.round(n), min, max)
      } catch (error) {
        /* fall through */
      }
      return def
    }

    /** Generic persisted boolean flag, default ON ('0' = off). */
    function readFlag(key) {
      try {
        return window.localStorage.getItem(key) !== '0'
      } catch (error) {
        return true
      }
    }

    function writeFlag(key, value) {
      try {
        window.localStorage.setItem(key, value ? '1' : '0')
      } catch (error) {
        /* session-only */
      }
    }

    function readPanelMax() {
      return readNum(PANEL_MAX_KEY, PANEL_MAX_DEFAULT, 8, 80)
    }

    function readFootMax() {
      return readNum(FOOT_MAX_KEY, FOOT_MAX_DEFAULT, 5, 60)
    }

    function readOverlayMax() {
      return readNum(OVERLAY_MAX_KEY, OVERLAY_MAX_DEFAULT, 30, 90)
    }

    function readQrSize() {
      return readNum(QR_SIZE_KEY, QR_SIZE_DEFAULT, 80, 256)
    }

    function writePanelMax(v) {
      try {
        window.localStorage.setItem(PANEL_MAX_KEY, String(clampNum(Math.round(v), 8, 80)))
      } catch (error) {
        /* session-only */
      }
    }

    function writeFootMax(v) {
      try {
        window.localStorage.setItem(FOOT_MAX_KEY, String(clampNum(Math.round(v), 5, 60)))
      } catch (error) {
        /* session-only */
      }
    }

    function writeOverlayMax(v) {
      try {
        window.localStorage.setItem(OVERLAY_MAX_KEY, String(clampNum(Math.round(v), 30, 90)))
      } catch (error) {
        /* session-only */
      }
    }

    function writeQrSize(v) {
      try {
        window.localStorage.setItem(QR_SIZE_KEY, String(clampNum(Math.round(v), 80, 256)))
      } catch (error) {
        /* session-only */
      }
    }

    // ----------------------------------------------------------------- whitelist

    // Cache for the parsed whitelist (invalidated on every write path):
    // isWhitelisted() runs per row per refresh pass, and re-parsing the whole
    // JSON array per row multiplied that cost for no benefit.
    let whitelistCache = null

    /** Persisted whitelist: an array of non-empty name strings. */
    function readWhitelist() {
      // Cached: isWhitelisted() runs per row per refresh tick, and parsing the
      // whole JSON array for every row multiplied that cost. The cache is
      // invalidated on every write path, so it cannot go stale.
      if (whitelistCache) return whitelistCache
      try {
        const parsed = JSON.parse(window.localStorage.getItem(WHITELIST_KEY) || '[]')
        if (Array.isArray(parsed)) {
          whitelistCache = parsed
            .filter(function (n) {
              return typeof n === 'string' && n.trim().length > 0
            })
            .map(function (n) {
              return n.trim()
            })
          return whitelistCache
        }
      } catch (error) {
        /* fall through */
      }
      whitelistCache = []
      return whitelistCache
    }

    function writeWhitelist(list) {
      whitelistCache = null
      try {
        window.localStorage.setItem(WHITELIST_KEY, JSON.stringify(list || []))
      } catch (error) {
        /* session-only */
      }
    }

    /** Persisted label→id map (plain object). Missing key → empty object. */
    // Cached like the whitelist: isWhitelisted(label, id) reads it per row
    // per pass; invalidated on every write path.
    let labelIdMapCache = null
    function readLabelIdMap() {
      if (labelIdMapCache) return labelIdMapCache
      try {
        const parsed = JSON.parse(window.localStorage.getItem(LABEL_ID_MAP_KEY) || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          labelIdMapCache = parsed
          return labelIdMapCache
        }
      } catch (error) {
        /* fall through */
      }
      labelIdMapCache = {}
      return labelIdMapCache
    }

    function mergeLabelIdMap(pairs) {
      try {
        const map = readLabelIdMap()
        let changed = false
        pairs.forEach(function (pair) {
          if (pair && pair.id && pair.label) {
            // b67: keep ONE current label per id — after a locale switch the
            // stale-label key would linger and id-first lookups (hidden/
            // renames) would resolve to a dead string.
            Object.keys(map).forEach(function (label) {
              if (label !== pair.label && map[label] === pair.id) {
                delete map[label]
                changed = true
              }
            })
            if (map[pair.label] !== pair.id) {
              map[pair.label] = pair.id
              changed = true
            }
          }
        })
        if (changed) {
          window.localStorage.setItem(LABEL_ID_MAP_KEY, JSON.stringify(map))
          labelIdMapCache = null // keep the isWhitelisted fast path honest
        }
      } catch (error) {
        /* session-only */
      }
    }

    // ------------------------------------------------------- layout presets

    /**
     * Snapshot the whole panel layout (v1.0.0). Captured state:
     * unpinned store, top pins, overlay group folds, whitelist, icon-only,
     * compact-footer master. NOT captured: numeric sliders (they are visual
     * tuning, not layout identity) and the Recent queue (behavioral, not
     * spatial) — the same trade layout-organizer makes for its presets.
     */
    function captureLayoutSnapshot() {
      return {
        unpinned: Array.from(readUnpinned()),
        topPins: readTopPins(),
        folds: readGroupFolds(),
        whitelist: readWhitelist(),
        iconOnly: readFlag(ICONONLY_KEY),
        tidy: readTidy(),
      }
    }

    /**
     * Apply a snapshot atomically: write every captured key, invalidate the
     * caches, re-run every applier, and let the refresh pass replay the
     * sidebar rows. Rows whose id the snapshot mentions but the host no
     * longer shows simply match nothing (no error, no residue).
     */
    function applyLayoutSnapshot(snap) {
      if (!snap || typeof snap !== 'object') return
      try {
        writeUnpinned(new Set(Array.isArray(snap.unpinned) ? snap.unpinned : []))
        writeTopPins(Array.isArray(snap.topPins) ? snap.topPins : [])
        writeGroupFolds(snap.folds && typeof snap.folds === 'object' ? snap.folds : {})
        writeWhitelist(Array.isArray(snap.whitelist) ? snap.whitelist : [])
        writeFlag(ICONONLY_KEY, snap.iconOnly !== false)
        writeTidy(snap.tidy !== false)
        // Caches + every applier, mirroring importSettings' replay list.
        whitelistCache = null
        labelIdMapCache = null
        applyConfig()
        applyTidy()
        applyIconOnly()
        restoreWhitelistedEverywhere()
        applyFold()
        applyFamily()
        applyTopPins()
        ensureLauncher()
        // If a menu is open, close it: the next open rebuilds from scratch and
        // replays the snapshot's fold states (replayGroupFolds is an openOverlay
        // closure, unreachable from here — closing is the clean replay path).
        try {
          if (overlay) closeOverlay()
        } catch (error) {
          /* ignore */
        }
      } catch (error) {
        /* preset application is cosmetic: never break the host */
      }
    }

    function readPresets() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(PRESETS_KEY) || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
      } catch (error) {
        /* fall through */
      }
      return {}
    }

    function writePresets(obj) {
      try {
        window.localStorage.setItem(PRESETS_KEY, JSON.stringify(obj || {}))
      } catch (error) {
        /* session-only */
      }
    }

    function savePreset(name) {
      const n = String(name || '').trim()
      if (!n) return false
      const presets = readPresets()
      presets[n] = captureLayoutSnapshot()
      writePresets(presets)
      try {
        window.localStorage.setItem(PRESET_NAME_KEY, n)
      } catch (error) {
        /* active-marker is cosmetic */
      }
      return true
    }

    function applyPreset(name) {
      const presets = readPresets()
      const snap = presets[name]
      if (!snap) return false
      applyLayoutSnapshot(snap)
      try {
        window.localStorage.setItem(PRESET_NAME_KEY, String(name))
      } catch (error) {
        /* active-marker is cosmetic */
      }
      return true
    }

    function deletePreset(name) {
      const presets = readPresets()
      if (!(name in presets)) return false
      delete presets[name]
      writePresets(presets)
      try {
        if (window.localStorage.getItem(PRESET_NAME_KEY) === name) {
          window.localStorage.removeItem(PRESET_NAME_KEY)
        }
      } catch (error) {
        /* ignore */
      }
      return true
    }

    function readActivePreset() {
      try {
        return window.localStorage.getItem(PRESET_NAME_KEY) || ''
      } catch (error) {
        return ''
      }
    }

    // ------------------------------------------------------- custom groups

    /** {groupId: {name, labels:[...]}} — labels are panel aria-labels. */
    function readCustomGroups() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_GROUPS_KEY) || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
      } catch (error) {
        /* fall through */
      }
      return {}
    }

    function writeCustomGroups(obj) {
      try {
        window.localStorage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify(obj || {}))
      } catch (error) {
        /* session-only */
      }
    }

    /** Labels already assigned to SOME custom group (set-like object). */
    function customGroupedLabels() {
      const groups = readCustomGroups()
      const assigned = {}
      Object.keys(groups).forEach(function (gid) {
        const labels = groups[gid] && groups[gid].labels
        if (!Array.isArray(labels)) return
        labels.forEach(function (l) {
          if (typeof l === 'string' && l.length > 0) assigned[l] = true
        })
      })
      return assigned
    }


    /**
     * Whether an entry is whitelisted. Entries are stored id-FIRST since
     * v0.8.0 (stable across UI-language switches); entries written by older
     * builds are plain labels, still matched case-insensitively-exact. A
     * legacy label entry that now maps to `id` in the label→id map also
     * matches — so a whitelist kept in Chinese keeps working after switching
     * the UI to English, and vice versa. Pass both label and id whenever the
     * id is known; label-only callers (arbitrary DOM sweep) still work.
     */
    function isWhitelisted(label, id) {
      const l = String(label || '').trim().toLowerCase()
      if (l.length === 0 && !id) return false
      const list = readWhitelist()
      const map = id ? readLabelIdMap() : null
      for (let i = 0; i < list.length; i++) {
        const entry = list[i]
        if (id && entry === id) return true
        if (l.length > 0 && entry.toLowerCase() === l) return true
        if (id && map[entry] === id) return true
      }
      return false
    }

    /**
     * Every selectable sidebar entry: {label, id|null}. Global panel rows
     * resolve id via the persisted label→id map; plugin entry (family) rows
     * have no panel id — they stay label-keyed. De-duplicated by label. This
     * is what the Settings whitelist picker offers — no free-text typing.
     */
    function readAvailableEntries() {
      const out = []
      const seen = {}
      function push(label, id) {
        const l = String(label || '').trim()
        if (l.length === 0) return
        const key = l.toLowerCase()
        if (seen[key]) return
        seen[key] = true
        out.push({ label: l, id: id || null })
      }
      try {
        const map = readLabelIdMap()
        const nav = findPanelListNav()
        if (nav) {
          findPanelRows(nav).forEach(function (row) {
            const l = (row.getAttribute('aria-label') || row.textContent || '').trim()
            push(l, map[l])
          })
        }
        findFamilyRows().forEach(function (row) {
          push(rowLabel(row))
        })
      } catch (error) {
        /* sidebar not ready: empty list */
      }
      return out
    }

    /**
     * Push the numeric tunables into CSS custom properties on <html>. The
     * stylesheet reads var(--dpp-panel-list-max) / var(--dpp-foot-max) etc.,
     * so this is the whole "apply" path — no stylesheet rewriting, instant.
     */
    function applyConfig() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (!root || !root.style) return
      try {
        root.style.setProperty('--dpp-panel-list-max', readPanelMax() + 'vh')
        root.style.setProperty('--dpp-foot-max', readFootMax() + 'vh')
        root.style.setProperty('--dpp-overlay-max', readOverlayMax() + 'vh')
        root.style.setProperty('--dpp-qr-size', readQrSize() + 'px')
      } catch (error) {
        /* ignore */
      }
    }

    // ------------------------------------------------------ plugin entry rows

    /**
     * Whether third-party plugin entry rows are collected into the launcher.
     * ON by default: the same complaint as the panel rows — every sidebar
     * plugin injects an entry row and the list grows unbounded.
     */
    function readFamily() {
      try {
        const raw = window.localStorage.getItem(FAMILY_KEY)
        if (raw === '0') return false
        if (raw === '1') return true
      } catch (error) {
        /* fall through to the default */
      }
      return true
    }

    function writeFamily(value) {
      try {
        window.localStorage.setItem(FAMILY_KEY, value ? '1' : '0')
      } catch (error) {
        /* session-only */
      }
    }

    // ------------------------------------------------------------ host DOM lookups

    function findPanelListNav() {
      // css-modules hash agnostic: class is "<hash>_panelList".
      try {
        return document.querySelector('nav[class$="_panelList"]')
      } catch (error) {
        return null
      }
    }

    /** Panel rows = nav button children, minus the More launcher and our launcher. */
    function findPanelRows(nav) {
      if (!nav) return []
      const kids = Array.prototype.slice.call(nav.children)
      const out = []
      for (let i = 0; i < kids.length; i++) {
        const el = kids[i]
        if (!el.getAttribute) continue
        if (el.hasAttribute(LAUNCHER_ATTR)) continue
        if (el.getAttribute('aria-haspopup') === 'menu') continue
        if (el.tagName !== 'BUTTON') continue
        out.push(el)
      }
      return out
    }

    // ------------------------------------------------- family row lookups
    // Structural derivation, zero literal selectors (per weibaohui/
    // dsh-sidebar-tidy v0.1.0): the new-session container is the anchor, the
    // sidebar root is its container that also directly holds the panel-list
    // nav, and family rows are the CLICKABLE root children strictly between
    // the anchor and the nav — direct <button>s or containers wrapping one
    // button (wrapped third-party injections). Bottom/footer entries are
    // never considered: they live outside this span.

    /** The root child that holds the new-session control (or null). */
    function findAnchor(root) {
      if (!root) return null
      try {
        const el = document.querySelector('[class$="_newSession"]')
        if (!el) return null
        let node = el
        for (let i = 0; node && node !== document.body && i < 8; i++) {
          if (node.parentNode === root) return node
          node = node.parentNode
        }
      } catch (error) {
        /* ignore */
      }
      return null
    }

    /** Whether the element triggers something: a button or wraps one. */
    function isClickableRow(el) {
      if (!el || !el.querySelector) return false
      if (el.tagName === 'BUTTON') return true
      if (el.hasAttribute(LAUNCHER_ATTR)) return false
      // A wrapped injection: the container's first meaningful child is a button.
      return el.querySelector(':scope > button') !== null
    }

    /**
     * Family rows = clickable root children strictly between the new-session
     * anchor and the panel-list nav. Returns [] when the structure cannot be
     * derived (anchor or nav missing) — never guess.
     */
    function findFamilyRows() {
      try {
        const nav = findPanelListNav()
        if (!nav || !nav.parentNode) return []
        const root = nav.parentNode
        const anchor = findAnchor(root)
        if (!anchor) return []
        const kids = Array.prototype.slice.call(root.children)
        const ai = kids.indexOf(anchor)
        const ni = kids.indexOf(nav)
        if (ai < 0 || ni < 0 || ni <= ai + 1) return []
        const out = []
        for (let i = ai + 1; i < ni; i++) {
          if (isClickableRow(kids[i])) out.push(kids[i])
        }
        return out
      } catch (error) {
        return []
      }
    }

    /** Click the ORIGINAL control behind a row (unwrap wrapped injections). */
    function triggerRow(row) {
      try {
        const btn = row.tagName === 'BUTTON' ? row : row.querySelector('button')
        if (btn) btn.click()
      } catch (error) {
        /* ignore */
      }
    }

    function rowLabel(row) {
      const btn = row.tagName === 'BUTTON' ? row : row.querySelector('button')
      const el = btn || row
      return ((el.getAttribute && el.getAttribute('aria-label')) || el.textContent || '').trim()
    }

    function rowIcon(row) {
      const btn = row.tagName === 'BUTTON' ? row : row.querySelector('button')
      return svgClone(btn || row, 16)
    }

    /** Apply the persisted family-row visibility (inline display, replayed). */
    function applyFamily() {
      if (typeof document === 'undefined') return
      const hidden = readFamily()
      findFamilyRows().forEach(function (row) {
        // b52: skip rows with an in-place rename editor (observer race guard,
        // same as applyFold).
        if (row.getAttribute('data-dpp-renaming') === '1') return
        // Whitelisted entries stay in the sidebar no matter what. Family rows
        // have no panel id — match label + map-derived id equivalence.
        const hide = hidden && !isWhitelistedLabelOrMapped(rowLabel(row))
        const want = hide ? 'none' : ''
        if (row.style.display === want) return // skip redundant writes
        row.style.display = want
        if (hide) row.dataset.dppHidden = '1'
        else delete row.dataset.dppHidden
      })
    }

    /** Whitelist check for rows whose panel id is unknown: exact label, or
     * any whitelist entry that maps to a panel whose CURRENT label is this
     * one (label→id→reverse-label equivalence across locale switches). */
    function isWhitelistedLabelOrMapped(label) {
      if (isWhitelisted(label)) return true
      const map = readLabelIdMap()
      const id = map[label]
      if (!id) return false
      for (const entry of readWhitelist()) {
        if (map[entry] === id) return true
      }
      return false
    }

    const HIDDEN_MARK = 'dppHidden'

    /**
     * Sweep for rows we hid that drifted out of the structural derivation
     * (a plugin re-inserted or moved its entry). Anything still carrying our
     * marker whose label is now whitelisted gets restored — this is what
     * makes toggling a whitelist entry reliable even when the entry moved.
     */
    function restoreWhitelistedEverywhere() {
      if (typeof document === 'undefined') return
      let marked
      try {
        marked = document.querySelectorAll('[data-dpp-hidden="1"]')
      } catch (error) {
        return
      }
      Array.prototype.forEach.call(marked, function (el) {
        const label =
          (el.getAttribute && el.getAttribute('aria-label')) ||
          (el.textContent || '').trim()
        if (isWhitelistedLabelOrMapped(label)) {
          el.style.display = ''
          delete el.dataset.dppHidden
        }
      })
    }

    // ---------------------------------------------------------------- fold state
    /**
     * Apply the persisted row-visibility state.
     *
     * The host renders the panel rows AND the "More" button (PanelMoreMenu) as
     * children of the same nav (dsh-client-ui-sidebar/lib/client.js:471-500).
     * Hiding the whole nav would hide the More button too — and that button is
     * the only way to unfold again, so the sidebar would lock itself collapsed
     * with no way out. We therefore hide only the panel rows and always keep
     * the More button (and our own launcher) visible.
     */
    function applyFold() {
      if (typeof document === 'undefined') return
      const nav = findPanelListNav()
      if (!nav) return
      const hidden = readRowsHidden()
      const rows = findPanelRows(nav)
      const renames = readRenames()
      const hiddenRows = readHiddenRows()
      rows.forEach(function (row) {
        // b52: an in-place rename editor lives in this row — do not touch
        // its label (the observer fires on the editor insertion and would
        // race the editor's text node).
        if (row.getAttribute('data-dpp-renaming') === '1') return
        // Whitelisted panels stay in the sidebar no matter what. The row's id
        // resolves through the persisted label→id map (locale-change safe).
        const label = (row.getAttribute('aria-label') || row.textContent || '').trim()
        // v1.1.0 display rename: rewrite the visible label text in place.
        // aria-label carries the ORIGINAL label (all lookups — pins, groups,
        // whitelist, context menu — keep matching); only the rendered text
        // and a tooltip show the override.
        const customName =
          typeof renames[label] === 'string' && renames[label].trim() ? renames[label].trim() : null
        const nameEl = row.querySelector('[class$="_label"], .dpp-label') || row
        if (customName) {
          // v1.1.0 b48: rewrite only the TEXT node — the label element also
          // hosts the row icon (svg); nameEl.textContent = customName wiped
          // it (icon-loss bug). Reuse the shared text-node swap.
          // b61: first strip any orphan text nodes WE appended earlier
          // (data-dpp-text="1") — the host may have re-rendered its own text
          // node meanwhile, and both copies would show ("XD PoolXD Pool").
          const stale = nameEl.querySelectorAll('[data-dpp-text="1"]')
          for (const s of stale) s.remove()
          // b64: SINGLE text carrier. React may have re-created its own text
          // node while our write/marked node survived (or the host node we
          // blanked during an earlier edit was restored) — two visible text
          // nodes = duplicated label ("XD Pool XD Pool"). Prefer the host's
          // own node (non-empty first, then a blanked one — reusing it keeps
          // React's commit target stable); blank every OTHER text node so
          // exactly one carrier shows customName.
          const tn = (function () {
            let blanked = null
            for (const n of nameEl.childNodes) {
              if (n.nodeType !== 3) continue
              if (n.nodeValue && n.nodeValue.trim()) return n
              if (!blanked) blanked = n
            }
            return blanked
          })()
          if (tn) {
            if (tn.nodeValue !== customName) tn.nodeValue = customName
            for (const n of nameEl.childNodes) {
              if (n.nodeType === 3 && n !== tn && n.nodeValue) n.nodeValue = ''
            }
          } else if (nameEl.textContent !== customName) {
            const node = document.createTextNode(customName)
            node.setAttribute('data-dpp-text', '1')
            nameEl.appendChild(node)
          }
          if (row.getAttribute('data-dpp-renamed') !== '1') {
            row.setAttribute('data-dpp-renamed', '1')
            row.title = customName
          }
        } else if (row.getAttribute('data-dpp-renamed') === '1') {
          // Renaming was undone: b64 — clear every text node we may have
          // written (customName carriers) EXCEPT the host's own node; if no
          // host node survives, React restores the label on its next render.
          // Without this sweep a leftover carrier kept the old override
          // visible next to the restored original.
          const stale2 = nameEl.querySelectorAll('[data-dpp-text="1"]')
          for (const s of stale2) s.remove()
          let hostSeen = false
          for (const n of nameEl.childNodes) {
            if (n.nodeType !== 3) continue
            if (!hostSeen && n.nodeValue && n.nodeValue.trim() && n.nodeValue.trim() !== label) {
              hostSeen = true
              continue
            }
            n.nodeValue = ''
          }
          row.removeAttribute('data-dpp-renamed')
          row.removeAttribute('title')
        }
        // v1.1.0 hide: user-hidden rows disappear from the sidebar (unless
        // whitelisted — whitelist still wins, it means "keep in sidebar").
        const hide =
          (hidden || hiddenRows.indexOf(label) !== -1) &&
          !isWhitelisted(label, readLabelIdMap()[label])
        const want = hide ? 'none' : ''
        // Skip when already in place: refresh runs on every DOM mutation
        // burst, and redundant inline-style writes invalidate layout for nothing.
        if (row.style.display === want) return
        row.style.display = want
        if (hide) row.dataset.dppHidden = '1'
        else delete row.dataset.dppHidden
      })
    }

    /**
     * v1.1.0: hide user-hidden rows in the family (plugin entry) region too,
     * same semantics as applyFold — whitelist still wins.
     */
    function applyHiddenRows() {
      if (typeof document === 'undefined') return
      const hiddenRows = readHiddenRows()
      if (hiddenRows.length === 0) return
      findFamilyRows().forEach(function (row) {
        const label = rowLabel(row)
        if (hiddenRows.indexOf(label) === -1) return
        if (isWhitelistedLabelOrMapped(label)) return
        if (row.style.display !== 'none') {
          row.style.display = 'none'
          row.dataset.dppHidden = '1'
        }
      })
    }

    /** Refresh pass: re-assert everything the plugin owns on the live DOM.
     * Called from the MutationObserver callback (debounced) and one low-rate
     * fallback interval — replacing the old unconditional 1.5s full sweep. */
    function refreshAll() {
      if (typeof document === 'undefined') return
      injectStyle()
      applyConfig()
      applyTheme()
      applyTidy()
      applyIconOnly()
      seedMapFromSlots()
      restoreWhitelistedEverywhere()
      applyFamily()
      applyFold()
      applyHiddenRows()
      applyTopPins()
      ensureLauncher()
      updateDebug()
    }

    // ---------------------------------------------------------------- scroll css

    const EXTRA_CSS = [
      // Cap the global panel list so many plugin rows cannot squeeze the
      // session-history region below it; let the list scroll instead.
      // NOTE: no scrollbar-width/scrollbar-color here — in Chromium 121+ the
      // standard properties DISABLE ::-webkit-scrollbar styling below.
      '[class$="_panelList"] {',
      '  max-height: var(--dpp-panel-list-max, 20vh);',
      '  overflow-y: auto;',
      '  overflow-x: hidden;',
      '}',
      // Themed thin scrollbars for every area we cap (panel list, capped
      // footer, panels popup). Capsule thumb, transparent track. Colors come
      // from the host's own scrollbar tokens (--dsh-scrollbar-thumb / -hover,
      // which the sidebar root derives from --dsw-alias-scrollbar-*-l2), so
      // they follow the theme and dsh-any-background's palette; the
      // --dpp-scrollbar pair remains only as a last-resort fallback.
      'html { --dpp-scrollbar: rgba(127,127,127,.4); --dpp-scrollbar-hover: rgba(127,127,127,.6); }',
      'html.dpp-dark { --dpp-scrollbar: rgba(255,255,255,.26); --dpp-scrollbar-hover: rgba(255,255,255,.46); }',
      '[class$="_panelList"]::-webkit-scrollbar,',
      'html.dpp-tidy [class*="_footArea"]::-webkit-scrollbar,',
      'html.dpp-tidy .cm-bbox::-webkit-scrollbar,',
      '.dpp-overlay .dpp-ov-body::-webkit-scrollbar {',
      '  width: 7px;',
      '  height: 7px;',
      '}',
      '[class$="_panelList"]::-webkit-scrollbar-track,',
      'html.dpp-tidy [class*="_footArea"]::-webkit-scrollbar-track,',
      'html.dpp-tidy .cm-bbox::-webkit-scrollbar-track,',
      '.dpp-overlay .dpp-ov-body::-webkit-scrollbar-track {',
      '  background: transparent;',
      '}',
      '[class$="_panelList"]::-webkit-scrollbar-thumb,',
      'html.dpp-tidy [class*="_footArea"]::-webkit-scrollbar-thumb,',
      'html.dpp-tidy .cm-bbox::-webkit-scrollbar-thumb,',
      '.dpp-overlay .dpp-ov-body::-webkit-scrollbar-thumb {',
      '  background-color: var(--dsh-scrollbar-thumb, var(--dpp-scrollbar, rgba(127,127,127,.4)));',
      '  border-radius: 8px;',
      '  border: 2px solid transparent;',
      '  background-clip: padding-box;',
      '  min-height: 24px;',
      '  min-width: 24px;',
      '}',
      '[class$="_panelList"]::-webkit-scrollbar-thumb:hover,',
      'html.dpp-tidy [class*="_footArea"]::-webkit-scrollbar-thumb:hover,',
      'html.dpp-tidy .cm-bbox::-webkit-scrollbar-thumb:hover,',
      '.dpp-overlay .dpp-ov-body::-webkit-scrollbar-thumb:hover {',
      '  background-color: var(--dsh-scrollbar-thumb-hover, var(--dpp-scrollbar-hover, rgba(127,127,127,.6)));',
      '  border: 2px solid transparent;',
      '  background-clip: padding-box;',
      '}',
      // Compact footer ("sidebar tidy", ported from @weibaohui/dsh-sidebar-tidy).
      // Gated on html.dpp-tidy so the toggle only flips one class. Host class
      // names are css-modules hashes (_2H3hWW_footArea); the suffix is stable,
      // so the rules match with [class*="_footArea"]. Footer ENTRIES stay in
      // place — only their container gets a height cap and a scrollbar.
      'html.dpp-tidy [class*="_footArea"] {',
      '  max-height: var(--dpp-foot-max, 15vh) !important;',
      '  overflow-y: auto !important;',
      '  overscroll-behavior: contain;',
      '}',
      'html.dpp-tidy.dpp-tidy-qr img[alt*="二维码"], html.dpp-tidy.dpp-tidy-qr img[alt*="QR"] {',
      '  width: var(--dpp-qr-size, 132px) !important;',
      '  height: auto !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-qr [class*="KV--Pq_qr"] {',
      '  width: var(--dpp-qr-size, 132px) !important;',
      '  height: auto !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-qr [class*="KV--Pq_content"] {',
      '  padding: 10px 0 !important;',
      '  gap: 8px !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-brand [class*="_logoRow"] {',
      '  height: 44px !important;',
      '  margin-bottom: 0 !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-brand [class*="_newSession"] {',
      '  margin-bottom: 8px !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-meter .cm-foot {',
      '  height: 26px !important;',
      '}',
      'html.dpp-tidy.dpp-tidy-meter .cm-bbox {',
      '  max-height: 128px;',
      '  overflow-y: auto;',
      '}',
      // Icon-only panel rows (v0.10.0, fixed in 0.10.2): rows keep their flex
      // slot but shrink to the glyph. Structure-independent approach — the
      // icon wrapper's class is a host css-modules hash we cannot match
      // reliably, so instead of guessing wrapper class names we hide every
      // DIRECT child that does NOT contain an svg (label spans, badges) via
      // :has(). Chromium in Electron 44 supports :has() natively. The
      // font-size:0 trick below also swallows bare text nodes in rows whose
      // label isn't wrapped. Our launcher keeps its label.
      'html.dpp-icononly [class$="_panelList"] > button:not([data-dpp-launcher]) {',
      '  width: 36px !important;',
      '  min-width: 36px !important;',
      '  padding: 7px 0 !important;',
      '  justify-content: center;',
      '  gap: 0 !important;',
      '  font-size: 0 !important; /* bare text nodes vanish */',
      '}',
      'html.dpp-icononly [class$="_panelList"] > button:not([data-dpp-launcher]) > *:not(:has(svg)) {',
      '  display: none !important;',
      '}',
      'html.dpp-icononly [class$="_panelList"] > button:not([data-dpp-launcher]) svg {',
      '  width: 18px !important;',
      '  height: 18px !important;',
      '  font-size: 0;',
      '}',
      // Our launcher row: matches the host panel row metrics. `order: -1`
      // pins it to the top of the flex column while keeping it as the LAST
      // DOM child — React only ever appends new rows to the end, so this
      // avoids fighting the host renderer over sibling order.
      // Metrics mirror _2H3hWW_panelRow exactly (margin 0 2px, padding 7px 8px,
      // gap 8px, 16px glyph when wide / 18px in rail) so the label aligns with
      // the host rows' text column — a wider icon pushed it 2px right.
      '.dpp-launcher {',
      '  order: -1;',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  box-sizing: border-box;',
      '  width: calc(100% - 4px);',
      '  min-height: 36px;',
      '  margin: 0 2px;',
      '  padding: 7px 8px;',
      '  border: none;',
      '  border-radius: var(--dsw-radius-md, 8px);',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 14px;',
      '  text-align: left;',
      '  cursor: pointer;',
      '}',
      '.dpp-launcher:hover, .dpp-launcher:focus-visible {',
      '  background-color: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '  outline: none;',
      '}',
      '.dpp-launcher .dpp-icon {',
      '  flex: none;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 16px;',
      '  height: 16px;',
      '  color: var(--dsw-alias-label-secondary, inherit);',
      '}',
      '.dpp-launcher svg { width: 16px; height: 16px; }',
      // Rail mode (collapsed sidebar): host rows switch back to 18px glyphs.
      '.dpp-launcher.dpp-rail .dpp-icon { width: 18px; height: 18px; }',
      '.dpp-launcher.dpp-rail svg { width: 18px; height: 18px; }',
      '.dpp-launcher .dpp-launcher-label {',
      '  flex: 1 1 auto;',
      '  min-width: 0;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      '.dpp-launcher .dpp-launcher-badge {',
      '  flex: none;',
      '  min-width: 16px;',
      '  padding: 0 5px;',
      '  border-radius: 8px;',
      '  font-size: 11px;',
      '  line-height: 16px;',
      '  text-align: center;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  background: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '}',
      '.dpp-launcher .dpp-launcher-badge:empty { display: none; }',
      // Rail mode (collapsed sidebar, 56px): icon only.
      '.dpp-launcher.dpp-rail {',
      '  width: 36px;',
      '  min-width: 36px;',
      '  justify-content: center;',
      '  gap: 0;',
      '  padding: 0;',
      '}',
      '.dpp-launcher.dpp-rail .dpp-launcher-label,',
      '.dpp-launcher.dpp-rail .dpp-launcher-badge { display: none; }',
      // Floating panels menu.
      '.dpp-overlay {',
      '  position: fixed;',
      '  z-index: 2147482000;',
      '  box-sizing: border-box;',
      '  display: flex;',
      '  flex-direction: column;',
      '  min-width: 220px;',
      '  max-width: 300px;',
      '  max-height: var(--dpp-overlay-max, 60vh);',
      '  /* v0.10.7: the BOX no longer scrolls — it is a flex column whose',
      '     middle .dpp-ov-body scrolls. Search box (top) and the footer rows',
      '     + Ctrl+K hint (bottom) stay pinned outside the scroll area, so the',
      '     hint is never clipped when the list exceeds --dpp-overlay-max. */',
      '  overflow: hidden;',
      '  padding: 6px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));',
      '  border-radius: 10px;',
      '  /* Theme-inherited menu surface (dsh-any-background compatible): consume',
      '     the SAME tokens the host MenuSurface paints from. The wallpaper /',
      '     card-opacity / menu-blur sliders of dsh-any-background retint this',
      '     surface exactly like host menus — no hardcoded white/dark base. */',
      '  background-color: var(--dsw-menu-surface-fill, var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2, transparent)));',
      '  -webkit-backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(150%));',
      '  backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(150%));',
      '  box-shadow: 0 12px 32px rgba(0,0,0,.35);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font-size: 13px;',
      '  /* Host scrollbar tokens (declared by the sidebar root for its own',
      '     scrollers) re-declared here because this overlay lives on <body>,',
      '     outside that inheritance scope. */',
      '  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2, rgba(127,127,127,.4));',
      '  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2, rgba(127,127,127,.6));',
      '}',
      // v0.10.7: middle scroll region — every list child (heads, items, empty
      // state) lives here; the search box and the footer/hint stay outside.
      '.dpp-ov-body {',
      '  flex: 1 1 auto;',
      '  min-height: 0;',
      '  overflow-y: auto;',
      '  overflow-x: hidden;',
      '}',
      '.dpp-ov-body::-webkit-scrollbar {',
      '  width: 8px;',
      '}',
      '.dpp-ov-body::-webkit-scrollbar-track {',
      '  background: transparent;',
      '}',
      '.dpp-ov-body::-webkit-scrollbar-thumb {',
      '  background-color: var(--dsh-scrollbar-thumb, var(--dpp-scrollbar, rgba(127,127,127,.4)));',
      '  border-radius: 8px;',
      '}',
      '.dpp-ov-body::-webkit-scrollbar-thumb:hover {',
      '  background-color: var(--dsh-scrollbar-thumb-hover, var(--dpp-scrollbar-hover, rgba(127,127,127,.6)));',
      '}',
      '.dpp-ov-head {',
      '  padding: 6px 8px 3px;',
      '  font-size: 11px;',
      '  line-height: 16px;',
      '  opacity: .55;',
      '  white-space: nowrap;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '}',
      // Collapsible group header (v0.10.0): clickable, chevron shows the fold.
      '.dpp-ov-ghead {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 4px;',
      '  width: 100%;',
      '  border: none;',
      '  background: transparent;',
      '  color: inherit;',
      '  font: inherit;',
      '  font-size: 11px;',
      '  text-align: left;',
      '  cursor: pointer;',
      '  box-sizing: border-box;',
      '}',
      '.dpp-ov-ghead:hover { opacity: .85; }',
      '.dpp-ov-gchev { display: inline-flex; flex: none; width: 12px; height: 12px; }',
      '.dpp-ov-gchev svg { width: 12px; height: 12px; }',
      // Search box at the top of the panels overlay. flex:none so the flex
      // column never shrinks it when the body list saturates the cap.
      '.dpp-ov-search {',
      '  display: block;',
      '  box-sizing: border-box;',
      '  flex: none;',
      '  width: 100%;',
      '  height: 30px;',
      '  margin: 2px 0 4px;',
      '  padding: 4px 10px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));',
      '  border-radius: 8px;',
      '  background: var(--dsw-alias-bg-layer-1, transparent);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 13px;',
      '  outline: none;',
      '}',
      '.dpp-ov-search:focus-visible {',
      '  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d6bfe));',
      '  outline-offset: 0;',
      '}',
      '.dpp-ov-search::placeholder { color: var(--dsw-alias-label-tertiary, inherit); opacity: .7; }',
      '.dpp-ov-empty {',
      '  padding: 10px 8px;',
      '  font-size: 12px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '  text-align: center;',
      '}',
      // Keyboard-active overlay line (↑↓ navigation highlight).
      '.dpp-ov-item.dpp-kb {',
      '  background: var(--dsw-alias-interactive-bg-active, rgba(127,127,127,.2));',
      '}',
      // Row context menu (right-click on a sidebar row).
      '.dpp-ctx {',
      '  position: fixed;',
      '  z-index: 2147482100;',
      '  box-sizing: border-box;',
      '  min-width: 180px;',
      '  max-width: 280px;',
      '  padding: 5px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));',
      '  border-radius: 10px;',
      '  background-color: var(--dsw-menu-surface-fill, var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2, transparent)));',
      '  -webkit-backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(150%));',
      '  backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(150%));',
      '  box-shadow: 0 12px 32px rgba(0,0,0,.35);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font-size: 13px;',
      '  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2, rgba(127,127,127,.4));',
      '  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2, rgba(127,127,127,.6));',
      '}',
      '.dpp-ctx-title {',
      '  padding: 5px 8px 3px;',
      '  font-size: 11px;',
      '  line-height: 16px;',
      '  opacity: .55;',
      '  white-space: nowrap;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '}',
      '.dpp-ctx .dpp-row { min-height: 30px; border-radius: var(--dsw-radius-md, 8px); }',
      // Transient toast (bottom-center).
      '.dpp-toast {',
      '  position: fixed;',
      '  left: 50%;',
      '  bottom: 48px;',
      '  transform: translateX(-50%);',
      '  z-index: 2147483000;',
      '  padding: 8px 16px;',
      '  border-radius: 10px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));',
      '  background-color: var(--dsw-menu-surface-fill, var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2, rgba(40,40,40,.92))));',
      '  -webkit-backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(150%));',
      '  backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(150%));',
      '  box-shadow: 0 8px 24px rgba(0,0,0,.3);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font-size: 13px;',
      '  max-width: 60vw;',
      '  white-space: nowrap;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '}',
      // Command palette: centered variant of the panels overlay.
      '.dpp-overlay.dpp-palette {',
      '  left: 50% !important;',
      '  top: 18vh !important;',
      '  transform: translateX(-50%);',
      '  min-width: min(420px, calc(100vw - 24px));',
      '  max-width: calc(100vw - 24px);',
      '}',
      '.dpp-overlay.dpp-palette .dpp-ov-search {',
      '  height: 36px;',
      '  font-size: 14px;',
      '}',
      // Muted shortcut hint under the overlay footer. Lives OUTSIDE the
      // scrollable body (flex column child after .dpp-ov-body), so it stays
      // visible even when the panel list hits the height cap. v0.12.0: the
      // hint also documents Alt+数字 quick activation.
      '.dpp-ov-hint {',
      '  flex: none;',
      '  padding: 4px 8px 2px;',
      '  font-size: 11px;',
      '  line-height: 16px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '  opacity: .75;',
      '  text-align: center;',
      '  user-select: none;',
      '}',
      '.dpp-ov-item {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  width: 100%;',
      '  min-height: 34px;',
      '  padding: 6px 8px;',
      '  border: none;',
      '  border-radius: var(--dsw-radius-md, 8px);',
      '  background: transparent;',
      '  color: inherit;',
      '  font: inherit;',
      '  font-size: 13px;',
      '  text-align: left;',
      '  cursor: pointer;',
      '}',
      '.dpp-ov-item:hover, .dpp-ov-item:focus-visible {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '  outline: none;',
      '}',
      '.dpp-ov-ico {',
      '  flex: none;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 18px;',
      '  height: 18px;',
      '}',
      '.dpp-ov-ico svg { width: 16px; height: 16px; }',
      '.dpp-ov-letter {',
      '  flex: none;',
      '  width: 16px;',
      '  height: 16px;',
      '  border-radius: 50%;',
      '  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.15));',
      '  font-size: 10px;',
      '  line-height: 14px;',
      '  text-align: center;',
      '  opacity: .75;',
      '}',
      '.dpp-ov-lbl {',
      '  flex: 1 1 auto;',
      '  min-width: 0;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      '.dpp-ov-dot {',
      '  flex: none;',
      '  width: 6px;',
      '  height: 6px;',
      '  border-radius: 50%;',
      '  background: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '}',
      // Search hit highlight (v0.12.0): the matched substring inside a row
      // label. Theme-aware accent color, never overrides the kb highlight.
      '.dpp-ov-lbl .dpp-mark {',
      '  color: var(--dsw-alias-brand-primary, #4d6bfe);',
      '  font-weight: 600;',
      '  background: transparent;',
      '}',
      // Unpinned panel lines: reachable but visually secondary.
      '.dpp-ov-item.dpp-ov-unpinned .dpp-ov-lbl { opacity: .7; }',
      // Hover action cluster (pin/unpin, to-top) on panel lines.
      '.dpp-ov-acts {',
      '  flex: none;',
      '  display: none;',
      '  align-items: center;',
      '  gap: 2px;',
      '  margin-left: auto;',
      '}',
      '.dpp-ov-item:hover .dpp-ov-acts,',
      '.dpp-ov-item:focus-within .dpp-ov-acts { display: inline-flex; }',
      '.dpp-ov-act {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 22px;',
      '  height: 22px;',
      '  padding: 0;',
      '  border: none;',
      '  border-radius: 6px;',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-secondary, inherit);',
      '  cursor: pointer;',
      '}',
      '.dpp-ov-act:hover {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '}',
      '.dpp-ov-act[disabled] { opacity: .35; cursor: default; }',
      '.dpp-ov-act[disabled]:hover { background: transparent; }',
      '.dpp-ov-act[data-active="1"] {',
      '  color: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '}',
      // v0.10.7 flex column: only .dpp-ov-body shrinks/scrolls — the search
      // box, the footer rows and the hint keep their natural height.
      '.dpp-overlay > .dpp-ov-item { flex: none; }',
      '.dpp-ov-foot {',
      '  flex: none;',
      '  margin-top: 4px;',
      '  padding-top: 4px;',
      '  border-top: 0.5px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08));',
      '}',
      // Our menu rows: match the host MenuItemButton metrics exactly.
      '.dpp-row {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  width: 100%;',
      '  padding: 0 12px;',
      '  min-height: 32px;',
      '  border: none;',
      '  border-radius: var(--dsw-radius-sm, 6px);',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 13px;',
      '  text-align: left;',
      '  cursor: pointer;',
      '  box-sizing: border-box;',
      '}',
      '.dpp-row:hover, .dpp-row:focus-visible, .dpp-row:focus {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '  outline: none;',
      '}',
      // v1.1.0 inline rename editor inside a sidebar row.
      '.dpp-row-rename {',
      '  flex: 1 1 auto;',
      '  min-width: 0;',
      '  height: 24px;',
      '  padding: 0 6px;',
      '  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.35));',
      '  border-radius: 6px;',
      '  background: var(--dsw-alias-bg-layer-1, transparent);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 13px;',
      '  outline: none;',
      '  box-sizing: border-box;',
      '}',
      '.dpp-row .dpp-icon {',
      '  flex: none;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 16px;',
      '  height: 16px;',
      '  color: var(--dsw-alias-label-secondary, inherit);',
      '}',
      '.dpp-row .dpp-label { min-width: 0; }',
      '.dpp-row .dpp-detail {',
      '  margin-left: auto;',
      '  padding-left: 12px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '  white-space: nowrap;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '}',
      // Settings page section (dpp-set-*): plain host-token styling, no
      // primitives import (see note at item 5 in the header).
      '.dpp-set {',
      '  max-width: 760px;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 12px;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '}',
      '.dpp-set-title { margin: 0; font-size: 18px; font-weight: 600; }',
      '.dpp-set-intro {',
      '  margin: 0;',
      '  font-size: 13px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set-card {',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12));',
      '  border-radius: 10px;',
      '  padding: 2px 14px;',
      '  background: var(--dsw-alias-bg-layer-1, transparent);',
      '}',
      '.dpp-set-row {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 12px;',
      '  min-height: 46px;',
      '}',
      '.dpp-set-row + .dpp-set-row {',
      '  border-top: 0.5px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08));',
      '}',
      '.dpp-set-texts { flex: 1 1 auto; min-width: 0; }',
      '.dpp-set-label { font-size: 13px; }',
      '.dpp-set-detail {',
      '  font-size: 12px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set input[type="range"] {',
      '  flex: none;',
      '  width: 160px;',
      '  accent-color: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '}',
      '.dpp-set-val {',
      '  flex: none;',
      '  min-width: 44px;',
      '  text-align: right;',
      '  font-size: 12px;',
      '  font-variant-numeric: tabular-nums;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set-switch {',
      '  flex: none;',
      '  width: 36px;',
      '  height: 20px;',
      '  box-sizing: border-box;',
      '  border: none;',
      '  border-radius: 10px;',
      '  padding: 0;',
      '  position: relative;',
      '  cursor: pointer;',
      '  background: var(--dsw-alias-border-l2, rgba(127,127,127,.4));',
      '  transition: background .15s ease;',
      '}',
      '.dpp-set-switch::after {',
      '  content: "";',
      '  position: absolute;',
      '  top: 2px;',
      '  left: 2px;',
      '  width: 16px;',
      '  height: 16px;',
      '  border-radius: 50%;',
      '  background: #fff;',
      '  box-shadow: 0 1px 2px rgba(0,0,0,.25);',
      '  transition: transform .15s ease;',
      '}',
      '.dpp-set-switch[data-on="true"] {',
      '  background: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '}',
      '.dpp-set-switch[data-on="true"]::after { transform: translateX(16px); }',
      '.dpp-set-reset {',
      '  align-self: flex-start;',
      '  padding: 6px 14px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,.15));',
      '  border-radius: 8px;',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 13px;',
      '  cursor: pointer;',
      '}',
      '.dpp-set-reset:hover {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '}',
      '.dpp-set-actions {',
      '  display: flex;',
      '  gap: 8px;',
      '  align-items: center;',
      '}',
      '.dpp-set-danger {',
      '  color: var(--dsw-alias-state-error-primary, #c0392b);',
      '  border-color: var(--dsw-alias-state-error-primary, rgba(192,57,43,.5));',
      '}',
      '.dpp-set-danger:hover {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(192,57,43,.08));',
      '}',
      '.dpp-set-version { opacity: .7; }',
      // Settings dialog: let the LEFT NAV scroll when many plugin sections
      // register. The host .navList already declares overflow-y:auto but its
      // flex chain has no height bound (nav is flex:none, navList has no
      // flex/min-height), so a long rail overflows the panel instead of
      // scrolling. Scoped with :has(.dpp-set) so the rules only apply to the
      // settings dialog that hosts our own section. The panel already declares
      // --dsh-scrollbar-thumb vars, so the thumb follows the theme.
      '[class$="_panel"]:has(.dpp-set) nav[class$="_nav"] {',
      '  min-height: 0;',
      '}',
      '[class$="_panel"]:has(.dpp-set) nav[class$="_nav"] > [class$="_navList"] {',
      '  flex: 1 1 auto;',
      '  min-height: 0;',
      '  overscroll-behavior: contain;',
      '}',
      '[class$="_panel"]:has(.dpp-set) [class$="_navList"]::-webkit-scrollbar {',
      '  width: 7px;',
      '  height: 7px;',
      '}',
      '[class$="_panel"]:has(.dpp-set) [class$="_navList"]::-webkit-scrollbar-track {',
      '  background: transparent;',
      '}',
      '[class$="_panel"]:has(.dpp-set) [class$="_navList"]::-webkit-scrollbar-thumb {',
      '  background-color: var(--dsh-scrollbar-thumb, var(--dpp-scrollbar, rgba(127,127,127,.4)));',
      '  border-radius: 8px;',
      '  border: 2px solid transparent;',
      '  background-clip: padding-box;',
      '  min-height: 24px;',
      '}',
      '.dpp-set-note {',
      '  padding: 6px 0 2px;',
      '  font-size: 12px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set-inputrow {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  padding: 8px 0;',
      '}',
      '.dpp-set-input {',
      '  flex: 1 1 auto;',
      '  min-width: 0;',
      '  box-sizing: border-box;',
      '  height: 30px;',
      '  padding: 4px 10px;',
      '  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));',
      '  border-radius: 8px;',
      '  background: var(--dsw-alias-bg-layer-1, transparent);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  font: inherit;',
      '  font-size: 13px;',
      '}',
      '.dpp-set-input:focus-visible {',
      '  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d6bfe));',
      '  outline-offset: 1px;',
      '}',
      '.dpp-set-add {',
      '  flex: none;',
      '  padding: 5px 14px;',
      '  border: none;',
      '  border-radius: 8px;',
      '  background: var(--dsw-alias-state-business-primary, #4d6bfe);',
      '  color: var(--dsw-alias-label-on-business, #fff);',
      '  font: inherit;',
      '  font-size: 13px;',
      '  cursor: pointer;',
      '}',
      '.dpp-set-add:hover { filter: brightness(1.08); }',
      '.dpp-set-chip {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  min-height: 38px;',
      '}',
      '.dpp-set-chip + .dpp-set-chip {',
      '  border-top: 0.5px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08));',
      '}',
      // Drag-to-reorder top pins (v0.10.0).
      '.dpp-set-chip.dpp-draggable { cursor: grab; }',
      '.dpp-set-chip.dpp-draggable:active { cursor: grabbing; }',
      '.dpp-set-chip.dpp-droptarget {',
      '  outline: 2px dashed var(--dsw-alias-state-business-primary, #4d6bfe);',
      '  outline-offset: -2px;',
      '}',
      '.dpp-set-x {',
      '  flex: none;',
      '  padding: 4px 10px;',
      '  border: none;',
      '  border-radius: 6px;',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '  font: inherit;',
      '  font-size: 12px;',
      '  cursor: pointer;',
      '}',
      '.dpp-set-x:hover {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12));',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '}',
      '.dpp-set-x[disabled] {',
      '  opacity: .45;',
      '  cursor: default;',
      '}',
      '.dpp-set-x[disabled]:hover {',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set-empty {',
      '  padding: 8px 0;',
      '  font-size: 12px;',
      '  color: var(--dsw-alias-label-tertiary, inherit);',
      '}',
      '.dpp-set-subrow { padding-left: 14px; }',
    ].join('\n')

    // ---------------------------------------------------------------- debug

    /**
     * Runtime diagnostics, enabled only with ?dppdebug in the page URL.
     *
     * The host has no DevTools in production builds (F12 is disabled and the
     * CDP ports are closed), so this overlay is the only way to inspect the
     * live sidebar DOM from the outside.
     */
    const DEBUG_ENABLED = (function () {
      try {
        return /[?&]dppdebug\b/.test(window.location.search || '')
      } catch (error) {
        return false
      }
    })()

    function debugText() {
      const nav = findPanelListNav()
      const out = []
      if (!nav) {
        out.push('nav NOT FOUND')
        return out.join('\n')
      }
      const ncs = window.getComputedStyle(nav)
      const nr = nav.getBoundingClientRect()
      out.push(
        'nav rect=' +
          [nr.top, nr.left, nr.width, nr.height].map(Math.round).join(',') +
          ' ovy=' +
          ncs.overflowY +
          ' scrollTop=' +
          nav.scrollTop +
          ' scrollH=' +
          nav.scrollHeight +
          ' clientH=' +
          nav.clientHeight +
          ' fd=' +
          ncs.flexDirection +
          ' wrap=' +
          ncs.flexWrap,
      )
      const l = nav.querySelector('[' + LAUNCHER_ATTR + ']')
      Array.prototype.slice.call(nav.children).forEach(function (el, i) {
        const ecs = window.getComputedStyle(el)
        const er = el.getBoundingClientRect()
        out.push(
          (el === l ? '*' : ' ') +
            i +
            ' ' +
            el.tagName +
            ' inlineOrd=' +
            (el.style && el.style.order ? el.style.order : '-') +
            ' csOrd=' +
            ecs.order +
            ' disp=' +
            ecs.display +
            ' top=' +
            Math.round(er.top) +
            ' h=' +
            Math.round(er.height) +
            ' lbl=' +
            String(el.getAttribute ? el.getAttribute('aria-label') || '' : '').slice(0, 10),
        )
      })
      if (l) {
        const r = l.getBoundingClientRect()
        out.push('launcher rect=' + [r.top, r.left, r.width, r.height].map(Math.round).join(','))
        const cx = Math.round(r.left + r.width / 2)
        const cy = Math.round(r.top + r.height / 2)
        const hit = document.elementFromPoint(cx, cy)
        out.push('hit@' + cx + ',' + cy + '=' + (hit ? hit.tagName + '.' + String(hit.className || '').slice(0, 40) : 'null'))
      }
      out.push('rowsHidden=' + readRowsHidden())
      out.push('tidy=' + readTidy() + ' family=' + readFamily() + ' famRows=' + findFamilyRows().length)
      out.push('dark=' + isDarkSurface())
      out.push('BUILD=' + BUILD)
      const styleTag = document.getElementById(STYLE_ID)
      out.push('styleTag=' + (styleTag ? 'yes len=' + String(styleTag.textContent || '').length : 'NO'))
      const ov = document.querySelector('.dpp-overlay')
      if (ov) {
        const ocs = window.getComputedStyle(ov)
        out.push(
          'overlay bg=' +
            ocs.backgroundColor +
            ' bgImage=' +
            ocs.backgroundImage +
            ' z=' +
            ocs.zIndex +
            ' pos=' +
            ocs.position +
            ' shadow=' +
            ocs.boxShadow.slice(0, 40),
        )
        const v = getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-bg-layer-2')
        out.push('var bg-layer-2=' + String(v))
        const v2 = getComputedStyle(document.documentElement).getPropertyValue('--dsw-elevation-prominent')
        out.push('var elevation=' + String(v2))
        const v3 = getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-border-l2')
        out.push('var border-l2=' + String(v3))
      } else {
        out.push('overlay: not open')
      }
      const keys = []
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i)
          if (k && k.indexOf('dsh-panel-pins') === 0) keys.push(k + '=' + String(window.localStorage.getItem(k)).slice(0, 60))
        }
      } catch (error) {
        /* ignore */
      }
      out.push('ls: ' + keys.join(' | '))
      return out.join('\n')
    }

    function updateDebug() {
      if (typeof document === 'undefined') return
      // Debug-only diagnostics (enable with ?dppdebug). The title/status
      // channel is intentionally gated: unconditionally rewriting
      // document.title every tick would clobber the host's session title
      // and the taskbar unread indicator. DEBUG_ENABLED is a const captured
      // once at apply-time (URL cannot change in this embedded webview).
      if (!DEBUG_ENABLED) return
      try {
        const nav = findPanelListNav()
        document.title =
          'dpp ' +
          BUILD +
          ' hidden=' +
          readRowsHidden() +
          ' rows=' +
          (nav ? findPanelRows(nav).length : -1) +
          ' kids=' +
          (nav ? nav.children.length : -1)
      } catch (error) {
        /* ignore */
      }
      if (!DEBUG_ENABLED) return
      let box = document.getElementById('dsh-panel-pins-debug')
      if (!box) {
        box = document.createElement('pre')
        box.id = 'dsh-panel-pins-debug'
        box.style.cssText =
          'position:fixed;left:8px;bottom:8px;z-index:2147483000;margin:0;max-width:560px;max-height:46vh;overflow:auto;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.86);color:#d8f7d0;font:11px/1.45 Consolas,monospace;white-space:pre-wrap;word-break:break-all;'
        document.body.appendChild(box)
      }
      // Guard against observer feedback: the box lives outside the sidebar
      // root, so writes here do not re-trigger refreshAll — but keep the
      // signature check anyway in case the debug scope ever widens.
      const text = debugText()
      if (box.__dppSig === text) return
      box.__dppSig = text
      box.textContent = text
    }

    function injectStyle() {
      if (typeof document === 'undefined') return
      if (document.getElementById(STYLE_ID)) return
      const tag = document.createElement('style')
      tag.id = STYLE_ID
      tag.dataset.plugin = 'dsh-panel-pins'
      tag.dataset.pluginCss = 'dsh-panel-pins/panellist'
      tag.textContent = EXTRA_CSS
      document.head.appendChild(tag)
    }

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
          return row.style.display !== 'none'
        }).length : 0
        if (visible === 0) showToast(LABEL.noRowsAfterShow)
      } catch (error) {
        /* advisory only */
      }
    }

    // --------------------------------------------- overlay group fold state
    function readGroupFolds() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(FOLD_GROUPS_KEY) || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
      } catch (error) {
        /* fall through */
      }
      return {}
    }

    function writeGroupFolds(obj) {
      try {
        window.localStorage.setItem(FOLD_GROUPS_KEY, JSON.stringify(obj || {}))
      } catch (error) {
        /* session-only */
      }
    }

    // ----------------------------------------- display renames + hidden rows
    // Both maps are keyed by the ORIGINAL label. A rename changes what the
    // sidebar row, overlay items and context menus DISPLAY; the original
    // label stays the storage key everywhere else (pins, whitelist, groups,
    // presets keep working unchanged). Hidden rows are filtered out of the
    // sidebar and the overlay inventory entirely.
    /** Same-document change notification for the Settings page cards. The DOM
     * `storage` event does NOT fire in the document that performed the write,
     * so ctx-menu hides / inline renames would silently leave already-mounted
     * Settings cards stale (the "card says empty but the store has data" bug).
     * Writers dispatch this; PanelPinsSettingsSection subscribes. */
    function notifyStoreChange(key) {
      try {
        window.dispatchEvent(new CustomEvent('dpp:store-changed', { detail: { key: key } }))
      } catch (error) {
        /* engines without CustomEvent: cards just stay as-is */
      }
    }

    /** Resolve a v2 store entry to its CURRENT label. Entries carry the
     * registration id whenever one was known at write time; after a locale
     * switch the id maps to the new label via the persisted label→id map
     * (kept one-label-per-id by mergeLabelIdMap), while id-less entries
     * (family rows, unknown ids) fall back to the stored label. */
    function resolveEntryLabel(entry, idMap) {
      if (entry && entry.id && idMap) {
        for (const l in idMap) {
          if (idMap[l] === entry.id) return l
        }
      }
      return entry && typeof entry.label === 'string' && entry.label ? entry.label : null
    }

    // v2 store shape: { v: 2, items: [{ id, label(, name) }] }. Legacy v1
    // values (label-keyed object / plain label array) are converted on read
    // and rewritten in v2 on the next write — no separate migration step.
    function readRenameEntries() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(RENAMES_KEY) || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          if (parsed.v === 2 && Array.isArray(parsed.items)) {
            return parsed.items
              .filter(function (e) {
                return e && typeof e.label === 'string' && e.label && typeof e.name === 'string' && e.name
              })
              .map(function (e) { return { id: e.id || null, label: e.label, name: e.name } })
          }
          const entries = []
          Object.keys(parsed).forEach(function (label) {
            const name = parsed[label]
            if (typeof name === 'string' && name) entries.push({ id: null, label: label, name: name })
          })
          return entries
        }
      } catch (error) {
        /* fall through */
      }
      return []
    }

    function writeRenameEntries(entries) {
      try {
        window.localStorage.setItem(RENAMES_KEY, JSON.stringify({ v: 2, items: entries || [] }))
        notifyStoreChange('renames')
      } catch (error) {
        // b67: no longer silent — a failed write (quota, blocked storage) used
        // to look exactly like a successful save.
        console.warn('[dsh-panel-pins] rename store write failed (session-only):', error)
      }
    }

    /** Rebuild v2 entries from a resolved {label: name} map, preserving the
     * id of any existing entry that resolves to the same label, and seeding
     * the id from the label→id map when available. */
    function renameMapToEntries(map, prevEntries) {
      const prev = Array.isArray(prevEntries) ? prevEntries : []
      const idMap = readLabelIdMap()
      const entries = []
      Object.keys(map).forEach(function (label) {
        const name = typeof map[label] === 'string' ? map[label].trim() : ''
        if (!label || !name) return
        let id = null
        for (const p of prev) {
          if (resolveEntryLabel(p, idMap) === label) { id = p.id; break }
        }
        if (!id && idMap[label]) id = idMap[label]
        entries.push({ id: id || null, label: label, name: name })
      })
      return entries
    }

    /** Public shape kept label-keyed: { resolvedLabel: name } (deduped).
     * All existing call sites — applyFold, displayNameFor, the settings
     * reset card — keep matching on CURRENT labels unchanged. */
    function readRenames() {
      const idMap = readLabelIdMap()
      const map = {}
      const seen = {}
      readRenameEntries().forEach(function (e) {
        const label = resolveEntryLabel(e, idMap)
        if (!label || seen[label]) return
        seen[label] = true
        map[label] = e.name
      })
      return map
    }

    function writeRenames(obj) {
      writeRenameEntries(renameMapToEntries(obj || {}, readRenameEntries()))
    }

    /** Display name for a row label: rename override, else the label itself. */
    function displayNameFor(label) {
      if (!label) return label
      try {
        const renames = readRenames()
        const custom = renames[label]
        return typeof custom === 'string' && custom.trim() ? custom.trim() : label
      } catch (error) {
        return label
      }
    }

    function readHiddenEntries() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(HIDDEN_KEY) || '[]')
        if (parsed && typeof parsed === 'object' && parsed.v === 2 && Array.isArray(parsed.items)) {
          return parsed.items
            .filter(function (e) { return e && typeof e.label === 'string' && e.label })
            .map(function (e) { return { id: e.id || null, label: e.label } })
        }
        if (Array.isArray(parsed)) {
          // legacy v1: plain label array
          return parsed
            .filter(function (x) { return typeof x === 'string' && x })
            .map(function (label) { return { id: null, label: label } })
        }
      } catch (error) {
        /* fall through */
      }
      return []
    }

    function writeHiddenEntries(entries) {
      try {
        window.localStorage.setItem(HIDDEN_KEY, JSON.stringify({ v: 2, items: entries || [] }))
        notifyStoreChange('hidden')
      } catch (error) {
        console.warn('[dsh-panel-pins] hidden-rows store write failed (session-only):', error)
      }
    }

    /** Public shape kept a plain label array (current labels, deduped) —
     * badge counts, applyFold, applyHiddenRows and the Alt+N build path all
     * keep doing string indexOf against it. */
    function readHiddenRows() {
      const idMap = readLabelIdMap()
      const out = []
      const seen = {}
      readHiddenEntries().forEach(function (e) {
        const label = resolveEntryLabel(e, idMap)
        if (label && !seen[label]) {
          seen[label] = true
          out.push(label)
        }
      })
      return out
    }

    function writeHiddenRows(arr) {
      const prev = readHiddenEntries()
      const idMap = readLabelIdMap()
      const entries = []
      const seen = {}
      ;(Array.isArray(arr) ? arr : []).forEach(function (label) {
        if (typeof label !== 'string' || !label || seen[label]) return
        seen[label] = true
        let id = null
        for (const p of prev) {
          if (resolveEntryLabel(p, idMap) === label) { id = p.id; break }
        }
        if (!id && idMap[label]) id = idMap[label]
        entries.push({ id: id || null, label: label })
      })
      writeHiddenEntries(entries)
    }

    function isRowHidden(label) {
      return readHiddenRows().indexOf(label) !== -1
    }

    /** idHint (registration id, when the caller knows it) lets the toggle
     * match the entry across locale switches instead of trusting the label. */
    function toggleRowHidden(label, idHint) {
      const idMap = readLabelIdMap()
      const entries = readHiddenEntries()
      const matchId = idHint || idMap[label] || null
      let idx = -1
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i]
        if ((matchId && e.id && e.id === matchId) || resolveEntryLabel(e, idMap) === label) {
          idx = i
          break
        }
      }
      if (idx === -1) entries.push({ id: matchId || null, label: label })
      else entries.splice(idx, 1)
      writeHiddenEntries(entries)
      return idx === -1
    }

    /**
     * Collapsible group header: a button row (chevron + title + count).
     * Clicking toggles the group body via inline display; the state persists
     * in FOLD_GROUPS_KEY. The search filter FORCE-SHOWS every item and head
     * while a query is active (applyFilter handles that), so folding and
     * filtering never fight.
     */
    function makeGroupHead(box, groupKey, title, countText) {
      const head = document.createElement('button')
      head.type = 'button'
      head.className = 'dpp-ov-head dpp-ov-ghead'
      head.setAttribute('aria-expanded', 'true')
      head.setAttribute('data-dpp-group', groupKey)
      const chev = document.createElement('span')
      chev.className = 'dpp-ov-gchev'
      chev.appendChild(iconSvgPath(ICON_CHEVRON_DOWN, 12))
      head.appendChild(chev)
      const ttl = document.createElement('span')
      ttl.textContent = title
      head.appendChild(ttl)
      const cnt = document.createElement('span')
      cnt.textContent = countText ? ' · ' + countText : ''
      cnt.style.opacity = '.8'
      head.appendChild(cnt)
      box.appendChild(head)
      const folds = readGroupFolds()
      const collapsed = folds[groupKey] === true
      function apply(collapse) {
        head.setAttribute('aria-expanded', collapse ? 'false' : 'true')
        // Rotate the PATH, not the svg root (chev.firstChild): a root
        // transform is interpreted in the parent coordinate system and
        // displaces the 12px glyph out of view.
        const chevPath = chev.querySelector('path')
        if (chevPath) chevPath.setAttribute('transform', collapse ? 'rotate(-90 10 10)' : '')
        let node = head.nextElementSibling
        while (node && !node.classList.contains('dpp-ov-ghead')) {
          if (node.classList.contains('dpp-ov-item') || node.classList.contains('dpp-ov-head')) {
            node.style.display = collapse ? 'none' : ''
          }
          node = node.nextElementSibling
        }
      }
      head.addEventListener('click', function () {
        const next = head.getAttribute('aria-expanded') !== 'false'
        const folds2 = readGroupFolds()
        folds2[groupKey] = next
        writeGroupFolds(folds2)
        apply(next)
      })
      if (collapsed) apply(true)
      return head
    }


    let toastEl = null
    let toastTimer = null

    /**
     * One-shot transient notice, bottom-center. Fully defensive: toast is an
     * optional UX sugar and must never throw into a caller.
     */
    function showToast(message) {
      try {
        if (typeof document === 'undefined') return
        if (toastTimer) clearTimeout(toastTimer)
        if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl)
        const el = document.createElement('div')
        el.className = 'dpp-toast'
        el.setAttribute('role', 'status')
        el.textContent = String(message || '')
        document.body.appendChild(el)
        toastEl = el
        toastTimer = setTimeout(function () {
          try {
            if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl)
          } catch (error) {
            /* ignore */
          }
          toastEl = null
          toastTimer = null
        }, 2600)
      } catch (error) {
        /* ignore */
      }
    }

    /** Hover actions for one overlay panel line: pin/unpin + top. */
    function buildOverlayActs(entry, launcherRef) {
      const acts = document.createElement('span')
      acts.className = 'dpp-ov-acts'
      const pinBtn = document.createElement('button')
      pinBtn.type = 'button'
      pinBtn.className = 'dpp-ov-act'
      pinBtn.appendChild(iconSvgPath(entry.pinned ? ICON_PIN_ALT : ICON_PIN, 14))
      pinBtn.title = entry.pinned ? LABEL.unpin : LABEL.pin
      pinBtn.setAttribute('aria-label', pinBtn.title)
      if (!entry.idKnown) {
        pinBtn.disabled = true
        pinBtn.title = LABEL.setPinNeedMenu
      }
      pinBtn.addEventListener('click', function (event) {
        event.stopPropagation()
        const unpinned = readUnpinned()
        if (entry.pinned) unpinned.add(entry.id)
        else unpinned.delete(entry.id)
        writeUnpinned(unpinned)
        try {
          if (typeof bridge.onPinnedChange === 'function') {
            bridge.onPinnedChange(entry.id, !entry.pinned)
          }
        } catch (error) {
          /* store still holds the state */
        }
        refreshAll()
        openOverlay(launcherRef)
      })
      acts.appendChild(pinBtn)
      const topBtn = document.createElement('button')
      topBtn.type = 'button'
      topBtn.className = 'dpp-ov-act'
      topBtn.appendChild(iconSvgPath(ICON_CHEVRON_UP, 14))
      topBtn.title = entry.top ? LABEL.setTopOff : LABEL.setTop
      topBtn.setAttribute('aria-label', topBtn.title)
      topBtn.setAttribute('data-active', entry.top ? '1' : '0')
      if (!entry.idKnown || !entry.pinned) {
        topBtn.disabled = true
        topBtn.title = !entry.idKnown ? LABEL.setPinNeedMenu : LABEL.setTopNeedPin
      }
      topBtn.addEventListener('click', function (event) {
        event.stopPropagation()
        toggleTopPinStore(entry.id, entry.label)
        applyTopPins()
        openOverlay(launcherRef)
      })
      acts.appendChild(topBtn)
      return acts
    }

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
      // Merged FULL panel inventory (visible rows + unpinned store + host-fed
      // entries): the menu becomes the single place to reach any panel, even
      // unpinned ones. Whitelisted entries stay in the sidebar — not listed.
      // v1.1.0: user-hidden rows are excluded here too (Settings restores).
      const allPanels = readPanelList().filter(function (entry) {
        if (isRowHidden(entry.label)) return false
        return !isWhitelisted(entry.label, entry.idKnown ? entry.id : undefined)
      })
      if (allPanels.length === 0 && famRows.length === 0 && !paletteMode) return

      const box = document.createElement('div')
      box.className = paletteMode ? 'dpp-overlay dpp-palette' : 'dpp-overlay'
      box.setAttribute('role', 'menu')
      box.dataset.plugin = 'dsh-panel-pins'

      // v0.10.7: middle scroll region. Every list child (group heads, items,
      // empty state) appends here; the search input stays above it and the
      // footer rows + Ctrl+K hint stay below it — neither ever scrolls away
      // nor gets clipped by --dpp-overlay-max.
      const body = document.createElement('div')
      body.className = 'dpp-ov-body'
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
          item.setAttribute('role', 'menuitem')
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
          item.setAttribute('role', 'menuitem')

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
        item.setAttribute('role', 'menuitem')

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
          item.setAttribute('role', 'menuitem')

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
          item.setAttribute('role', 'menuitem')
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
      search.setAttribute('autocomplete', 'off')
      search.setAttribute('spellcheck', 'false')
      box.insertBefore(search, body)

      const empty = document.createElement('div')
      empty.className = 'dpp-ov-empty'
      empty.textContent = LABEL.searchEmpty
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
        const text = mi.text
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
        menuItems.forEach(function (mi) {
          const hit = q.length === 0 || mi.text.toLowerCase().indexOf(q) !== -1
          mi.el.style.display = hit ? '' : 'none'
          applyMark(mi, hit ? q : '')
          if (hit) visibleCount++
        })
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
        for (const mi of menuItems) mi.el.classList.remove('dpp-kb')
      }
      function setKb(idx) {
        const vis = visibleItems()
        if (vis.length === 0) return
        kbIndex = ((idx % vis.length) + vis.length) % vis.length
        clearKb()
        const target = vis[kbIndex]
        target.el.classList.add('dpp-kb')
        try {
          target.el.scrollIntoView({ block: 'nearest' })
        } catch (error) {
          /* older engines without options */
        }
      }
      search.addEventListener('input', applyFilter)
      search.addEventListener('keydown', function (event) {
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
        foot.setAttribute('role', 'menuitem')
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
        fam.setAttribute('role', 'menuitem')
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
        tidy.setAttribute('role', 'menuitem')
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
        const hint = document.createElement('div')
        hint.className = 'dpp-ov-hint'
        hint.textContent = zh ? 'Ctrl+K 快速命令 · Alt+数字直达' : 'Ctrl+K quick commands · Alt+N to jump'
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
     * v1.1.0 display rename: swap the sidebar row's label element for an
     * inline text input pre-filled with the current override (or the original
     * label). Enter/blur commits (empty = reset), Escape cancels. The row's
     * aria-label keeps the ORIGINAL label — every other store keys on it —
     * applyFold's rename pass does the actual text rewrite after commit.
     */
    function beginRowRename(row, kind) {
      // b65: the ctx menu stays open ~seconds before the user picks an item.
      // During that window the host React re-renders the sidebar (session
      // ticks, palette closes, observer bursts) and may replace the row
      // element — the captured `row` can be a DETACHED ghost by activation
      // time, so the editor we inserted into it never appeared (b64 UI walk:
      // rename item focused + activated, zero DOM/storage effect while hide
      // on the SAME menu worked — hide only uses the label string). Resolve
      // a LIVE row by the original label before doing anything.
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
      // connected row in DOM order, so the editor always lands on a live row.
      const renames = readRenames()
      const current = typeof renames[original] === 'string' && renames[original].trim() ? renames[original].trim() : original
      // Prefer the same element applyFold rewrites; fall back to the row.
      // v1.1.0 b48: the label element usually also CONTAINS the row icon
      // (svg) next to the text. Wiping textContent deleted the icon too
      // (user report: "重命名有 bug，图标丢了"). Preserve every non-text
      // child and only swap the text node the editor sits in.
      const nameEl = row.querySelector('[class$="_label"], .dpp-label') || row
      // b61: drop orphan text nodes we appended earlier (data-dpp-text="1")
      // BEFORE reading prevDisplay — textContent would otherwise concatenate
      // host text + our orphan and permanently double the label on restore.
      Array.prototype.forEach.call(
        nameEl.querySelectorAll('[data-dpp-text="1"]'),
        function (s) { s.remove() }
      )
      const prevDisplay = (function () {
        // Prefer the host's own text node content (b61) instead of the
        // concatenated textContent, which included our appendNode duplicates.
        for (const n of nameEl.childNodes) {
          if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) return n.nodeValue
        }
        return (nameEl.textContent || '').trim()
      })()
      const textNode = (function () {
        for (const n of nameEl.childNodes) {
          if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) return n
        }
        return null
      })()
      const editor = document.createElement('input')
      editor.type = 'text'
      editor.value = current
      editor.className = 'dpp-row-rename'
      editor.setAttribute('aria-label', LABEL.renamePrompt)
      const restore = function (text) {
        // b61: strip our earlier appended orphans first, then write the host
        // node; only append a fresh (marked) node when no host node exists.
        Array.prototype.forEach.call(
          nameEl.querySelectorAll('[data-dpp-text="1"]'),
          function (s) { s.remove() }
        )
        // b64: the host text node we blanked at edit start is still here
        // (empty nodeValue) — REUSE it instead of appending a second carrier.
        // Appending while the blanked node survived React's re-render was the
        // three-copy bug ("XD Pool XD PoolXD Pool").
        let host = null
        let blanked = null
        for (const n of nameEl.childNodes) {
          if (n.nodeType !== 3) continue
          if (n.nodeValue && n.nodeValue.trim()) { host = n; break }
          if (!blanked) blanked = n
        }
        if (!host) host = blanked
        if (host) {
          host.nodeValue = text
        } else if (nameEl.childNodes.length === 0) {
          nameEl.textContent = text
        } else {
          // No text node at all (icon-only markup): append one without
          // touching the icon siblings. Mark it so later passes reclaim it.
          const node = document.createTextNode(text)
          node.setAttribute('data-dpp-text', '1')
          nameEl.appendChild(node)
        }
      }
      if (textNode) {
        textNode.nodeValue = ''
      } else {
        restore('')
      }
      nameEl.insertBefore(editor, textNode || nameEl.firstChild)
      document.title = 'dpp-rename:INSERTED label=' + original + ' inDoc=' + editor.isConnected
      // b52: mark the row as "renaming" so applyFold/refreshAll leave this
      // label alone until finish() — the observer fires on the editor
      // insertion itself and would otherwise race the editor's text node.
      row.setAttribute('data-dpp-renaming', '1')
      try {
        editor.focus()
        editor.select()
      } catch (error) {
        /* ignore */
      }
      let done = false
      const finish = function (commit) {
        if (done) return
        done = true
        const value = editor.value.trim()
        // b52 fix: the editor input used to stay in the label forever —
        // every later textContent/aria-label read (rowLabel, applyFold's
        // label lookup, MutationObserver bursts) saw the stray input, and
        // the observer's refresh re-raced finish's restore. Remove it first.
        try {
          editor.remove()
        } catch (error) {
          /* ignore */
        }
        try {
          row.removeAttribute('data-dpp-renaming')
        } catch (error) {
          /* ignore */
        }
        if (commit) {
          try {
            const map = readRenames()
            if (!value || value === original) delete map[original]
            else map[original] = value
            writeRenames(map)
          } catch (error) {
            /* session-only */
          }
        }
        // applyFold (via refreshAll) rewrites the text; restore meanwhile so
        // a failed pass never leaves an empty label. restore() keeps icon
        // siblings intact.
        restore(commit && value && value !== original ? value : prevDisplay)
        refreshAll()
      }
      editor.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          finish(true)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          finish(false)
        }
      })
      editor.addEventListener('blur', function () {
        finish(true)
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
          /* ignore */
        }
      })
      if (opts && opts.disabled) {
        btn.disabled = true
        btn.title = opts.title || ''
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

    /** Global Ctrl+K capture. Registered once in apply(), inside the
     * defensive DOM block; capture phase so host shortcuts lose the race. */
    function handleGlobalKey(event) {
      try {
        if (!event || !event.ctrlKey || !event.metaKey !== false) {
          /* fallthrough to the actual check below */
        }
        if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'k') {
          // Don't hijack Ctrl+K inside text inputs that belong to the HOST
          // (chat box etc.) — only fire when the focus is not an editable
          // field, or when our own palette/overlay is already open (Esc-like
          // re-press closes it).
          const t = event.target
          const editable = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t.isContentEditable === true))
          const inOurUi = overlay && t && overlay.contains(t)
          if (inOurUi) {
            event.preventDefault()
            event.stopPropagation()
            closeOverlay()
            return
          }
          if (editable) return
          event.preventDefault()
          event.stopPropagation()
          if (overlay) closeOverlay()
          else openPaletteSafe()
        }
      } catch (error) {
        /* never break host keyboard handling */
      }
    }

    function positionOverlay(launcher) {
      if (!overlay) return
      // Palette mode (launcher=null): centered via CSS class, nothing to do.
      if (!launcher) return
      const rect = launcher.getBoundingClientRect()
      overlay.style.visibility = 'hidden'
      const pw = overlay.offsetWidth
      const ph = overlay.offsetHeight
      const vw = window.innerWidth || 1280
      const vh = window.innerHeight || 800
      let top = rect.bottom + 6
      if (top + ph > vh - 8) top = Math.max(8, rect.top - ph - 6)
      let left = rect.left
      if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8)
      overlay.style.left = left + 'px'
      overlay.style.top = top + 'px'
      overlay.style.visibility = ''
    }

    /**
     * Create (or refresh) the launcher row inside the panel list nav.
     *
     * It is appended as the LAST DOM child and pulled to the top with CSS
     * `order: -1`. Appending (rather than inserting first) is deliberate: the
     * host renderer appends new panel rows at the end of the nav, so an
     * appended foreign node keeps a stable relative position and never causes
     * the host to reorder or drop one of its own rows.
     */
    function ensureLauncher() {
      if (typeof document === 'undefined') return null
      const nav = findPanelListNav()
      if (!nav) return null
      let launcher = nav.querySelector('[' + LAUNCHER_ATTR + ']')
      if (!launcher) {
        launcher = document.createElement('button')
        launcher.type = 'button'
        launcher.setAttribute(LAUNCHER_ATTR, '')
        launcher.className = 'dpp-launcher'
        launcher.setAttribute('aria-haspopup', 'menu')
        launcher.setAttribute('aria-label', LABEL.panelsMenu)
        const glyph = document.createElement('span')
        glyph.className = 'dpp-icon'
        glyph.setAttribute('aria-hidden', 'true')
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('width', '18')
        svg.setAttribute('height', '18')
        svg.setAttribute('viewBox', '0 0 20 20')
        svg.setAttribute('fill', 'none')
        svg.setAttribute('stroke', 'currentColor')
        svg.setAttribute('stroke-width', '1.4')
        svg.setAttribute('stroke-linejoin', 'round')
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', ICON_GRID)
        svg.appendChild(path)
        glyph.appendChild(svg)
        launcher.appendChild(glyph)
        const text = document.createElement('span')
        text.className = 'dpp-launcher-label'
        text.textContent = LABEL.panels
        launcher.appendChild(text)
        const badge = document.createElement('span')
        badge.className = 'dpp-launcher-badge'
        launcher.appendChild(badge)
        launcher.addEventListener('click', function (event) {
          event.stopPropagation()
          if (overlay) closeOverlay()
          else openOverlay(launcher)
        })
        nav.appendChild(launcher)
      }
      // Keep the badge in sync with the live row count and the rail mode.
      // The badge advertises EVERYTHING the menu holds — the merged panel
      // inventory (pinned + unpinned) AND collected plugin entry rows — so
      // nothing is silently "lost". Whitelisted entries stay in the sidebar
      // and don't count.
      // CRITICAL: only write when the value actually changed. The refresh
      // pass is driven by a MutationObserver — an unconditional textContent
      // write here would mutate the DOM every pass and feed back into the
      // observer, looping forever at the debounce rate.
      const allPanels = readPanelList().filter(function (entry) {
        // b63: mirror the menu's filter exactly (openOverlay 2796-2799) —
        // user-hidden rows must not be advertised by the badge either, or
        // the badge shows N while the menu shows N-3 and users read it as
        // "lost panels". Backfill guards inside readPanelList are not
        // enough: a hidden row's stored label may differ slightly from the
        // backfilled entry label, so filter here by the same rule.
        if (isRowHidden(entry.label)) return false
        return !isWhitelisted(entry.label, entry.idKnown ? entry.id : undefined)
      })
      const famCount = findFamilyRows().filter(function (row) {
        if (isRowHidden(rowLabel(row))) return false // b61: hidden rows don't count
        return !isWhitelistedLabelOrMapped(rowLabel(row))
      }).length
      const badge = launcher.querySelector('.dpp-launcher-badge')
      const total = allPanels.length + famCount
      const badgeText = total > 0 ? String(total) : ''
      const rail = nav.getBoundingClientRect().width < 120
      const sig = badgeText + '|' + String(rail)
      if (launcher.__dppBadgeSig !== sig) {
        launcher.__dppBadgeSig = sig
        if (badge) badge.textContent = badgeText
        if (badge) {
          badge.setAttribute(
            'aria-label',
            LABEL.panels + ' ' + allPanels.length + ' · ' + LABEL.groupFamily + ' ' + famCount,
          )
        }
        launcher.classList.toggle('dpp-rail', rail)
      }
      return launcher
    }

    // ---------------------------------------------------------------- menu rows

    function PinMenuRows({ entries, onOpen, onPinnedChange, onDismiss }) {
      const [hidden, setHidden] = React.useState(readRowsHidden())

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
        syncIntoHost(entries, onPinnedChange)
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
      Array.prototype.forEach.call(nav.children, function (el) {
        if (!el.getAttribute) return
        // Our launcher always stays first (visual anchor; never jumps).
        if (el.hasAttribute(LAUNCHER_ATTR)) {
          if (el.style.order !== ORDER_LAUNCHER) el.style.order = ORDER_LAUNCHER
          return
        }
        // The host More button lives OUTSIDE this nav (verified against the
        // host source: nav children are exactly the PanelRow buttons).
        if (el.tagName !== 'BUTTON') return
        const label = (el.getAttribute('aria-label') || '').trim()
        const idx = label ? topPinIndexFor(label, map, topPins) : -1
        if (idx !== -1) {
          matched++
          if (el.getAttribute('data-dpp-top') !== '1') el.setAttribute('data-dpp-top', '1')
          // -20000, -19999, …: stored order wins among top-pinned rows.
          const want = String(-(20000 - idx))
          if (el.style.order !== want) el.style.order = want
        } else if (el.getAttribute('data-dpp-top') === '1') {
          el.removeAttribute('data-dpp-top')
          el.style.removeProperty('order')
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

    /** Host-style switch, pure CSS (`.dpp-set-switch`), no primitives import. */
    function SettingsSwitch({ on, onToggle, label }) {
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': !!on,
        'aria-label': label,
        className: 'dpp-set-switch',
        'data-on': on ? 'true' : 'false',
        onClick: onToggle,
      })
    }

    /** One "label + range slider + value" row; onChange fires per input event. */
    function SettingsSliderRow({ label, value, min, max, onChange, unit }) {
      return h(
        'div',
        { className: 'dpp-set-row' },
        h('span', { className: 'dpp-set-label' }, label),
        h('input', {
          type: 'range',
          min: min,
          max: max,
          step: 1,
          value: value,
          'aria-label': label,
          onInput: function (event) {
            const n = Number(event.target.value)
            if (Number.isFinite(n)) onChange(n)
          },
        }),
        h('span', { className: 'dpp-set-val' }, value + (unit || '')),
      )
    }

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

      function exportSettings() {
        // Dump every plugin-owned localStorage key as one JSON blob to the
        // clipboard. Restores are full-value (no merging): import replaces.
        try {
          const dump = { __plugin: 'dsh-panel-pins', __version: VERSION }
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i)
            if (key && key.indexOf('dsh-panel-pins:') === 0) {
              dump[key] = window.localStorage.getItem(key)
            }
          }
          const json = JSON.stringify(dump, null, 2)
          const write = function (text) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              return navigator.clipboard.writeText(text)
            }
            // Fallback: hidden textarea + execCommand (older webviews).
            const ta = document.createElement('textarea')
            ta.value = text
            ta.style.position = 'fixed'
            ta.style.opacity = '0'
            document.body.appendChild(ta)
            ta.select()
            try {
              document.execCommand('copy')
            } catch (error) {
              /* ignore */
            }
            document.body.removeChild(ta)
            return Promise.resolve()
          }
          Promise.resolve(write(json)).then(
            function () {
              showToast(LABEL.setExportDone)
            },
            function () {
              showToast(zh ? '复制失败：剪贴板不可用' : 'Copy failed: clipboard unavailable')
            },
          )
        } catch (error) {
          showToast(zh ? '导出失败' : 'Export failed')
        }
      }

      function importSettings() {
        // Read the clipboard, validate, write every key back, re-apply all.
        const read = navigator.clipboard && navigator.clipboard.readText
          ? navigator.clipboard.readText()
          : Promise.reject(new Error('no clipboard api'))
        Promise.resolve(read).then(
          function (text) {
            let dump = null
            try {
              dump = JSON.parse(String(text || ''))
            } catch (error) {
              dump = null
            }
            if (!dump || dump.__plugin !== 'dsh-panel-pins' || typeof dump !== 'object') {
              showToast(LABEL.setImportBad)
              return
            }
            try {
              Object.keys(dump).forEach(function (key) {
                if (key.indexOf('dsh-panel-pins:') !== 0) return
                const value = dump[key]
                if (typeof value === 'string') window.localStorage.setItem(key, value)
              })
              // Invalidate every cache, re-apply everything, reset React state.
              whitelistCache = null
              labelIdMapCache = null
              applyConfig()
              applyTidy()
              applyIconOnly()
              applyTheme()
              applyFold()
              applyFamily()
              applyTopPins()
              ensureLauncher()
              refreshAfterWhitelist()
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
              // v1.0.0: refresh the preset/group cards after a full import.
              try {
                setPresets(readPresets())
                setCgroups(readCustomGroups())
              } catch (error) {
                /* card state is cosmetic */
              }
              showToast(LABEL.setImportDone)
            } catch (error) {
              showToast(zh ? '导入失败' : 'Import failed')
            }
          },
          function () {
            showToast(zh ? '无法读取剪贴板：请手动复制后重试' : 'Cannot read clipboard — copy again and retry')
          },
        )
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

      return h(
        'div',
        { className: 'dpp-set' },
        h('h2', { className: 'dpp-set-title' }, LABEL.setTitle),
        h('p', { className: 'dpp-set-intro' }, LABEL.setIntro),
        h(
          'div',
          { className: 'dpp-set-card' },
          switchRow(LABEL.setRows, LABEL.setRowsDetail, rowsHid, toggleRows),
          switchRow(LABEL.setFamily, LABEL.setFamilyDetail, family, toggleFamily),
          switchRow(LABEL.setIconOnly, LABEL.setIconOnlyDetail, iconOnly, toggleIconOnly),
          switchRow(LABEL.setTidy, LABEL.setTidyDetail, tidy, toggleTidy),
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
        ),
        h(
          'p',
          { className: 'dpp-set-intro dpp-set-version' },
          // Build tag stays out of the UI: it lives in the ?dppdebug overlay
          // (debugText pushes BUILD=...) for troubleshooting; the settings
          // footnote reads clean ("v0.11.0").
          'dsh-panel-pins v' + VERSION,
        ),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        // Slot registrations first (they must survive even if the DOM layer
        // below fails).
        ctxSlots = ctx.slots
        ctx.slots.inject(SLOT, function () {
          return ctx.slots.register({ name: SLOT, id: SLOT_ID, order: 900 }, PinMenuRows)
        })
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
            observer = new MutationObserver(scheduleRefresh)
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
          // Attribute-only probe for theme/language flips (class on <html>).
          let attrObserver = null
          try {
            attrObserver = new MutationObserver(applyTheme)
            attrObserver.observe(document.documentElement, {
              attributes: true,
              attributeFilter: ['class'],
            })
          } catch (error) {
            attrObserver = null
          }
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
