import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getFantasyTeam, getFantasyDrivers, getFantasyConstructors, getSessions } from '../api/client';
import type { FantasyDriver, FantasyConstructor, FantasyTeam, Session } from '../api/client';
import { LoadingSpinner, ErrorMessage } from '../components/LoadingSpinner';
import { TeamBadge } from '../components/TeamBadge';

const FALLBACK_DRIVERS: FantasyDriver[] = [
  { code:'NOR',name:'Lando Norris',team:'McLaren',price:27.5,number:4,predicted_points:62,avg_points:55,pts_per_million:2.25 },
  { code:'PIA',name:'Oscar Piastri',team:'McLaren',price:22.0,number:81,predicted_points:55,avg_points:50,pts_per_million:2.50 },
  { code:'BEA',name:'Oliver Bearman',team:'Haas',price:8.0,number:87,predicted_points:20,avg_points:18,pts_per_million:2.50 },
  { code:'GAS',name:'Pierre Gasly',team:'Alpine',price:10.0,number:10,predicted_points:22,avg_points:20,pts_per_million:2.20 },
  { code:'HUL',name:'Nico Hulkenberg',team:'Sauber',price:10.0,number:27,predicted_points:22,avg_points:20,pts_per_million:2.20 },
  { code:'VER',name:'Max Verstappen',team:'Red Bull',price:30.0,number:1,predicted_points:58,avg_points:52,pts_per_million:1.93 },
  { code:'LEC',name:'Charles Leclerc',team:'Ferrari',price:25.0,number:16,predicted_points:52,avg_points:48,pts_per_million:2.08 },
  { code:'HAM',name:'Lewis Hamilton',team:'Ferrari',price:22.5,number:44,predicted_points:46,avg_points:42,pts_per_million:2.04 },
  { code:'RUS',name:'George Russell',team:'Mercedes',price:20.0,number:63,predicted_points:43,avg_points:40,pts_per_million:2.15 },
  { code:'SAI',name:'Carlos Sainz',team:'Williams',price:18.0,number:55,predicted_points:38,avg_points:35,pts_per_million:2.11 },
  { code:'ALO',name:'Fernando Alonso',team:'Aston Martin',price:15.0,number:14,predicted_points:31,avg_points:28,pts_per_million:2.07 },
  { code:'TSU',name:'Yuki Tsunoda',team:'Red Bull',price:14.0,number:22,predicted_points:28,avg_points:25,pts_per_million:2.00 },
  { code:'ALB',name:'Alexander Albon',team:'Williams',price:11.0,number:23,predicted_points:24,avg_points:22,pts_per_million:2.18 },
  { code:'ANT',name:'Kimi Antonelli',team:'Mercedes',price:13.0,number:12,predicted_points:24,avg_points:22,pts_per_million:1.85 },
  { code:'LAW',name:'Liam Lawson',team:'Racing Bulls',price:10.0,number:30,predicted_points:20,avg_points:18,pts_per_million:2.00 },
  { code:'OCO',name:'Esteban Ocon',team:'Haas',price:9.0,number:31,predicted_points:18,avg_points:16,pts_per_million:2.00 },
  { code:'STR',name:'Lance Stroll',team:'Aston Martin',price:8.0,number:18,predicted_points:16,avg_points:15,pts_per_million:2.00 },
  { code:'DOO',name:'Jack Doohan',team:'Alpine',price:7.0,number:7,predicted_points:13,avg_points:12,pts_per_million:1.86 },
  { code:'BOR',name:'Gabriel Bortoleto',team:'Sauber',price:7.5,number:5,predicted_points:15,avg_points:14,pts_per_million:2.00 },
  { code:'HAD',name:'Isack Hadjar',team:'Racing Bulls',price:8.5,number:6,predicted_points:15,avg_points:14,pts_per_million:1.76 },
];

const FALLBACK_CONSTRUCTORS: FantasyConstructor[] = [
  { name:'McLaren',price:33.5,predicted_points:100,avg_points:95,pts_per_million:2.99 },
  { name:'Ferrari',price:30.0,predicted_points:84,avg_points:80,pts_per_million:2.80 },
  { name:'Red Bull',price:28.0,predicted_points:79,avg_points:75,pts_per_million:2.82 },
  { name:'Mercedes',price:22.0,predicted_points:68,avg_points:65,pts_per_million:3.09 },
  { name:'Williams',price:13.0,predicted_points:37,avg_points:35,pts_per_million:2.85 },
  { name:'Aston Martin',price:15.0,predicted_points:42,avg_points:40,pts_per_million:2.80 },
  { name:'Racing Bulls',price:12.0,predicted_points:34,avg_points:32,pts_per_million:2.83 },
  { name:'Alpine',price:10.0,predicted_points:30,avg_points:28,pts_per_million:3.00 },
  { name:'Haas',price:9.5,predicted_points:27,avg_points:26,pts_per_million:2.84 },
  { name:'Sauber',price:8.0,predicted_points:19,avg_points:18,pts_per_million:2.38 },
];

