const PRESETS = {
  'Plano':    { bass: 0,  mid: 0,  treble: 0  },
  'Bass':     { bass: 8,  mid: 0,  treble: -2 },
  'Treble':   { bass: -2, mid: 0,  treble: 8  },
  'Vocal':    { bass: -3, mid: 6,  treble: 3  },
  'Dance':    { bass: 6,  mid: 2,  treble: 3  },
  'Rock':     { bass: 5,  mid: -2, treble: 4  },
  'Clássico': { bass: -2, mid: 0,  treble: 4  },
  'Lo-Fi':    { bass: 4,  mid: -3, treble: -4 },
}

function activePreset(values) {
  return Object.keys(PRESETS).find(
    k => PRESETS[k].bass === values.bass && PRESETS[k].mid === values.mid && PRESETS[k].treble === values.treble
  ) ?? null
}

export default function EQPanel({ values, onChange }) {
  const active = activePreset(values)

  const applyPreset = (name) => onChange({ ...PRESETS[name] })
  const change = (band) => (e) => onChange({ ...values, [band]: parseFloat(e.target.value) })

  const reset = () => onChange({ bass: 0, mid: 0, treble: 0 })

  return (
    <div className="eq-panel">
      <div className="eq-header">
        <h2>Equalizador 🎛️</h2>
        <button className="eq-reset" onClick={reset} title="Zerar EQ">↺ Reset</button>
      </div>

      {/* Presets */}
      <div className="eq-presets">
        {Object.keys(PRESETS).map(name => (
          <button
            key={name}
            className={`eq-preset ${active === name ? 'active' : ''}`}
            onClick={() => applyPreset(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Sliders */}
      <div className="eq-sliders">
        {[
          ['bass',   'Grave',  '🎸', 200],
          ['mid',    'Médio',  '🎹', 1000],
          ['treble', 'Agudo',  '🎺', 4000],
        ].map(([band, label, icon, freq]) => (
          <div key={band} className="eq-band">
            <div className="eq-band-top">
              <span className="eq-band-icon">{icon}</span>
              <span className="eq-band-label">{label}</span>
              <span className="eq-freq">{freq >= 1000 ? `${freq / 1000}kHz` : `${freq}Hz`}</span>
            </div>
            <div className="eq-slider-row">
              <span className="eq-min">-12</span>
              <input
                type="range"
                className="eq-slider"
                min={-12} max={12} step={0.5}
                value={values[band]}
                onChange={change(band)}
              />
              <span className="eq-max">+12</span>
            </div>
            <div className="eq-bar-visual">
              <div
                className="eq-bar-fill"
                style={{
                  height: `${((values[band] + 12) / 24) * 100}%`,
                  background: values[band] > 0
                    ? 'linear-gradient(to top, var(--accent), color-mix(in srgb, var(--accent) 65%, white))'
                    : 'linear-gradient(to top, var(--slider-track), color-mix(in srgb, var(--slider-track) 65%, black))',
                }}
              />
            </div>
            <span className="eq-db">
              {values[band] > 0 ? '+' : ''}{values[band].toFixed(1)} dB
            </span>
          </div>
        ))}
      </div>

      <p className="eq-tip">💡 Os controles afetam o áudio em tempo real via Web Audio API.</p>
    </div>
  )
}
