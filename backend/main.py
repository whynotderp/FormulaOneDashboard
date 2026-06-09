"""
F1 Telemetry Dashboard - FastAPI Backend
Uses OpenF1 API, Ergast API, and FastF1 library
"""

import datetime
import math
import random
from typing import Any, Dict, List, Optional

CURRENT_YEAR = datetime.date.today().year

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="F1 Telemetry Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENF1_BASE = "https://api.openf1.org/v1"
ERGAST_BASE = "http://ergast.com/api/f1"


async def fetch_json(client: httpx.AsyncClient, url: str, params: Dict = None) -> Any:
    try:
        r = await client.get(url, params=params, timeout=20)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[FETCH ERROR] {url}: {e}")
        return None


# ---------------------------------------------------------------------------
# Track SVG paths (10 circuits)
# ---------------------------------------------------------------------------

TRACK_SVGS: Dict[str, Dict] = {
    "monaco": {
        "name": "Circuit de Monaco", "turns": 19, "length_km": 3.337,
        "viewBox": "100 40 260 220",
        "path": "M150,80 L220,60 L280,70 L310,100 L320,150 L300,200 L260,230 L200,240 L160,220 L130,180 L120,140 L130,100 Z",
    },
    "silverstone": {
        "name": "Silverstone Circuit", "turns": 18, "length_km": 5.891,
        "viewBox": "60 60 320 230",
        "path": "M80,120 L160,80 L260,80 L340,120 L360,180 L320,240 L240,270 L160,260 L80,220 Z",
    },
    "spa": {
        "name": "Circuit de Spa-Francorchamps", "turns": 19, "length_km": 7.004,
        "viewBox": "60 40 300 230",
        "path": "M100,80 L180,60 L280,80 L340,140 L320,200 L260,240 L180,250 L100,200 L80,140 Z",
    },
    "monza": {
        "name": "Autodromo Nazionale Monza", "turns": 11, "length_km": 5.793,
        "viewBox": "100 40 210 220",
        "path": "M150,60 L250,60 L280,100 L280,200 L240,240 L160,240 L120,200 L120,100 Z",
    },
    "suzuka": {
        "name": "Suzuka International Racing Course", "turns": 18, "length_km": 5.807,
        "viewBox": "80 40 240 220",
        "path": "M120,100 L200,60 L280,80 L300,160 L260,220 L180,240 L120,200 L100,150 Z",
    },
    "bahrain": {
        "name": "Bahrain International Circuit", "turns": 15, "length_km": 5.412,
        "viewBox": "60 50 290 220",
        "path": "M100,100 L200,70 L300,90 L330,160 L290,230 L200,250 L110,220 L80,150 Z",
    },
    "jeddah": {
        "name": "Jeddah Corniche Circuit", "turns": 27, "length_km": 6.174,
        "viewBox": "70 30 290 250",
        "path": "M130,70 L220,50 L310,80 L340,160 L300,240 L200,260 L110,220 L90,140 Z",
    },
    "melbourne": {
        "name": "Albert Park Circuit", "turns": 16, "length_km": 5.278,
        "viewBox": "60 40 280 240",
        "path": "M120,80 L220,60 L300,100 L320,180 L280,250 L180,260 L100,220 L80,150 Z",
    },
    "miami": {
        "name": "Miami International Autodrome", "turns": 19, "length_km": 5.412,
        "viewBox": "60 40 300 250",
        "path": "M110,90 L210,60 L310,90 L340,170 L300,250 L200,270 L100,240 L80,160 Z",
    },
    "interlagos": {
        "name": "Autodromo Jose Carlos Pace", "turns": 15, "length_km": 4.309,
        "viewBox": "50 50 290 230",
        "path": "M100,110 L180,70 L270,80 L320,160 L280,240 L180,260 L90,220 L70,150 Z",
    },
}

