# 🎧 Moodify – Tocador que muda a cor da interface conforme o humor da música  

> **Mini‑app web (React + Tauri)**  
> Que reproduz MP3s locais, analisa a faixa com `librosa` e adapta a paleta de cores do player ao BPM e à tonalidade. O objetivo é criar uma experiência musical “em sintonia” com o ambiente visual.  

---

## 🚀 Visão geral

| Feature | Descrição |
|---------|-----------|
| **Reprodução local** | Navegar por pastas, selecionar MP3s, play/pause/skip. |
| **Análise em tempo real** | `librosa` calcula BPM e key (tensão) a cada segundo de reprodução. |
| **Tema dinâmico** | Fundo + texto mudam para cores que reflitam o “humor” da música – alta energia → vibrante, baixa energia → suave. |
| **Modos** | • **Relax** – paleta pastel e volume baixo.<br>• **Focus** – cores fortes e equalização de áudio para foco. |
| **Interface amigável** | UI em português, responsiva, minimalista. |

---

## 📦 Tecnologias

| Camada | Tecnologia | Por que |
|--------|------------|---------|
| **Frontend** | React + Vite | Simplicidade, hot‑reload e tamanho pequeno. |
| **Desktop wrapper** | Tauri | Leve (≈ 5 MB), segurança nativa, acesso a arquivos locais. |
| **Audio / ML** | Python 3.x + `librosa`, `numpy` | Biblioteca padrão para análise de áudio. |
| **Comunicação** | WebSocket via `tauri-plugin-sysapi` | Permite enviar dados da análise Python ao React em tempo real. |
| **Build** | Cargo (Rust) + Vite | Compila Rust e bundle JS/TS. |

---

## 🗂️ Estrutura do projeto

```
moodify/
├─ src/                     # Código fonte React
│  ├─ App.jsx               # Layout principal
│  ├─ components/
│  │   ├─ Player.jsx        # Controles de áudio
│  │   └─ ThemeProvider.jsx # Gera tema a partir do BPM/key
│  └─ styles/               # CSS / SCSS
├─ src-tauri/                # Código Rust/Tauri
│  ├─ src/
│  │   └─ main.rs           # Entry point, spawn Python worker
│  └─ Cargo.toml            # Dependências do Rust
├─ scripts/
│  └─ analyze.py            # Script que roda `librosa` e envia resultados via WS
├─ assets/                   # Imagens, ícones
└─ package.json
```

> **Obs.:** O script `analyze.py` é iniciado em segundo plano pelo Tauri quando o app abre. Ele observa a faixa atual (por meio de um canal IPC) e devolve BPM/key ao frontend.

---

## 📥 Instalação

### Pré‑requisitos

| Item | Versão |
|------|--------|
| Node.js + npm/yarn | ≥ 20 |
| Rust + Cargo | latest stable |
| Python 3.10+ |  |
| `librosa` e dependências | instalar via pip |

```bash
# 1️⃣ Clone o repositório
git clone https://github.com/seu-usuario/moodify.git
cd moodify

# 2️⃣ Instale as dependências JavaScript
npm install          # ou yarn

# 3️⃣ Instale Python deps
pip install -r scripts/requirements.txt   # (librosa, numpy)

# 4️⃣ Build e rode o app Tauri
npx tauri dev
```

> O comando acima compila a aplicação Rust + WebAssembly e abre uma janela desktop.  
> Para criar um bundle de produção: `npx tauri build`.

---

## 🎛️ Como usar

1. **Abrir** – Ao abrir, o app solicita permissão para acessar arquivos locais.
2. **Selecionar música** – Clique em *“Escolher arquivo”* → navegue até a pasta desejada e abra um MP3.
3. **Controle de áudio** – Play/Pause/Next/Previous + slider de posição + volume.
4. **Modo** – No canto superior direito, escolha entre *Relax* ou *Focus*.  
   - Relax: paleta pastel, equalizador “bass‑soft”.  
   - Focus: cores vivas, equalizador “treble‑boost”.
5. **Observação visual** – Conforme a música evolui, o fundo e o texto mudam em tempo real (ex.: BPM alto → vermelho vibrante; BPM baixo → azul tranquilo).

---

## 📊 Análise de áudio

O script `analyze.py` executa:

```python
import librosa
y, sr = librosa.load(file_path)
bpm = librosa.beat.tempo(y=y, sr=sr)[0]
key = librosa.core.key.get_key(y, sr)  # retorno: (tonalidade, modo)
```

Esses valores são enviados para o frontend via WebSocket e mapeados em cores:

| BPM | Cor de fundo |
|-----|--------------|
| < 60 | Azul‑pálido |
| 60–90 | Verde‑lima |
| 90–120 | Amarelo‑laranja |
| > 120 | Vermelho |

A tonalidade determina a saturação: modo *major* → cores mais vivas, *minor* → tons suaves.

---

## 🛠️ Extensões Futuras

- **Equalizador visual** – barras que respondem à frequência.
- **Playlist inteligente** – agrupar faixas por BPM/tonalidade similar.
- **Integração com Spotify** – usar Web API para obter metadados e streaming.
- **Modo “Night”** – tema escuro automático.

---

## 📄 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais detalhes.

---

## 🤝 Contribuindo

1. Fork → Clone → Crie branch (`git checkout -b feature/foo`).  
2. Commit → Push → Pull Request.  
3. Certifique‑se de rodar os testes e manter o README atualizado.

---

### 📞 Contato

- **Autor:** Fernando Freitas de Oliveira – <f.freitasoli2001@gmail.com>  
- **GitHub:** https://github.com/FernandoFreitasOli/Moodify  

--- 

*Obrigado por explorar o Moodify! 🎶✨*
