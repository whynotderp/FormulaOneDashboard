# F1 Telemetry Dashboard 2025

A full-stack Formula 1 telemetry and analytics dashboard featuring real-time session data, race outcome prediction, and fantasy team optimization.

![F1 Dashboard](https://img.shields.io/badge/F1-Telemetry%20Dashboard-e10600?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)

## Features

### Tab 1 — Telemetry Dashboard
- Circuit map with animated car positions (SVG, 10 circuits hardcoded)
- Speed trace area chart, throttle/brake line chart
- Lap time comparison for up to 5 drivers (line chart with color coding)
- Gap to leader timeline
- Tire compound, stint & degradation indicator bars
- Lap times table with pit lap highlighting
- Live standings with gap/interval
- Race control messages (SC, VSC, flags)
- Weather panel (temp, humidity, wind, rainfall)
- Data: OpenF1 API with mock fallback

### Tab 2 — Race Outcome Predictor
- Weighted ML-style scoring: Qualifying (40%), Team Pace (25%), Recent Form/5 races (20%), Circuit Factor (15%)
- Predicted podium with gold/silver/bronze cards
- Semi-circular gauge charts for Safety Car, VSC, Red Flag probabilities
- Full 20-driver grid with confidence bars and crash risk coloring
- Dry/wet weather toggle (amplifies chaos 1.3x)
- Historical incident rates per circuit from hardcoded data + Ergast API for form
- Methodology breakdown section

### Tab 3 — Fantasy F1 Optimizer
- Official F1 Fantasy scoring rules displayed (qualifying pts, race pts, bonuses, deductions)
- $100M budget constraint with greedy knapsack optimization
- Max 2 drivers per constructor constraint
- Captain 2x multiplier recommendation
- Value chart (pts/$M) for top 15 drivers
- Three views: Optimal Team, All Drivers table, Constructor comparison
- 2025 approximate driver prices

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, uvicorn |
| Data fetching | httpx (async), OpenF1 API, Ergast API |
| Telemetry | FastF1 library |
| Frontend | React 18, TypeScript, Vite |
| Styling | TailwindCSS v3 + inline styles |
| Charts | Recharts |
| Containerization | Docker, docker-compose |

## Quick Start

### Option A — Docker Compose

```bash
git clone https://github.com/whynotderp/FormulaOneDashboard.git
cd FormulaOneDashboard
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs

### Option B — Local Development

**Backend:**
```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

The frontend auto-proxies `/api/*` to `http://localhost:8000` in dev mode via Vite config.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/sessions?year=2025` | F1 sessions |
| `GET /api/drivers?session_key=N` | Drivers |
| `GET /api/laps?session_key=N&driver_number=N` | Lap times |
| `GET /api/car_data?session_key=N&driver_number=N` | Telemetry |
| `GET /api/stints?session_key=N` | Tire stints |
| `GET /api/weather?session_key=N` | Weather |
| `GET /api/race_control?session_key=N` | Race control messages |
| `GET /api/positions?session_key=N` | Live standings |
| `GET /api/tracks/{id}` | Circuit SVG (bahrain, monaco, silverstone, spa, monza, suzuka, jeddah, melbourne, miami, interlagos) |
| `GET /api/predictor/race?circuit_id=bahrain&weather=dry` | Race prediction |
| `GET /api/fantasy/team?circuit_id=bahrain` | Optimal fantasy team |
| `GET /api/fantasy/drivers?circuit_id=bahrain` | All drivers ranked by value |
| `GET /api/fantasy/constructors?circuit_id=bahrain` | Constructors ranked by value |
| `GET /api/ergast/standings/{year}` | Championship standings |
| `GET /docs` | Interactive Swagger UI |

## Data Sources

- **[OpenF1 API](https://openf1.org)** — Free, no API key. Live and historical session telemetry.
- **[Ergast API](http://ergast.com/api/f1)** — Free historical F1 data back to 1950.
- **[FastF1](https://theoehrly.github.io/Fast-F1/)** — Python library with local caching for detailed telemetry.

All API calls have graceful fallback to mock data, so the UI always renders even without internet or backend.

## License

MIT
