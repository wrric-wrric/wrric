"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Trophy, Eye, EyeOff, Lock, Globe, Loader2, Medal } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LeaderboardPage() {
  const { eventId } = useParams();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('hidden');
  const [phaseLoading, setPhaseLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [judgeGroups, setJudgeGroups] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedJudgeGroup, setSelectedJudgeGroup] = useState('');

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return { Authorization: `Bearer ${token}` };
  };

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/admin/hackathons/${eventId}/leaderboard`;
      if (selectedCategory) url = `/api/admin/hackathons/${eventId}/leaderboard/by-category/${selectedCategory}`;
      else if (selectedJudgeGroup) url = `/api/admin/hackathons/${eventId}/leaderboard/by-group/${selectedJudgeGroup}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) setEntries(await res.json());
    } catch { } finally { setLoading(false); }
  }, [eventId, selectedCategory, selectedJudgeGroup]);

  const fetchPhase = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/leaderboard-phase`, { headers: getHeaders() });
      if (res.ok) { const d = await res.json(); setPhase(d.phase ?? 'hidden'); }
    } catch { }
  }, [eventId]);

  const fetchFilters = useCallback(async () => {
    try {
      const [cRes, gRes] = await Promise.all([
        fetch(`/api/admin/hackathons/${eventId}/categories`, { headers: getHeaders() }),
        fetch(`/api/admin/hackathons/${eventId}/judge-groups`, { headers: getHeaders() }),
      ]);
      if (cRes.ok) setCategories(await cRes.json());
      if (gRes.ok) setJudgeGroups(await gRes.json());
    } catch { }
  }, [eventId]);

  useEffect(() => { fetchPhase(); fetchFilters(); }, [fetchPhase, fetchFilters]);
  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const setLeaderboardPhase = async (newPhase: string) => {
    setPhaseLoading(true);
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/leaderboard-phase`, {
        method: 'PUT', headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: newPhase }),
      });
      if (res.ok) { setPhase(newPhase); toast.success(`Leaderboard is now ${newPhase}`); }
      else toast.error('Failed to update visibility');
    } catch { toast.error('Network error'); }
    finally { setPhaseLoading(false); }
  };

  const phaseOptions = [
    { value: 'hidden', label: 'Hidden', icon: EyeOff, desc: 'Not visible to participants' },
    { value: 'locked', label: 'Locked', icon: Lock, desc: 'Visible but fixed (no live updates)' },
    { value: 'public', label: 'Public', icon: Globe, desc: 'Live and visible to all' },
  ];

  const rankColor = (rank: number) => {
    if (rank === 1) return 'text-amber-500';
    if (rank === 2) return 'text-slate-400';
    if (rank === 3) return 'text-amber-700';
    return 'text-slate-500';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-blue-600" />
            Leaderboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Live rankings for all participants</p>
        </div>
      </div>

      {/* Visibility control */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Visibility Control</p>
        <div className="flex flex-wrap gap-2">
          {phaseOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setLeaderboardPhase(opt.value)}
              disabled={phaseLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-all ${phase === opt.value
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                } disabled:opacity-50`}
            >
              <opt.icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          {phaseOptions.find(p => p.value === phase)?.desc}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Filter</p>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium">Category:</label>
            <select value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setSelectedJudgeGroup(''); }}
              className="text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Categories</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {judgeGroups.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium">Judge Group:</label>
              <select value={selectedJudgeGroup} onChange={e => { setSelectedJudgeGroup(e.target.value); setSelectedCategory(''); }}
                className="text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Groups</option>
                {judgeGroups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
            <span className="text-sm text-slate-500">Loading rankings...</span>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-380px)]">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">Rank</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Participant</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Total Score</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Judges</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e: any, idx) => (
                  <tr key={e.participant_id || idx} className={`hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-4 py-3.5">
                      <span className={`text-lg font-bold ${rankColor(e.rank)}`}>
                        {e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : `#${e.rank}`}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-slate-800">{e.first_name} {e.last_name}</p>
                      <p className="text-xs text-slate-400">{e.email || '—'}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-slate-600 max-w-xs truncate">{e.project_title || '—'}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
                        {typeof e.total_score === 'number' ? e.total_score.toFixed(2) : e.total_score ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm text-slate-500">{e.judge_count ?? '—'}</span>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <Trophy className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                      <p className="text-sm font-medium text-slate-400">No results yet</p>
                      <p className="text-xs text-slate-300 mt-1">Scores will appear here once judges submit</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
