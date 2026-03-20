import { useMemo } from 'react'

const BPM_GROUPS = [
  { label: 'Calmo',    emoji: '💤', min: 0,   max: 60,       color: 'blue'   },
  { label: 'Suave',    emoji: '🌿', min: 60,  max: 90,       color: 'green'  },
  { label: 'Enérgico', emoji: '✨', min: 90,  max: 120,      color: 'orange' },
  { label: 'Intenso',  emoji: '🔥', min: 120, max: Infinity, color: 'red'    },
]

export default function PlaylistPanel({ playlist, currentIdx, onSelect, onRemove, onLike }) {
  const grouped = useMemo(() => {
    return BPM_GROUPS.map(group => ({
      ...group,
      tracks: playlist
        .map((t, i) => ({ ...t, idx: i }))
        .filter(t => {
          const bpm = t.bpm ?? 80
          return bpm >= group.min && bpm < group.max
        }),
    })).filter(g => g.tracks.length > 0)
  }, [playlist])

  if (!playlist.length) {
    return (
      <div className="playlist-empty">
        <span className="empty-icon">🎶</span>
        <p>Nenhuma música adicionada ainda.</p>
        <p className="empty-hint">Vá ao Player e clique em "Adicionar Músicas".</p>
      </div>
    )
  }

  return (
    <div className="playlist-panel">
      <div className="playlist-header">
        <h2>Smart Playlist 🧠</h2>
        <p className="pl-sub">Agrupada por energia e tonalidade</p>
      </div>

      <div className="pl-stats">
        <span>🎵 {playlist.length} faixas</span>
        <span>❤️ {playlist.filter(t => t.liked).length} curtidas</span>
      </div>

      {grouped.map(group => (
        <div key={group.label} className={`pl-group pl-group--${group.color}`}>
          <div className="pl-group-header">
            <span className="pl-group-title">{group.emoji} {group.label}</span>
            <span className="pl-group-range">
              {group.min}–{group.max === Infinity ? '∞' : group.max} BPM
            </span>
          </div>

          {group.tracks.map(track => (
            <div
              key={track.idx}
              className={`pl-track ${track.idx === currentIdx ? 'playing' : ''}`}
              onClick={() => onSelect(track.idx)}
            >
              <div className="pl-track-icon">
                {track.idx === currentIdx ? (
                  <span className="now-playing-icon">▶</span>
                ) : (
                  <span className="track-num-icon">{track.idx + 1}</span>
                )}
              </div>

              <div className="pl-track-meta">
                <span className="pl-track-name">{track.name}</span>
                <span className="pl-track-info">
                  {track.bpm ? `${Math.round(track.bpm)} BPM` : ''}
                  {track.key ? ` · ${track.key} ${track.mode === 'major' ? 'Maior' : 'Menor'}` : ''}
                </span>
              </div>

              <div className="pl-track-actions">
                <button
                  className={`pl-like ${track.liked ? 'liked' : ''}`}
                  onClick={e => { e.stopPropagation(); onLike(track.idx) }}
                  title="Curtir"
                >
                  {track.liked ? '❤️' : '🤍'}
                </button>
                <button
                  className="pl-remove"
                  onClick={e => { e.stopPropagation(); onRemove(track.idx) }}
                  title="Remover"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
