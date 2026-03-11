"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Award, ArrowRight, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function JudgeHomePage() {
  const router = useRouter();
  const [hackathons, setHackathons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/judge/hackathons', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => setHackathons(Array.isArray(data) ? data : [])).catch(() => { }).finally(() => setLoading(false));
  }, []);

  const getStatus = (h: any) => {
    if (h.judging_ended_at) return { icon: XCircle, text: 'Ended', cls: 'bg-red-100 text-red-700 border-red-200' };
    if (h.judging_started_at) return { icon: CheckCircle2, text: 'In Progress', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    return { icon: Clock, text: 'Pending', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
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
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" />
            My Assignments
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {hackathons.length} event{hackathons.length !== 1 ? 's' : ''} assigned to you
          </p>
        </div>
      </div>

      {hackathons.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-16 text-center">
          <Award className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-400">No assignments yet</p>
          <p className="text-xs text-slate-300 mt-1">You will see your events here once assigned by an administrator</p>
        </div>
      ) : (
        <div className="space-y-3">
          {hackathons.map(h => {
            const status = getStatus(h);
            const StatusIcon = status.icon;
            return (
              <div key={h.event_id}
                className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 flex items-center justify-between gap-4 hover:border-blue-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Award className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{h.event_title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${status.cls}`}>
                        <StatusIcon className="w-3 h-3" /> {status.text}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/judge/${h.event_id}`)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex-shrink-0">
                  Open Dashboard <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
