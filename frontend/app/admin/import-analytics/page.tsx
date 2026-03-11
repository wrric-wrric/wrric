"use client";

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  RefreshCw,
  Loader2,
  TrendingUp,
  FileText,
  CheckSquare,
  XSquare
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ImportStats {
  total_imported: number;
  pending: number;
  accepted: number;
  declined: number;
  expired: number;
  acceptance_rate: number;
  recent_batches: Array<{
    id: string;
    filename: string;
    created_at: string;
    total_rows: number;
    successful_imports: number;
    failed_imports: number;
    status: string;
  }>;
}

export default function ImportAnalyticsPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [stats, setStats] = useState<ImportStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users/import-stats');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: ImportStats = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch import stats:', error);
      toast.error('Failed to load import analytics');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'processing':
        return 'bg-blue-500/20 text-blue-400';
      case 'failed':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 dark:text-gray-400 text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-10 border-b px-4 py-3 dark:bg-[#0A0A0A] bg-white/95 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-[#00FB75]" />
            <span className="font-medium">Import Analytics</span>
            <span className="text-gray-500">/</span>
            <span className="dark:text-gray-400 text-gray-600">Dashboard</span>
          </div>
        </div>
        <div className="flex-1 p-4 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00FB75] animate-spin" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-10 border-b px-4 py-3 dark:bg-[#0A0A0A] bg-white/95 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-[#00FB75]" />
            <span className="font-medium">Import Analytics</span>
            <span className="text-gray-500">/</span>
            <span className="dark:text-gray-400 text-gray-600">Dashboard</span>
          </div>
        </div>
        <div className="flex-1 p-4 flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm dark:text-gray-400 text-gray-600">Failed to load analytics</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 border-b px-4 py-3 dark:bg-[#0A0A0A] bg-white/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-[#00FB75]" />
            <span className="font-medium">Import Analytics</span>
            <span className="text-gray-500">/</span>
            <span className="dark:text-gray-400 text-gray-600">Dashboard</span>
          </div>
          <button
            onClick={fetchStats}
            className="p-1.5 rounded-lg border dark:border-[#1A1A1A] border-gray-200 hover:border-[#00FB75]/50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <Users className="w-4 h-4 text-blue-500 mb-1" />
            <div className="text-lg font-bold">{stats.total_imported}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">Total Imported</div>
          </div>
          
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <Clock className="w-4 h-4 text-yellow-500 mb-1" />
            <div className="text-lg font-bold">{stats.pending}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">
              Pending ({stats.total_imported > 0 ? ((stats.pending / stats.total_imported) * 100).toFixed(1) : 0}%)
            </div>
          </div>
          
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <CheckCircle className="w-4 h-4 text-green-500 mb-1" />
            <div className="text-lg font-bold">{stats.accepted}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">
              Accepted ({stats.total_imported > 0 ? ((stats.accepted / stats.total_imported) * 100).toFixed(1) : 0}%)
            </div>
          </div>
          
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <XCircle className="w-4 h-4 text-red-500 mb-1" />
            <div className="text-lg font-bold">{stats.declined}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">
              Declined ({stats.total_imported > 0 ? ((stats.declined / stats.total_imported) * 100).toFixed(1) : 0}%)
            </div>
          </div>
          
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <Calendar className="w-4 h-4 text-gray-500 mb-1" />
            <div className="text-lg font-bold">{stats.expired}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">
              Expired ({stats.total_imported > 0 ? ((stats.expired / stats.total_imported) * 100).toFixed(1) : 0}%)
            </div>
          </div>
          
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <TrendingUp className="w-4 h-4 text-purple-500 mb-1" />
            <div className="text-lg font-bold">{stats.acceptance_rate}%</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">Acceptance Rate</div>
          </div>
        </div>

        {/* Recent Batches */}
        <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium">Recent Import Batches</span>
            <FileText className="w-4 h-4 dark:text-gray-400 text-gray-600" />
          </div>
          
          {stats.recent_batches.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm dark:text-gray-400 text-gray-600">No import batches found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b dark:border-[#1A1A1A] border-gray-200">
                    <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">File Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Total Rows</th>
                    <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Successful</th>
                    <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Failed</th>
                    <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_batches.map((batch) => (
                    <tr
                      key={batch.id}
                      className="border-b dark:border-[#1A1A1A] border-gray-200 hover:bg-[#1A1A1A]/50"
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{batch.filename}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          {new Date(batch.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-sm">{batch.total_rows}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <CheckSquare className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-sm">{batch.successful_imports}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <XSquare className="w-3.5 h-3.5 text-red-500" />
                          <span className="text-sm">{batch.failed_imports}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${getStatusBadgeColor(batch.status)}`}>
                          {batch.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Summary */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Success Rate</span>
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="dark:text-gray-400 text-gray-600">Overall Success</span>
                  <span>
                    {stats.total_imported > 0 
                      ? ((stats.accepted / stats.total_imported) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1A1A1A]">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ 
                      width: `${stats.total_imported > 0 ? (stats.accepted / stats.total_imported) * 100 : 0}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Response Rate</span>
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="dark:text-gray-400 text-gray-600">Response Rate</span>
                  <span>
                    {stats.total_imported > 0 
                      ? (((stats.accepted + stats.declined) / stats.total_imported) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1A1A1A]">
                  <div
                    className="h-full rounded-full bg-purple-500"
                    style={{ 
                      width: `${stats.total_imported > 0 ? ((stats.accepted + stats.declined) / stats.total_imported) * 100 : 0}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}