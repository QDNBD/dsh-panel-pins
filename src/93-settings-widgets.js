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