function buildFallbackTeam(cid: string): FantasyTeam {
  const sorted = [...FALLBACK_DRIVERS].sort((a, b) => b.pts_per_million - a.pts_per_million);
  const picked: FantasyDriver[] = []; const usedTeams: Record<string, number> = {}; let budget = 100;
  for (const d of sorted) {
    if (picked.length >= 5) break;
    const tc = usedTeams[d.team] || 0;
    if (tc >= 2 || d.price > budget - 9) continue;
    picked.push(d); usedTeams[d.team] = tc + 1; budget -= d.price;
  }
  const cons = [...FALLBACK_CONSTRUCTORS].sort((a, b) => b.predicted_points - a.predicted_points);
  const pickedCons: FantasyConstructor[] = [];
  for (const c of cons) { if (pickedCons.length >= 2) break; if (c.price <= budget - (pickedCons.length === 0 ? 6 : 0)) { pickedCons.push(c); budget -= c.price; } }
  const cap = picked.reduce((a, b) => a.predicted_points > b.predicted_points ? a : b, picked[0]);
  const conCost = pickedCons.reduce((s, c) => s + c.price, 0);
  const totalCost = picked.reduce((s, d) => s + d.price, 0) + conCost;
  const totalPts = picked.reduce((s, d) => s + (d.code === cap?.code ? d.predicted_points * 2 : d.predicted_points), 0) + pickedCons.reduce((s, c) => s + c.predicted_points, 0);
  return { circuit: cid, budget: 100, total_cost: Math.round(totalCost*10)/10, budget_remaining: Math.round((100-totalCost)*10)/10, drivers: picked, constructors: pickedCons, captain: cap, total_predicted_points: Math.round(totalPts*10)/10, reasoning: `5 drivers + 2 constructors by value. Captain ${cap?.name} earns 2× points.` };
}

