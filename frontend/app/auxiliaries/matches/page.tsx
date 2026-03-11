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
  FileText,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

interface Funder {
  id: string;
  name: string;
  org_type: string;
  regions: string[];
  min_ticket: number | null;
  max_ticket: number | null;
  profile: string;
}

interface MatchRecord {
  id: string;
  funder: Funder | null;
  funder_id: string; // Added to handle cases where funder is missing
  score: number;
  reason: string;
  status: string;
  created_at: string;
  last_updated: string;
  entity_id?: string; // Optional, based on API response
  metadata_?: Record<string, any>; // Optional, based on API response
}

export default function MatchesPage() {
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

  const fetchFunderDetails = useCallback(async (funderId: string): Promise<Funder | null> => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }
      const response = await fetch(`/api/funders/${funderId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch funder ${funderId}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching funder ${funderId}:`, error);
      return null;
    }
  }, []);

  const fetchMatches = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) {
        router.push("/auth/login");
        throw new Error("No authentication token found");
      }

      const response = await fetch("/api/matches", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch matches");

      const data: MatchRecord[] = await response.json();
      // Fetch funder details for matches with missing funder data
      const validMatches = await Promise.all(
        data.map(async (match) => {
          if (!match.funder || !match.funder.name || !match.funder.profile) {
            console.warn("Invalid match data, fetching funder details:", match);
            const funder = await fetchFunderDetails(match.funder_id);
            if (!funder) {
              return null; // Skip matches with unresolvable funder data
            }
            return { ...match, funder };
          }
          return match;
        })
      );

      const filteredMatches = validMatches.filter((match): match is MatchRecord => match !== null);

      if (filteredMatches.length < data.length) {
        toast.error("Some matches were invalid and excluded");
      }

      setMatches(filteredMatches);
    } catch (error) {
      console.error("Fetch matches error:", error);
      toast.error("Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, [router, fetchFunderDetails]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const updateMatchStatus = async (matchId: string, status: string) => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) {
        router.push("/auth/login");
        throw new Error("No authentication token found");
      }

      const response = await fetch(`/api/matches/${matchId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error("Failed to update match status");

      setMatches((prev) =>
        prev.map((match) =>
          match.id === matchId ? { ...match, status, last_updated: new Date().toISOString() } : match
        )
      );

      toast.success(status === "interested" ? "Interest expressed!" : "Match rejected");
    } catch (error) {
      console.error("Update match status error:", error);
      toast.error("Failed to update match");
    }
  };

  const createProposal = async (funderId: string, funderName: string) => {
    router.push(`/proposals/new?funder=${funderId}`);
  };

  const filteredMatches = matches.filter((match) => {
    if (!match.funder || !match.funder.name || !match.funder.profile) {
      return false;
    }

    const matchesSearch =
      match.funder.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.funder.profile.toLowerCase().includes(searchTerm.toLowerCase());

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
      case "suggested":
        return "bg-blue-500/20 text-blue-400";
      case "interested":
        return "bg-green-500/20 text-green-400";
      case "contacted":
        return "bg-yellow-500/20 text-yellow-400";
      case "proposal_sent":
        return "bg-purple-500/20 text-purple-400";
      case "rejected":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-gray-500/20 text-gray-400";
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
                          {match.funder!.name}
                        </h3>
                        <p className={`text-xs ${
                          isDark ? "text-gray-500" : "text-gray-500"
                        }`}>
                          {match.funder!.org_type.replace("_", " ")}
                        </p>
                      </div>
                    </div>
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

                  <div className={`flex items-center gap-2 text-xs mt-2 ${
                    isDark ? "text-gray-500" : "text-gray-500"
                  }`}>
                    <MapPin className="w-3 h-3" />
                    <span>{match.funder!.regions.join(", ") || "Global"}</span>
                  </div>

                  <p className={`text-sm line-clamp-2 mt-2 ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}>
                    {match.reason}
                  </p>

                  <div className="flex items-center gap-2 mt-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"
                    }`}>
                      {match.status.replace("_", " ")}
                    </span>
                    <span className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                      {new Date(match.last_updated).toLocaleDateString()}
                    </span>
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
                        onClick={() => router.push(`/messages?to=${match.funder!.id}`)}
                        className={`flex-1 px-3 py-2 text-sm transition-colors ${
                          isDark 
                            ? "hover:bg-blue-500/10 text-blue-400" 
                            : "hover:bg-blue-50 text-blue-600"
                        }`}
                      >
                        Contact
                      </button>
                      <button
                        onClick={() => createProposal(match.funder!.id, match.funder!.name)}
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
                    onClick={() => router.push(`/funders/${match.funder!.id}`)}
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