DRIVERS_2025 = [
    {"code": "VER", "name": "Max Verstappen",     "team": "Red Bull",     "price": 30.0, "number": 1},
    {"code": "NOR", "name": "Lando Norris",        "team": "McLaren",      "price": 27.5, "number": 4},
    {"code": "LEC", "name": "Charles Leclerc",     "team": "Ferrari",      "price": 25.0, "number": 16},
    {"code": "PIA", "name": "Oscar Piastri",       "team": "McLaren",      "price": 22.0, "number": 81},
    {"code": "HAM", "name": "Lewis Hamilton",      "team": "Ferrari",      "price": 22.5, "number": 44},
    {"code": "SAI", "name": "Carlos Sainz",        "team": "Williams",     "price": 18.0, "number": 55},
    {"code": "RUS", "name": "George Russell",      "team": "Mercedes",     "price": 20.0, "number": 63},
    {"code": "ANT", "name": "Kimi Antonelli",      "team": "Mercedes",     "price": 13.0, "number": 12},
    {"code": "ALO", "name": "Fernando Alonso",     "team": "Aston Martin", "price": 15.0, "number": 14},
    {"code": "STR", "name": "Lance Stroll",        "team": "Aston Martin", "price": 8.0,  "number": 18},
    {"code": "GAS", "name": "Pierre Gasly",        "team": "Alpine",       "price": 10.0, "number": 10},
    {"code": "DOO", "name": "Jack Doohan",         "team": "Alpine",       "price": 7.0,  "number": 7},
    {"code": "TSU", "name": "Yuki Tsunoda",        "team": "Red Bull",     "price": 14.0, "number": 22},
    {"code": "LAW", "name": "Liam Lawson",         "team": "Racing Bulls", "price": 10.0, "number": 30},
    {"code": "HUL", "name": "Nico Hulkenberg",     "team": "Sauber",       "price": 10.0, "number": 27},
    {"code": "BOR", "name": "Gabriel Bortoleto",   "team": "Sauber",       "price": 7.5,  "number": 5},
    {"code": "OCO", "name": "Esteban Ocon",        "team": "Haas",         "price": 9.0,  "number": 31},
    {"code": "BEA", "name": "Oliver Bearman",      "team": "Haas",         "price": 8.0,  "number": 87},
    {"code": "ALB", "name": "Alexander Albon",     "team": "Williams",     "price": 11.0, "number": 23},
    {"code": "HAD", "name": "Isack Hadjar",        "team": "Racing Bulls", "price": 8.5,  "number": 6},
]

CONSTRUCTORS_2025 = [
    {"name": "McLaren",      "price": 33.5},
    {"name": "Ferrari",      "price": 30.0},
    {"name": "Red Bull",     "price": 28.0},
    {"name": "Mercedes",     "price": 22.0},
    {"name": "Aston Martin", "price": 15.0},
    {"name": "Williams",     "price": 13.0},
    {"name": "Racing Bulls", "price": 12.0},
    {"name": "Alpine",       "price": 10.0},
    {"name": "Haas",         "price": 9.5},
    {"name": "Sauber",       "price": 8.0},
]

TEAM_PACE = {
    "McLaren": 1.000, "Ferrari": 1.003, "Red Bull": 1.005,
    "Mercedes": 1.010, "Aston Martin": 1.025, "Williams": 1.030,
    "Racing Bulls": 1.028, "Alpine": 1.040, "Haas": 1.042, "Sauber": 1.055,
}

CIRCUIT_INCIDENTS = {
    "monaco":      {"sc": 0.75, "vsc": 0.60, "red_flag": 0.30},
    "spa":         {"sc": 0.55, "vsc": 0.40, "red_flag": 0.25},
    "silverstone": {"sc": 0.45, "vsc": 0.35, "red_flag": 0.15},
    "monza":       {"sc": 0.50, "vsc": 0.30, "red_flag": 0.20},
    "suzuka":      {"sc": 0.40, "vsc": 0.30, "red_flag": 0.15},
    "bahrain":     {"sc": 0.35, "vsc": 0.25, "red_flag": 0.10},
    "jeddah":      {"sc": 0.65, "vsc": 0.50, "red_flag": 0.30},
    "melbourne":   {"sc": 0.60, "vsc": 0.45, "red_flag": 0.25},
    "miami":       {"sc": 0.55, "vsc": 0.40, "red_flag": 0.20},
    "interlagos":  {"sc": 0.70, "vsc": 0.55, "red_flag": 0.35},
}

