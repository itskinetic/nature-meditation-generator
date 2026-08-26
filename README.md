# Calm Nature Meditation Video Generator

An automated, local full-stack web application designed for meditation channels. It analyzes titles and scripts for emotional intent and mood, discovers footage from Pexels and Pixabay, applies strict calmness and motion scoring, tracks and reuses assets with a persistent SQLite library, calculates clip counts and transitions, and renders seamless meditation videos with ambient soundscapes using FFmpeg.

---

## Key Features

- **Intent & Mood NLP Engine**: Extracts emotional intent, mood states, energy level, visual style, motifs, and negative exclusions. Supports Google Gemini Vision or intelligent offline semantic fallback.
- **Strict Visual & Calmness Scoring**: Evaluates candidates against strict thresholds (`intent >= 8`, `theme >= 8`, `calmness >= 8`, `motion <= 4`, `quality >= 7`).
- **Nature Presets**: Built-in presets including *Calm Misty Forest*, *Calm Ocean*, *Peaceful Meadow*, *Quiet Mountain Lake*, *Soft Sunrise Valley*, *Gentle Rainforest*, and *Clouds Above the Mountains*.
- **Multi-Source Footage Discovery**: Official Pexels & Pixabay video search APIs with caching, pagination, deduplication, and offline synthetic fallback.
- **Smart Asset Library & Cooldown Logic**: SQLite tracking of times used, freshness decay, and cooldown logic to prioritize less-used, high-scoring clips.
- **Harmonic Sequence Planning**: Alternates subthemes and creators, rotates starting clips upon loop cycles, and calculates precise usable/effective durations.
- **Local FFmpeg Video Engine**: Smooth `xfade` crossfades (0.5s–5.0s), 1080p / 4K resolution normalization, aspect ratio conversion (16:9, 9:16, 1:1), and ambient meditation soundscapes with audio fade-in/fade-out.
- **Polished React Dashboard**: Modern, distraction-free UI with real-time job progress, candidate inspection, library browser, and history player.
- **n8n Webhook Ready**: API endpoint `/api/webhooks/generate` for optional external orchestration.

---

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, TanStack React Query, Lucide icons.
- **Backend**: Python 3.11+, FastAPI, SQLAlchemy, SQLite, Pydantic v2, FFmpeg, FFprobe.

---

## Getting Started

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- FFmpeg & FFprobe installed and available in PATH

### 2. Quick Dry-Run (CLI)
Render a sample 60-second meditation video without requiring external API keys:
```bash
# Using root npm script
npm run dry-run

# Or directly via Python
.venv\Scripts\python.exe backend/run.py --dry-run --duration 60
```

### 3. Running the Application Locally

#### Backend (FastAPI):
```bash
# Activate virtual environment
.venv\Scripts\activate

# Start backend server
uvicorn backend.app.main:app --reload --port 8000
```
Backend API docs will be live at `http://localhost:8000/docs`.

#### Frontend (React / Vite):
```bash
cd frontend
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## Environment Variables (.env)

Copy `.env.example` to `.env`:
```env
PEXELS_API_KEY=your_pexels_api_key
PIXABAY_API_KEY=your_pixabay_api_key
GEMINI_API_KEY=your_gemini_api_key
VISION_PROVIDER=gemini
DEFAULT_ASPECT_RATIO=16:9
DEFAULT_RESOLUTION=1080p
DEFAULT_TRANSITION=crossfade
DEFAULT_TRANSITION_DURATION=2
```
*Note: If API keys are omitted, the application runs in offline mode using synthetic nature footage and ambient soundscapes.*

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health & directory status check |
| `GET` | `/api/presets` | Available nature presets |
| `POST` | `/api/analyze` | Analyzes title/script for intent & mood |
| `POST` | `/api/search` | Searches and filters footage candidates |
| `POST` | `/api/generate` | Starts a background video generation job |
| `GET` | `/api/jobs/{id}` | Detailed job info and evaluated candidates |
| `GET` | `/api/jobs/{id}/progress` | Real-time progress and stage updates |
| `GET` | `/api/jobs/{id}/preview` | Stream rendered MP4 video |
| `GET` | `/api/jobs/{id}/download` | Download completed final MP4 |
| `POST` | `/api/jobs/{id}/cancel` | Cancel an ongoing rendering job |
| `GET` | `/api/library` | Search and filter SQLite video library |
| `GET` | `/api/history` | Generation history and past downloads |
| `POST` | `/api/webhooks/generate`| n8n automation webhook trigger |

---

## Automated Tests

Run the test suite with pytest:
```bash
.venv\Scripts\pytest.exe tests -v
```
Tests cover:
- Intent analysis & query expansion
- Pexels & Pixabay search and caching
- Duplicate removal & negative keyword exclusions
- Scoring thresholds & criteria validation
- Library reuse priority formula & cooldown tracking
- Sequence duration mathematics & loop repetitions
- FFmpeg audio generation and FFprobe stream verification
