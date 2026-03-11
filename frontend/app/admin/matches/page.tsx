"use client";

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import {
  Search,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Loader2,
  ArrowUp,
  ArrowDown,
  DollarSign,
  Target,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Match {
  id: number;
  funder_id: string;
  funder_name: string;
  entity_id: string;
  entity_name: string;
  score: number;
  status: 'suggested' | 'contacted' | 'interested' | 'declined' | 'funded';
  created_at: string;
}

export default function AdminMatchesPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const router = useRouter();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    average_score: 0,
    status_counts: { suggested: 0, contacted: 0, interested: 0, declined: 0, funded: 0 },
    recent_7d: 0,
    high_quality: 0
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<string>('');
  const [minScore, setMinScore] = useState<number>(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: '20',
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      if (status) params.append('status', status);
      if (minScore > 0) params.append('min_score', minScore.toString());

      const response = await fetch(`/api/admin/matches?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      // Ensure matches is always an array, even if API returns undefined
      setMatches(data.matches || []);
      setTotalPages(data.total_pages || 1);
    } catch (error) {
      console.error('Failed to fetch matches:', error);
      toast.error('Failed to load matches');
      // Set matches to empty array on error
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, status, minScore, sortBy, sortOrder]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/matches/stats/overview');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
    fetchStats();
  }, [fetchMatches, fetchStats]);

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/matches/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        toast.success('Match status updated');
        fetchMatches();
        fetchStats();
      } else {
        throw new Error('Failed to update match');
      }
    } catch (error) {
      toast.error('Failed to update match');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this match?')) return;

    try {
      const response = await fetch(`/api/admin/matches/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Match deleted successfully');
        fetchMatches();
        fetchStats();
      } else {
        throw new Error('Failed to delete match');
      }
    } catch (error) {
      toast.error('Failed to delete match');
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'suggested':
        return 'blue';
      case 'contacted':
        return 'yellow';
      case 'interested':
        return 'purple';
      case 'declined':
        return 'red';
      case 'funded':
        return 'green';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'suggested':
        return <Target className="w-4 h-4" />;
      case 'contacted':
        return <Clock className="w-4 h-4" />;
      case 'interested':
        return <TrendingUp className="w-4 h-4" />;
      case 'declined':
        return <XCircle className="w-4 h-4" />;
      case 'funded':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-500';
    if (score >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Get safe matches array (always an array)
  const safeMatches = matches || [];

  return (
    <div className={`h-full flex flex-col ${isDark ? "dark:bg-[#0A0A0A] bg-gray-50 dark:text-white text-gray-900" : "bg-gray-50 text-gray-900"}`}>
      <header className={`sticky top-0 z-10 border-b px-4 py-3 ${
        isDark ? "dark:bg-[#0A0A0A] bg-gray-50 border-gray-800" : "bg-white border-gray-200"
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#00FB75]" />
            <div>
              <h1 className="font-semibold">Manage Matches</h1>
              <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                {safeMatches.length} match{safeMatches.length !== 1 ? "es" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={minScore.toString()}
              onChange={(e) => setMinScore(parseFloat(e.target.value) || 0)}
              placeholder="Min score..."
              className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#00FB75] ${
                isDark ? "dark:bg-[#121212] bg-white border-gray-700 dark:text-white text-gray-900" : "bg-white border-gray-300"
              }`}
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={`px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#00FB75] ${
                isDark ? "dark:bg-[#121212] bg-white border-gray-700 dark:text-white text-gray-900" : "bg-white border-gray-300"
              }`}
            >
              <option value="">All Status</option>
              <option value="suggested">Suggested</option>
              <option value="contacted">Contacted</option>
              <option value="interested">Interested</option>
              <option value="declined">Declined</option>
              <option value="funded">Funded</option>
            </select>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
            {[
              { label: 'Total', value: stats.total, icon: Sparkles },
              { label: 'Suggested', value: stats.status_counts.suggested, icon: Target },
              { label: 'Contacted', value: stats.status_counts.contacted, icon: Clock },
              { label: 'Interested', value: stats.status_counts.interested, icon: TrendingUp },
              { label: 'Funded', value: stats.status_counts.funded, icon: CheckCircle },
              { label: 'High Quality', value: stats.high_quality, icon: DollarSign },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`rounded-lg p-3 ${
                  isDark ? "dark:bg-[#121212] bg-white border border-gray-800" : "bg-white border"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className="w-3.5 h-3.5 text-[#00FB75]" />
                  <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                    {stat.label}
                  </span>
                </div>
                <div className="text-xl font-bold">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className={`rounded-lg overflow-hidden border ${
            isDark ? "dark:bg-[#121212] bg-white border-gray-800" : "bg-white border-gray-200"
          }`}>
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 mx-auto mb-2 text-[#00FB75] animate-spin" />
                <p className="text-sm opacity-70">Loading...</p>
              </div>
            ) : safeMatches.length === 0 ? (
              <div className="p-8 text-center">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm opacity-70">No matches found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${isDark ? "border-gray-800" : "border-gray-200"}`}>
                      <th className="px-3 py-2 text-left text-xs font-medium">Funder</th>
                      <th className="px-3 py-2 text-left text-xs font-medium">Entity</th>
                      <th 
                        className="px-3 py-2 text-left text-xs font-medium cursor-pointer hover:opacity-80"
                        onClick={() => handleSort('score')}
                      >
                        <div className="flex items-center gap-1">
                          Score
                          {sortBy === 'score' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                        </div>
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium">Status</th>
                      <th 
                        className="px-3 py-2 text-left text-xs font-medium cursor-pointer hover:opacity-80"
                        onClick={() => handleSort('created_at')}
                      >
                        <div className="flex items-center gap-1">
                          Created
                          {sortBy === 'created_at' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                        </div>
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeMatches.map((match) => (
                      <tr
                        key={match.id}
                        className={`border-b last:border-0 ${isDark ? "border-gray-800 hover:bg-gray-800/50" : "border-gray-100 hover:bg-gray-50"}`}
                      >
                        <td className="px-3 py-2">
                          <div className="text-sm font-medium">{match.funder_name}</div>
                          <div className="text-xs opacity-50">{match.funder_id.slice(0, 8)}...</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-sm">{match.entity_name}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className={`text-sm font-bold ${
                            match.score >= 0.8 ? "text-green-400" : match.score >= 0.6 ? "text-yellow-400" : "text-red-400"
                          }`}>
                            {(match.score * 100).toFixed(0)}%
                          </div>
                          <div className={`w-16 h-1 rounded-full mt-1 ${isDark ? "bg-gray-800" : "bg-gray-200"}`}>
                            <div
                              className={`h-full rounded-full ${
                                match.score >= 0.8 ? "bg-green-500" : match.score >= 0.6 ? "bg-yellow-500" : "bg-red-500"
                              }`}
                              style={{ width: `${match.score * 100}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={match.status}
                            onChange={(e) => handleUpdateStatus(match.id, e.target.value)}
                            className={`px-2 py-1 rounded text-xs border ${
                              isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"
                            }`}
                          >
                            <option value="suggested">Suggested</option>
                            <option value="contacted">Contacted</option>
                            <option value="interested">Interested</option>
                            <option value="declined">Declined</option>
                            <option value="funded">Funded</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-xs">
                            {new Date(match.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => router.push(`/admin/matches/${match.id}`)}
                              className={`p-1.5 rounded transition-colors ${
                                isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"
                              }`}
                              title="View"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(match.id)}
                              className={`p-1.5 rounded transition-colors ${
                                isDark ? "hover:bg-red-500/20 text-red-400" : "hover:bg-red-100 text-red-500"
                              }`}
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className={`flex items-center justify-between px-3 py-2 border-t ${isDark ? "border-gray-800" : "border-gray-200"}`}>
                <div className="text-xs opacity-70">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`p-1 rounded transition-colors ${
                      currentPage === 1 ? "opacity-30" : isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-6 h-6 rounded text-xs font-medium transition-all ${
                          currentPage === pageNum 
                            ? "bg-[#00FB75] text-black" 
                            : isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`p-1 rounded transition-colors ${
                      currentPage === totalPages ? "opacity-30" : isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}