import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, ReferenceLine,
} from 'recharts';
import {
  getSessions, getDrivers, getLaps, getCarData, getStints,
  getWeather, getRaceControl, getPositions, getTrackOutline,
  getReplayMeta, getReplay,
} from '../api/client';
import type { Session, Driver, Lap, CarData, Stint, Weather, RaceControl, Position, TrackOutline, ReplayCar, PitStop } from '../api/client';
import { LoadingSpinner, ErrorMessage } from '../components/LoadingSpinner';
import { TeamBadge, getTeamColor } from '../components/TeamBadge';

const DRIVER_COLORS = ['#e10600','#27F4D2','#FF8000','#3671C6','#E8002D','#FF87BC','#229971','#64C4FF','#6692FF','#B6BABD'];

// canonical ordering of sessions within a weekend (incl. sprint format)
const SESSION_ORDER: Record<string, number> = {
  'Practice 1': 1, 'Practice 2': 2, 'Practice 3': 3,
  'Sprint Qualifying': 4, 'Sprint Shootout': 4, 'Sprint': 5,
  'Qualifying': 6, 'Race': 7,
};
const sessionRank = (s: Session) => SESSION_ORDER[s.session_name] ?? 99;

const MOCK_SESSIONS: Session[] = [
  { session_key: 9574, session_name: 'Race', date_start: '2025-03-16T15:00:00+00:00', circuit_short_name: 'Bahrain', country_name: 'Bahrain', year: 2025, session_type: 'Race' },
  { session_key: 9573, session_name: 'Qualifying', date_start: '2025-03-15T14:00:00+00:00', circuit_short_name: 'Bahrain', country_name: 'Bahrain', year: 2025, session_type: 'Qualifying' },
];

const MOCK_DRIVERS: Driver[] = [
  { code: 'VER', name: 'Max Verstappen', team: 'Red Bull', price: 30.0, number: 1 },
  { code: 'NOR', name: 'Lando Norris', team: 'McLaren', price: 27.5, number: 4 },
  { code: 'LEC', name: 'Charles Leclerc', team: 'Ferrari', price: 25.0, number: 16 },
  { code: 'PIA', name: 'Oscar Piastri', team: 'McLaren', price: 22.0, number: 81 },
  { code: 'HAM', name: 'Lewis Hamilton', team: 'Ferrari', price: 22.5, number: 44 },
  { code: 'RUS', name: 'George Russell', team: 'Mercedes', price: 20.0, number: 63 },
  { code: 'SAI', name: 'Carlos Sainz', team: 'Williams', price: 18.0, number: 55 },
  { code: 'ALO', name: 'Fernando Alonso', team: 'Aston Martin', price: 15.0, number: 14 },
  { code: 'TSU', name: 'Yuki Tsunoda', team: 'Red Bull', price: 14.0, number: 22 },
  { code: 'ALB', name: 'Alexander Albon', team: 'Williams', price: 11.0, number: 23 },
];

function generateMockLaps(driverNum: number): Lap[] {
  return Array.from({ length: 57 }, (_, i) => ({
    lap_number: i + 1, driver_number: driverNum,
    lap_duration: 92 + Math.sin(i * 0.3 + driverNum) * 1.5 + (Math.random() * 0.4 - 0.2),
    duration_sector_1: 29.5, duration_sector_2: 35.2, duration_sector_3: 27.8,
    is_pit_out_lap: [1, 24, 44].includes(i + 1),
  }));
}

function generateMockCarData(): CarData[] {
  return Array.from({ length: 300 }, (_, i) => {
    const t = i / 300;
    const speed = 80 + 200 * Math.abs(Math.sin(t * Math.PI * 6)) + (Math.random() * 10 - 5);
    return {
      date: '', speed: Math.round(Math.min(330, speed)),
      throttle: Math.round(Math.max(0, Math.min(100, 60 + 40 * Math.abs(Math.sin(t * Math.PI * 6))))),
      brake: speed > 270 && Math.cos(t * Math.PI * 6) < -0.3 ? 1 : 0,
      drs: speed > 240 ? 10 : 0, n_gear: Math.min(8, Math.max(1, Math.floor(speed / 42))),
      rpm: Math.round(6000 + (speed / 330) * 8000),
    };
  });
}

