"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Building2, Calendar, Sparkles, Activity, Clock,
  AlertCircle, Loader2, TrendingUp, RefreshCw, Plus, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DashboardStats {
  users: { total: number; new_7d: number; new_30d: number; total_profiles: number; };
  entities: { total: number; new_7d: number; };
  events: { total: number; published: number; registrations: number; };
  matches: { total: number; average_score: number; };
  system: { active_sessions: number; total_messages: number; total_notifications: number; };
}

interface ActivityItem {
  type: 'user_created' | 'entity_created' | 'event_created' | 'match_created';
  message: string;
  timestamp: string;
}

interface SystemHealth { cpu: number; memory: number; disk: number; status: string; }

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({ cpu: 0, memory: 0, disk: 0, status: 'unknown' });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [overviewRes, healthRes] = await Promise.all([
        fetch('/api/admin/analytics/dashboard/overview', { headers }),
        fetch('/api/admin/analytics/system/health', { headers }),
      ]);

      if (overviewRes.ok) {
        const overview = await overviewRes.json();
        // Map the overview response to our dashboard state shapes
        setStats({
          users: overview.users ?? { total: 0, new_7d: 0, new_30d: 0, total_profiles: 0 },
          entities: overview.entities ?? { total: 0, new_7d: 0 },
          events: overview.events ?? { total: 0, published: 0, registrations: 0 },
          matches: overview.matches ?? { total: 0, average_score: 0 },
          system: overview.system ?? { active_sessions: 0, total_messages: 0, total_notifications: 0 },
        });
        // recent_activity comes inside overview
        const activity = overview.recent_activity || [];
        setRecentActivity(Array.isArray(activity) ? activity.slice(0, 8) : []);
      }

      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setSystemHealth({
          cpu: healthData.cpu_usage ?? 0,
          memory: healthData.memory_usage ?? 0,
          disk: healthData.disk_usage ?? 0,
          status: healthData.database_status || 'unknown',
        });
      }
    } catch { toast.error('Failed to load dashboard data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  const activityIconColor = (type: ActivityItem['type']) => {
    if (type === 'user_created') return 'text-blue-600 bg-blue-50';
    if (type === 'entity_created') return 'text-purple-600 bg-purple-50';
    if (type === 'event_created') return 'text-emerald-600 bg-emerald-50';
    return 'text-amber-600 bg-amber-50';
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-sm">Loading dashboard...</span>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            System overview and recent activity
            <span className={`ml-3 inline-flex items-center gap-1 text-xs font-medium ${systemHealth.status === 'healthy' ? 'text-emerald-600' : 'text-red-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${systemHealth.status === 'healthy' ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {systemHealth.status === 'healthy' ? 'All systems operational' : `Status: ${systemHealth.status}`}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchDashboardData} className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 bg-white hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => router.push('/admin/events/new')} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> New Event
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: stats?.users.total ?? 0, sub: `+${stats?.users.new_7d ?? 0} this week`, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', route: '/admin/users' },
          { label: 'Entities', value: stats?.entities.total ?? 0, sub: `+${stats?.entities.new_7d ?? 0} this week`, icon: Building2, color: 'text-purple-600', bg: 'bg-purple-50', route: '/admin/entities' },
          { label: 'Published Events', value: stats?.events.published ?? 0, sub: `${stats?.events.total ?? 0} total`, icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-50', route: '/admin/events' },
          { label: 'Matches', value: stats?.matches.total ?? 0, sub: `Avg score: ${(stats?.matches.average_score ?? 0).toFixed(1)}`, icon: Sparkles, color: 'text-amber-600', bg: 'bg-amber-50', route: '/admin/matches' },
        ].map(s => (
          <div key={s.label} onClick={() => router.push(s.route)}
            className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{s.value}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{s.label}</p>
            <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Bottom row: System Health + Activity + Quick Links */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* System Health */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-800">System Health</h2>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-4">
            {[
              { label: 'CPU', value: systemHealth.cpu },
              { label: 'Memory', value: systemHealth.memory },
              { label: 'Disk', value: systemHealth.disk },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1.5">
                  <span>{item.label}</span>
                  <span className={item.value > 80 ? 'text-red-600' : 'text-slate-800'}>{item.value.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${item.value > 80 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-800">{stats?.system.active_sessions ?? 0}</p>
              <p className="text-xs text-slate-400">Sessions</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-800">{stats?.users.total_profiles ?? 0}</p>
              <p className="text-xs text-slate-400">Profiles</p>
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Recent Activity</h2>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-3 overflow-y-auto max-h-64">
            {recentActivity.length > 0 ? recentActivity.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-full ${activityIconColor(a.type)} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <span className="text-xs">●</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 leading-snug line-clamp-2">{a.message}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(a.timestamp).toLocaleDateString()} · {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                <AlertCircle className="w-8 h-8 mb-2" />
                <p className="text-xs">No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Quick Links</h2>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Events Registry', icon: Calendar, route: '/admin/events', color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Users', icon: Users, route: '/admin/users', color: 'text-blue-600 bg-blue-50' },
              { label: 'Entities', icon: Building2, route: '/admin/entities', color: 'text-purple-600 bg-purple-50' },
              { label: 'Analytics', icon: TrendingUp, route: '/admin/analytics', color: 'text-amber-600 bg-amber-50' },
              { label: 'Hackathons', icon: Sparkles, route: '/admin/hackathons', color: 'text-blue-600 bg-blue-50' },
            ].map(a => (
              <button key={a.route} onClick={() => router.push(a.route)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all text-left group">
                <div className={`w-7 h-7 rounded-md ${a.color.split(' ')[1]} flex items-center justify-center flex-shrink-0`}>
                  <a.icon className={`w-3.5 h-3.5 ${a.color.split(' ')[0]}`} />
                </div>
                <span className="text-sm text-slate-700 group-hover:text-blue-700 font-medium">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
