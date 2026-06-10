"""
F1 Telemetry Dashboard - FastAPI Backend
Uses OpenF1 API, Ergast API, and FastF1 library
"""

import datetime
import hashlib
import math
import random
import time
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
# Ergast (ergast.com) is deprecated and now 301-redirects; Jolpica is the
# maintained drop-in successor with the same response schema.
ERGAST_BASE = "https://api.jolpi.ca/ergast/f1"


async def fetch_json(client: httpx.AsyncClient, url: str, params: Dict = None,
                     retries: int = 3) -> Any:
    """GET JSON, following redirects and backing off on 429 rate limits."""
    import asyncio
    for attempt in range(retries):
        try:
            r = await client.get(url, params=params, timeout=20, follow_redirects=True)
            if r.status_code == 429 and attempt < retries - 1:
                await asyncio.sleep(0.6 * (attempt + 1))
                continue
            r.raise_for_status()
            return r.json()
        except httpx.HTTPStatusError as e:
            if e.response is not None and e.response.status_code == 429 and attempt < retries - 1:
                await asyncio.sleep(0.6 * (attempt + 1))
                continue
            print(f"[FETCH ERROR] {url}: {e}")
            return None
        except Exception as e:
            print(f"[FETCH ERROR] {url}: {e}")
            return None
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

PRICE_BY_CODE = {d["code"]: d["price"] for d in DRIVERS_2025}

# OpenF1 team names ("Red Bull Racing", "Kick Sauber", ...) -> canonical names
# used by TEAM_PACE, the price tables, and the frontend team badges.
TEAM_ALIASES = {
    "red bull": "Red Bull", "racing bulls": "Racing Bulls", "rb": "Racing Bulls",
    "visa cash app": "Racing Bulls", "mclaren": "McLaren", "ferrari": "Ferrari",
    "mercedes": "Mercedes", "aston martin": "Aston Martin", "williams": "Williams",
    "alpine": "Alpine", "haas": "Haas", "kick sauber": "Sauber", "sauber": "Sauber",
    "audi": "Audi", "cadillac": "Cadillac",
}


def canonical_team(name: Optional[str]) -> str:
    n = (name or "").lower().strip()
    # check multi-word aliases first (e.g. "racing bulls" before "rb")
    for key in sorted(TEAM_ALIASES, key=len, reverse=True):
        if key in n:
            return TEAM_ALIASES[key]
    return name or "Unknown"


def normalize_drivers(raw: List[Dict]) -> List[Dict]:
    """Map OpenF1's /drivers schema (name_acronym, full_name, team_name,
    driver_number) into the schema the frontend expects (code, name, team,
    number, price). De-dupes by driver number."""
    out: List[Dict] = []
    seen = set()
    for d in raw:
        num = d.get("driver_number")
        if num is None or num in seen:
            continue
        seen.add(num)
        code = (d.get("name_acronym")
                or (d.get("last_name") or d.get("full_name") or "").strip()[:3].upper()
                or str(num))
        name = (d.get("full_name")
                or f"{d.get('first_name', '')} {d.get('last_name', '')}".strip()
                or code)
        out.append({
            "code": code,
            "name": name.title() if name.isupper() else name,
            "team": canonical_team(d.get("team_name")),
            "team_colour": (f"#{d['team_colour']}" if d.get("team_colour") else None),
            "number": num,
            "price": PRICE_BY_CODE.get(code, 5.0),
        })
    return out