const MOCK_STINTS: Stint[] = [
  { driver_number: 1, stint_number: 1, lap_start: 1, lap_end: 23, compound: 'SOFT', tyre_age_at_start: 0 },
  { driver_number: 1, stint_number: 2, lap_start: 24, lap_end: 43, compound: 'MEDIUM', tyre_age_at_start: 0 },
  { driver_number: 1, stint_number: 3, lap_start: 44, lap_end: 57, compound: 'HARD', tyre_age_at_start: 0 },
];

const MOCK_WEATHER: Weather = { air_temperature: 28.5, track_temperature: 42.3, humidity: 35, pressure: 1013.2, wind_speed: 12.4, wind_direction: 245, rainfall: false };

const MOCK_RC: RaceControl[] = [
  { date: '2025-03-16T15:05:00+00:00', message: 'SAFETY CAR DEPLOYED', category: 'SafetyCar', flag: 'SC', lap_number: 12 },
  { date: '2025-03-16T15:10:00+00:00', message: 'SAFETY CAR IN THIS LAP', category: 'SafetyCar', flag: 'SC', lap_number: 15 },
  { date: '2025-03-16T15:40:00+00:00', message: 'CHEQUERED FLAG', category: 'Flag', flag: 'CHEQUERED', lap_number: 57 },
];

// Client-side fallback outline: a winding, circuit-like closed curve seeded by
// the circuit id, used when the backend / live telemetry is unavailable.
function mockOutline(circuitId: string, n = 240): { x: number; y: number }[] {
  let seed = 0;
  for (const c of circuitId) seed += c.charCodeAt(0);
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const a2 = 0.25 + rnd() * 0.2, a3 = 0.1 + rnd() * 0.15;
  const b2 = 0.2 + rnd() * 0.2, b3 = 0.1 + rnd() * 0.12, ph = rnd() * Math.PI;
  const raw = Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    return {
      x: Math.cos(t) + a2 * Math.cos(2 * t + ph) - a3 * Math.sin(3 * t),
      y: Math.sin(t) + b2 * Math.sin(2 * t + ph) + b3 * Math.cos(3 * t),
    };
  });
  const xs = raw.map(p => p.x), ys = raw.map(p => p.y);
  const minx = Math.min(...xs), maxx = Math.max(...xs);
  const miny = Math.min(...ys), maxy = Math.max(...ys);
  const pad = 60, span = 1000;
  const w = Math.max(maxx - minx, 1e-6), h = Math.max(maxy - miny, 1e-6);
  const scale = (span - 2 * pad) / Math.max(w, h);
  const ox = pad + (span - 2 * pad - w * scale) / 2;
  const oy = pad + (span - 2 * pad - h * scale) / 2;
  return raw.map(p => ({
    x: Math.round((ox + (p.x - minx) * scale) * 10) / 10,
    y: Math.round((span - (oy + (p.y - miny) * scale)) * 10) / 10,
  }));
}

function formatLapTime(s: number): string {
  if (!s) return '-';
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3);
  return `${m}:${sec.padStart(6, '0')}`;
}

function CompoundBadge({ compound }: { compound: string }) {
  const cls: Record<string, string> = { SOFT: 'bg-[#e10600] text-white', MEDIUM: 'bg-[#ffd700] text-black', HARD: 'bg-[#e5e5e5] text-black', INTER: 'bg-[#00a651] text-white', WET: 'bg-[#0066cc] text-white' };
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${cls[compound] || 'bg-gray-700 text-white'}`}>{compound[0]}</span>;
}

// Catmull-Rom spline -> smooth SVG path so the track reads like a real circuit
// map instead of a jagged polyline.
function smoothPath(pts: { x: number; y: number }[], closed: boolean): string {
  const n = pts.length;
  if (n < 3) return n ? 'M' + pts.map(p => `${p.x},${p.y}`).join(' L ') : '';
  let d = `M ${pts[0].x},${pts[0].y} `;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x},${p2.y} `;
  }
  return closed ? d + 'Z' : d;
}

// Linear-interpolate a car's position at normalized lap time p (0..1).
function interpAt(samples: { x: number; y: number; t: number }[], p: number) {
  if (samples.length === 0) return null;
  if (p <= samples[0].t) return samples[0];
  const last = samples[samples.length - 1];
  if (p >= last.t) return last;
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i], b = samples[i + 1];
    if (p >= a.t && p <= b.t) {
      const f = (p - a.t) / Math.max(b.t - a.t, 1e-6);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
  }
  return last;
}

