"use client";

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Sparkles,
  DollarSign,
  Building2,
  Calendar,
  Edit,
  Trash2,
  Loader2,
  Target,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ScoreMetadata {
  semantic_score: number;
  thematic_score: number;
  regional_score: number;
}

interface MatchDetails {
  id: number;
  funder_id: string;
  funder_name: string;
  entity_id: string;
  entity_name: string;
  score: number;
  reason: string;
  status: 'suggested' | 'contacted' | 'interested' | 'declined' | 'funded';
  created_at: string;
  metadata_: ScoreMetadata;
}

export default function MatchDetailPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const router = useRouter();
  const params = useParams();
  const matchId = parseInt(params.id as string);

  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState(match?.status || 'suggested');

  const fetchMatch = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/matches/${matchId}`);
      if (!response.ok) {
        throw new Error('Match not found');
      }
      const data = await response.json();
      setMatch(data);
      setNewStatus(data.status);
    } catch (error) {
      console.error('Failed to fetch match:', error);
      toast.error('Failed to load match details');
      router.push('/admin/matches');
    } finally {
      setLoading(false);
    }
  }, [matchId, router]);

  useEffect(() => {
    fetchMatch();
  }, [fetchMatch]);

  const handleUpdateStatus = async () => {
    try {
      const response = await fetch(`/api/admin/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        toast.success('Match status updated successfully');
        setEditingStatus(false);
        fetchMatch();
      } else {
        throw new Error('Failed to update match');
      }
    } catch (error) {
      toast.error('Failed to update match');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this match?')) return;

    try {
      const response = await fetch(`/api/admin/matches/${matchId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Match deleted successfully');
        router.push('/admin/matches');
      } else {
        throw new Error('Failed to delete match');
      }
    } catch (error) {
      toast.error('Failed to delete match');
    }
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

  if (loading) {
    return (
      <div className={`h-full flex flex-col ${isDark ? "dark:bg-[#0A0A0A] bg-gray-50 dark:text-white text-gray-900" : "bg-gray-50 text-gray-900"}`}>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-800 rounded w-1/4" />
            <div className="h-48 bg-gray-800 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!match) return null;

  return (
    <div className={`h-full flex flex-col ${isDark ? "dark:bg-[#0A0A0A] bg-gray-50 dark:text-white text-gray-900" : "bg-gray-50 text-gray-900"}`}>
      <header className={`sticky top-0 z-10 border-b px-4 py-3 ${
        isDark ? "dark:bg-[#0A0A0A] bg-gray-50 border-gray-800" : "bg-white border-gray-200"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin/matches')}
              className={`p-1.5 rounded transition-colors ${
                isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-semibold">Match Details</h1>
              <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                {match.funder_name} · {match.entity_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!editingStatus ? (
              <button
                onClick={() => setEditingStatus(true)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                Edit Status
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${
                    isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"
                  }`}
                >
                  <option value="suggested">Suggested</option>
                  <option value="contacted">Contacted</option>
                  <option value="interested">Interested</option>
                  <option value="declined">Declined</option>
                  <option value="funded">Funded</option>
                </select>
                <button
                  onClick={handleUpdateStatus}
                  className="px-3 py-1.5 rounded-lg text-sm bg-[#00FB75] text-black hover:bg-green-400"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingStatus(false);
                    setNewStatus(match.status);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm ${
                    isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Score */}
          <div className={`rounded-lg p-4 ${isDark ? "dark:bg-[#121212] bg-white border border-gray-800" : "bg-white border"}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00FB75]" />
                Match Score
              </h2>
              <span className="text-2xl font-bold text-[#00FB75]">
                {(match.score * 100).toFixed(0)}%
              </span>
            </div>
            <div className={`h-2 rounded-full ${isDark ? "bg-gray-800" : "bg-gray-200"}`}>
              <div
                className="h-full rounded-full bg-[#00FB75]"
                style={{ width: `${match.score * 100}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              {[
                { label: 'Semantic', score: match.metadata_.semantic_score, color: 'text-blue-400' },
                { label: 'Thematic', score: match.metadata_.thematic_score, color: 'text-purple-400' },
                { label: 'Regional', score: match.metadata_.regional_score, color: 'text-orange-400' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={isDark ? "text-gray-500" : "text-gray-500"}>{item.label}</span>
                    <span className={`font-medium ${item.color}`}>{(item.score * 100).toFixed(0)}%</span>
                  </div>
                  <div className={`h-1 rounded-full ${isDark ? "bg-gray-800" : "bg-gray-200"}`}>
                    <div
                      className={`h-full rounded-full ${
                        item.color === 'text-blue-400' ? 'bg-blue-500' :
                        item.color === 'text-purple-400' ? 'bg-purple-500' : 'bg-orange-500'
                      }`}
                      style={{ width: `${item.score * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className={`rounded-lg p-4 ${isDark ? "dark:bg-[#121212] bg-white border border-gray-800" : "bg-white border"}`}>
            <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>Funder</p>
                <p className="font-medium">{match.funder_name}</p>
              </div>
              <div>
                <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>Entity</p>
                <p className="font-medium">{match.entity_name}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700">
              <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>Match Reason</p>
              <p className="text-sm mt-1">{match.reason}</p>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700">
              <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>Created</p>
              <p className="text-sm mt-1">{new Date(match.created_at).toLocaleString()}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              className="flex-1 px-4 py-2 rounded-lg text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Delete Match
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
