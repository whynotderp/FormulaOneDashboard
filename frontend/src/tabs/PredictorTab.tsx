import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { predictRace, getSessions } from '../api/client';
import type { RacePrediction, PredictionResult, Session } from '../api/client';
import { LoadingSpinner, ErrorMessage } from '../components/LoadingSpinner';
import { TeamBadge } from '../components/TeamBadge';

const FALLBACK: RacePrediction = {
  circuit: 'bahrain', weather: 'dry',
  predictions: [
    { predicted_position: 1, driver_code: 'NOR', driver_name: 'Lando Norris', team: 'McLaren', quali_position: 1, confidence_pct: 78, crash_probability_pct: 5, score: 1.2 },
    { predicted_position: 2, driver_code: 'VER', driver_name: 'Max Verstappen', team: 'Red Bull', quali_position: 2, confidence_pct: 72, crash_probability_pct: 4, score: 2.1 },
    { predicted_position: 3, driver_code: 'LEC', driver_name: 'Charles Leclerc', team: 'Ferrari', quali_position: 3, confidence_pct: 65, crash_probability_pct: 8, score: 3.0 },
    { predicted_position: 4, driver_code: 'PIA', driver_name: 'Oscar Piastri', team: 'McLaren', quali_position: 4, confidence_pct: 62, crash_probability_pct: 6, score: 4.1 },
    { predicted_position: 5, driver_code: 'HAM', driver_name: 'Lewis Hamilton', team: 'Ferrari', quali_position: 6, confidence_pct: 58, crash_probability_pct: 5, score: 5.2 },
    { predicted_position: 6, driver_code: 'RUS', driver_name: 'George Russell', team: 'Mercedes', quali_position: 5, confidence_pct: 55, crash_probability_pct: 6, score: 6.0 },
    { predicted_position: 7, driver_code: 'SAI', driver_name: 'Carlos Sainz', team: 'Williams', quali_position: 8, confidence_pct: 50, crash_probability_pct: 7, score: 7.1 },
    { predicted_position: 8, driver_code: 'ALO', driver_name: 'Fernando Alonso', team: 'Aston Martin', quali_position: 9, confidence_pct: 48, crash_probability_pct: 7, score: 8.2 },
    { predicted_position: 9, driver_code: 'TSU', driver_name: 'Yuki Tsunoda', team: 'Red Bull', quali_position: 7, confidence_pct: 45, crash_probability_pct: 10, score: 9.0 },
    { predicted_position: 10, driver_code: 'ALB', driver_name: 'Alexander Albon', team: 'Williams', quali_position: 10, confidence_pct: 42, crash_probability_pct: 8, score: 10.1 },
    { predicted_position: 11, driver_code: 'ANT', driver_name: 'Kimi Antonelli', team: 'Mercedes', quali_position: 11, confidence_pct: 38, crash_probability_pct: 14, score: 11 },
    { predicted_position: 12, driver_code: 'LAW', driver_name: 'Liam Lawson', team: 'Racing Bulls', quali_position: 12, confidence_pct: 35, crash_probability_pct: 13, score: 12 },
    { predicted_position: 13, driver_code: 'GAS', driver_name: 'Pierre Gasly', team: 'Alpine', quali_position: 13, confidence_pct: 32, crash_probability_pct: 10, score: 13 },
    { predicted_position: 14, driver_code: 'HUL', driver_name: 'Nico Hulkenberg', team: 'Sauber', quali_position: 14, confidence_pct: 30, crash_probability_pct: 9, score: 14 },
    { predicted_position: 15, driver_code: 'OCO', driver_name: 'Esteban Ocon', team: 'Haas', quali_position: 15, confidence_pct: 27, crash_probability_pct: 11, score: 15 },
    { predicted_position: 16, driver_code: 'BEA', driver_name: 'Oliver Bearman', team: 'Haas', quali_position: 16, confidence_pct: 25, crash_probability_pct: 15, score: 16 },
    { predicted_position: 17, driver_code: 'STR', driver_name: 'Lance Stroll', team: 'Aston Martin', quali_position: 17, confidence_pct: 22, crash_probability_pct: 12, score: 17 },
    { predicted_position: 18, driver_code: 'DOO', driver_name: 'Jack Doohan', team: 'Alpine', quali_position: 18, confidence_pct: 20, crash_probability_pct: 17, score: 18 },
    { predicted_position: 19, driver_code: 'BOR', driver_name: 'Gabriel Bortoleto', team: 'Sauber', quali_position: 19, confidence_pct: 18, crash_probability_pct: 18, score: 19 },
    { predicted_position: 20, driver_code: 'HAD', driver_name: 'Isack Hadjar', team: 'Racing Bulls', quali_position: 20, confidence_pct: 15, crash_probability_pct: 16, score: 20 },
  ],
  incident_probabilities: { safety_car: 35, virtual_sc: 25, red_flag: 10 },
  podium: ['Lando Norris', 'Max Verstappen', 'Charles Leclerc'],
};

