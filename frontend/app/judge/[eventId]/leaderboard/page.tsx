"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trophy, ArrowLeft, Filter, Users, Medal } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  participant_count: number;
}

export default function JudgeLeaderboardPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('hidden');
  
  // Filters
  const [categories, setCategories] = useState<Category[]>([]);
  const [myCategories, setMyCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = useMemo(() => ({
    Authorization: `Bearer ${token}`
  }), [token]);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/judge/hackathons/${eventId}/leaderboard`;
      if (selectedCategory) {
        url = `/api/judge/hackathons/${eventId}/leaderboard/by-category/${selectedCategory}`;
      }
      const res = await fetch(url, { headers });
      if (res.ok) setEntries(await res.json());
    } catch { } finally { setLoading(false); }
  }, [eventId, selectedCategory, headers]);

  const fetchPhase = useCallback(async () => {
    try {
      const res = await fetch(`/api/judge/hackathons/${eventId}/leaderboard-phase`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPhase(data.phase || 'hidden');
      }
    } catch { }
  }, [eventId, headers]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/judge/hackathons/${eventId}/categories`, { headers });
      if (res.ok) setCategories(await res.json());
    } catch { }
  }, [eventId, headers]);

  const fetchMyCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/judge/hackathons/${eventId}/my-categories`, { headers });
      if (res.ok) setMyCategories(await res.json());
    } catch { }
  }, [eventId, headers]);

  useEffect(() => { 
    fetchLeaderboard();
    fetchPhase();
    fetchCategories();
    fetchMyCategories();
  }, [fetchLeaderboard, fetchPhase, fetchCategories, fetchMyCategories]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const rankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-gray-300';
    if (rank === 3) return 'text-amber-600';
    return '';
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { emoji: '🥇', bg: 'bg-yellow-500/20' };
    if (rank === 2) return { emoji: '🥈', bg: 'bg-gray-400/20' };
    if (rank === 3) return { emoji: '🥉', bg: 'bg-amber-600/20' };
    return { emoji: String(rank), bg: '' };
  };

  const criteriaNames = entries.length > 0 ? entries[0].criteria_scores?.map((c: any) => c.criterion_name || c.name) || [] : [];

  return (
    <div className="p-4 sm:p-6 overflow-auto h-full">
      {/* Back Button */}
      <button 
        onClick={() => router.push(`/judge/${eventId}`)} 
        className="text-sm sm:text-xs dark:text-gray-400 text-gray-500 hover:text-[#00FB75] inline-flex items-center gap-1.5 mb-4 py-1"
      >
        <ArrowLeft className="w-4 h-4 sm:w-3 sm:h-3" />Back to dashboard
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-xl sm:text-lg font-bold flex items-center gap-2">
          <Trophy className="w-6 h-6 sm:w-5 sm:h-5 text-[#00FB75]" />Leaderboard
        </h1>
        
        {/* Phase indicator */}
        <span className={`self-start sm:self-auto px-3 py-1.5 sm:px-2 sm:py-1 rounded-full text-sm sm:text-xs font-medium ${
          phase === 'public' ? 'bg-green-500/20 text-green-400' :
          phase === 'locked' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-gray-500/20 text-gray-400'
        }`}>
          {phase === 'public' ? '🌐 Public' : phase === 'locked' ? '🔐 Locked' : '🔒 Hidden'}
        </span>
      </div>

      {/* Phase Description */}
      <div className="mb-4 p-3 rounded-xl dark:bg-[#1A1A1A]/50 bg-gray-50 text-sm sm:text-xs dark:text-gray-400 text-gray-500">
        {phase === 'hidden' && '🔒 Leaderboard is visible only to admins and judges.'}
        {phase === 'locked' && '🔐 Final scores visible to judges/admins. Rankings computed but not public.'}
        {phase === 'public' && '🌐 Leaderboard is publicly visible. Participants can view their rankings.'}
      </div>

      {/* My Categories Quick Access */}
      {myCategories.length > 0 && (
        <div className="mb-4 p-4 sm:p-3 rounded-xl dark:bg-[#121212] bg-white border dark:border-[#1A1A1A] border-gray-200">
          <p className="text-sm sm:text-xs font-medium mb-3 sm:mb-2 dark:text-gray-400 text-gray-500">Your Assigned Categories:</p>
          <div className="flex flex-wrap gap-2">
            {myCategories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(selectedCategory === c.id ? '' : c.id)}
                className={`px-4 py-2 sm:px-3 sm:py-1.5 text-sm sm:text-xs rounded-full transition-colors active:scale-95 ${
                  selectedCategory === c.id
                    ? 'bg-[#00FB75] text-black font-semibold'
                    : 'dark:bg-[#1A1A1A] bg-gray-100 dark:hover:bg-[#252525] hover:bg-gray-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All Categories Filter */}
      {categories.length > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span className="text-sm sm:text-xs dark:text-gray-400 text-gray-500 inline-flex items-center gap-1.5">
            <Filter className="w-4 h-4 sm:w-3 sm:h-3" />Filter by category:
          </span>
          
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm sm:text-xs rounded-lg border dark:border-[#1A1A1A] border-gray-200 dark:bg-[#0A0A0A] bg-white"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.participant_count})</option>
            ))}
          </select>
          
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory('')}
              className="px-3 py-1.5 text-sm sm:text-xs text-[#00FB75] font-medium"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00FB75]" />
        </div>
      ) : (
        <>
          {/* Mobile Cards View */}
          <div className="block sm:hidden space-y-3">
            {entries.map((e: any) => {
              const badge = getRankBadge(e.rank);
              return (
                <div 
                  key={e.participant_id} 
                  className={`dark:bg-[#121212] bg-white border dark:border-[#1A1A1A] border-gray-200 rounded-xl p-4 ${e.rank <= 3 ? 'ring-1 ring-[#00FB75]/30' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Rank */}
                    <div className={`w-10 h-10 rounded-full ${badge.bg || 'dark:bg-[#1A1A1A] bg-gray-100'} flex items-center justify-center text-lg font-bold ${rankColor(e.rank)}`}>
                      {badge.emoji}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base">{e.name || `${e.first_name} ${e.last_name}`}</h3>
                      {e.team_name && (
                        <p className="text-sm dark:text-gray-400 text-gray-500 flex items-center gap-1 mt-0.5">
                          <Users className="w-3.5 h-3.5" />{e.team_name}
                        </p>
                      )}
                      {e.project_title && (
                        <p className="text-sm dark:text-gray-500 text-gray-400 mt-1 line-clamp-1">{e.project_title}</p>
                      )}
                    </div>
                    
                    {/* Score */}
                    <div className="text-right">
                      <div className="text-xl font-bold text-[#00FB75]">{e.total_weighted_score}</div>
                      <div className="text-xs dark:text-gray-500 text-gray-400">{e.judge_count} judge{e.judge_count !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  
                  {/* Criteria Scores */}
                  {e.criteria_scores && e.criteria_scores.length > 0 && (
                    <div className="mt-3 pt-3 border-t dark:border-[#1A1A1A] border-gray-100 grid grid-cols-2 gap-2">
                      {e.criteria_scores.map((cs: any) => (
                        <div key={cs.criterion_id} className="text-xs">
                          <span className="dark:text-gray-500 text-gray-400">{cs.criterion_name}:</span>
                          <span className="ml-1 font-medium">{cs.avg_score}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            
            {entries.length === 0 && (
              <div className="text-center py-12 px-4">
                <Medal className="w-12 h-12 mx-auto mb-4 dark:text-gray-600 text-gray-300" />
                <p className="dark:text-gray-400 text-gray-500">No scores yet</p>
              </div>
            )}
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden sm:block dark:bg-[#121212] bg-white border dark:border-[#1A1A1A] border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="dark:bg-[#1A1A1A] bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium dark:text-gray-400 text-gray-500 w-12">#</th>
                  <th className="px-4 py-3 font-medium dark:text-gray-400 text-gray-500">Participant</th>
                  <th className="px-4 py-3 font-medium dark:text-gray-400 text-gray-500">Team</th>
                  <th className="px-4 py-3 font-medium dark:text-gray-400 text-gray-500">Project</th>
                  {criteriaNames.map((name: string) => (
                    <th key={name} className="px-4 py-3 font-medium dark:text-gray-400 text-gray-500 text-center">{name}</th>
                  ))}
                  <th className="px-4 py-3 font-medium dark:text-gray-400 text-gray-500 text-center">Total</th>
                  <th className="px-4 py-3 font-medium dark:text-gray-400 text-gray-500 text-center">Judges</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e: any) => (
                  <tr 
                    key={e.participant_id} 
                    className={`border-t dark:border-[#1A1A1A] border-gray-100 ${e.rank <= 3 ? 'dark:bg-[#1A1A1A]/30 bg-gray-50' : ''}`}
                  >
                    <td className={`px-4 py-3 font-bold ${rankColor(e.rank)}`}>
                      {e.rank === 1 && '🥇'}
                      {e.rank === 2 && '🥈'}
                      {e.rank === 3 && '🥉'}
                      {e.rank > 3 && e.rank}
                    </td>
                    <td className="px-4 py-3 font-medium">{e.name || `${e.first_name} ${e.last_name}`}</td>
                    <td className="px-4 py-3 dark:text-gray-400 text-gray-500">{e.team_name || '-'}</td>
                    <td className="px-4 py-3 dark:text-gray-400 text-gray-500 max-w-xs truncate">{e.project_title || '-'}</td>
                    {e.criteria_scores?.map((cs: any) => (
                      <td key={cs.criterion_id} className="px-4 py-3 text-center">
                        <span className="text-xs">{cs.avg_score}</span>
                        <span className="text-[10px] dark:text-gray-500 text-gray-400 ml-1">({cs.weighted_score})</span>
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center font-bold text-[#00FB75]">{e.total_weighted_score}</td>
                    <td className="px-4 py-3 text-center dark:text-gray-400 text-gray-500">{e.judge_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entries.length === 0 && (
              <div className="text-center py-8 text-sm dark:text-gray-400 text-gray-500">
                No scores yet
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
