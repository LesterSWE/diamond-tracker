import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Team } from '../lib/types';

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [season, setSeason] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    const { data } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
    setTeams(data ?? []);
    setLoading(false);
  };

  const createTeam = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from('teams').insert({ name, season });
    if (!error) {
      setName('');
      setShowForm(false);
      fetchTeams();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-8 pt-4">
          <div>
            <h1 className="text-3xl font-bold text-white">⚾ Diamond Tracker</h1>
            <p className="text-sky-300 text-sm mt-1">Little League Stats</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-800 hover:bg-blue-900 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            + New Team
          </button>
        </div>

        {showForm && (
          <div className="bg-slate-900 rounded-2xl p-4 mb-6 border border-blue-900">
            <h2 className="font-semibold mb-4 text-amber-400">New Team</h2>
            <input
              type="text"
              placeholder="Team name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
            <input
              type="text"
              placeholder="Season (e.g. 2025)"
              value={season}
              onChange={e => setSeason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
            <div className="flex gap-2">
              <button onClick={createTeam} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-xl text-sm font-medium transition-colors">
                Create
              </button>
              <button onClick={() => setShowForm(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-slate-500 text-center py-12">Loading...</p>
        ) : teams.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p className="text-4xl mb-4">⚾</p>
            <p>No teams yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {teams.map(team => (
              <Link
                key={team.id}
                to={`/team/${team.id}`}
                className="block bg-slate-900 hover:bg-slate-800 border border-blue-900 rounded-2xl p-4 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{team.name}</p>
                    <p className="text-sm text-sky-300">{team.season} Season</p>
                  </div>
                  <span className="text-amber-400 text-lg">›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
