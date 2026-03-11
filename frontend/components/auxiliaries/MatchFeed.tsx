"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { Target, DollarSign, MapPin, Building, ThumbsUp, ThumbsDown, MessageCircle } from "lucide-react";
import toast from "react-hot-toast";

interface MatchRecord {
  id: string;
  funder: {
    id: string;
    name: string;
    org_type: string;
    regions: string[];
    min_ticket: number | null;
    max_ticket: number | null;
  };
  score: number;
  reason: string;
  status: string;
  created_at: string;
}

interface MatchFeedProps {
  entityId: string;
}

export default function MatchFeed({ entityId }: MatchFeedProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch(`/api/match_records/entities/${entityId}?min_score=0.7`);
      
      if (!response.ok) throw new Error("Failed to fetch matches");
      
      const data = await response.json();
      setMatches(data);
    } catch (error) {
      console.error("Fetch matches error:", error);
      toast.error("Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const updateMatchStatus = async (matchId: string, status: string) => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch(`/api/match_records/${matchId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error("Failed to update match status");
      
      setMatches(prev => prev.map(match => 
        match.id === matchId ? { ...match, status } : match
      ));
      
      toast.success(`Match ${status === 'interested' ? 'accepted' : 'rejected'}!`);
    } catch (error) {
      console.error("Update match status error:", error);
      toast.error("Failed to update match");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`animate-pulse rounded-xl p-6 ${
            isDark ? "bg-gray-900" : "bg-gray-100"
          }`}>
            <div className="h-4 bg-gray-300 rounded w-1/4 mb-4"></div>
            <div className="h-3 bg-gray-300 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-300 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className={`text-center py-8 rounded-xl ${
        isDark ? "bg-gray-900" : "bg-gray-100"
      }`}>
        <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No Matches Yet</h3>
        <p className="text-sm opacity-70">
          We{"'"}re analyzing your profile and will suggest relevant funders soon.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {matches.map((match) => (
        <div
          key={match.id}
          className={`rounded-xl p-6 border transition-all ${
            isDark 
              ? "bg-gray-900 border-gray-700 hover:border-gray-600" 
              : "bg-white border-gray-200 hover:border-gray-300 shadow-sm"
          }`}
        >
          {/* Match Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                match.score > 0.8 ? "bg-green-500/20 text-green-400" :
                match.score > 0.6 ? "bg-yellow-500/20 text-yellow-400" :
                "bg-blue-500/20 text-blue-400"
              }`}>
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold">{match.funder.name}</h3>
                <p className="text-sm opacity-70 capitalize">
                  {match.funder.org_type.replace('_', ' ')}
                </p>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              match.score > 0.8 ? "bg-green-500/20 text-green-400" :
              match.score > 0.6 ? "bg-yellow-500/20 text-yellow-400" :
              "bg-blue-500/20 text-blue-400"
            }`}>
              {Math.round(match.score * 100)}% Match
            </div>
          </div>

          {/* Match Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 opacity-60" />
              <span>{match.funder.regions.join(", ")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 opacity-60" />
              <span>
                ${match.funder.min_ticket?.toLocaleString()} - ${match.funder.max_ticket?.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Match Reason */}
          <p className="text-sm opacity-80 mb-4">{match.reason}</p>

          {/* Actions */}
          {match.status === "suggested" && (
            <div className="flex gap-2 pt-4 border-t border-gray-700">
              <button
                onClick={() => updateMatchStatus(match.id, "interested")}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <ThumbsUp className="w-4 h-4" />
                Interested
              </button>
              <button
                onClick={() => updateMatchStatus(match.id, "rejected")}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <ThumbsDown className="w-4 h-4" />
                Not Interested
              </button>
            </div>
          )}

          {match.status === "interested" && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-700">
              <span className="text-sm text-green-400 flex items-center gap-2">
                <ThumbsUp className="w-4 h-4" />
                You expressed interest
              </span>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                <MessageCircle className="w-4 h-4" />
                Contact
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}