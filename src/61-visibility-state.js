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

