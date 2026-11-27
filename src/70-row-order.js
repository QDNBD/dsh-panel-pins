    // ---------------------------------------------------- row order (v1.2.2)
    // User-defined sidebar row order via negative CSS `order` on nav rows —
    // same no-DOM-surgery approach as top pins, but for ALL rows. Stored as a
    // label array (locale drift is mitigated by the label-id map reverse
    // lookup, same tradeoff as the v1 hidden stores). Rows not listed keep
    // their host order (partial authority: only reordered rows get a style).
    const ROW_ORDER_KEY = 'dsh-panel-pins:row-order'

    function readRowOrder() {
      try {
        const raw = window.localStorage.getItem(ROW_ORDER_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            return parsed.filter(function (x) { return typeof x === 'string' && x })
          }
        }
      } catch (error) {
        /* fall through to the default */
      }
      return []
    }

    function writeRowOrder(arr) {
      try {
        const clean = (Array.isArray(arr) ? arr : []).filter(function (x) {
          return typeof x === 'string' && x
        })
        window.localStorage.setItem(ROW_ORDER_KEY, JSON.stringify(clean))
        try {
          window.dispatchEvent(new CustomEvent('dpp:store-changed', { detail: { key: 'row-order' } }))
        } catch (error) {
          /* listener optional */
        }
      } catch (error) {
        /* storage unavailable */
      }
    }

    /** Move one row (by its current visible label) to a new index in the
     * stored order array, compacting to "known labels first". Returns the
     * updated array. Used by drag-drop and the context-menu "to front". */
    function moveRowInOrder(label, toIndex) {
      const order = readRowOrder()
      const cur = order.indexOf(label)
      if (cur !== -1) order.splice(cur, 1)
      const at = Math.max(0, Math.min(toIndex, order.length))
      order.splice(at, 0, label)
      writeRowOrder(order)
      return order
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
      // v1.7.1 ARIA: inside the listbox the head is chrome, not an option —
      // keep it focusable (it toggles the fold) but read as its own button
      // instead of polluting the option list.
      head.setAttribute('role', 'presentation')
      head.setAttribute('aria-label', title)
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

    /**
     * v1.5.0 (b95): panels registered in the root `main` keyed slot.
     *
     * The host's main slot holds every full-page panel in the app: the
     * conversation column, the pages our settings bridge registers, and any
     * panel a third-party plugin registers itself. A plugin that ships a
     * full page but NO sidebar row was installed and unreachable — exactly
     * the "装了就摸不到" case this plugin exists for.
     *
     * The host enumerates that slot itself with ctx.slots.entries('main')
     * (see ui-layout's retainMainPanels), so we read the same public slot.
     * Opening is layout.selectPanel(key) — the same call the settings bridge
     * already makes for bridged pages.
     */
    function readMainPanels() {
      if (!ctxSlots) return []
      let entries = []
      try {
        if (typeof ctxSlots.entries === 'function') entries = ctxSlots.entries(SLOT_MAIN) || []
        else if (typeof ctxSlots.entriesOfSlot === 'function') {
          entries = ctxSlots.entriesOfSlot(SLOT_MAIN) || []
        }
      } catch (error) {
        return []
      }
      if (!Array.isArray(entries)) return []
      const out = []
      entries.forEach(function (entry) {
        const options = (entry && entry.options) || {}
        const key = options.key
        if (typeof key !== 'string' || !key) return
        if (key === 'conversation') return // the host's own column
        if (key.indexOf(BRIDGE_PREFIX) === 0) return // already in the bridge group
        const label =
          typeof options.label === 'string' && options.label
            ? options.label
            : typeof options.title === 'string' && options.title
              ? options.title
              : key
        out.push({ key: key, label: label })
      })
      return out
    }

    /**
     * v1.6.0: the host's RIGHT sidebar tab types.
     *
     * The host keeps a registry of right-sidebar tab types
     * (ctx.sidebarRightTabs) plus a navigation controller
     * (ctx.sidebarRight). A tab type is either a PAGE type — no `patterns`,
     * opened by kind — or a RESOURCE type, which declares `patterns` over
     * `dsh-resource://` addresses and is opened by ADDRESS.
     *
     * openTab() only ever synthesizes the page address `sidebar://<kind>`
     * (ui-sidebar-right/src/client/service.ts:482, contract/seed.ts:45-47);
     * it does not consult `patterns`. Opening a RESOURCE kind by name would
     * therefore mount a body that throws on a non-resource address
     * (documentpreview src/client/code/CodeBody.tsx:17). So we list PAGE
     * TYPES ONLY — the resource types have no address we could derive from a
     * type listing anyway (there is no "enumerate the addresses of a type"
     * API).
     *
     * The registry's entries() already returns only the definitions that are
     * IN FORCE — a builtin shadowed by an extension is absent — so we never
     * reason about the extension/builtin priority ourselves
     * (tab-registry.ts:313-315, :407-408).
     */
    function readRightSidebarTabs() {
      let registry = null
      try {
        registry = optionalService('sidebarRightTabs')
      } catch (error) {
        return []
      }
      if (!registry || typeof registry.entries !== 'function') return []
      let entries = []
      try {
        entries = registry.entries() || []
      } catch (error) {
        return []
      }
      if (!Array.isArray(entries)) return []
      const out = []
      entries.forEach(function (def) {
        if (!def || typeof def.kind !== 'string' || !def.kind) return
        const patterns = def.patterns
        if (Array.isArray(patterns) && patterns.length > 0) return // resource type
        if (RIGHT_TAB_BLOCKED[def.kind]) return // needs navigation params we cannot supply
        out.push({ kind: def.kind, label: rightTabLabel(def) })
      })
      return out
    }

    /**
     * Kinds that cannot be opened by name alone. `scheduleTask` is opened with
     * params ({sessionId, id}) that a type listing cannot supply; the params
     * map is a type-level declaration only and does not exist at runtime
     * (ui-sidebar-right/src/client/contract/params.ts:38-40), so this list
     * is maintained by hand.
     */
    const RIGHT_TAB_BLOCKED = {
      scheduleTask: true,
    }

    /** The tab chip text. `title` is a required FUNCTION of an address. */
    function rightTabLabel(def) {
      try {
        // Page types receive the synthesized page address `sidebar://<kind>`
        // (contract/seed.ts:45-47). pageAddress() itself is NOT a public
        // export, so we compose the same string.
        const title = typeof def.title === 'function' ? def.title('sidebar://' + def.kind) : ''
        if (typeof title === 'string' && title) return title
      } catch (error) {
        /* a third-party title() may throw — fall back to the kind */
      }
      return def.kind
    }

    /**
     * Whether the right sidebar can be driven right now. The host throws
     * "no session surface is mounted" before it even looks the kind up
     * (ui-sidebar-right/src/client/service.ts:391, :854-864), so with no
     * session on screen the whole group would be dead rows.
     */
    function rightSidebarAvailable() {
      try {
        const right = optionalService('sidebarRight')
        if (!right || typeof right.openTab !== 'function') return false
        const mounted = right.mounted
        if (mounted && typeof mounted.getSnapshot === 'function') {
          return mounted.getSnapshot() !== undefined
        }
        return true
      } catch (error) {
        return false
      }
    }

    /** Open a right-sidebar tab type by kind, with the host's own guards. */
    function openRightSidebarTab(kind) {
      try {
        const registry = optionalService('sidebarRightTabs')
        // The type may have been unloaded between opening the menu and the
        // click — the host throws for an unregistered kind
        // (service.ts:481), so re-check before asking it to open anything.
        if (registry && typeof registry.get === 'function' && registry.get(kind) === undefined) {
          return false
        }
        const right = optionalService('sidebarRight')
        if (!right || typeof right.openTab !== 'function') return false
        right.openTab(kind)
        return true
      } catch (error) {
        return false
      }
    }

