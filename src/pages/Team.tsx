import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Team as TeamType, Player, Game } from '../lib/types';

export default function Team() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<TeamType | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [tab, setTab] = useState<'roster' | 'games'>('roster');

  // Add player form
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');

  // Edit player
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editName, setEditName] = useState('');
  const [editJersey, setEditJersey] = useState('');

  // Game form
  const [showGameForm, setShowGameForm] = useState(false);
  const [opponent, setOpponent] = useState('');
  const [gameDate, setGameDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchAll();
  }, [teamId]);

  const fetchAll = async () => {
    const [teamRes, playersRes, gamesRes] = await Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).single(),
      supabase.from('players').select('*').eq('team_id', teamId).order('jersey_number'),
      supabase.from('games').select('*').eq('team_id', teamId).order('game_date', { ascending: false }),
    ]);
    setTeam(teamRes.data);
    setPlayers(playersRes.data ?? []);
    setGames(gamesRes.data ?? []);
  };

  const addPlayer = async () => {
    if (!playerName.trim()) return;
    await supabase.from('players').insert({
      team_id: teamId,
      name: playerName,
      jersey_number: jerseyNumber ? parseInt(jerseyNumber) : null,
    });
    setPlayerName('');
    setJerseyNumber('');
    setShowPlayerForm(false);
    fetchAll();
  };

  const openEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setEditName(player.name);
    setEditJersey(player.jersey_number !== null ? String(player.jersey_number) : '');
  };

  const saveEditPlayer = async () => {
    if (!editingPlayer || !editName.trim()) return;
    await supabase.from('players').update({
      name: editName,
      jersey_number: editJersey ? parseInt(editJersey) : null,
    }).eq('id', editingPlayer.id);
    setEditingPlayer(null);
    fetchAll();
  };

  const addGame = async () => {
    if (!opponent.trim()) return;
    const { data } = await supabase.from('games').insert({
      team_id: teamId,
      opponent,
      game_date: gameDate,
    }).select().single();
    setOpponent('');
    setShowGameForm(false);
    if (data) navigate(`/game/${data.id}`);
  };

  const deletePlayer = async (playerId: string, name: string) => {
    if (!confirm(`Remove ${name} from the roster? This cannot be undone.`)) return;
    await supabase.from('players').delete().eq('id', playerId);
    fetchAll();
  };

  const deleteGame = async (gameId: string, opponent: string) => {
    if (!confirm(`Delete game vs. ${opponent}? This cannot be undone.`)) return;
    await supabase.from('games').delete().eq('id', gameId);
    fetchAll();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6 pt-4">
          <Link to="/" className="text-sky-300 hover:text-white text-2xl">‹</Link>
          <div>
            <h1 className="text-2xl font-bold">{team?.name}</h1>
            <p className="text-sky-300 text-sm">{team?.season} Season</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-900 p-1 rounded-xl mb-6">
          <button
            onClick={() => setTab('roster')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'roster' ? 'bg-blue-800 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Roster ({players.length})
          </button>
          <button
            onClick={() => setTab('games')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'games' ? 'bg-blue-800 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Games ({games.length})
          </button>
        </div>

        {tab === 'roster' && (
          <>
            <button
              onClick={() => setShowPlayerForm(true)}
              className="w-full bg-blue-800 hover:bg-blue-900 py-3 rounded-xl text-sm font-medium mb-4 transition-colors"
            >
              + Add Player
            </button>

            {showPlayerForm && (
              <div className="bg-slate-900 rounded-2xl p-4 mb-4 border border-blue-900">
                <input
                  type="text"
                  placeholder="Player name"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
                <input
                  type="number"
                  placeholder="Jersey number (optional)"
                  value={jerseyNumber}
                  onChange={e => setJerseyNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
                <div className="flex gap-2">
                  <button onClick={addPlayer} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-xl text-sm font-medium transition-colors">Add</button>
                  <button onClick={() => setShowPlayerForm(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {/* Edit player inline form */}
            {editingPlayer && (
              <div className="bg-slate-900 rounded-2xl p-4 mb-4 border border-amber-700">
                <p className="text-sm font-medium text-amber-400 mb-3">Edit Player</p>
                <input
                  type="text"
                  placeholder="Player name"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
                <input
                  type="number"
                  placeholder="Jersey number (optional)"
                  value={editJersey}
                  onChange={e => setEditJersey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
                <div className="flex gap-2">
                  <button onClick={saveEditPlayer} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-xl text-sm font-medium transition-colors">Save</button>
                  <button onClick={() => setEditingPlayer(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {players.map(player => (
                <div key={player.id} className="bg-slate-900 border border-blue-900 rounded-2xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {player.jersey_number !== null && (
                      <span className="w-8 h-8 bg-blue-800 rounded-full flex items-center justify-center text-xs font-bold text-amber-400">{player.jersey_number}</span>
                    )}
                    <span className="font-medium">{player.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditPlayer(player)}
                      className="text-slate-500 hover:text-amber-400 text-xs px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      Edit
                    </button>
                    <button onClick={() => deletePlayer(player.id, player.name)} className="text-slate-600 hover:text-red-400 text-lg transition-colors">×</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'games' && (
          <>
            <button
              onClick={() => setShowGameForm(true)}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl text-sm font-medium mb-4 transition-colors"
            >
              ▶ Start New Game
            </button>

            {showGameForm && (
              <div className="bg-slate-900 rounded-2xl p-4 mb-4 border border-blue-900">
                <input
                  type="text"
                  placeholder="Opponent team name"
                  value={opponent}
                  onChange={e => setOpponent(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
                <input
                  type="date"
                  value={gameDate}
                  onChange={e => setGameDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
                <div className="flex gap-2">
                  <button onClick={addGame} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-xl text-sm font-medium transition-colors">Start Game</button>
                  <button onClick={() => setShowGameForm(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {games.map(game => (
                <div key={game.id} className="flex items-center gap-2">
                  <Link
                    to={`/game/${game.id}`}
                    className="flex-1 block bg-slate-900 hover:bg-slate-800 border border-blue-900 rounded-2xl px-4 py-3 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">vs. {game.opponent}</p>
                        <p className="text-sm text-sky-300">{new Date(game.game_date + 'T00:00:00').toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-amber-400">{game.home_score} – {game.away_score}</p>
                        <span className="text-sky-300 text-sm">›</span>
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={() => deleteGame(game.id, game.opponent)}
                    className="text-slate-600 hover:text-red-400 text-xl px-2 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