DRIVER_CRASH_PROB = {
    "VER": 0.05, "NOR": 0.07, "LEC": 0.10, "PIA": 0.08,
    "SAI": 0.08, "HAM": 0.06, "RUS": 0.07, "ANT": 0.15,
    "ALO": 0.08, "STR": 0.12, "GAS": 0.10, "DOO": 0.18,
    "TSU": 0.12, "LAW": 0.14, "HUL": 0.09, "BOR": 0.18,
    "OCO": 0.11, "BEA": 0.16, "ALB": 0.09, "HAD": 0.17,
}

DRIVER_AVG_FANTASY_PTS = {
    "VER": 52.0, "NOR": 55.0, "LEC": 48.0, "PIA": 50.0,
    "SAI": 35.0, "HAM": 42.0, "RUS": 40.0, "ANT": 22.0,
    "ALO": 28.0, "STR": 15.0, "GAS": 20.0, "DOO": 12.0,
    "TSU": 25.0, "LAW": 18.0, "HUL": 20.0, "BOR": 14.0,
    "OCO": 16.0, "BEA": 18.0, "ALB": 22.0, "HAD": 14.0,
}

CONSTRUCTOR_AVG_FANTASY_PTS = {
    "McLaren": 95.0, "Ferrari": 80.0, "Red Bull": 75.0,
    "Mercedes": 65.0, "Aston Martin": 40.0, "Williams": 35.0,
    "Racing Bulls": 32.0, "Alpine": 28.0, "Haas": 26.0, "Sauber": 18.0,
}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/sessions")
async def get_sessions(year: Optional[int] = None):
    """Live sessions for a season. Defaults to the current year; if that season
    has no data yet (early in the year), falls back to the previous season so the
    dashboard always shows the most recent real sessions."""
    async with httpx.AsyncClient() as client:
        for y in [year] if year else [CURRENT_YEAR, CURRENT_YEAR - 1]:
            data = await fetch_json(client, f"{OPENF1_BASE}/sessions", {"year": y})
            if data:
                # newest first so the frontend can auto-select the latest session
                data.sort(key=lambda s: s.get("date_start", ""), reverse=True)
                return data
    # offline fallback (sample data)
    return [
        {"session_key": 9999, "session_name": "Race", "date_start": f"{CURRENT_YEAR}-03-16T15:00:00+00:00",
         "circuit_short_name": "Bahrain", "country_name": "Bahrain", "year": CURRENT_YEAR, "session_type": "Race"},
        {"session_key": 9998, "session_name": "Qualifying", "date_start": f"{CURRENT_YEAR}-03-15T14:00:00+00:00",
         "circuit_short_name": "Bahrain", "country_name": "Bahrain", "year": CURRENT_YEAR, "session_type": "Qualifying"},
    ]


@app.get("/api/drivers")
async def get_drivers(session_key: Optional[int] = None):
    if session_key:
        async with httpx.AsyncClient() as client:
            data = await fetch_json(client, f"{OPENF1_BASE}/drivers", {"session_key": session_key})
            if data:
                return data
    return DRIVERS_2025


@app.get("/api/laps")
async def get_laps(session_key: int, driver_number: Optional[int] = None):
    params = {"session_key": session_key}
    if driver_number:
        params["driver_number"] = driver_number
    async with httpx.AsyncClient() as client:
        data = await fetch_json(client, f"{OPENF1_BASE}/laps", params)
        if data:
            return data
    laps = []
    for lap in range(1, 58):
        base = 92.0 + random.gauss(0, 0.3)
        laps.append({
            "lap_number": lap, "driver_number": driver_number or 1,
            "lap_duration": round(base, 3),
            "duration_sector_1": round(base * 0.32, 3),
            "duration_sector_2": round(base * 0.38, 3),
            "duration_sector_3": round(base * 0.30, 3),
            "is_pit_out_lap": lap in [1, 25, 45],
            "date_start": f"2025-03-16T15:{lap:02d}:00+00:00",
        })
    return laps


