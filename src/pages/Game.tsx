import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Game as GameType, Player, AtBat, PitchCount } from '../lib/types';

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  single: { label: '1B', color: 'bg-green-700' },
  double: { label: '2B', color: 'bg-green-800' },
  triple: { label: '3B', color: 'bg-emerald-700' },
  hr: { label: 'HR', color: 'bg-amber-500' },
  walk: { label: 'BB', color: 'bg-blue-800' },
  strikeout: { label: 'K', color: 'bg-red-700' },
  out: { label: 'OUT', color: 'bg-slate-600' },
};

type ResultKey = keyof typeof RESULT_LABELS;

function getRestDaysRequired(pitches: number): number {
  if (pitches >= 66) return 4;
  if (pitches >= 51) return 3;
  if (pitches >= 36) return 2;
  if (pitches >= 21) return 1;
  return 0;
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.round(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

interface PrevPitchInfo {
  lastCount: number;
  lastDate: string;
  daysRequired: number;
  daysAvailable: number;
  eligible: boolean;
}

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<GameType | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [seasonAtBats, setSeasonAtBats] = useState<AtBat[]>([]);
  const [pitchCounts, setPitchCounts] = useState<PitchCount[]>([]);
  const [prevPitchInfo, setPrevPitchInfo] = useState<Record<string, PrevPitchInfo>>({});
  const [tab, setTab] = useState<'atbats' | 'pitching' | 'score' | 'recap'>('atbats');
  const [statsView, setStatsView] = useState<'game' | 'season'>('game');
  const [recap, setRecap] = useState('');
  const [recapLoading, setRecapLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // At-bat form
  const [editingAtBat, setEditingAtBat] = useState<AtBat | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [inning, setInning] = useState(1);
  const [result, setResult] = useState('');
  const [rbi, setRbi] = useState(0);
  const [runScored, setRunScored] = useState(false);
  const [stolenBase, setStolenBase] = useState(false);
  const [showAtBatForm, setShowAtBatForm] = useState(false);

  // Pitcher picker
  const [showAddPitcher, setShowAddPitcher] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [gameId]);

  const fetchAll = async () => {
    const [gameRes, atBatsRes, pitchRes] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('at_bats').select('*').eq('game_id', gameId).order('created_at'),
      supabase.from('pitch_counts').select('*').eq('game_id', gameId),
    ]);

    const gameData = gameRes.data as GameType;
    setGame(gameData);
    setAtBats(atBatsRes.data ?? []);
    const currentPitchCounts: PitchCount[] = pitchRes.data ?? [];
    setPitchCounts(currentPitchCounts);

    if (gameData?.team_id) {
      const { data: teamPlayers } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', gameData.team_id)
        .order('name');
      setPlayers(teamPlayers ?? []);

      // Fetch all at-bats for the season (all games on this team)
      const { data: allGames } = await supabase
        .from('games')
        .select('id')
        .eq('team_id', gameData.team_id);
      if (allGames && allGames.length > 0) {
        const gameIds = allGames.map((g: { id: string }) => g.id);
        const { data: allAtBats } = await supabase
          .from('at_bats')
          .select('*')
          .in('game_id', gameIds);
        setSeasonAtBats(allAtBats ?? []);
      }

      // Fetch previous pitch data for rest day eligibility
      if (teamPlayers && gameData.game_date) {
        const playerIds = teamPlayers.map((p: Player) => p.id);
        const { data: prevPitches } = await supabase
          .from('pitch_counts')
          .select('player_id, count, game_id, games(game_date)')
          .in('player_id', playerIds)
          .neq('game_id', gameId)
          .gt('count', 0);

        if (prevPitches) {
          const infoMap: Record<string, PrevPitchInfo> = {};
          for (const playerId of playerIds) {
            const playerPrevGames = (prevPitches as unknown as Array<{
              player_id: string;
              count: number;
              game_id: string;
              games: { game_date: string };
            }>)
              .filter(p => p.player_id === playerId)
              .sort((a, b) => new Date(b.games.game_date + 'T00:00:00').getTime() - new Date(a.games.game_date + 'T00:00:00').getTime());

            if (playerPrevGames.length > 0) {
              const last = playerPrevGames[0];
              const daysRequired = getRestDaysRequired(last.count);
              const daysAvailable = daysBetween(last.games.game_date, gameData.game_date);
              infoMap[playerId] = {
                lastCount: last.count,
                lastDate: last.games.game_date,
                daysRequired,
                daysAvailable,
                eligible: daysAvailable >= daysRequired,
              };
            }
          }
          setPrevPitchInfo(infoMap);
        }
      }
    }
  };

  const openNewAtBatForm = () => {
    setEditingAtBat(null);
    setSelectedPlayer('');
    setInning(1);
    setResult('');
    setRbi(0);
    setRunScored(false);
    setStolenBase(false);
    setShowAtBatForm(true);
  };

  const openEditAtBatForm = (ab: AtBat) => {
    setEditingAtBat(ab);
    setSelectedPlayer(ab.player_id);
    setInning(ab.inning);
    setResult(ab.result);
    setRbi(ab.rbi);
    setRunScored(ab.run_scored);
    setStolenBase(ab.stolen_base);
    setShowAtBatForm(true);
  };

  const saveAtBat = async () => {
    if (!selectedPlayer || !result) return;
    const payload = {
      player_id: selectedPlayer,
      inning,
      result,
      rbi,
      run_scored: runScored,
      stolen_base: stolenBase,
    };
    if (editingAtBat) {
      await supabase.from('at_bats').update(payload).eq('id', editingAtBat.id);
    } else {
      await supabase.from('at_bats').insert({ game_id: gameId, ...payload });
    }
    setShowAtBatForm(false);
    setEditingAtBat(null);
    fetchAll();
  };

  const deleteAtBat = async (ab: AtBat) => {
    const player = players.find(p => p.id === ab.player_id);
    const { label } = RESULT_LABELS[ab.result] ?? { label: ab.result };
    if (!confirm(`Delete ${label} for ${player?.name ?? 'this player'} in inning ${ab.inning}?`)) return;
    await supabase.from('at_bats').delete().eq('id', ab.id);
    setShowAtBatForm(false);
    setEditingAtBat(null);
    fetchAll();
  };

  const deletePitcher = async (player: Player) => {
    if (!confirm(`Remove ${player.name} from pitching this game?`)) return;
    const pc = pitchCounts.find(p => p.player_id === player.id);
    if (pc) await supabase.from('pitch_counts').delete().eq('id', pc.id);
    fetchAll();
  };

  const addPitcher = async (playerId: string) => {
    const existing = pitchCounts.find(p => p.player_id === playerId);
    if (!existing) {
      await supabase.from('pitch_counts').insert({ game_id: gameId, player_id: playerId, count: 0 });
      fetchAll();
    }
    setShowAddPitcher(false);
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

  const generateRecap = async () => {
    if (!game) return;
    setRecapLoading(true);
    setRecap('');
    const stats = computeStats(atBats);
    const payload = {
      teamName: game.opponent ? 'Royals' : 'Us',
      opponent: game.opponent,
      gameDate: new Date(game.game_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
      homeScore: game.home_score,
      awayScore: game.away_score,
      playerStats: stats.map(s => ({
        name: s.player.name,
        jersey: s.player.jersey_number,
        hits: s.hits,
        abs: s.abs,
        runs: s.runs,
        rbis: s.rbis,
        sbs: s.sbs,
        walks: s.walks,
        ks: s.ks,
      })),
      pitcherStats: players
        .filter(p => pitchCounts.some(pc => pc.player_id === p.id))
        .map(p => ({
          name: p.name,
          jersey: p.jersey_number,
          count: pitchCounts.find(pc => pc.player_id === p.id)?.count ?? 0,
        })),
    };
    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setRecap(data.text ?? 'Could not generate recap.');
    } catch {
      setRecap('Error generating recap. Please try again.');
    }
    setRecapLoading(false);
  };

  const copyRecap = async () => {
    await navigator.clipboard.writeText(recap);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const computeStats = (sourceAtBats: AtBat[]) => players.map(player => {
    const pAtBats = sourceAtBats.filter(ab => ab.player_id === player.id);
    const hits = pAtBats.filter(ab => ['single', 'double', 'triple', 'hr'].includes(ab.result)).length;
    const abs = pAtBats.filter(ab => ab.result !== 'walk').length;
    const walks = pAtBats.filter(ab => ab.result === 'walk').length;
    const ks = pAtBats.filter(ab => ab.result === 'strikeout').length;
    const runs = pAtBats.filter(ab => ab.run_scored).length;
    const rbis = pAtBats.reduce((sum, ab) => sum + ab.rbi, 0);
    const sbs = pAtBats.filter(ab => ab.stolen_base).length;
    const avg = abs > 0 ? (hits / abs).toFixed(3).replace('0.', '.') : '---';
    return { player, hits, abs, walks, ks, runs, rbis, sbs, avg };
  });

  const playerStats = computeStats(statsView === 'game' ? atBats : seasonAtBats);

  // Only players with a pitch_count record for this game
  const gamePitchers = players.filter(p => pitchCounts.some(pc => pc.player_id === p.id));
  const unpitchedPlayers = players.filter(p => !pitchCounts.some(pc => pc.player_id === p.id));

  const atBatFormTitle = editingAtBat ? 'Edit At-Bat' : 'Log At-Bat';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-blue-900 border-b border-blue-800 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Link to={`/team/${game?.team_id}`} className="text-sky-300 hover:text-white text-2xl">‹</Link>
            <div className="flex-1">
              <p className="font-bold text-lg">vs. {game?.opponent}</p>
              <p className="text-sky-300 text-xs">{game?.game_date ? new Date(game.game_date + 'T00:00:00').toLocaleDateString() : ''}</p>
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
          {(['atbats', 'pitching', 'score', 'recap'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${tab === t ? 'bg-blue-800 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {t === 'atbats' ? '🏏 At-Bats' : t === 'pitching' ? '⚾ Pitching' : t === 'score' ? '📊 Stats' : '📣 Recap'}
            </button>
          ))}
        </div>

        {/* AT-BATS TAB */}
        {tab === 'atbats' && (
          <>
            <button
              onClick={openNewAtBatForm}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl text-sm font-medium mb-4 transition-colors"
            >
              + Log At-Bat
            </button>

            {showAtBatForm && (
              <div className="bg-slate-900 border border-blue-900 rounded-2xl p-4 mb-4">
                <h3 className="font-semibold mb-3 text-amber-400">{atBatFormTitle}</h3>

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

                <div className="mb-3">
                  <span className="text-sm text-sky-300 block mb-2">Inning:</span>
                  <div className="flex flex-wrap gap-2">
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
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  {Object.entries(RESULT_LABELS).map(([key, { label, color }]) => (
                    <button
                      key={key}
                      onClick={() => setResult(key as ResultKey)}
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
                    Stole 3rd
                  </label>
                </div>

                <div className="flex gap-2">
                  <button onClick={saveAtBat} disabled={!selectedPlayer || !result} className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white py-2 rounded-xl text-sm font-medium transition-colors">Save</button>
                  <button onClick={() => { setShowAtBatForm(false); setEditingAtBat(null); }} className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                </div>
                {editingAtBat && (
                  <button
                    onClick={() => deleteAtBat(editingAtBat)}
                    className="w-full mt-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 py-2 rounded-xl text-sm transition-colors"
                  >
                    Delete At-Bat
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              {[...atBats].reverse().slice(0, 20).map(ab => {
                const player = players.find(p => p.id === ab.player_id);
                const { label, color } = RESULT_LABELS[ab.result] ?? { label: ab.result, color: 'bg-slate-600' };
                return (
                  <div key={ab.id} className="bg-slate-900 border border-blue-900 rounded-xl px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`${color} text-white text-xs font-bold px-2 py-0.5 rounded-lg`}>{label}</span>
                      <span className="text-sm">{player?.name}</span>
                      {ab.rbi > 0 && <span className="text-xs text-amber-400">{ab.rbi} RBI</span>}
                      {ab.run_scored && <span className="text-xs text-green-400">R</span>}
                      {ab.stolen_base && <span className="text-xs text-sky-300">SB</span>}
                      <span className="text-xs text-slate-500">Inn. {ab.inning}</span>
                    </div>
                    <button
                      onClick={() => openEditAtBatForm(ab)}
                      className="text-slate-500 hover:text-amber-400 text-xs px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors ml-1 flex-shrink-0"
                    >
                      Edit
                    </button>
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
              <p>😴 Rest: 21–35 = 1 day · 36–50 = 2 days · 51–65 = 3 days · 66+ = 4 days</p>
              <p>🚫 No pitching back-to-back games</p>
            </div>

            {/* Add Pitcher */}
            {unpitchedPlayers.length > 0 && (
              <>
                <button
                  onClick={() => setShowAddPitcher(true)}
                  className="w-full bg-blue-800 hover:bg-blue-700 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  + Add Pitcher
                </button>
                {showAddPitcher && (
                  <div className="bg-slate-900 border border-blue-900 rounded-2xl p-4">
                    <p className="text-sm font-medium text-sky-300 mb-3">Select a pitcher to add:</p>
                    <div className="space-y-2">
                      {unpitchedPlayers.map(p => (
                        <button
                          key={p.id}
                          onClick={() => addPitcher(p.id)}
                          className="w-full text-left px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm transition-colors"
                        >
                          #{p.jersey_number} {p.name}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setShowAddPitcher(false)} className="w-full mt-3 bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-sm transition-colors">Cancel</button>
                  </div>
                )}
              </>
            )}

            {gamePitchers.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-6">No pitchers added yet. Tap "+ Add Pitcher" to get started.</p>
            )}

            {gamePitchers.map(player => {
              const pc = pitchCounts.find(p => p.player_id === player.id);
              const count = pc?.count ?? 0;
              const pct = Math.min((count / 50) * 100, 100);
              const barColor = count >= 45 ? 'bg-red-500' : count >= 35 ? 'bg-amber-500' : 'bg-sky-400';
              const restDays = getRestDaysRequired(count);
              const restColor = restDays >= 3 ? 'text-red-400' : restDays === 2 ? 'text-amber-400' : restDays === 1 ? 'text-yellow-300' : 'text-green-400';
              const prev = prevPitchInfo[player.id];

              return (
                <div key={player.id} className="bg-slate-900 border border-blue-900 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{player.name}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-bold ${count >= 45 ? 'text-red-400' : count >= 35 ? 'text-amber-400' : 'text-white'}`}>{count}</span>
                      <button
                        onClick={() => deletePitcher(player)}
                        className="text-slate-600 hover:text-red-400 p-1 transition-colors"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>

                  {/* Rest eligibility from previous game */}
                  {prev && (
                    <div className={`text-xs px-3 py-2 rounded-lg mb-2 ${prev.eligible ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>
                      {prev.eligible
                        ? `✅ Eligible — last pitched ${prev.daysAvailable}d ago (${prev.lastCount} pitches, needed ${prev.daysRequired}d rest)`
                        : `🚫 Not eligible — last pitched ${prev.daysAvailable}d ago (${prev.lastCount} pitches, needs ${prev.daysRequired}d rest)`
                      }
                    </div>
                  )}

                  <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                    <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-medium ${restColor}`}>
                      {count > 0 ? `😴 ${restDays > 0 ? `${restDays} day${restDays > 1 ? 's' : ''} rest after game` : 'No rest required'}` : '—'}
                    </span>
                    <span className="text-xs text-slate-500">{count < 50 ? `${50 - count} pitches left` : 'Limit reached'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => removePitch(player.id)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-sm font-medium transition-colors">− 1</button>
                    <button onClick={() => addPitch(player.id)} disabled={count >= 50} className="flex-1 bg-blue-800 hover:bg-blue-700 disabled:opacity-40 py-2 rounded-xl text-sm font-bold transition-colors">+ 1 Pitch</button>
                  </div>
                  {count >= 50 && <p className="text-red-400 text-xs mt-2 text-center font-semibold">🛑 Pitch limit reached!</p>}
                  {count >= 45 && count < 50 && <p className="text-amber-400 text-xs mt-2 text-center">⚠️ {50 - count} pitch{50 - count !== 1 ? 'es' : ''} left</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* STATS TAB */}
        {tab === 'score' && (
          <div>
            <div className="flex gap-1 bg-slate-900 p-1 rounded-xl mb-4">
              <button
                onClick={() => setStatsView('game')}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${statsView === 'game' ? 'bg-blue-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                This Game
              </button>
              <button
                onClick={() => setStatsView('season')}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${statsView === 'season' ? 'bg-blue-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Season
              </button>
            </div>
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
                    <td className="py-2 pr-3 font-medium">
                      <span>{player.name}</span>
                      {player.jersey_number !== null && (
                        <span className="text-xs text-amber-400 ml-1">#{player.jersey_number}</span>
                      )}
                    </td>
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
          </div>
        )}

        {/* RECAP TAB */}
        {tab === 'recap' && (
          <div>
            <button
              onClick={generateRecap}
              disabled={recapLoading}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium mb-4 transition-colors"
            >
              {recapLoading ? 'Generating...' : recap ? '↺ Regenerate Recap' : '✨ Generate Game Recap'}
            </button>

            {recap && (
              <div className="bg-slate-900 border border-blue-900 rounded-2xl p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-200 mb-4">{recap}</p>
                <button
                  onClick={copyRecap}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${copied ? 'bg-green-700 text-white' : 'bg-blue-800 hover:bg-blue-700 text-white'}`}
                >
                  {copied ? '✓ Copied!' : 'Copy to Clipboard'}
                </button>
              </div>
            )}

            {!recap && !recapLoading && (
              <p className="text-slate-500 text-sm text-center py-8">Tap the button to generate a recap you can paste into your parent group chat.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
