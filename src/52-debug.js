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
      // v1.3.2: the active panel id (empty when the layout service is
      // absent) — the exemption's input, visible for troubleshooting.
      out.push('active=' + (activePanelId() || '-'))
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

