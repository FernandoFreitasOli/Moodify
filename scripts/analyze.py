#!/usr/bin/env python3
"""
Moodify – Audio Analyzer
Analisa BPM e tonalidade de faixas de áudio e envia os resultados
ao frontend React via WebSocket (ws://localhost:8765).

Protocolo:
  → { "type": "analyze", "file_path": "/caminho/musica.mp3" }
  ← { "bpm": 120.5, "key": "A", "mode": "minor" }
  ← { "error": "mensagem de erro" }
"""

import asyncio
import json
import logging
import sys

import numpy as np
import websockets

logging.basicConfig(
    level=logging.INFO,
    format="[analyze.py] %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

HOST = "localhost"
PORT = 8765

# Perfis de Krumhansl-Schmuckler para detecção de tonalidade
_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
_KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def _estimate_key(y, sr):
    """Estimativa de tonalidade via correlação com perfis de Krumhansl-Schmuckler."""
    import librosa

    chroma      = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = np.mean(chroma, axis=1)

    best_corr = -np.inf
    best_key  = "C"
    best_mode = "major"

    for i in range(12):
        rotated     = np.roll(chroma_mean, -i)
        major_corr  = float(np.corrcoef(rotated, _MAJOR)[0, 1])
        minor_corr  = float(np.corrcoef(rotated, _MINOR)[0, 1])

        if major_corr > best_corr:
            best_corr, best_key, best_mode = major_corr, _KEY_NAMES[i], "major"
        if minor_corr > best_corr:
            best_corr, best_key, best_mode = minor_corr, _KEY_NAMES[i], "minor"

    return best_key, best_mode


def analyze_audio(file_path: str) -> dict:
    """Carrega o áudio (até 90 s) e calcula BPM + tonalidade."""
    try:
        import librosa
    except ImportError:
        return {"error": "librosa não encontrado. Execute: pip install librosa"}

    try:
        log.info("Carregando: %s", file_path)
        y, sr = librosa.load(file_path, duration=90, mono=True)

        # BPM
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm      = float(np.atleast_1d(tempo)[0])

        # Tonalidade
        key_name, mode = _estimate_key(y, sr)

        result = {"bpm": round(bpm, 1), "key": key_name, "mode": mode}
        log.info("Resultado: %s", result)
        return result

    except FileNotFoundError:
        return {"error": f"Arquivo não encontrado: {file_path}"}
    except Exception as exc:
        log.error("Erro ao analisar '%s': %s", file_path, exc)
        return {"error": str(exc)}


async def handler(websocket):
    """Gerencia uma conexão WebSocket de um cliente React."""
    addr = websocket.remote_address
    log.info("Cliente conectado: %s", addr)
    try:
        async for raw in websocket:
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send(json.dumps({"error": "JSON inválido"}))
                continue

            if data.get("type") == "analyze":
                path = data.get("file_path", "").strip()
                if not path:
                    await websocket.send(json.dumps({"error": "file_path ausente"}))
                    continue

                # Executa análise em thread separada para não bloquear o loop
                loop   = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, analyze_audio, path)
                await websocket.send(json.dumps(result))
            else:
                await websocket.send(
                    json.dumps({"error": f"Tipo desconhecido: {data.get('type')}"})
                )

    except websockets.exceptions.ConnectionClosedOK:
        pass
    except Exception as exc:
        log.error("Erro no handler (%s): %s", addr, exc)
    finally:
        log.info("Cliente desconectado: %s", addr)


async def main():
    log.info("Servidor WebSocket iniciado em ws://%s:%d", HOST, PORT)
    async with websockets.serve(handler, HOST, PORT):
        await asyncio.Future()  # roda indefinidamente


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Encerrando analyzer.")
        sys.exit(0)
