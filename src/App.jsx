import { useState, useCallback } from 'react'
import Player from './components/Player'
import ThemeProvider from './components/ThemeProvider'
import PlaylistPanel from './components/PlaylistPanel'
import EQPanel from './components/EQPanel'
import './styles/App.css'

export default function App() {
  const [playlist,     setPlaylist]     = useState([])
  const [currentIdx,   setCurrentIdx]   = useState(-1)
  const [analysisData, setAnalysisData] = useState({ bpm: 80, key: 'C', mode: 'major' })
  const [playbackMode, setPlaybackMode] = useState('focus')
  const [nightMode,    setNightMode]    = useState(true)
  const [activeTab,    setActiveTab]    = useState('player')
  const [eqValues,     setEqValues]     = useState({ bass: 0, mid: 0, treble: 0 })
  const [shuffle,      setShuffle]      = useState(false)
  const [repeat,       setRepeat]       = useState('none') // 'none' | 'all' | 'one'

  const addTracks = useCallback((tracks) => {
    setPlaylist(prev => {
      const newItems = tracks
        .filter(t => !prev.find(m => m.src === t.src))
        .map(t => ({ ...t, liked: false }))
      if (!newItems.length) return prev
      const next = [...prev, ...newItems]
      setCurrentIdx(ci => ci === -1 ? prev.length : ci)
      return next
    })
  }, [])

  const removeTrack = useCallback((idx) => {
    setPlaylist(prev => {
      const next = prev.filter((_, i) => i !== idx)
      setCurrentIdx(ci => {
        if (next.length === 0) return -1
        if (ci > idx) return ci - 1
        if (ci === idx) return Math.min(ci, next.length - 1)
        return ci
      })
      return next
    })
  }, [])

  const toggleLike = useCallback((idx) => {
    setPlaylist(prev => prev.map((t, i) => i === idx ? { ...t, liked: !t.liked } : t))
  }, [])

  return (
    <ThemeProvider bpm={analysisData.bpm} musicMode={analysisData.mode} playbackMode={playbackMode} nightMode={nightMode}>
      <div className={`app ${nightMode ? 'night' : 'day'}`}>
        <header className="app-header">
          <div className="header-side" />
          <div className="header-center">
            <span className="logo">🎧</span>
            <h1>Moodify</h1>
            <p className="tagline">Música em harmonia com seu ambiente</p>
          </div>
          <div className="header-side">
            <button className="night-btn" onClick={() => setNightMode(n => !n)} title={nightMode ? 'Modo claro' : 'Modo noturno'}>
              {nightMode ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        <nav className="tabs">
          {[['player','🎵','Player'],['playlist','📋','Playlist'],['eq','🎛️','EQ']].map(([id, icon, label]) => (
            <button key={id} className={`tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
              {icon} {label}
              {id === 'playlist' && playlist.length > 0 && <span className="tab-badge">{playlist.length}</span>}
            </button>
          ))}
        </nav>

        <div className="panel-wrap">
          {activeTab === 'player' && (
          <div className="panel visible">
            <Player
              playlist={playlist}
              currentIdx={currentIdx}
              onAddTracks={addTracks}
              onNextTrack={(pl) => setCurrentIdx(ci => {
                if (!pl.length) return ci
                if (shuffle) {
                  let n; do { n = Math.floor(Math.random() * pl.length) } while (n === ci && pl.length > 1); return n
                }
                return (ci + 1) % pl.length
              })}
              onPrevTrack={(pl) => setCurrentIdx(ci => {
                if (!pl.length) return ci
                return (ci - 1 + pl.length) % pl.length
              })}
              onAnalysis={setAnalysisData}
              analysisData={analysisData}
              playbackMode={playbackMode}
              onModeChange={setPlaybackMode}
              eqValues={eqValues}
              shuffle={shuffle}
              onToggleShuffle={() => setShuffle(s => !s)}
              repeat={repeat}
              onToggleRepeat={() => setRepeat(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none')}
              onToggleLike={() => currentIdx >= 0 && toggleLike(currentIdx)}
              isLiked={currentIdx >= 0 ? (playlist[currentIdx]?.liked ?? false) : false}
            />
          </div>
          )}
          {activeTab === 'playlist' && (
          <div className="panel visible">
            <PlaylistPanel
              playlist={playlist}
              currentIdx={currentIdx}
              onSelect={setCurrentIdx}
              onRemove={removeTrack}
              onLike={toggleLike}
            />
          </div>
          )}
          {activeTab === 'eq' && (
          <div className="panel visible">
            <EQPanel values={eqValues} onChange={setEqValues} />
          </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  )
}
