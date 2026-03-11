"use client";

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import {
  Activity,
  Cpu,
  HardDrive,
  Database,
  Users,
  Building2,
  Calendar,
  Sparkles,
  RefreshCw,
  Loader2,
  BarChart3,
  PieChart
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SystemHealth {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  database_status: string;
  uptime: string;
}

interface DailyData {
  date: string;
  count: number;
  avg_score?: number;
}

interface UserAnalytics {
  period_days: number;
  daily_registrations: DailyData[];
  total_registrations: number;
}

interface EntityAnalytics {
  period_days: number;
  daily_creations: DailyData[];
  type_distribution: { lab: number; startup: number; organization: number; university: number };
  total_created: number;
}

interface MatchAnalytics {
  period_days: number;
  daily_matches: DailyData[];
  status_distribution: { suggested: number; contacted: number; interested: number; declined: number; funded: number };
  total_matches: number;
}

interface EventAnalytics {
  period_days: number;
  daily_registrations: DailyData[];
  participation_types: { attendee: number; speaker: number; jury: number; idea_holder: number };
  total_registrations: number;
}

export default function AdminAnalyticsPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [entityAnalytics, setEntityAnalytics] = useState<EntityAnalytics | null>(null);
  const [matchAnalytics, setMatchAnalytics] = useState<MatchAnalytics | null>(null);
  const [eventAnalytics, setEventAnalytics] = useState<EventAnalytics | null>(null);
  const [daysFilter, setDaysFilter] = useState(30);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, userRes, entityRes, matchRes, eventRes] = await Promise.all([
        fetch('/api/admin/analytics/system/health'),
        fetch(`/api/admin/analytics/users?days=${daysFilter}`),
        fetch(`/api/admin/analytics/entities?days=${daysFilter}`),
        fetch(`/api/admin/analytics/matches?days=${daysFilter}`),
        fetch(`/api/admin/analytics/events?days=${daysFilter}`)
      ]);

      if (healthRes.ok) setSystemHealth(await healthRes.json());
      if (userRes.ok) setUserAnalytics(await userRes.json());
      if (entityRes.ok) setEntityAnalytics(await entityRes.json());
      if (matchRes.ok) setMatchAnalytics(await matchRes.json());
      if (eventRes.ok) setEventAnalytics(await eventRes.json());
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [daysFilter]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const getHealthColor = (value: number) => {
    if (value > 80) return 'red';
    if (value > 50) return 'yellow';
    return 'green';
  };

  const renderBarChart = (data: DailyData[], label: string) => {
    if (!data || data.length === 0) return null;

    const maxCount = Math.max(...data.map(d => d.count));

    return (
      <div className={`rounded-xl p-4 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <div className="flex items-end gap-1 h-40">
          {data.map((item, index) => {
            const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center group"
              >
                <div
                  className="w-full bg-[#00FB75] rounded-t transition-all hover:opacity-80"
                  style={{ height: `${height}%`, minHeight: '4px' }}
                  title={`${item.date}: ${item.count}`}
                />
                <div className={`text-xs mt-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ${
                  index % 5 === 0 ? 'opacity-70' : ''
                }`}>
                  {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPieChart = (data: Record<string, number>, colors: Record<string, string>) => {
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    if (total === 0) return null;

    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

    return (
      <div className={`rounded-xl p-4 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <div className="flex items-center gap-4">
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
              {entries.map(([key, value], index) => {
                const percentage = (value / total) * 100;
                const previousPercentage = entries.slice(0, index).reduce((sum, [, v]) => sum + (v / total) * 100, 0);
                return (
                  <circle
                    key={key}
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="transparent"
                    stroke={colors[key]}
                    strokeWidth="3.8"
                    strokeDasharray={`${percentage} ${100 - percentage}`}
                    strokeDashoffset={-previousPercentage}
                  />
                );
              })}
            </svg>
          </div>
          <div className="flex-1 space-y-2">
            {entries.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colors[key] }}
                  />
                  <span className="capitalize">{key}</span>
                </div>
                <span className="font-medium">{value} ({((value / total) * 100).toFixed(1)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 border-b px-4 py-3 dark:bg-[#0A0A0A] bg-white/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4 text-[#00FB75]" />
            <span className="font-medium">Analytics</span>
            <span className="text-gray-500">/</span>
            <span className="dark:text-gray-400 text-gray-600">Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={daysFilter}
              onChange={(e) => setDaysFilter(Number(e.target.value))}
              className="px-2 py-1 text-xs rounded-lg border dark:bg-[#121212] bg-white dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
            <button
              onClick={fetchAnalytics}
              className="p-1.5 rounded-lg border dark:border-[#1A1A1A] border-gray-200 hover:border-[#00FB75]/50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#00FB75] animate-spin" />
          </div>
        ) : (
          <>
            {systemHealth && (
              <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium">System Health</span>
                  <Activity className="w-4 h-4 dark:text-gray-400 text-gray-600" />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Cpu className="w-4 h-4 text-blue-500" />
                      <span className="text-xs dark:text-gray-400 text-gray-600">CPU</span>
                    </div>
                    <div className="text-lg font-bold">{systemHealth.cpu_usage.toFixed(1)}%</div>
                    <div className="h-1.5 rounded-full bg-[#1A1A1A] mt-1">
                      <div
                        className={`h-full rounded-full ${
                          systemHealth.cpu_usage > 80 ? 'bg-red-500' : systemHealth.cpu_usage > 50 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${systemHealth.cpu_usage}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="w-4 h-4 text-purple-500" />
                      <span className="text-xs dark:text-gray-400 text-gray-600">Memory</span>
                    </div>
                    <div className="text-lg font-bold">{systemHealth.memory_usage.toFixed(1)}%</div>
                    <div className="h-1.5 rounded-full bg-[#1A1A1A] mt-1">
                      <div
                        className={`h-full rounded-full ${
                          systemHealth.memory_usage > 80 ? 'bg-red-500' : systemHealth.memory_usage > 50 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${systemHealth.memory_usage}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <HardDrive className="w-4 h-4 text-orange-500" />
                      <span className="text-xs dark:text-gray-400 text-gray-600">Disk</span>
                    </div>
                    <div className="text-lg font-bold">{systemHealth.disk_usage.toFixed(1)}%</div>
                    <div className="h-1.5 rounded-full bg-[#1A1A1A] mt-1">
                      <div
                        className={`h-full rounded-full ${
                          systemHealth.disk_usage > 80 ? 'bg-red-500' : systemHealth.disk_usage > 50 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${systemHealth.disk_usage}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="w-4 h-4 text-green-500" />
                      <span className="text-xs dark:text-gray-400 text-gray-600">Status</span>
                    </div>
                    <div className="text-lg font-bold capitalize">{systemHealth.database_status}</div>
                    <div className="text-xs text-gray-500">{systemHealth.uptime}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-4">
              {userAnalytics && (
                <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium">User Registrations</span>
                    <Users className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold mb-3">{userAnalytics.total_registrations}</div>
                  {renderBarChart(userAnalytics.daily_registrations, 'Registrations')}
                </div>
              )}

              {entityAnalytics && (
                <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium">Entity Creations</span>
                    <Building2 className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="text-2xl font-bold mb-3">{entityAnalytics.total_created}</div>
                  {renderBarChart(entityAnalytics.daily_creations, 'Creations')}
                </div>
              )}

              {matchAnalytics && (
                <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium">Matches Generated</span>
                    <Sparkles className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="text-2xl font-bold mb-3">{matchAnalytics.total_matches}</div>
                  {renderBarChart(matchAnalytics.daily_matches, 'Matches')}
                </div>
              )}

              {eventAnalytics && (
                <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium">Event Registrations</span>
                    <Calendar className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="text-2xl font-bold mb-3">{eventAnalytics.total_registrations}</div>
                  {renderBarChart(eventAnalytics.daily_registrations, 'Registrations')}
                </div>
              )}
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {entityAnalytics && (
                <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium">Entity Type Distribution</span>
                    <PieChart className="w-4 h-4 text-purple-500" />
                  </div>
                  {renderPieChart(entityAnalytics.type_distribution, {
                    lab: '#3B82F6',
                    startup: '#22C55E',
                    organization: '#A855F7',
                    university: '#F97316'
                  })}
                </div>
              )}

              {matchAnalytics && (
                <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium">Match Status Distribution</span>
                    <BarChart3 className="w-4 h-4 text-orange-500" />
                  </div>
                  {renderPieChart(matchAnalytics.status_distribution, {
                    suggested: '#3B82F6',
                    contacted: '#EAB308',
                    interested: '#A855F7',
                    declined: '#EF4444',
                    funded: '#22C55E'
                  })}
                </div>
              )}

              {eventAnalytics && (
                <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium">Event Participation Types</span>
                    <PieChart className="w-4 h-4 text-green-500" />
                  </div>
                  {renderPieChart(eventAnalytics.participation_types, {
                    attendee: '#3B82F6',
                    speaker: '#A855F7',
                    jury: '#F97316',
                    idea_holder: '#22C55E'
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