@app.get("/api/car_data")
async def get_car_data(session_key: int, driver_number: int):
    params = {"session_key": session_key, "driver_number": driver_number}
    async with httpx.AsyncClient() as client:
        data = await fetch_json(client, f"{OPENF1_BASE}/car_data", params)
        if data and len(data) > 0:
            return data[:500]
    points = []
    for i in range(200):
        t = i / 200.0
        speed = 150 + 150 * abs(math.sin(t * math.pi * 4)) + random.gauss(0, 5)
        throttle = max(0, min(100, 80 * abs(math.sin(t * math.pi * 4)) + random.gauss(0, 5)))
        brake = 1 if speed > 280 and math.cos(t * math.pi * 4) < -0.5 else 0
        points.append({
            "date": f"2025-03-16T15:01:{i // 60:02d}.{i % 60:02d}+00:00",
            "speed": round(speed, 1), "throttle": round(throttle, 1), "brake": brake,
            "drs": 10 if speed > 250 and brake == 0 else 0,
            "n_gear": min(8, max(1, int(speed / 45))),
            "rpm": int(8000 + (speed / 350) * 7000),
        })
    return points


@app.get("/api/positions")
async def get_positions(session_key: int):
    async with httpx.AsyncClient() as client:
        data = await fetch_json(client, f"{OPENF1_BASE}/intervals", {"session_key": session_key})
        if data:
            return data
    return [
        {"driver_number": d["number"], "position": i + 1,
         "gap_to_leader": round(i * 1.8 + random.gauss(0, 0.2), 3) if i > 0 else 0,
         "interval": round(1.8 + random.gauss(0, 0.2), 3) if i > 0 else 0}
        for i, d in enumerate(DRIVERS_2025)
    ]


@app.get("/api/stints")
async def get_stints(session_key: int, driver_number: Optional[int] = None):
    params = {"session_key": session_key}
    if driver_number:
        params["driver_number"] = driver_number
    async with httpx.AsyncClient() as client:
        data = await fetch_json(client, f"{OPENF1_BASE}/stints", params)
        if data:
            return data
    return [
        {"driver_number": driver_number or 1, "stint_number": 1, "lap_start": 1,  "lap_end": 23, "compound": "SOFT",   "tyre_age_at_start": 0},
        {"driver_number": driver_number or 1, "stint_number": 2, "lap_start": 24, "lap_end": 43, "compound": "MEDIUM", "tyre_age_at_start": 0},
        {"driver_number": driver_number or 1, "stint_number": 3, "lap_start": 44, "lap_end": 57, "compound": "HARD",   "tyre_age_at_start": 0},
    ]


@app.get("/api/weather")
async def get_weather(session_key: int):
    async with httpx.AsyncClient() as client:
        data = await fetch_json(client, f"{OPENF1_BASE}/weather", {"session_key": session_key})
        if data:
            return data[-1] if data else {}
    return {"air_temperature": 28.5, "track_temperature": 42.3, "humidity": 35,
            "pressure": 1013.2, "wind_speed": 12.4, "wind_direction": 245, "rainfall": False}


@app.get("/api/race_control")
async def get_race_control(session_key: int):
    async with httpx.AsyncClient() as client:
        data = await fetch_json(client, f"{OPENF1_BASE}/race_control", {"session_key": session_key})
        if data:
            return data
    return [
        {"date": "2025-03-16T15:05:00+00:00", "message": "SAFETY CAR DEPLOYED",   "category": "SafetyCar", "flag": "SC",         "lap_number": 12},
        {"date": "2025-03-16T15:10:00+00:00", "message": "SAFETY CAR IN THIS LAP","category": "SafetyCar", "flag": "SC",         "lap_number": 15},
        {"date": "2025-03-16T15:40:00+00:00", "message": "CHEQUERED FLAG",         "category": "Flag",      "flag": "CHEQUERED",  "lap_number": 57},
    ]


