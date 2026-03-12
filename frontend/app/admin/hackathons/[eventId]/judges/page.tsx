"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Plus, Trash2, UserPlus, Search, Users, Loader2,
  ChevronDown, Check, X, User, UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function JudgesPage() {
  const { eventId } = useParams();
  const [judges, setJudges] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [participantSearch, setParticipantSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedJudge, setSelectedJudge] = useState<string | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'individual' | 'group'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // ── Auth helper – read inside callbacks to avoid stale closures ──────────
  const getAuthHeaders = (): Record<string, string> => {
    const tok = typeof window !== 'undefined'
      ? (localStorage.getItem('token') || sessionStorage.getItem('token'))
      : null;
    return { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' };
  };

  // ── Fetch judges ──────────────────────────────────────────────────────────
  const fetchJudges = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/judges`, { headers: getAuthHeaders() });
      const data = await res.json();
      setJudges(Array.isArray(data) ? data : []);
    } catch { setJudges([]); } finally { setLoading(false); }
  }, [eventId]);

  // ── Fetch participants (for assignment panel) ─────────────────────────────
  const fetchParticipants = useCallback(async () => {
    setParticipantsLoading(true);
    try {
      const res = await fetch(
        `/api/admin/hackathons/${eventId}/participants?limit=500`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) { setParticipantsLoading(false); return; }
      const data = await res.json();
      setParticipants(data.items || []);
    } catch {
      // silently fail, will show empty state
    } finally { setParticipantsLoading(false); }
  }, [eventId]);

  useEffect(() => {
    fetchJudges();
    fetchParticipants();
  }, [fetchJudges, fetchParticipants]);

  // ── Search platform users to add as judge ────────────────────────────────
  const searchUsers = async () => {
    if (!userSearch.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/admin/users?search=${encodeURIComponent(userSearch)}&limit=10`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json();
      setSearchResults(data.users || data.items || data || []);
    } catch { } finally { setIsSearching(false); }
  };

  const addJudge = async (userId: string, username: string) => {
    await fetch(`/api/admin/hackathons/${eventId}/judges`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ user_id: userId, display_name: username }),
    });
    setSearchResults([]);
    setUserSearch('');
    toast.success(`${username} added as judge`);
    fetchJudges();
  };

  const removeJudge = async (judgeId: string) => {
    if (!confirm('Remove this judge?')) return;
    await fetch(`/api/admin/hackathons/${eventId}/judges/${judgeId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    toast.success('Judge removed');
    if (selectedJudge === judgeId) { setSelectedJudge(null); setSelectedParticipants([]); }
    fetchJudges();
  };

  const assignParticipants = async () => {
    if (!selectedJudge || selectedParticipants.length === 0) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/judges/${selectedJudge}/assign`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ participant_ids: selectedParticipants }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.detail || 'Assignment failed');
        return;
      }
      toast.success(`Assigned ${selectedParticipants.length} participant(s)`);
      setSelectedParticipants([]);
      fetchJudges();
    } catch {
      toast.error('Assignment failed');
    } finally { setIsSubmitting(false); }
  };

  // ── Derived data ─────────────────────────────────────────────────────────
  const selectedJudgeData = judges.find(j => j.id === selectedJudge);
  // Use the assigned_participant_ids list returned from the backend
  const currentlyAssignedIds: string[] = selectedJudgeData?.assigned_participant_ids || [];

  const filteredParticipants = participants.filter(p => {
    const matchesType =
      typeFilter === 'all' ||
      (typeFilter === 'group' && (p.team_name || p.participant_type === 'Group')) ||
      (typeFilter === 'individual' && !p.team_name && p.participant_type !== 'Group');

    const q = participantSearch.toLowerCase();
    const matchesSearch = !q ||
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.team_name || '').toLowerCase().includes(q) ||
      (p.organization || '').toLowerCase().includes(q);

    return matchesType && matchesSearch;
  });

  const selectAll = () => {
    const selectable = filteredParticipants
      .filter(p => !currentlyAssignedIds.includes(p.id))
      .map(p => p.id);
    setSelectedParticipants(selectable);
  };

  const clearAll = () => setSelectedParticipants([]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-sm">Loading judges...</span>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          Judges Management
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Assign judges and allocate participants for evaluation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ── LEFT COLUMN ────────────────────────────────────────────────── */}
        <div className="lg:col-span-5 space-y-4">

          {/* Add judge card */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-600" /> Add Judge
            </h2>
            <p className="text-xs text-slate-500">Search for a registered user to add as a judge for this event.</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchUsers()}
                  placeholder="Name, email or username..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button onClick={searchUsers} disabled={isSearching}
                className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                {searchResults.map((u: any) => (
                  <button key={u.id} onClick={() => addJudge(u.id, u.username)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center justify-between transition-colors group">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700">{u.username}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                    <Plus className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                  </button>
                ))}
              </div>
            )}
            {searchResults.length === 0 && userSearch && !isSearching && (
              <p className="text-xs text-slate-400 text-center py-2">No users found for &quot;{userSearch}&quot;</p>
            )}
          </div>

          {/* Assignment panel – visible when a judge is selected */}
          {selectedJudge && (
            <div className="bg-white border border-blue-200 rounded-lg shadow-sm p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    Assign to:{' '}
                    <span className="text-blue-700">
                      {selectedJudgeData?.display_name || selectedJudgeData?.username}
                    </span>
                  </h2>
                  <button
                    onClick={() => { setSelectedJudge(null); setSelectedParticipants([]); }}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mt-1">
                    <X className="w-3 h-3" /> Cancel selection
                  </button>
                </div>
                <div className="flex gap-2 text-xs">
                  <button onClick={selectAll}
                    className="px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                    Select all
                  </button>
                  <button onClick={clearAll}
                    className="px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                    Clear
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    value={participantSearch}
                    onChange={e => setParticipantSearch(e.target.value)}
                    placeholder="Search participants..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="relative">
                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value as any)}
                    className="pl-2 pr-6 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none bg-white">
                    <option value="all">All types</option>
                    <option value="individual">Individual</option>
                    <option value="group">Group / Team</option>
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Participant count badge */}
              <p className="text-xs text-slate-500">
                {filteredParticipants.length} participant{filteredParticipants.length !== 1 ? 's' : ''} shown
                {participants.length > 0 && ` · ${participants.length} total`}
                {selectedParticipants.length > 0 && (
                  <span className="ml-1 text-blue-600 font-semibold">
                    · {selectedParticipants.length} selected
                  </span>
                )}
              </p>

              {/* Participant checklist */}
              <div className="max-h-64 overflow-y-auto space-y-1 border border-slate-100 rounded-md p-1">
                {participantsLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Loading participants…</span>
                  </div>
                ) : filteredParticipants.length === 0 ? (
                  <div className="text-center py-8 space-y-1">
                    <Users className="w-6 h-6 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-400">
                      {participants.length === 0
                        ? 'No participants registered yet. Add them on the Participants page.'
                        : 'No participants match your filters.'}
                    </p>
                  </div>
                ) : filteredParticipants.map(p => {
                  const checked = selectedParticipants.includes(p.id);
                  const alreadyAssigned = currentlyAssignedIds.includes(p.id);
                  const isGroup = !!(p.team_name || p.participant_type === 'Group');
                  return (
                    <label key={p.id} className={`flex items-center gap-3 px-3 py-2.5 rounded cursor-pointer transition-colors
                      ${alreadyAssigned ? 'opacity-50 cursor-not-allowed bg-slate-50' : checked ? 'bg-blue-600 text-white' : 'hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        disabled={alreadyAssigned}
                        checked={checked}
                        onChange={e => setSelectedParticipants(
                          e.target.checked
                            ? [...selectedParticipants, p.id]
                            : selectedParticipants.filter(id => id !== p.id)
                        )}
                        className="hidden"
                      />
                      {/* Custom checkbox */}
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                        ${checked ? 'border-white bg-transparent' : 'border-slate-300 bg-white'}`}>
                        {checked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      {/* Type icon */}
                      <div className={`flex-shrink-0 ${checked ? 'text-blue-100' : 'text-slate-400'}`}>
                        {isGroup
                          ? <Users className="w-3.5 h-3.5" />
                          : <User className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${checked ? 'text-white' : 'text-slate-700'}`}>
                          {p.first_name} {p.last_name}
                          {isGroup && (
                            <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-medium
                              ${checked ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'}`}>
                              {p.team_name || 'Group'}
                            </span>
                          )}
                        </p>
                        <p className={`text-[10px] truncate ${checked ? 'text-blue-100' : 'text-slate-400'}`}>
                          {p.email}
                          {alreadyAssigned && <span className="ml-1">(already assigned)</span>}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <button
                onClick={assignParticipants}
                disabled={selectedParticipants.length === 0 || isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-md text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {isSubmitting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><Check className="w-4 h-4" /> Assign {selectedParticipants.length} participant{selectedParticipants.length !== 1 ? 's' : ''}</>
                }
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT: Judges table ─────────────────────────────────────────── */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Registered Judges</h2>
              <span className="text-xs text-slate-500">{judges.length} judge{judges.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Judge</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assignments</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {judges.map((j: any, idx) => (
                    <tr
                      key={j.id}
                      onClick={() => { setSelectedJudge(j.id === selectedJudge ? null : j.id); setSelectedParticipants([]); }}
                      className={`cursor-pointer transition-colors
                        ${selectedJudge === j.id
                          ? 'bg-blue-50 border-l-2 border-blue-500'
                          : `hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                            ${selectedJudge === j.id ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'}`}>
                            {(j.display_name || j.username || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${selectedJudge === j.id ? 'text-blue-700' : 'text-slate-800'}`}>
                              {j.display_name || j.username}
                            </p>
                            <p className="text-xs text-slate-400">{j.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          <Users className="w-3 h-3" /> {j.assigned_count || 0}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 max-w-[80px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${j.assigned_count > 0 ? (j.scored_count / j.assigned_count) * 100 : 0}%` }} />
                          </div>
                          <span className="text-xs text-slate-600 font-medium">{j.scored_count || 0}/{j.assigned_count || 0}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); removeJudge(j.id); }}
                          className="p-1.5 rounded-md hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors"
                          title="Remove judge">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {judges.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-16 text-center">
                        <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-400">No judges assigned yet</p>
                        <p className="text-xs text-slate-300 mt-1">Search for a user on the left and add them as a judge</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