def _to_float(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


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
                drivers = normalize_drivers(data)
                if drivers:
                    return drivers
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
        pos_data = await fetch_json(client, f"{OPENF1_BASE}/position", {"session_key": session_key})
        itv_data = await fetch_json(client, f"{OPENF1_BASE}/intervals", {"session_key": session_key})
    if pos_data:
        # /position is time-ordered; the last entry per driver is the latest standing
        latest_pos: Dict[int, int] = {}
        for p in pos_data:
            dn = p.get("driver_number")
            if dn is not None and p.get("position") is not None:
                latest_pos[dn] = p["position"]
        latest_gap: Dict[int, Dict] = {}
        for x in (itv_data or []):
            dn = x.get("driver_number")
            if dn is not None:
                latest_gap[dn] = x
        result = [{
            "driver_number": dn,
            "position": position,
            "gap_to_leader": _to_float(latest_gap.get(dn, {}).get("gap_to_leader")),
            "interval": _to_float(latest_gap.get(dn, {}).get("interval")),
        } for dn, position in latest_pos.items()]
        result.sort(key=lambda r: r["position"])
        if result:
            return result
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


# Real circuit geometry from the open f1-circuits dataset (LineString lon/lat
# per track). Fetched once and cached in memory.
F1_CIRCUITS_URL = "https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson"
_CIRCUITS_CACHE: Optional[Dict] = None
# circuit_id -> substring to match against the dataset's Name/Location
CIRCUIT_NAME_HINTS = {
    "bahrain": "bahrain", "jeddah": "jedda", "melbourne": "albert park",
    "miami": "miami", "monaco": "monaco", "silverstone": "silverstone",
    "spa": "spa", "monza": "monza", "suzuka": "suzuka", "interlagos": "interlagos",
}


async def _load_circuit_geojson(client: httpx.AsyncClient) -> Dict:
    global _CIRCUITS_CACHE
    if _CIRCUITS_CACHE is None:
        data = await fetch_json(client, F1_CIRCUITS_URL)
        _CIRCUITS_CACHE = data or {}
    return _CIRCUITS_CACHE


def _circuit_outline_from_geojson(geo: Dict, circuit_id: str) -> Optional[List[Dict]]:
    hint = CIRCUIT_NAME_HINTS.get(circuit_id, circuit_id).lower().strip()
    generic = {"circuit", "international", "autodrome", "autodromo", "grand", "prix",
               "speedway", "park", "street", "racing", "course", "raceway", "city"}
    tokens = [t for t in hint.split() if len(t) > 3 and t not in generic]
    for feat in geo.get("features", []):
        props = feat.get("properties", {})
        label = f"{props.get('Name', '')} {props.get('Location', '')}".lower()
        if hint and (hint in label or any(t in label for t in tokens)):
            geom = feat.get("geometry", {})
            coords = geom.get("coordinates", [])
            if geom.get("type") == "MultiLineString":
                coords = max(coords, key=len) if coords else []
            if not coords or not isinstance(coords[0], (list, tuple)):
                continue
            lat0 = coords[0][1]
            # equirectangular projection: compress longitude by cos(latitude)
            raw = [{"x": c[0] * math.cos(math.radians(lat0)), "y": c[1]} for c in coords]
            if len(raw) > 20:
                return _normalize_points(raw)
    return None


@app.get("/api/track_outline")
async def get_track_outline(session_key: Optional[int] = None,
                            driver_number: Optional[int] = None,
                            circuit_id: str = "bahrain"):
    """Circuit outline, best source first: (1) real OpenF1 /location telemetry
    trace for the session, (2) real geometry from the f1-circuits dataset for
    the chosen circuit, (3) a generated circuit-like curve. Points are
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
    # real circuit geometry from the open dataset
    async with httpx.AsyncClient() as client:
        geo = await _load_circuit_geojson(client)
    real = _circuit_outline_from_geojson(geo, circuit_id) if geo else None
    if real:
        return {"source": "circuit", "circuit_id": circuit_id,
                "viewBox": "0 0 1000 1000", "points": real}
    return {"source": "generated", "circuit_id": circuit_id,
            "viewBox": "0 0 1000 1000", "points": _mock_outline(circuit_id)}


# ---------------------------------------------------------------------------
# Lap-by-lap replay (real car positions from /location)
# ---------------------------------------------------------------------------

def _fit_transform(points: List[Dict], pad: float = 50.0, span: float = 1000.0):
    """Build a transform that fits `points` into a square viewBox; reusable so
    the outline and every car use the same coordinate mapping."""
    xs = [p["x"] for p in points]
    ys = [p["y"] for p in points]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    w = max(maxx - minx, 1.0)
    h = max(maxy - miny, 1.0)
    scale = (span - 2 * pad) / max(w, h)
    ox = pad + (span - 2 * pad - w * scale) / 2
    oy = pad + (span - 2 * pad - h * scale) / 2

    def tf(x: float, y: float):
        return (round(ox + (x - minx) * scale, 1), round(span - (oy + (y - miny) * scale), 1))
    return tf


def _parse_dt(s: str) -> Optional[datetime.datetime]:
    try:
        return datetime.datetime.fromisoformat(s)
    except (TypeError, ValueError):
        return None


async def _reference_laps(client: httpx.AsyncClient, session_key: int):
    """Return (reference_driver_number, ordered lap list) where the reference is
    the driver who completed the most laps (the leader/finisher)."""
    laps = await fetch_json(client, f"{OPENF1_BASE}/laps", {"session_key": session_key})
    if not laps:
        return None, []
    by_drv: Dict[int, List[Dict]] = {}
    for l in laps:
        dn = l.get("driver_number")
        if dn is not None and l.get("date_start"):
            by_drv.setdefault(dn, []).append(l)
    if not by_drv:
        return None, []
    for dn in by_drv:
        by_drv[dn].sort(key=lambda x: x.get("lap_number", 0))
    ref = max(by_drv, key=lambda dn: len(by_drv[dn]))
    return ref, by_drv[ref]


@app.get("/api/replay_meta")
async def get_replay_meta(session_key: int):
    """Lightweight: how many laps can be replayed for this session."""
    async with httpx.AsyncClient() as client:
        ref, ref_laps = await _reference_laps(client, session_key)
    return {"session_key": session_key, "total_laps": len(ref_laps),
            "has_replay": len(ref_laps) > 0}


@app.get("/api/replay")
async def get_replay(session_key: int, lap: int = 1):
    """Real car positions for one lap of a session. Uses the reference driver's
    lap window to bound time, fetches every car's /location in that window, and
    returns the outline (the reference racing line) plus per-car position samples
    with a normalized time t in 0..1. All share one coordinate transform."""
    async with httpx.AsyncClient() as client:
        ref, ref_laps = await _reference_laps(client, session_key)
        if not ref_laps:
            return {"source": "none", "lap": 0, "total_laps": 0,
                    "viewBox": "0 0 1000 1000", "outline": [], "cars": []}
        total = len(ref_laps)
        lap = max(1, min(total, lap))
        idx = {l["lap_number"]: i for i, l in enumerate(ref_laps)}
        i = idx.get(lap, lap - 1)
        cur = ref_laps[i]
        start = _parse_dt(cur.get("date_start"))
        if start is None:
            return {"source": "none", "lap": lap, "total_laps": total,
                    "viewBox": "0 0 1000 1000", "outline": [], "cars": []}
        if i + 1 < len(ref_laps) and ref_laps[i + 1].get("date_start"):
            end = _parse_dt(ref_laps[i + 1]["date_start"])
        else:
            end = start + datetime.timedelta(seconds=(cur.get("lap_duration") or 110))
        # OpenF1 date filters: drop tz/fraction (a '+' in a query breaks it)
        s_iso = start.strftime("%Y-%m-%dT%H:%M:%S")
        e_iso = end.strftime("%Y-%m-%dT%H:%M:%S")
        url = (f"{OPENF1_BASE}/location?session_key={session_key}"
               f"&date%3E={s_iso}&date%3C={e_iso}")
        loc = await fetch_json(client, url)
        drv = await fetch_json(client, f"{OPENF1_BASE}/drivers", {"session_key": session_key})
        pit = await fetch_json(client, f"{OPENF1_BASE}/pit", {"session_key": session_key})

    if not loc:
        return {"source": "none", "lap": lap, "total_laps": total,
                "viewBox": "0 0 1000 1000", "outline": [], "cars": [], "pits": []}

    info = {d["number"]: d for d in (normalize_drivers(drv) if drv else [])}
    span_s = max((end - start).total_seconds(), 1.0)

    # pit stops occurring during this lap window -> normalized time t in 0..1
    pits = []
    for p in (pit or []):
        dt = _parse_dt(p.get("date"))
        dn = p.get("driver_number")
        if dt is None or dn is None or not (start <= dt <= end):
            continue
        pits.append({
            "driver_number": dn,
            "code": info.get(dn, {}).get("code", str(dn)),
            "team": info.get(dn, {}).get("team", "Unknown"),
            "t": round((dt - start).total_seconds() / span_s, 4),
            "duration": p.get("pit_duration"),
        })

    by_drv: Dict[int, List[Dict]] = {}
    for p in loc:
        dn = p.get("driver_number")
        if dn is None or p.get("x") is None:
            continue
        if p["x"] == 0 and p["y"] == 0:
            continue
        dt = _parse_dt(p.get("date"))
        if dt is None:
            continue
        by_drv.setdefault(dn, []).append(
            {"x": p["x"], "y": p["y"], "t": (dt - start).total_seconds() / span_s})
    for dn in by_drv:
        by_drv[dn].sort(key=lambda q: q["t"])

    # outline + shared transform from the reference driver's lap (the racing line)
    ref_pts = by_drv.get(ref) or max(by_drv.values(), key=len)
    tf = _fit_transform(ref_pts)

    def _downsample(seq, n=120):
        if len(seq) <= n:
            return seq
        step = len(seq) / n
        return [seq[int(k * step)] for k in range(n)]

    outline = [{"x": tf(p["x"], p["y"])[0], "y": tf(p["x"], p["y"])[1]} for p in _downsample(ref_pts, 200)]
    cars = []
    for dn, seq in by_drv.items():
        ds = _downsample(seq, 120)
        samples = [{"x": tf(p["x"], p["y"])[0], "y": tf(p["x"], p["y"])[1],
                    "t": round(p["t"], 4)} for p in ds]
        meta = info.get(dn, {})
        cars.append({"driver_number": dn, "code": meta.get("code", str(dn)),
                     "team": meta.get("team", "Unknown"), "samples": samples})
    return {"source": "telemetry", "lap": lap, "total_laps": total,
            "viewBox": "0 0 1000 1000", "outline": outline, "cars": cars, "pits": pits}


# ---------------------------------------------------------------------------
# Race Predictor
# ---------------------------------------------------------------------------

def _stable_unit(s: str) -> float:
    """Deterministic 0..1 value from a string (replaces reseeding random)."""
    return (int(hashlib.md5(s.encode()).hexdigest()[:8], 16) % 10000) / 10000.0


def _match_circuit(name: Optional[str]) -> str:
    n = (name or "").lower()
    for cid, hint in CIRCUIT_NAME_HINTS.items():
        if (hint and hint in n) or cid in n:
            return cid
    return "bahrain"


async def _real_grid(client: httpx.AsyncClient, session_key: int,
                     meeting_key: Optional[int] = None) -> Dict[int, int]:
    """Real starting grid for a race session: prefer /starting_grid, then fall
    back to the qualifying session's final classification."""
    grid: Dict[int, int] = {}
    sg = await fetch_json(client, f"{OPENF1_BASE}/starting_grid", {"session_key": session_key})
    for g in (sg or []):
        dn, pos = g.get("driver_number"), g.get("position")
        if dn is not None and pos is not None:
            grid[dn] = pos
    if grid:
        return grid
    if meeting_key:
        siblings = await fetch_json(client, f"{OPENF1_BASE}/sessions", {"meeting_key": meeting_key})
        qkey = next((s.get("session_key") for s in (siblings or [])
                     if "Qualifying" in (s.get("session_name") or "")), None)
        if qkey:
            qpos = await fetch_json(client, f"{OPENF1_BASE}/position", {"session_key": qkey})
            for p in (qpos or []):
                dn, pos = p.get("driver_number"), p.get("position")
                if dn is not None and pos is not None:
                    grid[dn] = pos  # time-ordered, last wins = final quali order
    return grid


@app.get("/api/predictor/race")
async def predict_race(circuit_id: str = "bahrain", weather: str = "dry",
                       session_key: Optional[int] = None):
    """Predict the finishing order. When a session_key is given, the prediction
    is grounded in that race's real starting grid (or qualifying result) and the
    actual entry list; otherwise it builds a deterministic grid from team pace.
    Scoring blends grid position, team pace, recent form and a circuit factor."""
    weather_mult = 1.3 if weather == "wet" else 1.0
    drivers = DRIVERS_2025
    grid: Dict[int, int] = {}
    grid_source = "model"

    async with httpx.AsyncClient() as client:
        if session_key:
            sess = await fetch_json(client, f"{OPENF1_BASE}/sessions", {"session_key": session_key})
            meeting_key = sess[0].get("meeting_key") if sess else None
            if sess:
                circuit_id = _match_circuit(sess[0].get("circuit_short_name"))
            dr = await fetch_json(client, f"{OPENF1_BASE}/drivers", {"session_key": session_key})
            nd = normalize_drivers(dr) if dr else []
            if nd:
                drivers = nd
            grid = await _real_grid(client, session_key, meeting_key)
            if grid:
                grid_source = "qualifying"
        # recent form: finishing positions over the last 5 races of the prior season
        form: Dict[str, List[int]] = {}
        ergast = await fetch_json(client, f"{ERGAST_BASE}/{CURRENT_YEAR - 1}/results.json", {"limit": 500})
        if ergast:
            try:
                for race in ergast["MRData"]["RaceTable"]["Races"][-5:]:
                    for res in race.get("Results", []):
                        code = res.get("Driver", {}).get("code", "")
                        if code:
                            form.setdefault(code, []).append(int(res.get("position", 10)))
            except Exception:
                pass

    if circuit_id not in CIRCUIT_INCIDENTS:
        circuit_id = "bahrain"
    incidents = CIRCUIT_INCIDENTS[circuit_id]
    n = len(drivers)

    # No real grid (e.g. future race): synthesize a deterministic one from pace
    if not grid:
        pace_sorted = sorted(
            drivers, key=lambda d: (TEAM_PACE.get(d["team"], 1.045), _stable_unit(d["code"] + circuit_id)))
        grid = {d["number"]: i + 1 for i, d in enumerate(pace_sorted)}

    preds = []
    for d in drivers:
        q = grid.get(d["number"], n)
        pace = TEAM_PACE.get(d["team"], 1.045)
        form_list = form.get(d["code"], [])
        form_avg = sum(form_list) / len(form_list) if form_list else q
        circuit_factor = (_stable_unit(d["code"] + circuit_id) - 0.5) * 2.0  # -1..1
        score = (0.45 * q
                 + 0.25 * ((pace - 1.0) * 250)
                 + 0.20 * form_avg
                 + 0.10 * (q + circuit_factor * 3))
        if weather == "wet":
            score += circuit_factor * 2.5  # wet shuffles the deck, deterministically
        crash = DRIVER_CRASH_PROB.get(d["code"], 0.11) * weather_mult
        preds.append({"driver": d, "quali": int(q), "score": score, "crash": crash})

    preds.sort(key=lambda x: x["score"])
    results = []
    for rank, p in enumerate(preds, 1):
        delta = abs(p["quali"] - rank)
        conf = round(max(20.0, min(96.0, 96 - rank * 2.8 - delta * 2.5)), 1)
        results.append({
            "predicted_position": rank,
            "driver_code": p["driver"]["code"],
            "driver_name": p["driver"]["name"],
            "team": p["driver"]["team"],
            "quali_position": p["quali"],
            "confidence_pct": conf,
            "crash_probability_pct": round(min(0.99, p["crash"]) * 100, 1),
            "score": round(p["score"], 3),
        })

    return {
        "circuit": circuit_id, "weather": weather, "grid_source": grid_source,
        "predictions": results,
        "incident_probabilities": {
            "safety_car":  round(min(99, incidents["sc"]       * weather_mult * 100), 1),
            "virtual_sc":  round(min(99, incidents["vsc"]      * weather_mult * 100), 1),
            "red_flag":    round(min(99, incidents["red_flag"] * weather_mult * 100), 1),
        },
        "podium": [r["driver_name"] for r in results[:3]],
    }


# ---------------------------------------------------------------------------
# Fantasy F1
# ---------------------------------------------------------------------------

FINISH_PTS = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}
_FANTASY_CACHE: Dict[str, Any] = {"ts": 0.0, "by_code": None, "season": None}