export function FantasyTab() {
  const [races, setRaces] = useState<Session[]>([]);
  const [sessionKey, setSessionKey] = useState<number | undefined>(undefined);
  const [team, setTeam] = useState<FantasyTeam>(buildFallbackTeam('bahrain'));
  const [allDrivers, setAllDrivers] = useState<FantasyDriver[]>(FALLBACK_DRIVERS);
  const [allConstructors, setAllConstructors] = useState<FantasyConstructor[]>(FALLBACK_CONSTRUCTORS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'recommended' | 'all-drivers' | 'constructors'>('recommended');

  // Load the live season race calendar so picks use the real current entry list.
  useEffect(() => {
    getSessions()
      .then(r => {
        const racesOnly = r.data.filter(s => (s.session_type || s.session_name) === 'Race');
        setRaces(racesOnly);
        if (racesOnly.length > 0) {
          const sk = racesOnly[0].session_key;
          setSessionKey(sk);
          load(sk);
        } else {
          load(undefined);
        }
      })
      .catch(() => load(undefined));
  }, []);

  const load = async (sk?: number) => {
    setLoading(true); setError(null);
    try {
      const [t, d, c] = await Promise.all([
        getFantasyTeam('bahrain', 100, sk),
        getFantasyDrivers('bahrain', sk),
        getFantasyConstructors('bahrain', sk),
      ]);
      setTeam(t.data); setAllDrivers(d.data); setAllConstructors(c.data);
    } catch {
      setError('Backend not running — showing sample fantasy data');
      setTeam(buildFallbackTeam('bahrain'));
      setAllDrivers(FALLBACK_DRIVERS); setAllConstructors(FALLBACK_CONSTRUCTORS);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#6b7280] uppercase tracking-wider">Race</label>
          <select className="bg-[#0f0f0f] border border-[#2a2a2a] text-[#e5e5e5] rounded px-3 py-1.5 text-sm max-w-xs"
            value={sessionKey ?? ''}
            onChange={e => { const sk = Number(e.target.value); setSessionKey(sk); load(sk); }}>
            {races.length === 0 && <option value="">No live calendar — using sample</option>}
            {races.map(s => (
              <option key={s.session_key} value={s.session_key}>
                {s.country_name} ({s.date_start?.slice(0, 10)})
              </option>
            ))}
          </select>
        </div>
        <div className="flex rounded overflow-hidden border border-[#2a2a2a] ml-auto">
          {([{id:'recommended' as const,label:'🏆 Optimal Team'},{id:'all-drivers' as const,label:'👤 All Drivers'},{id:'constructors' as const,label:'🏎️ Constructors'}]).map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`px-4 py-1.5 text-sm transition-colors ${view === v.id ? 'bg-[#e10600] text-white' : 'bg-[#0f0f0f] text-[#6b7280] hover:text-[#e5e5e5]'}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorMessage message={error} />}
      {!loading && (
        <div className="text-xs text-[#6b7280]">
          <span className="text-green-400">●</span> Points computed from real recent race results (official F1 Fantasy scoring).
          {' '}Prices are approximate — the official Fantasy game doesn't expose a public price API.
        </div>
      )}
      {loading && <LoadingSpinner size="lg" />}

      {!loading && view === 'recommended' && (
        <div className="space-y-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-[#6b7280] mb-1">Budget Used</div>
                <div className="text-2xl font-bold">${team.total_cost}M <span className="text-sm text-[#6b7280]">/ $100M</span></div>
                <div className="h-1.5 w-full bg-[#0f0f0f] rounded mt-2">
                  <div className="h-full bg-[#e10600] rounded" style={{ width: `${team.total_cost}%` }} />
                </div>
                <div className="text-xs text-green-400 mt-1">${team.budget_remaining}M remaining</div>
              </div>
              <div>
                <div className="text-xs text-[#6b7280] mb-1">Predicted Points</div>
                <div className="text-2xl font-bold text-green-400">{team.total_predicted_points}</div>
                <div className="text-xs text-[#6b7280]">incl. captain 2×</div>
              </div>
              <div>
                <div className="text-xs text-[#6b7280] mb-1">Captain (2×)</div>
                <div className="text-xl font-bold text-yellow-400">{team.captain?.code}</div>
                <div className="text-xs text-[#6b7280]">{team.captain?.name}</div>
                <div className="text-xs text-yellow-400 mt-0.5">{team.captain?.predicted_points} × 2 = {(team.captain?.predicted_points||0)*2} pts</div>
              </div>
              <div>
                <div className="text-xs text-[#6b7280] mb-1">Constructors (2)</div>
                {(team.constructors || []).map(c => (
                  <div key={c.name} className="flex justify-between gap-2">
                    <span className="text-sm font-bold">{c.name}</span>
                    <span className="text-xs text-green-400">{c.predicted_points}pt</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 text-xs text-[#6b7280] border-t border-[#2a2a2a] pt-3">
              <span className="text-[#e5e5e5]">Strategy: </span>{team.reasoning}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-3">Selected Drivers</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {team.drivers.map(d => (
                <div key={d.code} className={`relative p-3 rounded-lg border ${d.code === team.captain?.code ? 'border-yellow-500 ring-2 ring-yellow-500/30' : 'border-[#e10600]'} bg-[#e10600]/10`}>
                  {d.code === team.captain?.code && (
                    <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded">C×2</span>
                  )}
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-mono font-bold">{d.code}</span>
                    <span className="text-[#e10600] font-bold text-sm">${d.price}M</span>
                  </div>
                  <div className="text-xs text-[#6b7280] mb-2 truncate">{d.name.split(' ').slice(-1)}</div>
                  <TeamBadge team={d.team} />
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    <div className="text-center bg-[#1a1a1a] rounded p-1">
                      <div className="text-[10px] text-[#6b7280]">Pred</div>
                      <div className="font-bold text-green-400 text-sm">{d.predicted_points}</div>
                    </div>
                    <div className="text-center bg-[#1a1a1a] rounded p-1">
                      <div className="text-[10px] text-[#6b7280]">Avg</div>
                      <div className="font-bold text-sm">{d.avg_points}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-4">Value (pts/$M) — Top 15 Drivers</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={allDrivers.slice(0, 15).map(d => ({ name: d.code, value: d.pts_per_million }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6 }} formatter={(v: unknown) => [`${v} pts/$M`]} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {allDrivers.slice(0, 15).map((d, i) => <Cell key={i} fill={team.drivers.some(td => td.code === d.code) ? '#e10600' : '#374151'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-[#6b7280] text-center mt-1">Red = in selected team</p>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-3">Official F1 Fantasy Scoring</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {[
                { title:'Qualifying', rows:[['Q3 qualifier','+10 pts'],['Q2 qualifier','+3 pts'],['Q1 qualifier','+1 pt']] },
                { title:'Race Finish', rows:[['P1','25 pts'],['P2','18 pts'],['P3','15 pts'],['P4','12 pts'],['P5–P10','1–10 pts']] },
                { title:'Bonuses', rows:[['Fastest Lap (top 10)','+5'],['Positions gained','+2/pos'],['Classified finish','+1'],['Captain','×2']] },
                { title:'Deductions', rows:[['DNF','-20'],['Pit lane start','-10'],['Positions lost','-2/pos'],['DSQ','-25']] },
              ].map(s => (
                <div key={s.title}>
                  <h4 className="text-[#e5e5e5] font-semibold mb-2">{s.title}</h4>
                  <div className="space-y-1 text-[#6b7280]">
                    {s.rows.map(([lbl, pts]) => (
                      <div key={lbl} className="flex justify-between gap-2">
                        <span>{lbl}</span>
                        <span className={pts.startsWith('-') ? 'text-red-400' : pts === '×2' ? 'text-yellow-400' : 'text-[#e5e5e5]'}>{pts}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && view === 'all-drivers' && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[#6b7280] text-xs border-b border-[#2a2a2a]">
                <th className="text-left py-2 w-6">#</th><th className="text-left py-2">Driver</th>
                <th className="text-left py-2">Team</th><th className="text-right py-2">Price</th>
                <th className="text-right py-2">Avg</th><th className="text-right py-2">Pred</th><th className="text-right py-2">Pts/$M</th>
              </tr></thead>
              <tbody>
                {allDrivers.map((d, i) => (
                  <tr key={d.code} className={`border-b border-[#2a2a2a]/30 hover:bg-[#0f0f0f]/50 ${team.drivers.some(td => td.code === d.code) ? 'bg-[#e10600]/5' : ''}`}>
                    <td className="py-2 text-[#6b7280] text-xs">{i+1}</td>
                    <td className="py-2"><div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs w-8">{d.code}</span><span>{d.name}</span>
                      {team.drivers.some(td => td.code === d.code) && <span className="text-[10px] bg-[#e10600]/20 text-[#e10600] px-1 rounded">PICKED</span>}
                      {d.code === team.captain?.code && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1 rounded">CAP</span>}
                    </div></td>
                    <td className="py-2"><TeamBadge team={d.team} /></td>
                    <td className="py-2 text-right font-mono text-[#e10600]">${d.price}M</td>
                    <td className="py-2 text-right font-mono text-[#6b7280]">{d.avg_points}</td>
                    <td className="py-2 text-right font-mono text-green-400">{d.predicted_points}</td>
                    <td className="py-2 text-right font-mono">{d.pts_per_million}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && view === 'constructors' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {allConstructors.map(c => (
              <div key={c.name} className={`p-4 rounded-lg border ${(team.constructors || []).some(tc => tc.name === c.name) ? 'border-[#e10600] bg-[#e10600]/10' : 'border-[#2a2a2a] bg-[#1a1a1a]'}`}>
                <div className="flex items-start justify-between mb-3">
                  <TeamBadge team={c.name} className="font-semibold" />
                  <div className="text-right"><div className="text-[#e10600] font-bold">${c.price}M</div></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0f0f0f] rounded p-2 text-center">
                    <div className="text-[10px] text-[#6b7280]">Predicted</div>
                    <div className="font-bold text-green-400">{c.predicted_points}</div>
                  </div>
                  <div className="bg-[#0f0f0f] rounded p-2 text-center">
                    <div className="text-[10px] text-[#6b7280]">Pts/$M</div>
                    <div className="font-bold">{c.pts_per_million}</div>
                  </div>
                </div>
                {(team.constructors || []).some(tc => tc.name === c.name) && <div className="mt-2 text-xs text-center text-[#e10600] font-semibold">SELECTED</div>}
              </div>
            ))}
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-4">Constructor Predicted Points</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={allConstructors.map(c => ({ name: c.name.split(' ')[0], pts: c.predicted_points }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6 }} />
                <Bar dataKey="pts" name="Predicted Pts" radius={[4, 4, 0, 0]}>
                  {allConstructors.map((c, i) => <Cell key={i} fill={(team.constructors || []).some(tc => tc.name === c.name) ? '#e10600' : '#374151'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