function TrackMap({
  outline, replayCars, pits, positions, drivers, selectedDrivers, sourceLabel,
  playing, speed, showSectors, onLapComplete,
}: {
  outline: { x: number; y: number }[]; replayCars?: ReplayCar[]; pits?: PitStop[];
  positions: Position[]; drivers: Driver[]; selectedDrivers: number[];
  sourceLabel: string; playing: boolean; speed: number; showSectors: boolean;
  onLapComplete?: () => void;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const progress = useRef(0);
  const [, force] = useState(0);
  const replay = !!(replayCars && replayCars.length > 0);

  const d = smoothPath(outline, true);

  // Sector-start markers: a perpendicular tick + label where each sector begins
  // (boundaries approximated by splitting the lap into thirds by distance).
  const sectorColors = ['#fb923c', '#38bdf8', '#a78bfa'];
  const sectorLabels = ['S1', 'S2', 'S3'];
  const n = outline.length;
  const sectors = (showSectors && n > 6) ? [0, 1, 2].map(k => {
    const idx = Math.floor((n * k) / 3);
    const p = outline[idx];
    const q = outline[(idx + 1) % n];
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len; // perpendicular to track direction
    const L = 26;
    return {
      x1: p.x - nx * L, y1: p.y - ny * L, x2: p.x + nx * L, y2: p.y + ny * L,
      lx: p.x + nx * (L + 14), ly: p.y + ny * (L + 14),
      color: sectorColors[k], label: sectorLabels[k],
    };
  }) : [];

  // Who is in the pit lane right now (replay): pit events near current lap time,
  // de-duplicated by driver (OpenF1 can emit multiple rows per stop).
  const inPit = Array.from(
    new Map((pits || [])
      .filter(p => Math.abs(progress.current - p.t) < 0.10)
      .map(p => [p.driver_number, p])).values());

  // reset playback to the start of a lap whenever new replay data arrives
  useEffect(() => { progress.current = 0; }, [replayCars]);

  useEffect(() => {
    if (!playing || !d) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const rate = (replay ? 0.085 : 0.04) * speed; // replay ~12s/lap at 1x
      let np = progress.current + dt * rate;
      if (np >= 1) {
        if (replay && onLapComplete) { progress.current = 0; onLapComplete(); }
        else { np %= 1; progress.current = np; }
      } else progress.current = np;
      force(v => (v + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, d, replay, onLapComplete]);

  const path = pathRef.current;
  const total = path ? path.getTotalLength() : 0;

  // orbit fallback ordering (no telemetry): string the field out by running order
  const ordered: { driver_number: number; position: number }[] =
    positions.length > 0
      ? [...positions].sort((a, b) => (a.position || 99) - (b.position || 99))
      : drivers.slice(0, 20).map((d, i) => ({ driver_number: d.number, position: i + 1 }));
  const spread = 0.55;

  return (
    <div className="relative">
      <svg viewBox="0 0 1000 1000" className="w-full" style={{ height: '340px' }}>
        {d && <>
          {/* track bed: dark outer kerb + clean grey surface */}
          <path d={d} ref={pathRef} fill="none" stroke="#000" strokeWidth={40} strokeLinecap="round" strokeLinejoin="round" />
          <path d={d} fill="none" stroke="#4b4b4b" strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" />
          {/* start/finish marker */}
          <path d={d} fill="none" stroke="#e10600" strokeWidth={6} strokeLinecap="round" strokeDasharray="6 400" />
          {/* sector-start indicators */}
          {sectors.map(s => (
            <g key={s.label}>
              <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={4} strokeLinecap="round" />
              <text x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="middle"
                fontSize={15} fontWeight="bold" fill={s.color}>{s.label}</text>
            </g>
          ))}
        </>}

        {/* REPLAY: real car positions interpolated from telemetry */}
        {replay && replayCars!.map(car => {
          const pt = interpAt(car.samples, progress.current);
          if (!pt) return null;
          const color = getTeamColor(car.team);
          const isSel = selectedDrivers.includes(car.driver_number);
          return (
            <g key={car.driver_number} opacity={isSel ? 1 : 0.7}>
              <circle cx={pt.x} cy={pt.y} r={isSel ? 17 : 12} fill={color}
                stroke={isSel ? '#fff' : '#0f0f0f'} strokeWidth={isSel ? 3 : 1.5} />
              <text x={pt.x} y={pt.y - 22} textAnchor="middle" fontSize={isSel ? 24 : 18}
                fill={color} fontWeight="bold">{car.code}</text>
            </g>
          );
        })}

        {/* ORBIT fallback: no telemetry (e.g. future race) */}
        {!replay && total > 0 && ordered.map((pos, idx) => {
          const driver = drivers.find(dr => dr.number === pos.driver_number);
          const offset = ordered.length > 1 ? (idx / ordered.length) * spread : 0;
          const frac = (progress.current - offset + 1) % 1;
          const pt = path!.getPointAtLength(frac * total);
          const color = driver ? getTeamColor(driver.team) : '#888';
          const isSel = selectedDrivers.includes(pos.driver_number);
          return (
            <g key={pos.driver_number} opacity={isSel ? 1 : 0.55}>
              <circle cx={pt.x} cy={pt.y} r={isSel ? 18 : 13} fill={color}
                stroke={isSel ? '#fff' : 'none'} strokeWidth={isSel ? 3 : 0} />
              <text x={pt.x} y={pt.y - 24} textAnchor="middle" fontSize={isSel ? 26 : 20}
                fill={color} fontWeight="bold">{driver?.code || pos.driver_number}</text>
            </g>
          );
        })}
      </svg>
      <div className="absolute top-2 left-2 text-[10px] text-[#6b7280]">{sourceLabel}</div>

      {/* In-pit-lane tracker (replay) */}
      {replay && (
        <div className="absolute bottom-2 right-2 bg-[#0f0f0f]/90 border border-[#2a2a2a] rounded p-2 text-xs min-w-[120px]">
          <div className="text-[10px] text-[#facc15] font-semibold uppercase tracking-wider mb-1">In Pit Lane</div>
          {inPit.length === 0
            ? <div className="text-[#6b7280]">— empty —</div>
            : <div className="flex flex-wrap gap-1">
                {inPit.map(p => (
                  <span key={p.driver_number} className="font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{ color: getTeamColor(p.team), background: '#1a1a1a' }}>{p.code}</span>
                ))}
              </div>}
        </div>
      )}
    </div>
  );
}

// pick a meeting's default session: the Race, else the latest-stage session
function pickDefaultSession(list: Session[]): Session | undefined {
  const race = list.find(s => s.session_name === 'Race');
  return race || [...list].sort((a, b) => sessionRank(b) - sessionRank(a))[0];
}

export function TelemetryTab() {
  const [sessions, setSessions] = useState<Session[]>(MOCK_SESSIONS);
  const [selectedMeeting, setSelectedMeeting] = useState<number | undefined>(undefined);
  const [selectedSession, setSelectedSession] = useState<number>(0);
  const [pits, setPits] = useState<PitStop[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>(MOCK_DRIVERS);
  const [selectedDrivers, setSelectedDrivers] = useState<number[]>([1, 4]);
  const [lapsData, setLapsData] = useState<Record<number, Lap[]>>({});
  const [carData, setCarData] = useState<CarData[]>(generateMockCarData());
  const [stints, setStints] = useState<Stint[]>(MOCK_STINTS);
  const [weather, setWeather] = useState<Weather>(MOCK_WEATHER);
  const [raceControl, setRaceControl] = useState<RaceControl[]>(MOCK_RC);
  const [positions, setPositions] = useState<Position[]>([]);
  const [circuitId, setCircuitId] = useState<string>('bahrain');
  const [outline, setOutline] = useState<{ x: number; y: number }[]>(mockOutline('bahrain'));
  const [trackSource, setTrackSource] = useState<TrackOutline['source']>('generated');
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showSectors, setShowSectors] = useState(true);
  // lap replay
  const [totalLaps, setTotalLaps] = useState(0);
  const [currentLap, setCurrentLap] = useState(1);
  const [replayCars, setReplayCars] = useState<ReplayCar[] | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed mock laps for initial drivers
  useEffect(() => {
    const initial: Record<number, Lap[]> = {};
    [1, 4].forEach(n => { initial[n] = generateMockLaps(n); });
    setLapsData(initial);
    const mockPos = MOCK_DRIVERS.map((d, i) => ({
      driver_number: d.number, position: i + 1,
      gap_to_leader: i === 0 ? 0 : parseFloat((i * 2.1 + Math.random() * 0.5).toFixed(3)),
      interval: i === 0 ? 0 : parseFloat((2.1 + Math.random() * 0.5).toFixed(3)),
    }));
    setPositions(mockPos);
  }, []);

  // Fetch live sessions; auto-select the newest meeting and its Race session.
  useEffect(() => {
    setLoading(true);
    getSessions()
      .then(r => {
        setSessions(r.data);
        if (r.data.length > 0) {
          const mk = r.data[0].meeting_key ?? -1; // newest first
          setSelectedMeeting(mk);
          const def = pickDefaultSession(r.data.filter(s => (s.meeting_key ?? -1) === mk));
          if (def) setSelectedSession(def.session_key);
        }
      })
      .catch(() => setError('Backend not available — showing mock data'))
      .finally(() => setLoading(false));
  }, []);

  const meetings = useMemo(() => {
    const seen = new Set<number>();
    const out: { key: number; label: string }[] = [];
    for (const s of sessions) {
      const mk = s.meeting_key ?? -1;
      if (seen.has(mk)) continue;
      seen.add(mk);
      out.push({ key: mk, label: `${s.country_name} (${s.date_start?.slice(0, 10)})` });
    }
    return out;
  }, [sessions]);

  const meetingSessions = useMemo(
    () => sessions.filter(s => (s.meeting_key ?? -1) === selectedMeeting)
      .sort((a, b) => sessionRank(a) - sessionRank(b)),
    [sessions, selectedMeeting]);

  // Track shape follows the selected session's circuit automatically.
  useEffect(() => {
    const s = sessions.find(x => x.session_key === selectedSession);
    if (s?.circuit_short_name) setCircuitId(s.circuit_short_name.toLowerCase());
  }, [selectedSession, sessions]);

  useEffect(() => {
    if (!selectedSession) return;
    Promise.all([getDrivers(selectedSession), getWeather(selectedSession), getRaceControl(selectedSession), getPositions(selectedSession)])
      .then(([dr, wr, rc, pos]) => {
        setDrivers(dr.data);
        setWeather(wr.data);
        setRaceControl(rc.data);
        setPositions(pos.data);
        setSelectedDrivers(dr.data.slice(0, 2).map((d: Driver) => d.number));
      })
      .catch(() => {});
  }, [selectedSession]);

  useEffect(() => {
    if (!selectedSession || selectedDrivers.length === 0) return;
    selectedDrivers.forEach(dn => {
      if (!lapsData[dn]) {
        getLaps(selectedSession, dn)
          .then(r => setLapsData(prev => ({ ...prev, [dn]: r.data })))
          .catch(() => setLapsData(prev => ({ ...prev, [dn]: generateMockLaps(dn) })));
      }
    });
    getCarData(selectedSession, selectedDrivers[0])
      .then(r => setCarData(r.data))
      .catch(() => setCarData(generateMockCarData()));
    getStints(selectedSession, selectedDrivers[0])
      .then(r => setStints(r.data))
      .catch(() => setStints(MOCK_STINTS));
  }, [selectedSession, selectedDrivers]);

  // Static outline (real circuit geometry or generated) — only when there's no
  // lap replay available; replay provides its own per-lap racing-line outline.
  useEffect(() => {
    if (totalLaps > 0) return;
    getTrackOutline(selectedSession || undefined, circuitId, selectedDrivers[0])
      .then(r => {
        if (r.data.points?.length > 10) {
          setOutline(r.data.points);
          setTrackSource(r.data.source);
        } else {
          setOutline(mockOutline(circuitId));
          setTrackSource('generated');
        }
      })
      .catch(() => { setOutline(mockOutline(circuitId)); setTrackSource('generated'); });
  }, [selectedSession, circuitId, totalLaps]);

  // Is a lap-by-lap replay available for this session?
  useEffect(() => {
    if (!selectedSession) return;
    setReplayCars(undefined); setTotalLaps(0); setCurrentLap(1);
    getReplayMeta(selectedSession)
      .then(r => { if (r.data.has_replay) setTotalLaps(r.data.total_laps); })
      .catch(() => {});
  }, [selectedSession]);

  // Fetch the selected lap's real car positions.
  useEffect(() => {
    if (!selectedSession || totalLaps <= 0) return;
    getReplay(selectedSession, currentLap)
      .then(r => {
        if (r.data.cars?.length) {
          setReplayCars(r.data.cars);
          setPits(r.data.pits || []);
          if (r.data.outline?.length) { setOutline(r.data.outline); setTrackSource('telemetry'); }
        }
      })
      .catch(() => {});
  }, [selectedSession, totalLaps, currentLap]);

  const handleLapComplete = useCallback(() => {
    setCurrentLap(l => (l >= totalLaps ? 1 : l + 1));
  }, [totalLaps]);

  const toggleDriver = useCallback((num: number) => {
    setSelectedDrivers(prev => prev.includes(num) ? prev.filter(d => d !== num) : prev.length < 5 ? [...prev, num] : prev);
  }, []);

  const lapChartData = (() => {
    const maxLaps = Math.max(...selectedDrivers.map(dn => lapsData[dn]?.length || 0), 0);
    return Array.from({ length: maxLaps }, (_, i) => {
      const pt: Record<string, unknown> = { lap: i + 1 };
      selectedDrivers.forEach(dn => {
        const lap = lapsData[dn]?.[i];
        if (lap && !lap.is_pit_out_lap) {
          const d = drivers.find(dr => dr.number === dn);
          pt[d?.code || `D${dn}`] = parseFloat(lap.lap_duration.toFixed(3));
        }
      });
      return pt;
    });
  })();

  const gapData = lapChartData.map(d => {
    const firstD = drivers.find(dr => dr.number === selectedDrivers[0]);
    const base = (d[firstD?.code || `D${selectedDrivers[0]}`] as number) || 0;
    const res: Record<string, unknown> = { lap: d.lap };
    selectedDrivers.slice(1).forEach(dn => {
      const dr = drivers.find(x => x.number === dn);
      const key = dr?.code || `D${dn}`;
      const val = d[key] as number;
      if (val && base) res[key] = parseFloat((val - base).toFixed(3));
    });
    return res;
  });

  return (
    <div className="space-y-4">
      {error && <ErrorMessage message={error} />}

      {/* Controls */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#6b7280] uppercase tracking-wider">Race</label>
          <select className="bg-[#0f0f0f] border border-[#2a2a2a] text-[#e5e5e5] rounded px-3 py-1.5 text-sm max-w-[220px]"
            value={selectedMeeting ?? ''}
            onChange={e => {
              const mk = Number(e.target.value);
              setSelectedMeeting(mk);
              const def = pickDefaultSession(sessions.filter(s => (s.meeting_key ?? -1) === mk));
              if (def) setSelectedSession(def.session_key);
            }}>
            {meetings.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#6b7280] uppercase tracking-wider">Session</label>
          <select className="bg-[#0f0f0f] border border-[#2a2a2a] text-[#e5e5e5] rounded px-3 py-1.5 text-sm"
            value={selectedSession}
            onChange={e => setSelectedSession(Number(e.target.value))}>
            {meetingSessions.map(s => (
              <option key={s.session_key} value={s.session_key}>{s.session_name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4 ml-auto text-xs text-[#6b7280]">
          <span>🌡️ <span className="text-[#e5e5e5]">{weather.air_temperature}°C</span></span>
          <span>🏁 <span className="text-[#e5e5e5]">{weather.track_temperature}°C</span></span>
          <span>💧 <span className="text-[#e5e5e5]">{weather.humidity}%</span></span>
          <span>💨 <span className="text-[#e5e5e5]">{weather.wind_speed}km/h</span></span>
          {weather.rainfall && <span className="text-blue-400 font-bold">RAIN ☔</span>}
        </div>
      </div>

      {loading && <LoadingSpinner />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider">
              Circuit Map {totalLaps > 0 && <span className="text-[#e5e5e5] normal-case">· Lap {currentLap}/{totalLaps}</span>}
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setPlaying(p => !p)}
                className="text-xs px-2 py-0.5 rounded bg-[#0f0f0f] border border-[#2a2a2a] text-[#e5e5e5] hover:border-[#e10600]">
                {playing ? '⏸ Pause' : '▶ Play'}
              </button>
              <button onClick={() => setShowSectors(s => !s)}
                className={`text-xs px-2 py-0.5 rounded bg-[#0f0f0f] border ${showSectors ? 'border-[#e10600] text-[#e5e5e5]' : 'border-[#2a2a2a] text-[#6b7280]'} hover:border-[#e10600]`}>
                Sectors
              </button>
              <select value={speed} onChange={e => setSpeed(Number(e.target.value))}
                className="text-xs bg-[#0f0f0f] border border-[#2a2a2a] text-[#e5e5e5] rounded px-1 py-0.5">
                {[0.5, 1, 2, 4].map(s => <option key={s} value={s}>{s}x</option>)}
              </select>
            </div>
          </div>

          {/* Lap scrubber — replay control for previous sessions */}
          {totalLaps > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setCurrentLap(l => Math.max(1, l - 1))}
                className="text-xs px-2 py-0.5 rounded bg-[#0f0f0f] border border-[#2a2a2a] text-[#e5e5e5] hover:border-[#e10600]">◀</button>
              <input type="range" min={1} max={totalLaps} value={currentLap}
                onChange={e => setCurrentLap(Number(e.target.value))}
                className="flex-1 accent-[#e10600]" />
              <button onClick={() => setCurrentLap(l => Math.min(totalLaps, l + 1))}
                className="text-xs px-2 py-0.5 rounded bg-[#0f0f0f] border border-[#2a2a2a] text-[#e5e5e5] hover:border-[#e10600]">▶</button>
              <span className="text-xs text-[#6b7280] w-16 text-right tabular-nums">Lap {currentLap}/{totalLaps}</span>
            </div>
          )}

          <TrackMap outline={outline} replayCars={replayCars} pits={pits} positions={positions} drivers={drivers}
            selectedDrivers={selectedDrivers} playing={playing} speed={speed} showSectors={showSectors}
            onLapComplete={handleLapComplete}
            sourceLabel={
              replayCars && replayCars.length > 0 ? `Replay · real positions · lap ${currentLap}`
              : trackSource === 'circuit' ? `${circuitId} · real circuit`
              : trackSource === 'telemetry' ? 'Live telemetry trace'
              : `${circuitId} · simulated shape`
            } />
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-3">Drivers <span className="normal-case font-normal">(up to 5)</span></h3>
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {drivers.slice(0, 20).map(d => {
              const isSel = selectedDrivers.includes(d.number);
              const ci = selectedDrivers.indexOf(d.number);
              return (
                <button key={d.number} onClick={() => toggleDriver(d.number)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${isSel ? 'bg-[#0f0f0f] border border-[#2a2a2a]' : 'hover:bg-[#0f0f0f]/50'}`}>
                  <span className="w-3 h-3 rounded-full flex-shrink-0 border border-[#2a2a2a]"
                    style={isSel ? { backgroundColor: DRIVER_COLORS[ci % DRIVER_COLORS.length] } : {}} />
                  <span className="font-mono font-bold text-xs w-8">{d.code}</span>
                  <span className="flex-1 text-left">{d.name}</span>
                  <TeamBadge team={d.team} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-3">Race Control</h3>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {raceControl.map((rc, i) => {
              const fc: Record<string, string> = { SC: 'text-yellow-400', VSC: 'text-yellow-300', RED: 'text-red-500', CHEQUERED: 'text-white' };
              return (
                <div key={i} className="flex gap-2 text-xs border-b border-[#2a2a2a] pb-2">
                  <span className="text-[#6b7280] w-12 flex-shrink-0">{rc.date?.slice(11, 16)}</span>
                  <span className={`font-bold w-20 flex-shrink-0 ${fc[rc.flag] || 'text-[#e5e5e5]'}`}>[{rc.flag}]</span>
                  <span className="text-[#e5e5e5]">{rc.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lap time chart */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-4">Lap Time Comparison</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={lapChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="lap" stroke="#4b5563" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis stroke="#4b5563" tickFormatter={v => formatLapTime(v as number)} width={75} tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6 }} labelStyle={{ color: '#e5e5e5' }}
              formatter={(v: unknown) => [formatLapTime(v as number)]} labelFormatter={l => `Lap ${l}`} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {selectedDrivers.map((dn, idx) => {
              const d = drivers.find(x => x.number === dn);
              return <Line key={dn} type="monotone" dataKey={d?.code || `D${dn}`}
                stroke={DRIVER_COLORS[idx % DRIVER_COLORS.length]} dot={false} strokeWidth={2} connectNulls />;
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-4">Speed Trace (km/h)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={carData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis hide />
              <YAxis domain={[0, 360]} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6 }}
                formatter={(v: unknown) => [`${v} km/h`]} />
              <Area type="monotone" dataKey="speed" stroke="#e10600" fill="#e10600" fillOpacity={0.15} dot={false} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-4">Throttle / Brake</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={carData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis hide />
              <YAxis domain={[0, 110]} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6 }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Line type="monotone" dataKey="throttle" stroke="#22c55e" dot={false} strokeWidth={2} name="Throttle %" />
              <Line type="monotone" dataKey="brake" stroke="#ef4444" dot={false} strokeWidth={2} name="Brake" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-4">Gap to Leader (s)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={gapData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="lap" stroke="#4b5563" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis stroke="#4b5563" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6 }}
              formatter={(v: unknown) => [`+${(v as number).toFixed(3)}s`]} labelFormatter={l => `Lap ${l}`} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#e10600" strokeDasharray="3 3" />
            {selectedDrivers.slice(1).map((dn, idx) => {
              const d = drivers.find(x => x.number === dn);
              return <Line key={dn} type="monotone" dataKey={d?.code || `D${dn}`}
                stroke={DRIVER_COLORS[(idx + 1) % DRIVER_COLORS.length]} dot={false} strokeWidth={2} connectNulls />;
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-3">Tire Strategy</h3>
          <div className="space-y-3">
            {stints.map(stint => {
              const laps = stint.lap_end - stint.lap_start + 1;
              const deg = Math.min(100, Math.round((laps / 30) * 100));
              return (
                <div key={stint.stint_number} className="flex items-center gap-4">
                  <CompoundBadge compound={stint.compound} />
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-[#6b7280] mb-1">
                      <span>Laps {stint.lap_start}–{stint.lap_end}</span><span>{laps} laps</span>
                    </div>
                    <div className="h-2 bg-[#0f0f0f] rounded overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${deg}%`, background: deg > 75 ? '#ef4444' : deg > 50 ? '#f59e0b' : '#22c55e' }} />
                    </div>
                    <div className="text-xs text-[#6b7280] mt-0.5">Degradation: {deg}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-3">Lap Times</h3>
          <div className="overflow-y-auto max-h-52">
            <table className="w-full text-xs">
              <thead><tr className="text-[#6b7280] border-b border-[#2a2a2a]">
                <th className="text-left py-1 pr-2">Lap</th>
                {selectedDrivers.map(dn => { const d = drivers.find(x => x.number === dn); return <th key={dn} className="text-right py-1 px-2">{d?.code || dn}</th>; })}
              </tr></thead>
              <tbody>
                {Array.from({ length: Math.max(...selectedDrivers.map(dn => lapsData[dn]?.length || 0), 0) }, (_, i) => (
                  <tr key={i} className="border-b border-[#2a2a2a]/30 hover:bg-[#0f0f0f]/50">
                    <td className="py-1 pr-2 text-[#6b7280]">{i + 1}</td>
                    {selectedDrivers.map(dn => {
                      const lap = lapsData[dn]?.[i];
                      return <td key={dn} className="text-right py-1 px-2 font-mono">
                        {lap ? <span className={lap.is_pit_out_lap ? 'text-yellow-400' : 'text-[#e5e5e5]'}>{lap.is_pit_out_lap ? 'PIT' : formatLapTime(lap.lap_duration)}</span> : '-'}
                      </td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-3">Live Standings</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-[#6b7280] text-xs border-b border-[#2a2a2a]">
              <th className="text-left py-2 w-8">P</th><th className="text-left py-2">Driver</th>
              <th className="text-left py-2">Team</th><th className="text-right py-2">Gap</th><th className="text-right py-2">Interval</th>
            </tr></thead>
            <tbody>
              {[...positions].sort((a, b) => a.position - b.position).map(pos => {
                const d = drivers.find(x => x.number === pos.driver_number);
                return (
                  <tr key={pos.driver_number} className="border-b border-[#2a2a2a]/30 hover:bg-[#0f0f0f]/50">
                    <td className="py-2 font-bold text-[#6b7280]">{pos.position}</td>
                    <td className="py-2"><div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs w-8">{d?.code || pos.driver_number}</span>
                      <span>{d?.name || `#${pos.driver_number}`}</span>
                    </div></td>
                    <td className="py-2"><TeamBadge team={d?.team || ''} /></td>
                    <td className="py-2 text-right font-mono text-[#6b7280]">{pos.gap_to_leader > 0 ? `+${pos.gap_to_leader.toFixed(3)}s` : 'LEADER'}</td>
                    <td className="py-2 text-right font-mono text-[#6b7280]">{pos.interval > 0 ? `+${pos.interval.toFixed(3)}s` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