@app.get("/api/tracks")
async def get_tracks():
    return [{"id": k, "name": v["name"], "turns": v["turns"], "length_km": v["length_km"]} for k, v in TRACK_SVGS.items()]


@app.get("/api/tracks/{track_id}")
async def get_track(track_id: str):
    if track_id not in TRACK_SVGS:
        raise HTTPException(404, "Track not found")
    return {**TRACK_SVGS[track_id], "id": track_id}


def _normalize_points(raw: List[Dict], pad: float = 30.0, span: float = 1000.0) -> List[Dict]:
    """Scale raw (x, y) telemetry into a clean square viewBox."""
    xs = [p["x"] for p in raw]
    ys = [p["y"] for p in raw]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    w = max(maxx - minx, 1.0)
    h = max(maxy - miny, 1.0)
    scale = (span - 2 * pad) / max(w, h)
    ox = pad + (span - 2 * pad - w * scale) / 2
    oy = pad + (span - 2 * pad - h * scale) / 2
    # flip Y: telemetry Y grows "up", SVG Y grows "down"
    return [{"x": round(ox + (p["x"] - minx) * scale, 1),
             "y": round(span - (oy + (p["y"] - miny) * scale), 1)} for p in raw]


def _mock_outline(circuit_id: str, span: float = 1000.0, n: int = 240) -> List[Dict]:
    """Generate a winding, circuit-like closed curve (not a plain polygon).
    Seeded by circuit id so each track has a distinct, stable shape."""
    seed = sum(ord(c) for c in circuit_id)
    rnd = random.Random(seed)
    a2, a3, b2, b3 = (rnd.uniform(0.25, 0.45), rnd.uniform(0.10, 0.25),
                      rnd.uniform(0.20, 0.40), rnd.uniform(0.10, 0.22))
    ph = rnd.uniform(0, math.pi)
    raw = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = math.cos(t) + a2 * math.cos(2 * t + ph) - a3 * math.sin(3 * t)
        y = math.sin(t) + b2 * math.sin(2 * t + ph) + b3 * math.cos(3 * t)
        raw.append({"x": x, "y": y})
    return _normalize_points(raw, span=span)