def _fantasy_points_for_result(res: Dict) -> float:
    """Approximate official F1 Fantasy driver points for a single race result:
    race-finish points, +/-1 per position gained/lost vs grid, fastest lap,
    classified-finish bonus, DNF penalty."""
    try:
        finish = int(res.get("position", 20))
    except (TypeError, ValueError):
        finish = 20
    try:
        grid = int(res.get("grid", 0) or 0)
    except (TypeError, ValueError):
        grid = 0
    pts = float(FINISH_PTS.get(finish, 0))
    if grid > 0:
        pts += max(-10.0, min(10.0, grid - finish))  # cap position swing at +/-10
    if str(res.get("FastestLap", {}).get("rank")) == "1":
        pts += 10
    status = res.get("status", "")
    if status == "Finished" or status.startswith("+"):
        pts += 2  # classified-finish bonus
    else:
        pts -= 10  # DNF / not classified
    return max(-12.0, pts)


async def _compute_fantasy_form(client: httpx.AsyncClient):
    """Real F1-Fantasy points per driver code over the last up-to-5 races of the
    most recent season with data. Cached ~10 min. Returns (by_code, season)."""
    now = time.time()
    if _FANTASY_CACHE["by_code"] and now - _FANTASY_CACHE["ts"] < 600:
        return _FANTASY_CACHE["by_code"], _FANTASY_CACHE["season"]
    for year in (CURRENT_YEAR, CURRENT_YEAR - 1):
        sched = await fetch_json(client, f"{ERGAST_BASE}/{year}.json", {"limit": 100})
        try:
            rounds = [int(r["round"]) for r in sched["MRData"]["RaceTable"]["Races"]]
        except Exception:
            rounds = []
        if not rounds:
            continue
        by_code: Dict[str, List[float]] = {}
        for rnd in rounds[-5:]:
            data = await fetch_json(client, f"{ERGAST_BASE}/{year}/{rnd}/results.json")
            try:
                results = data["MRData"]["RaceTable"]["Races"][0]["Results"]
            except Exception:
                continue
            for res in results:
                code = res.get("Driver", {}).get("code")
                if code:
                    by_code.setdefault(code, []).append(_fantasy_points_for_result(res))
        if by_code:
            _FANTASY_CACHE.update(ts=now, by_code=by_code, season=year)
            return by_code, year
    return {}, None


