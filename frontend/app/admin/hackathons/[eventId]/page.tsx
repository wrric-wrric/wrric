"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, Award, Mail, Play, Square, BarChart3, ClipboardList, Send,
  FolderOpen, Pause, RotateCcw, Lock, Unlock, CheckCircle2,
  Loader2, Settings, AlertTriangle, ArrowRight
} from 'lucide-react';

export default function HackathonDashboard() {
  const { eventId } = useParams();
  const router = useRouter();
  const [config, setConfig] = useState<any>(null);
  const [judgingStatus, setJudgingStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const fetchData = useCallback(async () => {
    try {
      const [configRes, statusRes] = await Promise.all([
        fetch(`/api/admin/hackathons/${eventId}`, { headers: getHeaders() }),
        fetch(`/api/admin/hackathons/${eventId}/judging/status`, { headers: getHeaders() }),
      ]);
      if (configRes.ok) setConfig(await configRes.json());
      if (statusRes.ok) setJudgingStatus(await statusRes.json());
    } catch { } finally { setLoading(false); }
  }, [eventId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (action: string, endpoint: string, confirmMsg: string) => {
    if (!confirm(confirmMsg)) return;
    setActionLoading(action);
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}${endpoint}`, { method: 'POST', headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) { alert(data.detail || 'Action failed'); return; }
      fetchData();
    } catch { alert('Action failed'); }
    finally { setActionLoading(null); }
  };

  const startJudging = () => handleAction('start', '/judging/start', 'Start judging? This will lock the scoring schema.');
  const pauseJudging = () => handleAction('pause', '/judging/pause', 'Pause judging? Judges will not be able to submit until resumed.');
  const resumeJudging = () => handleAction('resume', '/judging/resume', 'Resume judging?');
  const finalizeJudging = () => handleAction('finalize', '/judging/finalize', 'FINALIZE judging? This CANNOT be undone.');
  const unlockSchema = () => handleAction('unlock', '/scoring-schema/unlock', 'Unlock schema? May cause inconsistencies if scores already submitted.');

  const modules = [
    { label: 'Participants', icon: Users, path: 'participants', desc: 'Manage registered participants' },
    { label: 'Judges', icon: Award, path: 'judges', desc: 'Manage evaluation board' },
    { label: 'Categories', icon: FolderOpen, path: 'categories', desc: 'Configure event categories' },
    { label: 'Scoring', icon: ClipboardList, path: 'scoring', desc: 'Define scoring criteria' },
    { label: 'Leaderboard', icon: BarChart3, path: 'leaderboard', desc: 'View live rankings' },
    { label: 'Broadcast', icon: Mail, path: 'email', desc: 'Email participants' },
    { label: 'Directives', icon: Send, path: 'judges-email', desc: 'Email judges' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-sm">Loading event data...</span>
      </div>
    </div>
  );

  if (!config) return (
    <div className="p-8 text-center text-slate-400">
      <p>Event not found.</p>
    </div>
  );

  const judgeLabel = judgingStatus?.is_finalized ? 'Finalized' :
    judgingStatus?.status === 'paused' ? 'Paused' :
      judgingStatus?.status === 'active' ? 'Active' : 'Not Started';

  const judgeColor = judgingStatus?.is_finalized ? 'text-purple-600 bg-purple-50 border-purple-200' :
    judgingStatus?.status === 'paused' ? 'text-amber-600 bg-amber-50 border-amber-200' :
      judgingStatus?.status === 'active' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
        'text-slate-500 bg-slate-50 border-slate-200';

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{config.event_title}</h1>
          <p className="text-sm text-slate-500 mt-0.5 font-mono">ID: {String(eventId).slice(0, 8)}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${judgeColor}`}>
          {judgeLabel}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Participants', value: config.participant_count ?? '—', icon: Users },
          { label: 'Judges', value: config.judge_count ?? '—', icon: Award },
          { label: 'Schema', value: judgingStatus?.schema_locked ? 'Locked' : 'Editable', icon: Lock },
          { label: 'Leaderboard', value: config.leaderboard_phase ?? 'Hidden', icon: BarChart3 },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500 font-medium">{s.label}</span>
            </div>
            <p className="text-xl font-bold text-slate-800 capitalize">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Judging Control Panel */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
          <Settings className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-800">Judging Controls</h2>
        </div>

        {/* Status banners */}
        <div className="space-y-2 mb-4">
          {judgingStatus?.is_finalized && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-purple-50 border border-purple-200 text-purple-700 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Judging has been finalized. Results are locked.
            </div>
          )}
          {judgingStatus?.status === 'paused' && !judgingStatus?.is_finalized && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              <Pause className="w-4 h-4" /> Judging is paused. Judges cannot submit scores.
            </div>
          )}
          {judgingStatus?.status === 'active' && !judgingStatus?.is_finalized && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              <Play className="w-4 h-4" /> Judging is active. Judges are submitting scores.
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {judgingStatus?.can_start && (
            <button onClick={startJudging} disabled={actionLoading === 'start'}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
              {actionLoading === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Start Judging
            </button>
          )}
          {judgingStatus?.can_pause && (
            <button onClick={pauseJudging} disabled={actionLoading === 'pause'}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50">
              {actionLoading === 'pause' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
              Pause Judging
            </button>
          )}
          {judgingStatus?.can_resume && (
            <button onClick={resumeJudging} disabled={actionLoading === 'resume'}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
              {actionLoading === 'resume' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Resume Judging
            </button>
          )}
          {judgingStatus?.can_finalize && (
            <button onClick={finalizeJudging} disabled={actionLoading === 'finalize'}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50">
              {actionLoading === 'finalize' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
              Finalize Results
            </button>
          )}
          {judgingStatus?.schema_locked && !judgingStatus?.is_finalized && (
            <button onClick={unlockSchema} disabled={actionLoading === 'unlock'}
              className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50">
              {actionLoading === 'unlock' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
              Override Schema Lock
            </button>
          )}
        </div>
      </div>

      {/* Module Grid */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
          <FolderOpen className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-800">Event Modules</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {modules.map(m => (
            <Link key={m.path} href={`/admin/hackathons/${eventId}/${m.path}`}
              className="group flex flex-col gap-2 p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all">
              <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <m.icon className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700">{m.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{m.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
