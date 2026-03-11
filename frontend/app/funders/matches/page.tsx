"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useSidebar } from "@/hooks/sideBarProvider";
import { 
  Target, 
  Search, 
  Filter, 
  MessageCircle, 
  Building,
  MapPin,
  DollarSign,
  Users,
  TrendingUp,
  Clock,
  Eye,
  Star,
  StarOff,
  MoreVertical,
  XCircle,
  FileText
} from "lucide-react";
import toast from "react-hot-toast";

interface MatchRecord {
  id: string;
  score: number;
  reason: string | null;
  status: string;
  created_at: string;
  entity: {
    id: string;
    university: string;
    location: {
      city?: string;
      country?: string;
    };
    research_abstract: string;
    climate_tech_focus: string[];
    min_ticket?: number;
    max_ticket?: number;
  } | null; // Allow entity to be null
  proposal_count: number;
  last_interaction?: string;
  favorite: boolean;
}

export default function FunderMatchesPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { setLoadSession } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");

  const isDark = mounted ? resolvedTheme === "dark" : false;

  useEffect(() => {
    setMounted(true);
    setLoadSession(() => {});
    return () => setLoadSession(() => {});
  }, [setLoadSession]);

  const fetchMatches = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) {
        router.push("/auth/login");
        throw new Error("No authentication token found");
      }

      const response = await fetch("/api/funders/matches", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error(`Failed to fetch matches: ${response.statusText}`);

      const data: MatchRecord[] = await response.json();
      const validMatches = data.filter((match) => {
        if (!match.entity || !match.entity.university || !match.entity.research_abstract) {
          console.warn("Invalid match data (missing entity or required fields):", match);
          return false;
        }
        return true;
      });

      if (validMatches.length < data.length) {
        toast.error("Some matches were invalid and excluded");
      }

      setMatches(validMatches);
    } catch (error) {
      console.error("Fetch matches error:", error);
      toast.error("Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, [router]);

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

      setMatches(prev => 
        prev.map(match => 
          match.id === matchId ? { ...match, status } : match
        )
      );
      
      toast.success(`Match ${status === 'interested' ? 'marked as interested' : 'rejected'}!`);
    } catch (error) {
      console.error("Update match status error:", error);
      toast.error("Failed to update match");
    }
  };

  const toggleFavorite = async (matchId: string, currentlyFavorite: boolean) => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch(`/api/match_records/${matchId}/favorite`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ favorite: !currentlyFavorite }),
      });

      if (!response.ok) throw new Error("Failed to update favorite status");

      setMatches(prev => 
        prev.map(match => 
          match.id === matchId ? { ...match, favorite: !currentlyFavorite } : match
        )
      );
      
      toast.success(!currentlyFavorite ? "Added to favorites!" : "Removed from favorites");
    } catch (error) {
      console.error("Toggle favorite error:", error);
      toast.error("Failed to update favorite status");
    }
  };

  const filteredMatches = matches.filter(match => {
    if (!match.entity) return false;

    const matchesSearch = 
      match.entity.university.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.entity.research_abstract.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || match.status === statusFilter;
    
    const matchesScore = 
      scoreFilter === "all" ||
      (scoreFilter === "high" && match.score >= 0.8) ||
      (scoreFilter === "medium" && match.score >= 0.6 && match.score < 0.8) ||
      (scoreFilter === "low" && match.score < 0.6);
    
    return matchesSearch && matchesStatus && matchesScore;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "suggested": return "bg-blue-500/20 text-blue-400";
      case "interested": return "bg-green-500/20 text-green-400";
      case "contacted": return "bg-yellow-500/20 text-yellow-400";
      case "proposal_sent": return "bg-purple-500/20 text-purple-400";
      case "rejected": return "bg-red-500/20 text-red-400";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "bg-green-500/20 text-green-400";
    if (score >= 0.6) return "bg-yellow-500/20 text-yellow-400";
    return "bg-red-500/20 text-red-400";
  };

  if (!mounted || loading) {
    return (
      <div className={`h-full flex flex-col ${isDark ? "bg-[#0A0A0A] text-white" : "bg-gray-50 text-gray-900"}`}>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-800 rounded w-1/4 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-800 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${isDark ? "bg-[#0A0A0A] text-white" : "bg-gray-50 text-gray-900"}`}>
      <header className={`sticky top-0 z-10 border-b px-4 py-3 ${
        isDark ? "bg-[#0A0A0A] border-gray-800" : "bg-white border-gray-200"
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-[#00FB75]" />
            <div>
              <h1 className="font-semibold">Matches</h1>
              <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                {filteredMatches.length} match{filteredMatches.length !== 1 ? "es" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                isDark ? "text-gray-500" : "text-gray-400"
              }`} />
              <input
                type="text"
                placeholder="Search matches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-8 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#00FB75] ${
                  isDark 
                    ? "bg-[#121212] border-gray-700 text-white placeholder-gray-500" 
                    : "bg-white border-gray-300 placeholder-gray-400"
                }`}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 ${isDark ? "text-gray-500" : "text-gray-400"}`}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#00FB75] ${
                isDark 
                  ? "bg-[#121212] border-gray-700 text-white" 
                  : "bg-white border-gray-300"
              }`}
            >
              <option value="all">All Status</option>
              <option value="suggested">Suggested</option>
              <option value="interested">Interested</option>
              <option value="contacted">Contacted</option>
              <option value="proposal_sent">Proposal Sent</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {(searchTerm || filteredMatches.length !== matches.length) && (
          <div className="mt-2 text-xs">
            <span className={isDark ? "text-gray-400" : "text-gray-600"}>
              {filteredMatches.length} of {matches.length}
              {searchTerm && ` for "${searchTerm}"`}
            </span>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {filteredMatches.length === 0 ? (
          <div className={`text-center py-12 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            <Target className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>
              {matches.length === 0 
                ? "No matches yet" 
                : "No matching matches"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMatches.map((match) => (
              <div
                key={match.id}
                className={`rounded-lg border overflow-hidden ${
                  isDark ? "bg-[#121212] border-gray-800" : "bg-white border-gray-200"
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        match.score >= 0.8 
                          ? "bg-green-500/20 text-green-400"
                          : match.score >= 0.6 
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-red-500/20 text-red-400"
                      }`}>
                        <Target className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className={`font-medium truncate ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}>
                          {match.entity!.university}
                        </h3>
                        <p className={`text-xs ${
                          isDark ? "text-gray-500" : "text-gray-500"
                        }`}>
                          Research Entity
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleFavorite(match.id, match.favorite)}
                        className={`p-1 rounded transition-colors ${
                          match.favorite 
                            ? "text-yellow-400" 
                            : isDark ? "text-gray-600 hover:text-yellow-400" : "text-gray-300 hover:text-yellow-500"
                        }`}
                      >
                        {match.favorite ? (
                          <Star className="w-4 h-4 fill-current" />
                        ) : (
                          <StarOff className="w-4 h-4" />
                        )}
                      </button>
                      <span className={`text-sm font-medium ${
                        match.score >= 0.8 
                          ? "text-green-400"
                          : match.score >= 0.6 
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}>
                        {Math.round(match.score * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className={`flex items-center gap-2 text-xs mt-2 ${
                    isDark ? "text-gray-500" : "text-gray-500"
                  }`}>
                    <MapPin className="w-3 h-3" />
                    <span>{[match.entity!.location.city, match.entity!.location.country].filter(Boolean).join(", ")}</span>
                  </div>

                  <p className={`text-sm line-clamp-2 mt-2 ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}>
                    {match.reason || "No reason provided"}
                  </p>

                  {match.entity!.climate_tech_focus.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {match.entity!.climate_tech_focus.slice(0, 2).map((focus, i) => (
                        <span
                          key={i}
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {focus.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"
                    }`}>
                      {match.status.replace("_", " ")}
                    </span>
                    {match.proposal_count > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        isDark ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-600"
                      }`}>
                        {match.proposal_count} proposal{match.proposal_count !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div className={`flex border-t ${
                  isDark ? "border-gray-800" : "border-gray-200"
                }`}>
                  {match.status === "suggested" && (
                    <>
                      <button
                        onClick={() => updateMatchStatus(match.id, "interested")}
                        className={`flex-1 px-3 py-2 text-sm transition-colors ${
                          isDark 
                            ? "hover:bg-green-500/10 text-green-400" 
                            : "hover:bg-green-50 text-green-600"
                        }`}
                      >
                        Interested
                      </button>
                      <button
                        onClick={() => updateMatchStatus(match.id, "rejected")}
                        className={`flex-1 px-3 py-2 text-sm transition-colors ${
                          isDark 
                            ? "hover:bg-red-500/10 text-red-400" 
                            : "hover:bg-red-50 text-red-600"
                        }`}
                      >
                        Pass
                      </button>
                    </>
                  )}
                  {match.status === "interested" && (
                    <>
                      <button
                        onClick={() => router.push(`/messages?to=${match.entity!.id}`)}
                        className={`flex-1 px-3 py-2 text-sm transition-colors ${
                          isDark 
                            ? "hover:bg-blue-500/10 text-blue-400" 
                            : "hover:bg-blue-50 text-blue-600"
                        }`}
                      >
                        Contact
                      </button>
                      <button
                        onClick={() => router.push(`/proposals/new?entity=${match.entity!.id}`)}
                        className={`flex-1 px-3 py-2 text-sm transition-colors ${
                          isDark 
                            ? "hover:bg-purple-500/10 text-purple-400" 
                            : "hover:bg-purple-50 text-purple-600"
                        }`}
                      >
                        Propose
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => router.push(`/entities/${match.entity!.id}`)}
                    className={`flex-1 px-3 py-2 text-sm transition-colors ${
                      isDark 
                        ? "hover:bg-gray-800 text-gray-400" 
                        : "hover:bg-gray-100 text-gray-600"
                    }`}
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}