import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Team, Player, Game, AtBat } from '../lib/types';

export default function SeasonStats() {
  const { teamId } = useParams<{ teamId: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [tab, setTab] = useState<'players' | 'games'>('players');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, [teamId]);

  const fetchAll = async () => {
    const [teamRes, playersRes, gamesRes] = await Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).single(),
      supabase.from('players').select('*').eq('team_id', teamId).order('name'),
      supabase.from('games').select('*').eq('team_id', teamId).order('game_date'),
    ]);
    setTeam(teamRes.data);
    setPlayers(playersRes.data ?? []);
    const teamGames: Game[] = gamesRes.data ?? [];
    setGames(teamGames);

    if (teamGames.length > 0) {
      const gameIds = teamGames.map(g => g.id);
      const { data: allAtBats } = await supabase
        .from('at_bats')
        .select('*')
        .in('game_id', gameIds);
      setAtBats(allAtBats ?? []);
    }
  };

  const computePlayerStats = (playerId: string, sourceAtBats: AtBat[]) => {
    const pAtBats = sourceAtBats.filter(ab => ab.player_id === playerId);
    const hits = pAtBats.filter(ab => ['single', 'double', 'triple', 'hr'].includes(ab.result)).length;
    const abs = pAtBats.filter(ab => ab.result !== 'walk').length;
    const walks = pAtBats.filter(ab => ab.result === 'walk').length;
    const ks = pAtBats.filter(ab => ab.result === 'strikeout').length;
    const runs = pAtBats.filter(ab => ab.run_scored).length;
    const rbis = pAtBats.reduce((sum, ab) => sum + ab.rbi, 0);
    const sbs = pAtBats.filter(ab => ab.stolen_base).length;
    const doubles = pAtBats.filter(ab => ab.result === 'double').length;
    const triples = pAtBats.filter(ab => ab.result === 'triple').length;
    const hrs = pAtBats.filter(ab => ab.result === 'hr').length;
    const avg = abs > 0 ? (hits / abs).toFixed(3).replace('0.', '.') : '---';
    return { hits, abs, walks, ks, runs, rbis, sbs, doubles, triples, hrs, avg };
  };

  const playerSeasonStats = players.map(p => ({
    player: p,
    ...computePlayerStats(p.id, atBats),
  })).sort((a, b) => {
    // Sort by AVG descending, players with no ABs at the bottom
    if (a.abs === 0 && b.abs === 0) return 0;
    if (a.abs === 0) return 1;
    if (b.abs === 0) return -1;
    return (b.hits / b.abs) - (a.hits / a.abs);
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6 pt-4">
          <Link to={`/team/${teamId}`} className="text-sky-300 hover:text-white text-2xl">‹</Link>
          <div>
            <h1 className="text-2xl font-bold">{team?.name}</h1>
            <p className="text-sky-300 text-sm">{team?.season} Season Stats</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-900 p-1 rounded-xl mb-6">
          <button
            onClick={() => setTab('players')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'players' ? 'bg-blue-800 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Players ({players.length})
          </button>
          <button
            onClick={() => setTab('games')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'games' ? 'bg-blue-800 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Games ({games.length})
          </button>
        </div>

        {/* PLAYERS TAB */}
        {tab === 'players' && (
          <div className="space-y-2">
            {playerSeasonStats.map(({ player, hits, abs, walks, ks, runs, rbis, sbs, doubles, triples, hrs, avg }) => {
              const isExpanded = expandedPlayer === player.id;
              const gameBreakdown = games.map(game => {
                const stats = computePlayerStats(player.id, atBats.filter(ab => ab.game_id === game.id));
                return { game, stats };
              }).filter(({ stats }) => stats.abs > 0 || stats.walks > 0);

              return (
                <div key={player.id} className="bg-slate-900 border border-blue-900 rounded-2xl overflow-hidden">
                  <button
                    className="w-full px-4 py-3 flex items-center justify-between"
                    onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}
                  >
                    <div className="flex items-center gap-3">
                      {player.jersey_number !== null && (
                        <span className="w-8 h-8 bg-blue-800 rounded-full flex items-center justify-center text-xs font-bold text-amber-400">{player.jersey_number}</span>
                      )}
                      <div className="text-left">
                        <p className="font-medium">{player.name}</p>
                        <p className="text-xs text-slate-400">{hits}/{abs} AB · {walks} BB · {runs} R · {rbis} RBI</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xl font-bold ${abs === 0 ? 'text-slate-500' : avg === '.000' ? 'text-red-400' : 'text-amber-400'}`}>{avg}</span>
                      <span className="text-slate-500 text-sm">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-blue-900 px-4 pb-3 pt-2">
                      {/* Extra stats row */}
                      <div className="flex gap-4 text-xs text-slate-400 mb-3">
                        <span><span className="text-white font-medium">{doubles}</span> 2B</span>
                        <span><span className="text-white font-medium">{triples}</span> 3B</span>
                        <span><span className="text-white font-medium">{hrs}</span> HR</span>
                        <span><span className="text-white font-medium">{ks}</span> K</span>
                        <span><span className="text-white font-medium">{sbs}</span> SB</span>
                      </div>
                      {/* Game-by-game */}
                      {gameBreakdown.length === 0 ? (
                        <p className="text-xs text-slate-500">No at-bats recorded.</p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs text-sky-300 font-medium mb-1">Game by Game</p>
                          {gameBreakdown.map(({ game, stats }) => (
                            <div key={game.id} className="flex items-center justify-between text-xs bg-slate-800 rounded-lg px-3 py-2">
                              <span className="text-slate-300">vs. {game.opponent} <span className="text-slate-500">{new Date(game.game_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></span>
                              <span className="text-slate-300">{stats.hits}/{stats.abs} · {stats.runs}R · {stats.rbis}RBI</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* GAMES TAB */}
        {tab === 'games' && (
          <div className="space-y-2">
            {games.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-12">No games logged yet.</p>
            )}
            {games.map(game => {
              const gameAtBats = atBats.filter(ab => ab.game_id === game.id);
              const totalHits = gameAtBats.filter(ab => ['single', 'double', 'triple', 'hr'].includes(ab.result)).length;
              const totalAbs = gameAtBats.filter(ab => ab.result !== 'walk').length;
              const won = game.home_score > game.away_score;
              const tied = game.home_score === game.away_score;

              return (
                <Link
                  key={game.id}
                  to={`/game/${game.id}`}
                  className="block bg-slate-900 hover:bg-slate-800 border border-blue-900 rounded-2xl px-4 py-3 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="font-medium">vs. {game.opponent}</p>
                      <p className="text-xs text-sky-300">{new Date(game.game_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-lg ${won ? 'text-green-400' : tied ? 'text-slate-400' : 'text-red-400'}`}>
                        {game.home_score} – {game.away_score}
                      </p>
                      <p className="text-xs text-slate-500">{totalHits}H / {totalAbs}AB</p>
                    </div>
                  </div>
                </Link>
              );
            })}
            {games.length > 0 && (
              <div className="bg-slate-900 border border-blue-900 rounded-2xl px-4 py-3 mt-4">
                <p className="text-xs text-sky-300 font-medium mb-2">Season Record</p>
                {(() => {
                  const wins = games.filter(g => g.home_score > g.away_score).length;
                  const losses = games.filter(g => g.home_score < g.away_score).length;
                  const ties = games.filter(g => g.home_score === g.away_score).length;
                  const totalRuns = games.reduce((s, g) => s + g.home_score, 0);
                  const oppRuns = games.reduce((s, g) => s + g.away_score, 0);
                  return (
                    <div className="flex gap-6 text-sm">
                      <div><span className="text-2xl font-bold text-green-400">{wins}</span><span className="text-slate-400 text-xs ml-1">W</span></div>
                      <div><span className="text-2xl font-bold text-red-400">{losses}</span><span className="text-slate-400 text-xs ml-1">L</span></div>
                      {ties > 0 && <div><span className="text-2xl font-bold text-slate-400">{ties}</span><span className="text-slate-400 text-xs ml-1">T</span></div>}
                      <div className="ml-auto text-right">
                        <p className="text-xs text-slate-400">Runs</p>
                        <p className="font-bold text-amber-400">{totalRuns} – {oppRuns}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
