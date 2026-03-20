import { useState, useRef, useEffect, useCallback } from 'react'

const MOOD_LABELS = (bpm) => {
  if (!bpm) return '–'
  if (bpm < 60)  return 'Calmo'
  if (bpm < 90)  return 'Suave'
  if (bpm < 120) return 'Enérgico'
  return 'Intenso'
}

const fmtTime = (s) => {
  if (!s || isNaN(s)) return '0:00'
  const m   = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const getTrackMonogram = (name) => {
  if (!name) return 'MD'
  const parts = name.split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'MD'
}

// Draws a fully-rounded rectangle (all 4 corners rounded)
function roundedRect(ctx, x, y, w, h, r) {
  if (h <= 0 || w <= 0) return
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.lineTo(x + w - rad, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad)
  ctx.lineTo(x + w, y + h - rad)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
  ctx.lineTo(x + rad, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad)
  ctx.lineTo(x, y + rad)
  ctx.quadraticCurveTo(x, y, x + rad, y)
  ctx.closePath()
}

const isTauri = () => Boolean(window.__TAURI__)

export default function Player({
  playlist, currentIdx,
  onAddTracks, onNextTrack, onPrevTrack,
  onAnalysis, analysisData,
  playbackMode, onModeChange,
  eqValues,
  shuffle,  onToggleShuffle,
  repeat,   onToggleRepeat,
  onToggleLike, isLiked,
}) {
  const audioRef      = useRef(null)
  const canvasRef     = useRef(null)
  const audioCtxRef   = useRef(null)
  const analyserRef   = useRef(null)
  const gainRef       = useRef(null)
  const bassRef       = useRef(null)
  const midRef        = useRef(null)
  const trebleRef     = useRef(null)
  const modeFilterRef = useRef(null)
  const animFrameRef  = useRef(null)
  const wsRef         = useRef(null)
  const controlsRef   = useRef({})

  const [isPlaying,   setIsPlaying]   = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)
  const [volume,      setVolume]      = useState(0.75)
  const [bpmRate,     setBpmRate]     = useState(1.0)
  const [wsStatus,    setWsStatus]    = useState('disconnected')
  const [isDragging,  setIsDragging]  = useState(false)

  const currentTrack = playlist[currentIdx] ?? null

  // ── Audio context (lazy init on first play) ────────────────────────────────
  const initAudioCtx = useCallback(() => {
    if (audioCtxRef.current) return
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const anal = ctx.createAnalyser()
    anal.fftSize = 256
    anal.smoothingTimeConstant = 0.80

    const bass   = ctx.createBiquadFilter()
    bass.type = 'lowshelf'; bass.frequency.value = 200; bass.gain.value = 0
    const mid    = ctx.createBiquadFilter()
    mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 1; mid.gain.value = 0
    const treble = ctx.createBiquadFilter()
    treble.type = 'highshelf'; treble.frequency.value = 4000; treble.gain.value = 0
    const modeF  = ctx.createBiquadFilter()
    modeF.type = 'peaking'; modeF.frequency.value = 4000; modeF.gain.value = 0
    const gain   = ctx.createGain()
    gain.gain.value = volume

    const src = ctx.createMediaElementSource(audioRef.current)
    src.connect(bass); bass.connect(mid); mid.connect(treble)
    treble.connect(modeF); modeF.connect(gain)
    gain.connect(anal); anal.connect(ctx.destination)

    audioCtxRef.current   = ctx
    analyserRef.current   = anal
    gainRef.current       = gain
    bassRef.current       = bass
    midRef.current        = mid
    trebleRef.current     = treble
    modeFilterRef.current = modeF
  }, [volume])

  // ── helpers exposed via ref so keyboard handler never goes stale ──────────
  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio?.src) return
    initAudioCtx()
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume()
    if (isPlaying) { audio.pause(); setIsPlaying(false) }
    else           { audio.play();  setIsPlaying(true)  }
  }, [isPlaying, initAudioCtx])

  const skip = useCallback((delta) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + delta))
  }, [])

  useEffect(() => {
    controlsRef.current = { togglePlay, skip, onNextTrack, onPrevTrack, playlist }
  })

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return
      const c = controlsRef.current
      switch (e.key) {
        case ' ':          e.preventDefault(); c.togglePlay();          break
        case 'ArrowRight': e.preventDefault(); c.skip(10);             break
        case 'ArrowLeft':  e.preventDefault(); c.skip(-10);            break
        case 'n':          c.onNextTrack(c.playlist);                  break
        case 'p':          c.onPrevTrack(c.playlist);                  break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Load track when src changes ────────────────────────────────────────────
  const currentSrc = currentTrack?.src
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentSrc) return
    initAudioCtx()
    audio.src = currentSrc
    audio.load()
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    setCurrentTime(0)
    if (currentTrack?.bpm) {
      onAnalysis({ bpm: currentTrack.bpm, key: currentTrack.key, mode: currentTrack.mode })
    }
  }, [currentSrc, initAudioCtx, currentTrack, onAnalysis])

  // ── BPM / playback rate ────────────────────────────────────────────────────
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = bpmRate }, [bpmRate])

  // ── 3-band EQ from props (set by EQPanel) ─────────────────────────────────
  useEffect(() => {
    if (!bassRef.current) return
    bassRef.current.gain.value   = eqValues.bass
    midRef.current.gain.value    = eqValues.mid
    trebleRef.current.gain.value = eqValues.treble
  }, [eqValues])

  // ── Relax / Focus mode filter ──────────────────────────────────────────────
  useEffect(() => {
    if (!modeFilterRef.current || !gainRef.current) return
    if (playbackMode === 'focus') {
      modeFilterRef.current.type            = 'highshelf'
      modeFilterRef.current.frequency.value = 4000
      modeFilterRef.current.gain.value      = 4
      gainRef.current.gain.value            = volume
    } else {
      modeFilterRef.current.type            = 'lowshelf'
      modeFilterRef.current.frequency.value = 300
      modeFilterRef.current.gain.value      = -3
      gainRef.current.gain.value            = volume * 0.72
    }
  }, [playbackMode, volume])

  // ── WebSocket – Python analyzer ────────────────────────────────────────────
  useEffect(() => {
    let retry
    const connect = () => {
      try {
        const ws = new WebSocket('ws://localhost:8765')
        wsRef.current = ws
        ws.onopen    = () => setWsStatus('connected')
        ws.onclose   = () => { setWsStatus('disconnected'); retry = setTimeout(connect, 5000) }
        ws.onerror   = () => setWsStatus('disconnected')
        ws.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data)
            if (d.bpm && d.key) { onAnalysis({ bpm: d.bpm, key: d.key, mode: d.mode }); setWsStatus('connected') }
          } catch { /* ignore */ }
        }
      } catch { setWsStatus('disconnected'); retry = setTimeout(connect, 5000) }
    }
    connect()
    return () => { clearTimeout(retry); wsRef.current?.close() }
  }, [onAnalysis])

  // ── Canvas – idle bars (paused state) ─────────────────────────────────────
  const drawIdle = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    const hue = getComputedStyle(document.documentElement).getPropertyValue('--hue').trim() || '210'
    ctx.clearRect(0, 0, W, H)
    const square = 154
    const left = (W - square) / 2
    const top = (H - square) / 2
    const barsPerSide = 18
    const spacing = 4
    const topBarW = (square - spacing * (barsPerSide - 1)) / barsPerSide
    const sideBarH = topBarW

    ctx.fillStyle = `hsla(${hue}, 30%, 30%, 0.18)`
    roundedRect(ctx, left, top, square, square, 26)
    ctx.fill()

    for (let i = 0; i < barsPerSide; i++) {
      const amp = 4 + Math.abs(Math.sin(i * 0.55)) * 8
      const x = left + i * (topBarW + spacing)
      const yTop = top - amp - 10
      const yBottom = top + square + 10
      ctx.fillStyle = `hsla(${hue}, 44%, 56%, 0.16)`
      roundedRect(ctx, x, yTop, topBarW, amp, Math.min(topBarW / 2, 4))
      ctx.fill()
      roundedRect(ctx, x, yBottom, topBarW, amp, Math.min(topBarW / 2, 4))
      ctx.fill()
    }

    for (let i = 0; i < barsPerSide - 2; i++) {
      const amp = 4 + Math.abs(Math.cos(i * 0.5)) * 8
      const y = top + 10 + i * (sideBarH + spacing)
      const xLeft = left - amp - 10
      const xRight = left + square + 10
      ctx.fillStyle = `hsla(${hue}, 44%, 56%, 0.16)`
      roundedRect(ctx, xLeft, y, amp, sideBarH, Math.min(sideBarH / 2, 4))
      ctx.fill()
      roundedRect(ctx, xRight, y, amp, sideBarH, Math.min(sideBarH / 2, 4))
      ctx.fill()
    }
  }, [])

  // ── Canvas – live visualizer ───────────────────────────────────────────────
  const startVisualizer = useCallback(() => {
    const canvas   = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return
    const ctx    = canvas.getContext('2d')
    const bufLen = analyser.frequencyBinCount
    const data   = new Uint8Array(bufLen)
    const square = 154
    const barsPerSide = 18
    const spacing = 4

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(data)
      const W   = canvas.width, H = canvas.height
      const hue = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hue')) || 210
      const left = (W - square) / 2
      const top = (H - square) / 2
      const topBarW = (square - spacing * (barsPerSide - 1)) / barsPerSide
      const sideBarH = topBarW
      ctx.clearRect(0, 0, W, H)

      const innerGrad = ctx.createLinearGradient(left, top, left + square, top + square)
      innerGrad.addColorStop(0, `hsla(${hue}, 36%, 22%, 0.88)`)
      innerGrad.addColorStop(1, `hsla(${hue + 18}, 40%, 12%, 0.92)`)
      ctx.fillStyle = innerGrad
      roundedRect(ctx, left, top, square, square, 26)
      ctx.fill()

      ctx.strokeStyle = `hsla(${hue}, 72%, 62%, 0.18)`
      ctx.lineWidth = 1
      roundedRect(ctx, left + 0.5, top + 0.5, square - 1, square - 1, 26)
      ctx.stroke()

      for (let i = 0; i < barsPerSide; i++) {
        const di   = Math.floor((i / barsPerSide) * bufLen)
        const val  = data[di] / 255
        const barH = Math.max(5, val * 28)
        const x    = left + i * (topBarW + spacing)
        const yTop = top - barH - 10
        const yBottom = top + square + 10
        const r    = Math.min(topBarW / 2, 5)

        const grad = ctx.createLinearGradient(x, yTop, x, yTop + barH)
        grad.addColorStop(0,    `hsla(${hue + i * 0.5}, 88%, 74%, 0.96)`)
        grad.addColorStop(0.55, `hsla(${hue},           80%, 56%, 0.85)`)
        grad.addColorStop(1,    `hsla(${hue - 15},      65%, 36%, 0.50)`)

        ctx.shadowBlur  = val > 0.6 ? 10 + val * 14 : 0
        ctx.shadowColor = `hsla(${hue}, 90%, 68%, 0.75)`
        ctx.fillStyle   = grad
        roundedRect(ctx, x, yTop, topBarW, barH, r)
        ctx.fill()
        roundedRect(ctx, x, yBottom, topBarW, barH, r)
        ctx.fill()
      }

      for (let i = 0; i < barsPerSide - 2; i++) {
        const di = Math.floor(((i + barsPerSide) / (barsPerSide * 2)) * bufLen)
        const val = data[di] / 255
        const barW = Math.max(5, val * 28)
        const y = top + 10 + i * (sideBarH + spacing)
        const xLeft = left - barW - 10
        const xRight = left + square + 10
        const r = Math.min(sideBarH / 2, 5)
        const grad = ctx.createLinearGradient(xLeft, y, xLeft + barW, y)
        grad.addColorStop(0,    `hsla(${hue - 10}, 65%, 36%, 0.50)`)
        grad.addColorStop(0.55, `hsla(${hue},      80%, 56%, 0.85)`)
        grad.addColorStop(1,    `hsla(${hue + 14}, 88%, 74%, 0.96)`)

        ctx.shadowBlur  = val > 0.6 ? 10 + val * 14 : 0
        ctx.shadowColor = `hsla(${hue}, 90%, 68%, 0.75)`
        ctx.fillStyle = grad
        roundedRect(ctx, xLeft, y, barW, sideBarH, r)
        ctx.fill()
        roundedRect(ctx, xRight, y, barW, sideBarH, r)
        ctx.fill()

        ctx.shadowBlur  = 0
      }
      ctx.shadowBlur = 0
    }
    draw()
  }, [])

  useEffect(() => {
    if (isPlaying && analyserRef.current) {
      startVisualizer()
    } else {
      cancelAnimationFrame(animFrameRef.current)
      drawIdle()
    }
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isPlaying, startVisualizer, drawIdle])

  // Redraw idle when theme color changes and player is paused
  useEffect(() => { if (!isPlaying) drawIdle() })

  // ── File handling ──────────────────────────────────────────────────────────
  const openFile = async () => {
    if (isTauri()) {
      try {
        const { open }           = await import('@tauri-apps/api/dialog')
        const { convertFileSrc } = await import('@tauri-apps/api/tauri')
        const files = await open({
          multiple: true,
          filters: [{ name: 'Áudio', extensions: ['mp3','ogg','wav','flac','m4a','aac'] }],
        })
        if (!files) return
        const arr    = Array.isArray(files) ? files : [files]
        const tracks = arr.map(path => {
          const name = String(path).split('/').pop().replace(/\.[^.]+$/, '')
          const src  = convertFileSrc(path)
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            setWsStatus('analyzing')
            wsRef.current.send(JSON.stringify({ type: 'analyze', file_path: path }))
          }
          return { name, src, bpm: null, key: null, mode: null }
        })
        onAddTracks(tracks)
      } catch (err) { console.error('[Moodify]', err) }
    } else {
      document.getElementById('moodify-file-input').click()
    }
  }

  const handleFileInput = (e) => {
    const KEYS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
    const tracks = Array.from(e.target.files).map(file => {
      const bpm  = Math.round(55 + Math.random() * 105)
      const key  = KEYS[Math.floor(Math.random() * KEYS.length)]
      const mode = Math.random() > 0.5 ? 'major' : 'minor'
      return { name: file.name.replace(/\.[^.]+$/, ''), src: URL.createObjectURL(file), bpm, key, mode }
    })
    onAddTracks(tracks)
    if (tracks[0]) onAnalysis({ bpm: tracks[0].bpm, key: tracks[0].key, mode: tracks[0].mode })
    e.target.value = ''
  }

  // ── Seek & volume ──────────────────────────────────────────────────────────
  const seek = (e) => {
    const t = parseFloat(e.target.value)
    audioRef.current.currentTime = t
    setCurrentTime(t)
  }

  const changeVolume = (e) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (gainRef.current) gainRef.current.gain.value = val
    else if (audioRef.current) audioRef.current.volume = val
  }

  // ── Audio element events ───────────────────────────────────────────────────
  const onTimeUpdate = () => { if (!isDragging) setCurrentTime(audioRef.current.currentTime) }
  const onLoadedMeta = () => setDuration(audioRef.current.duration)
  const onEnded      = () => {
    if (repeat === 'one') {
      audioRef.current.currentTime = 0; audioRef.current.play()
    } else if (repeat === 'all' || playlist.length > 1) {
      onNextTrack(playlist)
    } else {
      setIsPlaying(false); setCurrentTime(0)
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const { bpm, key, mode } = analysisData
  const effectiveBpm       = bpm ? Math.round(bpm * bpmRate) : null
  const progressPct        = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="player">
      {/* hidden inputs */}
      <input
        id="moodify-file-input" type="file" accept="audio/*" multiple
        style={{ display: 'none' }} onChange={handleFileInput}
      />
      <audio ref={audioRef} onTimeUpdate={onTimeUpdate} onLoadedMetadata={onLoadedMeta} onEnded={onEnded} />

      {/* ── Visualizer ──────────────────────────────────────── */}
      <div className="visualizer-wrap">
        <canvas ref={canvasRef} className="visualizer" width={420} height={240} />
        <div className="visualizer-core" aria-hidden="true">
          <div className="visualizer-core-inner">
            <span className="visualizer-core-mark">{getTrackMonogram(currentTrack?.name)}</span>
          </div>
        </div>
      </div>

      {/* ── Track info ──────────────────────────────────────── */}
      <div className="track-info">
        <div className="track-row">
          <p className="track-name" title={currentTrack?.name ?? 'Nenhuma faixa selecionada'}>
            {currentTrack?.name ?? 'Nenhuma faixa selecionada'}
          </p>
          <button className={`like-btn ${isLiked ? 'liked' : ''}`} onClick={onToggleLike} title="Curtir">
            {isLiked ? '❤️' : '🤍'}
          </button>
        </div>
        <div className="analysis-badges">
          <span className="badge">{effectiveBpm ? `${effectiveBpm} BPM` : '– BPM'}</span>
          <span className="badge">{key ?? '–'}{key && mode ? ` ${mode === 'major' ? 'Maior' : 'Menor'}` : ''}</span>
          <span className="badge mood">{MOOD_LABELS(effectiveBpm)}</span>
          {playlist.length > 1 && (
            <span className="badge track-num">{(currentIdx ?? 0) + 1}/{playlist.length}</span>
          )}
        </div>
      </div>

      {/* ── Seek bar ────────────────────────────────────────── */}
      <div className="seek-wrap">
        <span className="time">{fmtTime(currentTime)}</span>
        <div className="seek-container">
          <div className="seek-fill" style={{ width: `${progressPct}%` }} />
          <input
            type="range" className="seek-bar"
            min={0} max={duration || 0} step={0.1} value={currentTime}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onTouchEnd={() => setIsDragging(false)}
            onChange={seek}
          />
        </div>
        <span className="time end">{fmtTime(duration)}</span>
      </div>

      {/* ── Main controls ───────────────────────────────────── */}
      <div className="controls">
        <button className={`ctrl-btn icon-btn ${shuffle ? 'on' : ''}`} onClick={onToggleShuffle} title="Aleatório">🔀</button>
        <button className="ctrl-btn skip-btn" onClick={() => onPrevTrack(playlist)} title="Anterior">⏮</button>
        <button className="ctrl-btn play-btn" onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
        <button className="ctrl-btn skip-btn" onClick={() => onNextTrack(playlist)} title="Próxima">⏭</button>
        <button className={`ctrl-btn icon-btn ${repeat !== 'none' ? 'on' : ''}`} onClick={onToggleRepeat} title="Repetir">
          {repeat === 'one' ? '🔂' : '🔁'}
        </button>
      </div>

      {/* ── Volume ──────────────────────────────────────────── */}
      <div className="row-control">
        <span className="row-icon">🔉</span>
        <input type="range" className="slider" min={0} max={1} step={0.01} value={volume} onChange={changeVolume} />
        <span className="row-icon">🔊</span>
        <span className="row-value">{Math.round(volume * 100)}%</span>
      </div>

      {/* ── BPM / Velocidade ────────────────────────────────── */}
      <div className="row-control bpm-row">
        <span className="row-icon">⏱</span>
        <span className="row-text">Velocidade</span>
        <input
          type="range" className="slider"
          min={0.5} max={2.0} step={0.05} value={bpmRate}
          onChange={e => setBpmRate(parseFloat(e.target.value))}
        />
        <span className="row-value">{bpmRate.toFixed(2)}×</span>
        <button className="reset-btn" onClick={() => setBpmRate(1)} title="Resetar">↺</button>
      </div>

      {/* ── Mode toggle ─────────────────────────────────────── */}
      <div className="mode-wrap">
        <button className={`mode-btn ${playbackMode === 'relax' ? 'active' : ''}`} onClick={() => onModeChange('relax')}>
          🌿 Relax
        </button>
        <button className={`mode-btn ${playbackMode === 'focus' ? 'active' : ''}`} onClick={() => onModeChange('focus')}>
          ⚡ Focus
        </button>
      </div>

      {/* ── Add music button ────────────────────────────────── */}
      <button className="open-btn" onClick={openFile}>
        📂 Adicionar Músicas
      </button>

      {/* ── Footer ──────────────────────────────────────────── */}
      <div className="footer-row">
        <div className={`ws-status ${wsStatus}`}>
          <span className="ws-dot" />
          {wsStatus === 'connected'   ? 'Analyzer conectado'
           : wsStatus === 'analyzing' ? 'Analisando…'
           : 'Modo básico'}
        </div>
        <span className="kbd-hint" title="Atalhos de teclado">⌨ Spc · ← → · N · P</span>
      </div>
    </div>
  )
}
