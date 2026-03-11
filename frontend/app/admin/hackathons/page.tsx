"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Trophy, Loader2, ArrowRight, Plus, CheckCircle, Circle } from 'lucide-react';

interface EventItem {
  id: string;
  title: string;
  event_datetime: string;
  is_hackathon: boolean;
}

export default function HackathonsListPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [enabling, setEnabling] = useState<string | null>(null);

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return { Authorization: `Bearer ${token}` };
  };

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/events', { headers: getHeaders() });
      const data = await res.json();
      setEvents(data.items || data || []);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const enableHackathon = async (eventId: string) => {
    setEnabling(eventId);
    try {
      await fetch(`/api/admin/hackathons/${eventId}/enable`, { method: 'POST', headers: getHeaders() });
      fetchEvents();
    } finally { setEnabling(null); }
  };

  const filtered = events.filter(e => e.title?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-sm">Loading events...</span>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-blue-600" />
            Hackathons
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage all hackathon events and their judging sessions</p>
        </div>
      </div>

      {/* Search + controls */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search events..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <span className="text-sm text-slate-500 ml-auto">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Event Name</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hackathon</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e, idx) => (
                <tr key={e.id} className={`hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 truncate max-w-xs">{e.title}</p>
                        <p className="text-xs text-slate-400 font-mono">ID: {e.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-slate-600">
                      {e.event_datetime
                        ? new Date(e.event_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {e.is_hackathon ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <CheckCircle className="w-3 h-3" /> Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                        <Circle className="w-3 h-3" /> Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {e.is_hackathon ? (
                        <button
                          onClick={() => router.push(`/admin/hackathons/${e.id}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                        >
                          Open Hub <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => enableHackathon(e.id)}
                          disabled={enabling === e.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-blue-300 text-blue-600 text-xs font-medium hover:bg-blue-50 transition-colors disabled:opacity-50"
                        >
                          {enabling === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          Enable
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center">
                    <Trophy className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-400">No events found</p>
                    <p className="text-xs text-slate-300 mt-1">Try adjusting your search</p>
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