@app.get("/api/track_outline")
async def get_track_outline(session_key: Optional[int] = None,
                            driver_number: Optional[int] = None,
                            circuit_id: str = "bahrain"):
    """Return the real circuit outline traced from OpenF1 /location telemetry
    (one reference driver, sampled over a short window). Falls back to a
    generated circuit-like curve when live data is unavailable. Points are
    normalized into a 0..1000 square viewBox; cars animate along this outline."""
    if session_key:
        async with httpx.AsyncClient() as client:
            params = {"session_key": session_key}
            if driver_number:
                params["driver_number"] = driver_number
            data = await fetch_json(client, f"{OPENF1_BASE}/location", params)
        if data:
            # pick a single driver's time-ordered samples (a few laps trace the shape)
            if not driver_number:
                first = data[0].get("driver_number")
                data = [p for p in data if p.get("driver_number") == first]
            pts = [{"x": p["x"], "y": p["y"], "t": p.get("date", "")}
                   for p in data if p.get("x") is not None and (p.get("x") or p.get("y"))]
            # drop the (0,0) garbage samples OpenF1 emits between laps
            pts = [p for p in pts if not (p["x"] == 0 and p["y"] == 0)]
            if len(pts) > 40:
                step = max(1, len(pts) // 600)
                pts = pts[::step][:600]
                norm = _normalize_points(pts)
                return {"source": "telemetry", "session_key": session_key,
                        "viewBox": "0 0 1000 1000", "points": norm}
    return {"source": "generated", "circuit_id": circuit_id,
            "viewBox": "0 0 1000 1000", "points": _mock_outline(circuit_id)}


# ---------------------------------------------------------------------------
# Race Predictor
# ---------------------------------------------------------------------------

def driver_score(driver: Dict, quali_pos: int, circuit_id: str, recent_form: List[int]) -> float:
    pace_factor = TEAM_PACE.get(driver["team"], 1.04)
    form_avg = sum(recent_form) / len(recent_form) if recent_form else 10.0
    random.seed(hash(driver["code"] + circuit_id))
    circuit_factor = random.uniform(0.8, 1.2)
    random.seed()
    return 0.40 * quali_pos + 0.25 * (pace_factor - 1.0) * 200 + 0.20 * form_avg + 0.15 * circuit_factor * 10


@app.get("/api/predictor/race")
async def predict_race(circuit_id: str = "bahrain", weather: str = "dry"):
    if circuit_id not in CIRCUIT_INCIDENTS:
        circuit_id = "bahrain"
    incidents = CIRCUIT_INCIDENTS[circuit_id]
    weather_mult = 1.3 if weather == "wet" else 1.0

    form: Dict[str, List[int]] = {d["code"]: [] for d in DRIVERS_2025}
    async with httpx.AsyncClient() as client:
        ergast_data = await fetch_json(client, f"{ERGAST_BASE}/2024/results.json", {"limit": 100})
    if ergast_data:
        try:
            for race in ergast_data["MRData"]["RaceTable"]["Races"][-5:]:
                for result in race.get("Results", []):
                    code = result.get("Driver", {}).get("code", "")
                    if code in form:
                        form[code].append(int(result.get("position", 10)))
        except Exception:
            pass

    random.seed(hash(circuit_id + "quali"))
    quali_order = list(range(1, 21))
    random.shuffle(quali_order)
    random.seed()

    preds = []
    for i, driver in enumerate(DRIVERS_2025):
        q_pos = quali_order[i]
        score = driver_score(driver, q_pos, circuit_id, form.get(driver["code"], [10]*5))
        if weather == "wet":
            score += random.gauss(0, 3)
        crash = DRIVER_CRASH_PROB.get(driver["code"], 0.10) * weather_mult
        preds.append({"driver": driver, "quali_pos": q_pos, "score": score, "crash": crash})

    preds.sort(key=lambda x: x["score"])
    results = []
    for rank, p in enumerate(preds, 1):
        conf = min(95, round(max(20, 95 - rank * 3.5 - abs(p["quali_pos"] - rank) * 2) + random.gauss(0, 3), 1))
        results.append({
            "predicted_position": rank,
            "driver_code": p["driver"]["code"],
            "driver_name": p["driver"]["name"],
            "team": p["driver"]["team"],
            "quali_position": p["quali_pos"],
            "confidence_pct": conf,
            "crash_probability_pct": round(min(0.99, p["crash"]) * 100, 1),
            "score": round(p["score"], 3),
        })

    return {
        "circuit": circuit_id, "weather": weather, "predictions": results,
        "incident_probabilities": {
            "safety_car":  round(incidents["sc"]       * weather_mult * 100, 1),
            "virtual_sc":  round(incidents["vsc"]      * weather_mult * 100, 1),
            "red_flag":    round(incidents["red_flag"] * weather_mult * 100, 1),
        },
        "podium": [r["driver_name"] for r in results[:3]],
    }


# ---------------------------------------------------------------------------
# Fantasy F1
# ---------------------------------------------------------------------------

def calc_fantasy(driver_code: str, circuit_id: str) -> Dict:
    base = DRIVER_AVG_FANTASY_PTS.get(driver_code, 15.0)
    random.seed(hash(driver_code + circuit_id + "fantasy"))
    adj = random.uniform(0.85, 1.15)
    random.seed()
    return {"predicted_points": round(base * adj, 1), "avg_points": base}


@app.get("/api/fantasy/team")
async def get_optimal_fantasy_team(circuit_id: str = "bahrain", budget: float = 100.0):
    driver_scores = []
    for d in DRIVERS_2025:
        pts = calc_fantasy(d["code"], circuit_id)
        ppm = pts["predicted_points"] / d["price"] if d["price"] > 0 else 0
        driver_scores.append({**d, **pts, "pts_per_million": round(ppm, 2)})
    driver_scores.sort(key=lambda x: -x["pts_per_million"])

    picked: List[Dict] = []
    remaining = budget
    used_teams: Dict[str, int] = {}
    for d in driver_scores:
        if len(picked) >= 5:
            break
        tc = used_teams.get(d["team"], 0)
        if tc >= 2 or d["price"] > remaining - 8.0:
            continue
        picked.append(d)
        remaining -= d["price"]
        used_teams[d["team"]] = tc + 1

    con_scores = []
    for c in CONSTRUCTORS_2025:
        avg = CONSTRUCTOR_AVG_FANTASY_PTS.get(c["name"], 20.0)
        random.seed(hash(c["name"] + circuit_id))
        pts = round(avg * random.uniform(0.9, 1.1), 1)
        random.seed()
        con_scores.append({**c, "predicted_points": pts, "avg_points": avg, "pts_per_million": round(pts / c["price"], 2)})
    con_scores.sort(key=lambda x: -x["pts_per_million"])

    sel_con = next((c for c in con_scores if c["price"] <= remaining), con_scores[-1])
    captain = max(picked, key=lambda x: x["predicted_points"]) if picked else None

    total_pts = sum(d["predicted_points"] * (2 if captain and d["code"] == captain["code"] else 1) for d in picked)
    total_pts += sel_con["predicted_points"]
    total_cost = sum(d["price"] for d in picked) + sel_con["price"]

    return {
        "circuit": circuit_id, "budget": budget,
        "total_cost": round(total_cost, 1), "budget_remaining": round(budget - total_cost, 1),
        "drivers": picked, "constructor": sel_con, "captain": captain,
        "total_predicted_points": round(total_pts, 1),
        "reasoning": f"Top value picks by pts/$M. Captain {captain['name'] if captain else 'N/A'} earns 2x multiplier.",
    }


@app.get("/api/fantasy/drivers")
async def get_fantasy_drivers(circuit_id: str = "bahrain"):
    result = []
    for d in DRIVERS_2025:
        pts = calc_fantasy(d["code"], circuit_id)
        ppm = pts["predicted_points"] / d["price"] if d["price"] > 0 else 0
        result.append({**d, **pts, "pts_per_million": round(ppm, 2)})
    result.sort(key=lambda x: -x["pts_per_million"])
    return result


@app.get("/api/fantasy/constructors")
async def get_fantasy_constructors(circuit_id: str = "bahrain"):
    result = []
    for c in CONSTRUCTORS_2025:
        avg = CONSTRUCTOR_AVG_FANTASY_PTS.get(c["name"], 20.0)
        random.seed(hash(c["name"] + circuit_id + "con"))
        pts = round(avg * random.uniform(0.9, 1.1), 1)
        random.seed()
        result.append({**c, "predicted_points": pts, "avg_points": avg, "pts_per_million": round(pts / c["price"], 2)})
    result.sort(key=lambda x: -x["pts_per_million"])
    return result


@app.get("/api/ergast/standings/{year}")
async def get_driver_standings(year: int):
    async with httpx.AsyncClient() as client:
        data = await fetch_json(client, f"{ERGAST_BASE}/{year}/driverStandings.json")
        if data:
            try:
                return data["MRData"]["StandingsTable"]["StandingsLists"][0]["DriverStandings"]
            except Exception:
                pass
    return []


@app.get("/api/ergast/results/{year}/{round_num}")
async def get_race_results(year: int, round_num: int):
    async with httpx.AsyncClient() as client:
        data = await fetch_json(client, f"{ERGAST_BASE}/{year}/{round_num}/results.json")
        if data:
            try:
                return data["MRData"]["RaceTable"]["Races"][0]
            except Exception:
                pass
    return {}


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
