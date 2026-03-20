import { useEffect } from 'react'

/**
 * Mapeia BPM e tonalidade para uma paleta de cores e aplica via CSS custom properties.
 * BPM < 60   → azul-pálido
 * BPM 60-90  → verde-lima
 * BPM 90-120 → amarelo-laranja
 * BPM > 120  → vermelho
 * major → saturação alta | minor → saturação suave
 * relax → pastel e tom claro | focus → cores vibrantes e fundo escuro
 */
function computeTheme(bpm, musicMode, playbackMode, nightMode) {
  let baseHue
  if (bpm < 60)       baseHue = 210  // azul
  else if (bpm < 90)  baseHue = 140  // verde
  else if (bpm < 120) baseHue = 35   // laranja
  else                baseHue = 0    // vermelho

  const isRelax = playbackMode === 'relax'
  const isMajor = musicMode === 'major'

  // nightMode forces dark palette regardless of relax/focus
  const dark   = nightMode || !isRelax
  const sat    = isRelax && !nightMode ? 28 : (isMajor ? 75 : 52)
  const bgL    = dark ? 8  : 90
  const bg2L   = dark ? 14 : 83
  const accL   = dark ? 60 : 50
  const textL  = dark ? 96 : 15
  const text2L = dark ? 66 : 38
  const cardL  = dark ? 14 : 88

  return {
    '--hue':          baseHue,
    '--sat':          `${sat}%`,
    '--bg-primary':   `hsl(${baseHue}, ${sat}%, ${bgL}%)`,
    '--bg-secondary': `hsl(${baseHue}, ${Math.max(sat - 8, 0)}%, ${bg2L}%)`,
    '--accent':       `hsl(${baseHue}, ${Math.min(sat + 25, 100)}%, ${accL}%)`,
    '--accent-hover': `hsl(${baseHue}, ${Math.min(sat + 30, 100)}%, ${accL + 8}%)`,
    '--accent-glow':  `hsla(${baseHue}, ${Math.min(sat + 25, 100)}%, ${accL}%, 0.35)`,
    '--text-primary':   `hsl(${baseHue}, 10%, ${textL}%)`,
    '--text-secondary': `hsl(${baseHue}, 12%, ${text2L}%)`,
    '--card-bg':        `hsla(${baseHue}, ${Math.max(sat - 10, 0)}%, ${cardL}%, 0.88)`,
    '--border':         `hsla(${baseHue}, ${sat}%, ${isRelax ? 55 : 50}%, 0.2)`,
    '--slider-track':   `hsl(${baseHue}, ${Math.max(sat - 15, 0)}%, ${isRelax ? 68 : 24}%)`,
  }
}

export default function ThemeProvider({ bpm, musicMode, playbackMode, nightMode, children }) {
  useEffect(() => {
    const theme = computeTheme(bpm || 80, musicMode || 'major', playbackMode || 'focus', nightMode !== false)
    const root = document.documentElement
    Object.entries(theme).forEach(([key, val]) => root.style.setProperty(key, String(val)))
  }, [bpm, musicMode, playbackMode, nightMode])

  return <>{children}</>
}