async def _fantasy_driver_rows(circuit_id: str, session_key: Optional[int]):
    """Per-driver fantasy rows from the live entry list and real recent form."""
    async with httpx.AsyncClient() as client:
        drivers = DRIVERS_2025
        if session_key:
            dr = await fetch_json(client, f"{OPENF1_BASE}/drivers", {"session_key": session_key})
            nd = normalize_drivers(dr) if dr else []
            if nd:
                drivers = nd
        form, season = await _compute_fantasy_form(client)

    rows = []
    for d in drivers:
        hist = form.get(d["code"], [])
        if hist:
            avg = sum(hist) / len(hist)
            # recency weight: most recent race counts double
            pred = (sum(hist) + hist[-1]) / (len(hist) + 1)
        elif d["code"] in DRIVER_AVG_FANTASY_PTS:
            avg = DRIVER_AVG_FANTASY_PTS[d["code"]]
            pred = avg * (0.9 + _stable_unit(d["code"] + circuit_id) * 0.3)
        else:
            # newcomer / rookie with no race history: estimate from team strength
            # (per-driver share of the constructor's typical points) so they don't
            # look like artificially cheap value picks
            team_pts = CONSTRUCTOR_AVG_FANTASY_PTS.get(d["team"], 12.0)
            avg = team_pts / 2.0
            pred = avg * (0.85 + _stable_unit(d["code"] + circuit_id) * 0.3)
        # price: known driver price, else estimate from team tier (no public API)
        if d["code"] in PRICE_BY_CODE:
            price = PRICE_BY_CODE[d["code"]]
        else:
            team_pts = CONSTRUCTOR_AVG_FANTASY_PTS.get(d["team"], 12.0)
            price = round(max(5.0, min(30.0, team_pts / 3.2)), 1)
        ppm = pred / price if price > 0 else 0
        rows.append({
            "code": d["code"], "name": d["name"], "team": d["team"], "number": d["number"],
            "price": round(price, 1), "avg_points": round(avg, 1),
            "predicted_points": round(pred, 1), "pts_per_million": round(ppm, 2),
        })
    return rows, season