function PodiumCard({ p, medal }: { p: PredictionResult; medal: 1 | 2 | 3 }) {
  const colors = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
  const heights = { 1: 'h-28', 2: 'h-20', 3: 'h-16' };
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-24 ${heights[medal]} rounded-t-lg flex flex-col items-center justify-end pb-3`}
        style={{ background: `linear-gradient(180deg,${colors[medal]}22,${colors[medal]}44)`, border: `1px solid ${colors[medal]}66` }}>
        <span className="text-2xl font-bold" style={{ color: colors[medal] }}>{medal}{medal === 1 ? 'st' : medal === 2 ? 'nd' : 'rd'}</span>
      </div>
      <div className="text-center">
        <div className="font-bold text-sm">{p.driver_code}</div>
        <div className="text-xs text-[#6b7280]">{p.driver_name.split(' ').slice(-1)}</div>
        <TeamBadge team={p.team} className="mt-1" />
        <div className="text-xs mt-1" style={{ color: colors[medal] }}>{p.confidence_pct}% conf.</div>
      </div>
    </div>
  );
}

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  const r = 35; const c = Math.PI * r; const off = c - (value / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="90" height="55" viewBox="0 0 90 55">
        <path d={`M 10 45 A ${r} ${r} 0 0 1 80 45`} fill="none" stroke="#2a2a2a" strokeWidth="8" strokeLinecap="round" />
        <path d={`M 10 45 A ${r} ${r} 0 0 1 80 45`} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 1s' }} />
        <text x="45" y="42" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>{value}%</text>
      </svg>
      <span className="text-xs text-[#6b7280] text-center">{label}</span>
    </div>
  );
}

export function PredictorTab() {
  const [races, setRaces] = useState<Session[]>([]);
  const [sessionKey, setSessionKey] = useState<number | undefined>(undefined);
  const [weather, setWeather] = useState<'dry' | 'wet'>('dry');
  const [prediction, setPrediction] = useState<RacePrediction>(FALLBACK);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the full season race calendar (all Grands Prix), newest first.
  useEffect(() => {
    getSessions()
      .then(r => {
        const racesOnly = r.data.filter(s => (s.session_type || s.session_name) === 'Race');
        setRaces(racesOnly);
        if (racesOnly.length > 0) setSessionKey(racesOnly[0].session_key);
      })
      .catch(() => {});
  }, []);

  const run = async (sk = sessionKey) => {
    setLoading(true); setError(null);
    try {
      const r = await predictRace('bahrain', weather, sk);
      setPrediction(r.data);
    } catch {
      setError('Backend not running — showing sample prediction');
      setPrediction({ ...FALLBACK, weather });
    } finally { setLoading(false); }
  };

  useEffect(() => { run(); }, []);

  const chart10 = prediction.predictions.slice(0, 10).map(p => ({ name: p.driver_code, confidence: p.confidence_pct }));

  return (
    <div className="space-y-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#6b7280] uppercase tracking-wider">Race</label>
          <select className="bg-[#0f0f0f] border border-[#2a2a2a] text-[#e5e5e5] rounded px-3 py-1.5 text-sm max-w-xs"
            value={sessionKey ?? ''} onChange={e => setSessionKey(Number(e.target.value))}>
            {races.length === 0 && <option value="">No live calendar — using sample</option>}
            {races.map(s => (
              <option key={s.session_key} value={s.session_key}>
                {s.country_name} ({s.date_start?.slice(0, 10)})
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#6b7280] uppercase tracking-wider">Weather</label>
          <div className="flex rounded overflow-hidden border border-[#2a2a2a]">
            {(['dry', 'wet'] as const).map(w => (
              <button key={w} onClick={() => setWeather(w)}
                className={`px-4 py-1.5 text-sm transition-colors ${weather === w ? 'bg-[#e10600] text-white' : 'bg-[#0f0f0f] text-[#6b7280] hover:text-[#e5e5e5]'}`}>
                {w === 'dry' ? '☀️ Dry' : '🌧️ Wet'}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => run()} disabled={loading}
          className="ml-auto px-6 py-2 bg-[#e10600] text-white rounded font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50">
          {loading ? 'Calculating...' : '⚡ Run Prediction'}
        </button>
      </div>

      {error && <ErrorMessage message={error} />}
      {!loading && (
        <div className="text-xs text-[#6b7280]">
          {prediction.grid_source === 'qualifying'
            ? <span><span className="text-green-400">●</span> Grounded in the real starting grid / qualifying result for this race</span>
            : <span><span className="text-yellow-400">●</span> No qualifying data for this race yet — grid modeled from team pace</span>}
        </div>
      )}
      {loading && <LoadingSpinner size="lg" />}

      {!loading && (
        <>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
            <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-6 text-center">Predicted Podium</h3>
            <div className="flex items-end justify-center gap-8">
              {prediction.predictions[1] && <PodiumCard p={prediction.predictions[1]} medal={2} />}
              {prediction.predictions[0] && <PodiumCard p={prediction.predictions[0]} medal={1} />}
              {prediction.predictions[2] && <PodiumCard p={prediction.predictions[2]} medal={3} />}
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-4 text-center">Race Incident Probabilities</h3>
            <div className="flex justify-around flex-wrap gap-4">
              <Gauge label="Safety Car" value={prediction.incident_probabilities.safety_car} color="#f59e0b" />
              <Gauge label="Virtual SC" value={prediction.incident_probabilities.virtual_sc} color="#a78bfa" />
              <Gauge label="Red Flag" value={prediction.incident_probabilities.red_flag} color="#ef4444" />
            </div>
            <p className="text-xs text-center text-[#6b7280] mt-3">
              Historical incident rates · {weather === 'wet' ? '⚠️ Wet weather multiplier applied' : 'Dry conditions'}
            </p>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-4">Confidence — Top 10</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart10} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#e5e5e5', fontWeight: 'bold' }} width={40} />
                <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6 }}
                  formatter={(v: unknown) => [`${v}%`, 'Confidence']} />
                <Bar dataKey="confidence" radius={[0, 4, 4, 0]}>
                  {chart10.map((_, i) => <Cell key={i} fill={i === 0 ? '#e10600' : i < 3 ? '#ff6b35' : '#374151'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-3">Full Grid Prediction</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-[#6b7280] text-xs border-b border-[#2a2a2a]">
                  <th className="text-left py-2 w-10">Pos</th><th className="text-left py-2 w-12">Code</th>
                  <th className="text-left py-2">Driver</th><th className="text-left py-2">Team</th>
                  <th className="text-center py-2 w-12">Grid</th><th className="text-right py-2 w-36">Confidence</th>
                  <th className="text-right py-2 w-24">Crash Risk</th>
                </tr></thead>
                <tbody>
                  {prediction.predictions.map(p => (
                    <tr key={p.driver_code} className="border-b border-[#2a2a2a]/30 hover:bg-[#0f0f0f]/50">
                      <td className="py-2">
                        <span className={`font-bold ${p.predicted_position <= 3 ? 'text-[#e10600]' : p.predicted_position <= 10 ? 'text-[#e5e5e5]' : 'text-[#6b7280]'}`}>
                          P{p.predicted_position}
                        </span>
                      </td>
                      <td className="py-2 font-mono font-bold text-xs">{p.driver_code}</td>
                      <td className="py-2">{p.driver_name}</td>
                      <td className="py-2"><TeamBadge team={p.team} /></td>
                      <td className="py-2 text-center text-[#6b7280] text-xs">P{p.quali_position}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-20 h-1.5 bg-[#0f0f0f] rounded overflow-hidden">
                            <div className="h-full rounded" style={{ width: `${p.confidence_pct}%`, background: 'linear-gradient(90deg,#e10600,#ff6b6b)' }} />
                          </div>
                          <span className="text-xs text-[#6b7280] w-10 text-right">{p.confidence_pct}%</span>
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <span className={`text-xs font-mono ${p.crash_probability_pct > 15 ? 'text-red-400' : p.crash_probability_pct > 10 ? 'text-yellow-400' : 'text-green-400'}`}>
                          {p.crash_probability_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-4">
            <h4 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-3">Prediction Methodology</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {[
                { factor: 'Grid / Qualifying Position', weight: '45%', color: '#e10600' },
                { factor: 'Team Pace', weight: '25%', color: '#f59e0b' },
                { factor: 'Recent Form (this season weighted 3x)', weight: '20%', color: '#22c55e' },
                { factor: 'Circuit Performance', weight: '10%', color: '#3b82f6' },
              ].map(f => (
                <div key={f.factor} className="flex flex-col gap-1">
                  <span style={{ color: f.color }} className="font-bold text-base">{f.weight}</span>
                  <span className="text-[#6b7280]">{f.factor}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
