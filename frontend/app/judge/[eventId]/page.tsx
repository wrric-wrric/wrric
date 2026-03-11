"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, Circle, Trophy, Users, AlertCircle, Send, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function JudgeDashboard() {
  const { eventId } = useParams();
  const router = useRouter();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submittingAll, setSubmittingAll] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const fetchData = useCallback(async () => {
    try {
      const headers = getHeaders();
      const [a, p] = await Promise.all([
        fetch(`/api/judge/hackathons/${eventId}/assignments`, { headers }).then(r => r.json()),
        fetch(`/api/judge/hackathons/${eventId}/progress`, { headers }).then(r => r.json()),
      ]);
      setAssignments(Array.isArray(a) ? a : []);
      setProgress(p);
    } catch { }
    finally { setLoading(false); }
  }, [eventId]);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  useEffect(() => {
    const handleVisibility = () => { if (document.visibilityState === 'visible') { setLoading(true); fetchData(); } };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchData]);

  const submitAllDrafts = async () => {
    if (!confirm('Submit all draft scores? This will finalize them.')) return;
    setSubmittingAll(true);
    try {
      const res = await fetch(`/api/judge/hackathons/${eventId}/submit-all-drafts`, { method: 'POST', headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.detail === 'object' ? data.detail.message : data.detail || 'Failed');
      toast.success(`Submitted ${data.submitted_count} score(s)!`);
      setRefreshKey(k => k + 1);
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmittingAll(false); }
  };

  const statusBadge = (status: string) => {
    if (status === 'submitted') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">Submitted</span>;
    if (status === 'draft') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">Draft</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">Pending</span>;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-sm">Loading assignments...</span>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Scoring Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Score your assigned participants for this event</p>
        </div>
        <button onClick={() => router.push(`/judge/${eventId}/leaderboard`)}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
          <Trophy className="w-4 h-4 text-blue-600" /> View Standings
        </button>
      </div>

      {/* Progress card */}
      {progress && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Scoring Progress</p>
                <span className="text-sm font-bold text-slate-800">{progress.scored}/{progress.assigned} completed</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress.progress_pct || 0}%` }} />
              </div>
              <div className="flex items-center gap-6 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> {progress.scored} submitted</span>
                <span className="flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-amber-500" /> {progress.drafts} drafts</span>
                <span className="flex items-center gap-1.5"><Circle className="w-3.5 h-3.5 text-slate-300" /> {progress.remaining} remaining</span>
              </div>
            </div>

            {progress.drafts > 0 ? (
              <button onClick={submitAllDrafts} disabled={submittingAll}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex-shrink-0">
                {submittingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submittingAll ? 'Submitting...' : `Submit ${progress.drafts} Draft${progress.drafts !== 1 ? 's' : ''}`}
              </button>
            ) : progress.scored === progress.assigned && progress.assigned > 0 ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium flex-shrink-0">
                <CheckCircle className="w-4 h-4" /> All scores submitted
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Assignments table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-360px)]">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Participant</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Team / Org</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Project</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignments.map((a: any, idx) => (
                <tr key={a.id} onClick={() => router.push(`/judge/${eventId}/score/${a.id}`)}
                  className={`cursor-pointer hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  <td className="px-5 py-4">{statusBadge(a.scoring_status)}</td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-slate-800">{a.first_name} {a.last_name}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-slate-600">{a.team_name || <span className="text-slate-400 italic">Independent</span>}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-slate-600 max-w-xs truncate">{a.project_title || '—'}</p>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={e => { e.stopPropagation(); router.push(`/judge/${eventId}/score/${a.id}`); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors">
                      {a.scoring_status === 'submitted' ? 'Update Score' : 'Start Scoring'}
                    </button>
                  </td>
                </tr>
              ))}
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-400">No assignments yet</p>
                    <p className="text-xs text-slate-300 mt-1">Participants will appear here once assigned by the administrator</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