def _constructor_rows(driver_rows: List[Dict]) -> List[Dict]:
    """Aggregate driver fantasy points by team into constructor rows."""
    price_by_team = {c["name"]: c["price"] for c in CONSTRUCTORS_2025}
    agg: Dict[str, Dict[str, float]] = {}
    for r in driver_rows:
        a = agg.setdefault(r["team"], {"pred": 0.0, "avg": 0.0})
        a["pred"] += r["predicted_points"]
        a["avg"] += r["avg_points"]
    out = []
    for name, a in agg.items():
        price = price_by_team.get(name, 10.0)
        pred = round(a["pred"], 1)
        out.append({"name": name, "price": price, "predicted_points": pred,
                    "avg_points": round(a["avg"], 1),
                    "pts_per_million": round(pred / price, 2) if price > 0 else 0})
    out.sort(key=lambda x: -x["pts_per_million"])
    return out


@app.get("/api/fantasy/team")
async def get_optimal_fantasy_team(circuit_id: str = "bahrain", budget: float = 100.0,
                                   session_key: Optional[int] = None):
    rows, season = await _fantasy_driver_rows(circuit_id, session_key)
    con_scores = _constructor_rows(rows)
    min_driver = min((r["price"] for r in rows), default=5.0)
    min_con = min((c["price"] for c in con_scores), default=6.0)

    # Maximize predicted points within the budget (greedy by points, keeping a
    # reserve so the remaining driver slots + a constructor stay affordable, and
    # at most 2 drivers per team), rather than pure value — which would hoard
    # budget on cheap enablers.
    by_points = sorted(rows, key=lambda x: -x["predicted_points"])
    picked: List[Dict] = []
    remaining = budget
    used_teams: Dict[str, int] = {}
    for d in by_points:
        if len(picked) >= 5:
            break
        if used_teams.get(d["team"], 0) >= 2:
            continue
        slots_after = 5 - len(picked) - 1
        reserve = min_driver * slots_after + min_con
        if d["price"] <= remaining - reserve:
            picked.append(d)
            remaining -= d["price"]
            used_teams[d["team"]] = used_teams.get(d["team"], 0) + 1
    # fill any leftover slots with the cheapest feasible drivers
    if len(picked) < 5:
        for d in sorted(rows, key=lambda x: x["price"]):
            if len(picked) >= 5:
                break
            if d in picked or used_teams.get(d["team"], 0) >= 2:
                continue
            if d["price"] <= remaining - min_con:
                picked.append(d)
                remaining -= d["price"]
                used_teams[d["team"]] = used_teams.get(d["team"], 0) + 1

    # constructor: most points that still fits the remaining budget
    affordable_con = [c for c in con_scores if c["price"] <= remaining]
    sel_con = (max(affordable_con, key=lambda c: c["predicted_points"])
               if affordable_con else (min(con_scores, key=lambda c: c["price"]) if con_scores else None))
    captain = max(picked, key=lambda x: x["predicted_points"]) if picked else None

    total_pts = sum(d["predicted_points"] * (2 if captain and d["code"] == captain["code"] else 1) for d in picked)
    total_cost = sum(d["price"] for d in picked)
    if sel_con:
        total_pts += sel_con["predicted_points"]
        total_cost += sel_con["price"]

    src = f"real {season} form" if season else "model estimates"
    return {
        "circuit": circuit_id, "budget": budget,
        "total_cost": round(total_cost, 1), "budget_remaining": round(budget - total_cost, 1),
        "drivers": picked, "constructor": sel_con, "captain": captain,
        "total_predicted_points": round(total_pts, 1),
        "reasoning": (f"Best value (pts/$M) within ${budget:.0f}M using {src}; "
                      f"max 2 drivers per team. Captain {captain['name'] if captain else 'N/A'} earns 2x."),
    }


@app.get("/api/fantasy/drivers")
async def get_fantasy_drivers(circuit_id: str = "bahrain", session_key: Optional[int] = None):
    rows, _ = await _fantasy_driver_rows(circuit_id, session_key)
    rows.sort(key=lambda x: -x["pts_per_million"])
    return rows


@app.get("/api/fantasy/constructors")
async def get_fantasy_constructors(circuit_id: str = "bahrain", session_key: Optional[int] = None):
    rows, _ = await _fantasy_driver_rows(circuit_id, session_key)
    return _constructor_rows(rows)


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
