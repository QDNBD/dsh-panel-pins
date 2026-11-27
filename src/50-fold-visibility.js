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
        // b75: rc.3 wraps each row button in a DIV._panelEntry flex child —
        // visibility and order must target that UNIT; the button only carries
        // labels and rename state. Legacy navs: unit === the row button.
        const unit = rowUnitOf(nav, row) || row
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
        // b69: carrier lookup shared by the commit and reset passes. Direct
        // text nodes first (b64 preference — reusing the host's own node keeps
        // its commit target stable); when the host nests the text deeper (e.g.
        // an inner span inside the label), fall back to the FIRST non-empty
        // DEEP text node, then any blanked one. A Text node cannot carry
        // attributes, so the marker carrier for the no-text-node-at-all
        // fallback is an ELEMENT span (b48's createTextNode().setAttribute
        // threw and silently killed the whole applyFold pass on deep rows —
        // the b68 walk's renamedRows=0 evidence).
        const findCarrier = function () {
          let blanked = null
          for (const n of nameEl.childNodes) {
            if (n.nodeType !== 3) continue
            if (n.nodeValue && n.nodeValue.trim()) return n
            if (!blanked) blanked = n
          }
          const walker = document.createTreeWalker(nameEl, NodeFilter.SHOW_TEXT)
          let deep = null
          let deepBlanked = null
          let n
          while ((n = walker.nextNode())) {
            if (n.nodeValue && n.nodeValue.trim()) { deep = n; break }
            if (!deepBlanked) deepBlanked = n
          }
          return deep || blanked || deepBlanked || null
        }
        // Blank every OTHER non-empty text node (direct + deep) so exactly one
        // carrier shows the label. TreeWalker touches only text nodes — the
        // row icon (svg paths) is never affected.
        const blankOthers = function (keep) {
          for (const n of nameEl.childNodes) {
            if (n.nodeType === 3 && n !== keep && n.nodeValue) n.nodeValue = ''
          }
          const walker = document.createTreeWalker(nameEl, NodeFilter.SHOW_TEXT)
          let n
          while ((n = walker.nextNode())) {
            if (n !== keep && n.nodeValue && n.nodeValue.trim()) n.nodeValue = ''
          }
        }
        if (customName) {
          // v1.1.0 b48: rewrite only the TEXT node — the label element also
          // hosts the row icon (svg); nameEl.textContent = customName wiped
          // it (icon-loss bug).
          // b61/b64: strip orphan carriers WE appended earlier (data-dpp-text
          // spans) and keep a SINGLE text carrier — two visible texts showed
          // duplicated labels ("XD Pool XD Pool").
          const stale = nameEl.querySelectorAll('[data-dpp-text="1"]')
          for (const s of stale) s.remove()
          const tn = findCarrier()
          if (tn) {
            if (tn.nodeValue !== customName) tn.nodeValue = customName
            blankOthers(tn)
          } else if (nameEl.textContent !== customName) {
            const span = document.createElement('span')
            span.setAttribute('data-dpp-text', '1')
            span.textContent = customName
            nameEl.appendChild(span)
          }
          if (row.getAttribute('data-dpp-renamed') !== '1') {
            row.setAttribute('data-dpp-renamed', '1')
            row.title = customName
          }
        } else if (row.getAttribute('data-dpp-renamed') === '1') {
          // Renaming was undone: b64 — clear our carriers and restore the
          // original label. b69: the restore WRITES the original (aria-label)
          // into the carrier text node instead of only blanking — React does
          // not rewrite text nodes it believes unchanged, so a blanked deep
          // node would stay empty forever on nested-label rows.
          const stale2 = nameEl.querySelectorAll('[data-dpp-text="1"]')
          for (const s of stale2) s.remove()
          const tn = findCarrier()
          if (tn) {
            if (tn.nodeValue !== label) tn.nodeValue = label
            blankOthers(tn)
          } else if (nameEl.textContent !== label) {
            const span = document.createElement('span')
            span.setAttribute('data-dpp-text', '1')
            span.textContent = label
            nameEl.appendChild(span)
          }
          row.removeAttribute('data-dpp-renamed')
          row.removeAttribute('title')
        }
        // v1.1.0 hide + v1.3.2 active-row exemption: user-hidden rows
        // disappear from the sidebar unless whitelisted; an individually
        // hidden row that IS the currently active panel stays visible
        // ("you are on this page" — the dsh-panellist hidden-vs-active
        // rule). Collection mode (rows-hidden) never exempts.
        const hide = shouldHideRow(label, hiddenRows.indexOf(label) !== -1, hidden)
        const want = hide ? 'none' : ''
        // Skip when already in place: refresh runs on every DOM mutation
        // burst, and redundant inline-style writes invalidate layout for nothing.
        if (unit.style.display === want) return
        unit.style.display = want
        if (hide) unit.dataset.dppHidden = '1'
        else delete unit.dataset.dppHidden
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
      findFamilyRows().concat(findFooterRows()).forEach(function (row) {
        const label = rowLabel(row)
        if (hiddenRows.indexOf(label) === -1) return
        if (isWhitelistedLabelOrMapped(label)) return
        // v1.3.2 active-row exemption: a hidden plugin entry that IS the
        // currently active panel (id known via the label→id map) stays
        // visible; leaving the panel re-hides it on the next refresh pass.
        if (isActiveRowLabel(label)) return
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
      // v1.4.4: classify the host scroll contract BEFORE anything that gates
      // on it (the rc.3 structural CSS needs html.dpp-rc3, and the nav wheel
      // hijack in ensureLauncher checks the same class).
      detectScrollContract()
      applyConfig()
      applyTheme()
      applyTidy()
      applyIconOnly()
      seedMapFromSlots()
      restoreWhitelistedEverywhere()
      applyFamily()
      applyFooter()
      applyFold()
      applyHiddenRows()
      applyTopPins()
      applyRowOrder()
      // v1.4.0: reconcile bridged settings pages on the same debounced cadence
      // (sync itself is add/remove only, 120ms-debounced internally when the
      // subscription fires; direct calls here are cheap no-ops when the
      // candidate set is unchanged).
      syncBridgeSettings()
      ensureLauncher()
      updateDebug()
    }

