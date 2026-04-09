import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Game as GameType, Player, AtBat, PitchCount } from '../lib/types';

const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  single: { label: '1B', color: 'bg-green-700' },
  double: { label: '2B', color: 'bg-green-800' },
  triple: { label: '3B', color: 'bg-emerald-700' },
  hr: { label: 'HR', color: 'bg-amber-500' },
  walk: { label: 'BB', color: 'bg-blue-800' },
  strikeout: { label: 'K', color: 'bg-red-700' },
  out: { label: 'OUT', color: 'bg-slate-600' },
};

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<GameType | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [pitchCounts, setPitchCounts] = useState<PitchCount[]>([]);
  const [tab, setTab] = useState<'atbats' | 'pitching' | 'score'>('atbats');

  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [inning, setInning] = useState(1);
  const [result, setResult] = useState('');
  const [rbi, setRbi] = useState(0);
  const [runScored, setRunScored] = useState(false);
  const [stolenBase, setStolenBase] = useState(false);
  const [showAtBatForm, setShowAtBatForm] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [gameId]);

  const fetchAll = async () => {
    const [gameRes, atBatsRes, pitchRes] = await Promise.all([
      supabase.from('games').select('*, teams(*)').eq('id', gameId).single(),
      supabase.from('at_bats').select('*').eq('game_id', gameId).order('created_at'),
      supabase.from('pitch_counts').select('*').eq('game_id', gameId),
    ]);
    setGame(gameRes.data);
    if (gameRes.data?.team_id) {
      const { data: teamPlayers } = await supabase.from('players').select('*').eq('team_id', gameRes.data.team_id).order('jersey_number');
      setPlayers(teamPlayers ?? []);
    }
    setAtBats(atBatsRes.data ?? []);
    setPitchCounts(pitchRes.data ?? []);
  };

  const logAtBat = async () => {
    if (!selectedPlayer || !result) return;
    await supabase.from('at_bats').insert({
      game_id: gameId,
      player_id: selectedPlayer,
      inning,
      result,
      rbi,
      run_scored: runScored,
      stolen_base: stolenBase,
    });
    setResult('');
    setRbi(0);
    setRunScored(false);
    setStolenBase(false);
    setShowAtBatForm(false);
    fetchAll();
  };

  const addPitch = async (playerId: string) => {
    const existing = pitchCounts.find(p => p.player_id === playerId);
    if (existing) {
      await supabase.from('pitch_counts').update({ count: existing.count + 1, updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('pitch_counts').insert({ game_id: gameId, player_id: playerId, count: 1 });
    }
    fetchAll();
  };

  const removePitch = async (playerId: string) => {
    const existing = pitchCounts.find(p => p.player_id === playerId);
    if (!existing || existing.count === 0) return;
    await supabase.from('pitch_counts').update({ count: existing.count - 1, updated_at: new Date().toISOString() }).eq('id', existing.id);
    fetchAll();
  };

  const updateScore = async (field: 'home_score' | 'away_score', delta: number) => {
    if (!game) return;
    const newVal = Math.max(0, (game[field] ?? 0) + delta);
    await supabase.from('games').update({ [field]: newVal }).eq('id', gameId);
    fetchAll();
  };

  const playerStats = players.map(player => {
    const pAtBats = atBats.filter(ab => ab.player_id === player.id);
    const hits = pAtBats.filter(ab => ['single', 'double', 'triple', 'hr'].includes(ab.result)).length;
    const abs = pAtBats.filter(ab => !['walk'].includes(ab.result)).length;
    const walks = pAtBats.filter(ab => ab.result === 'walk').length;
    const ks = pAtBats.filter(ab => ab.result === 'strikeout').length;
    const runs = pAtBats.filter(ab => ab.run_scored).length;
    const rbis = pAtBats.reduce((sum, ab) => sum + ab.rbi, 0);
    const sbs = pAtBats.filter(ab => ab.stolen_base).length;
    const avg = abs > 0 ? (hits / abs).toFixed(3).replace('0.', '.') : '---';
    return { player, pAtBats, hits, abs, walks, ks, runs, rbis, sbs, avg };
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-blue-900 border-b border-blue-800 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Link to={`/team/${game?.team_id}`} className="text-sky-300 hover:text-white text-2xl">‹</Link>
            <div className="flex-1">
              <p className="font-bold text-lg">vs. {game?.opponent}</p>
              <p className="text-sky-300 text-xs">{game?.game_date ? new Date(game.game_date).toLocaleDateString() : ''}</p>
            </div>
            <Link to={`/game/${gameId}/scorecard`} className="bg-blue-800 hover:bg-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
              🖨 Print
            </Link>
          </div>

          {/* Score */}
          <div className="flex items-center justify-center gap-6 py-2">
            <div className="text-center">
              <p className="text-xs text-sky-300 mb-1">Us</p>
              <div className="flex items-center gap-2">
                <button onClick={() => updateScore('home_score', -1)} className="w-8 h-8 bg-blue-800 hover:bg-blue-700 rounded-full text-lg font-bold transition-colors">−</button>
                <span className="text-3xl font-bold w-8 text-center text-amber-400">{game?.home_score ?? 0}</span>
                <button onClick={() => updateScore('home_score', 1)} className="w-8 h-8 bg-blue-800 hover:bg-blue-700 rounded-full text-lg font-bold transition-colors">+</button>
              </div>
            </div>
            <span className="text-blue-400 text-2xl font-light">—</span>
            <div className="text-center">
              <p className="text-xs text-sky-300 mb-1">Them</p>
              <div className="flex items-center gap-2">
                <button onClick={() => updateScore('away_score', -1)} className="w-8 h-8 bg-blue-800 hover:bg-blue-700 rounded-full text-lg font-bold transition-colors">−</button>
                <span className="text-3xl font-bold w-8 text-center">{game?.away_score ?? 0}</span>
                <button onClick={() => updateScore('away_score', 1)} className="w-8 h-8 bg-blue-800 hover:bg-blue-700 rounded-full text-lg font-bold transition-colors">+</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-900 p-1 rounded-xl mb-4">
          {(['atbats', 'pitching', 'score'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${tab === t ? 'bg-blue-800 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {t === 'atbats' ? '🏏 At-Bats' : t === 'pitching' ? '⚾ Pitching' : '📊 Stats'}
            </button>
          ))}
        </div>

        {/* AT-BATS TAB */}
        {tab === 'atbats' && (
          <>
            <button
              onClick={() => setShowAtBatForm(true)}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl text-sm font-medium mb-4 transition-colors"
            >
              + Log At-Bat
            </button>

            {showAtBatForm && (
              <div className="bg-slate-900 border border-blue-900 rounded-2xl p-4 mb-4">
                <h3 className="font-semibold mb-3 text-amber-400">Log At-Bat</h3>

                <select
                  value={selectedPlayer}
                  onChange={e => setSelectedPlayer(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  <option value="">Select player...</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>#{p.jersey_number} {p.name}</option>
                  ))}
                </select>

                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-sky-300">Inning:</span>
                  {[1,2,3,4,5,6].map(i => (
                    <button
                      key={i}
                      onClick={() => setInning(i)}
                      className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${inning === i ? 'bg-blue-800 text-amber-400 font-bold' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                      {i}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  {Object.entries(RESULT_LABELS).map(([key, { label, color }]) => (
                    <button
                      key={key}
                      onClick={() => setResult(key)}
                      className={`py-2 rounded-xl text-sm font-bold transition-colors ${result === key ? color + ' text-white ring-2 ring-amber-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-sky-300">RBI:</span>
                  {[0,1,2,3,4].map(n => (
                    <button
                      key={n}
                      onClick={() => setRbi(n)}
                      className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${rbi === n ? 'bg-blue-800 text-amber-400 font-bold' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={runScored} onChange={e => setRunScored(e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
                    Run Scored
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={stolenBase} onChange={e => setStolenBase(e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
                    Stolen Base
                  </label>
                </div>

                <div className="flex gap-2">
                  <button onClick={logAtBat} disabled={!selectedPlayer || !result} className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white py-2 rounded-xl text-sm font-medium transition-colors">Save</button>
                  <button onClick={() => setShowAtBatForm(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {[...atBats].reverse().slice(0, 15).map(ab => {
                const player = players.find(p => p.id === ab.player_id);
                const { label, color } = RESULT_LABELS[ab.result] ?? { label: ab.result, color: 'bg-slate-600' };
                return (
                  <div key={ab.id} className="bg-slate-900 border border-blue-900 rounded-xl px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`${color} text-white text-xs font-bold px-2 py-0.5 rounded-lg`}>{label}</span>
                      <span className="text-sm">{player?.name}</span>
                      {ab.rbi > 0 && <span className="text-xs text-amber-400">{ab.rbi} RBI</span>}
                      {ab.run_scored && <span className="text-xs text-green-400">R</span>}
                      {ab.stolen_base && <span className="text-xs text-sky-300">SB</span>}
                    </div>
                    <span className="text-xs text-slate-500">Inn. {ab.inning}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* PITCHING TAB */}
        {tab === 'pitching' && (
          <div className="space-y-3">
            <div className="bg-slate-900 border border-blue-900 rounded-xl px-4 py-3 text-xs text-sky-300 space-y-1">
              <p className="font-semibold text-white mb-1">Ages 7–8 Rules</p>
              <p>⚾ Max 50 pitches/game · Max 1 inning/game (2 in playoffs)</p>
              <p>😴 Rest: 21–35 pitches = 1 day · 36–50 = 2 days · 51–65 = 3 days · 66+ = 4 days</p>
              <p>🚫 No pitching back-to-back games</p>
            </div>

            {players.map(player => {
              const pc = pitchCounts.find(p => p.player_id === player.id);
              const count = pc?.count ?? 0;
              const pct = Math.min((count / 50) * 100, 100);
              const barColor = count >= 45 ? 'bg-red-500' : count >= 35 ? 'bg-amber-500' : 'bg-sky-400';
              const restDays = count >= 66 ? 4 : count >= 51 ? 3 : count >= 36 ? 2 : count >= 21 ? 1 : 0;
              const restLabel = restDays > 0 ? `${restDays} day${restDays > 1 ? 's' : ''} rest required` : 'No rest required';
              const restColor = restDays >= 3 ? 'text-red-400' : restDays === 2 ? 'text-amber-400' : restDays === 1 ? 'text-yellow-300' : 'text-green-400';
              return (
                <div key={player.id} className="bg-slate-900 border border-blue-900 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{player.name}</span>
                    <span className={`text-2xl font-bold ${count >= 45 ? 'text-red-400' : count >= 35 ? 'text-amber-400' : 'text-white'}`}>{count}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                    <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-medium ${restColor}`}>
                      {count > 0 ? `😴 ${restLabel}` : '—'}
                    </span>
                    <span className="text-xs text-slate-500">{50 - count > 0 ? `${50 - count} left` : 'Limit reached'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => removePitch(player.id)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-sm font-medium transition-colors">− 1</button>
                    <button onClick={() => addPitch(player.id)} disabled={count >= 50} className="flex-1 bg-blue-800 hover:bg-blue-700 disabled:opacity-40 py-2 rounded-xl text-sm font-bold transition-colors">+ 1 Pitch</button>
                  </div>
                  {count >= 50 && <p className="text-red-400 text-xs mt-2 text-center font-semibold">🛑 Pitch limit reached!</p>}
                  {count >= 45 && count < 50 && <p className="text-amber-400 text-xs mt-2 text-center">⚠️ Approaching limit — {50 - count} pitch{50 - count !== 1 ? 'es' : ''} left</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* STATS TAB */}
        {tab === 'score' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-sky-300 text-xs border-b border-blue-900">
                  <th className="text-left py-2 pr-3">Player</th>
                  <th className="text-center py-2 px-1">AB</th>
                  <th className="text-center py-2 px-1">H</th>
                  <th className="text-center py-2 px-1">R</th>
                  <th className="text-center py-2 px-1">RBI</th>
                  <th className="text-center py-2 px-1">BB</th>
                  <th className="text-center py-2 px-1">K</th>
                  <th className="text-center py-2 px-1">SB</th>
                  <th className="text-center py-2 px-1">AVG</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.map(({ player, abs, hits, runs, rbis, walks, ks, sbs, avg }) => (
                  <tr key={player.id} className="border-b border-slate-900">
                    <td className="py-2 pr-3 font-medium">{player.name}</td>
                    <td className="text-center py-2 px-1 text-slate-300">{abs}</td>
                    <td className="text-center py-2 px-1 text-green-400 font-medium">{hits}</td>
                    <td className="text-center py-2 px-1 text-slate-300">{runs}</td>
                    <td className="text-center py-2 px-1 text-amber-400">{rbis}</td>
                    <td className="text-center py-2 px-1 text-sky-300">{walks}</td>
                    <td className="text-center py-2 px-1 text-red-400">{ks}</td>
                    <td className="text-center py-2 px-1 text-purple-400">{sbs}</td>
                    <td className="text-center py-2 px-1 text-slate-300">{avg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
