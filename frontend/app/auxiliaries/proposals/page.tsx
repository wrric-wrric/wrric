"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useSidebar } from "@/hooks/sideBarProvider";
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Eye, 
  Download,
  Building,
  DollarSign,
  Target,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  MoreVertical
} from "lucide-react";
import toast from "react-hot-toast";

interface Proposal {
  id: string;
  title: string;
  summary: string;
  ask_amount: number;
  equity_seek: number | null;
  stage: string;
  status: string;
  climate_focus: string[];
  created_at: string;
  funder: {
    id: string;
    name: string;
    org_type: string;
    regions: string[];
  };
  documents: string[];
}

export default function ProposalsPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { setLoadSession } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const isDark = mounted ? resolvedTheme === "dark" : false;

  useEffect(() => {
    setMounted(true);
    setLoadSession(() => {});
    return () => setLoadSession(() => {});
  }, [setLoadSession]);

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch("/api/proposals", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch proposals");
      
      const data = await response.json();
      setProposals(data);
    } catch (error) {
      console.error("Fetch proposals error:", error);
      toast.error("Failed to load proposals");
    } finally {
      setLoading(false);
    }
  };

  const deleteProposal = async (proposalId: string) => {
    if (!confirm("Are you sure you want to delete this proposal? This action cannot be undone.")) {
      return;
    }

    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to delete proposal");
      
      setProposals(prev => prev.filter(proposal => proposal.id !== proposalId));
      toast.success("Proposal deleted successfully");
    } catch (error) {
      console.error("Delete proposal error:", error);
      toast.error("Failed to delete proposal");
    }
  };

  const downloadProposal = async (proposalId: string, proposalTitle: string) => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch(`/api/proposals/${proposalId}/export`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to download proposal");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${proposalTitle.replace(/\s+/g, '_')}_proposal.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success("Proposal downloaded successfully!");
    } catch (error) {
      console.error("Download proposal error:", error);
      toast.error("Failed to download proposal");
    }
  };

  const filteredProposals = proposals.filter(proposal => {
    const matchesSearch = 
      proposal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proposal.funder.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proposal.summary.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || proposal.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-500/20 text-gray-400";
      case "submitted": return "bg-blue-500/20 text-blue-400";
      case "under_review": return "bg-yellow-500/20 text-yellow-400";
      case "accepted": return "bg-green-500/20 text-green-400";
      case "declined": return "bg-red-500/20 text-red-400";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  const getStageLabel = (stage: string) => {
    const stages: { [key: string]: string } = {
      idea: "Idea/Concept",
      prototype: "Prototype",
      seed: "Seed",
      series_a: "Series A",
      series_b: "Series B",
      growth: "Growth"
    };
    return stages[stage] || stage;
  };

  if (!mounted || loading) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-black" : "bg-gray-50"}`}>
        <div className="container mx-auto px-6 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen overflow-y-auto ${isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"}`}>
      {/* Header */}
      <div className={`border-b ${isDark ? "border-gray-800" : "border-gray-200"}`}>
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">My Proposals</h1>
              <p className="text-sm opacity-70 mt-1">
                Manage your funding proposals and track their status
              </p>
            </div>
            <button
              onClick={() => router.push("/proposals/new")}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
                isDark 
                  ? "bg-[#00FB75] text-black hover:bg-green-400" 
                  : "bg-[#00FB75] text-black hover:bg-green-400"
              }`}
            >
              <Plus className="w-5 h-5" />
              New Proposal
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Filters and Search */}
          <div className={`rounded-xl p-6 mb-8 ${isDark ? "bg-gray-900" : "bg-white shadow-sm"}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 opacity-60" />
                <input
                  type="text"
                  placeholder="Search proposals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg border transition-colors ${
                    isDark 
                      ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                      : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
                  }`}
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  isDark 
                    ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                    : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
                }`}
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
              </select>
            </div>
          </div>

          {/* Proposals List */}
          <div className="space-y-6">
            {filteredProposals.length === 0 ? (
              <div className={`text-center py-16 rounded-xl ${isDark ? "bg-gray-900" : "bg-white shadow-sm"}`}>
                <FileText className="w-24 h-24 mx-auto mb-4 opacity-50" />
                <h2 className="text-2xl font-semibold mb-2">
                  {proposals.length === 0 ? "No Proposals Yet" : "No Matching Proposals"}
                </h2>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  {proposals.length === 0 
                    ? "Create your first funding proposal to start seeking investment for your project." 
                    : "No proposals match your current filters."}
                </p>
                {proposals.length === 0 && (
                  <button
                    onClick={() => router.push("/proposals/new")}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
                      isDark 
                        ? "bg-[#00FB75] text-black hover:bg-green-400" 
                        : "bg-[#00FB75] text-black hover:bg-green-400"
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                    Create Your First Proposal
                  </button>
                )}
              </div>
            ) : (
              filteredProposals.map((proposal) => (
                <div
                  key={proposal.id}
                  className={`rounded-xl p-6 transition-all ${
                    isDark 
                      ? "bg-gray-900 border border-gray-800 hover:border-gray-600" 
                      : "bg-white border border-gray-200 hover:border-gray-300 shadow-sm"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    {/* Proposal Content */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-semibold mb-2">{proposal.title}</h3>
                          <div className="flex flex-wrap items-center gap-4 mb-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(proposal.status)}`}>
                              {proposal.status.replace('_', ' ')}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-sm ${
                              isDark ? "bg-gray-800" : "bg-gray-100"
                            }`}>
                              {getStageLabel(proposal.stage)}
                            </span>
                            <div className="flex items-center gap-1 text-sm opacity-70">
                              <Calendar className="w-4 h-4" />
                              {new Date(proposal.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="text-sm opacity-80 line-clamp-2">
                        {proposal.summary}
                      </p>

                      {/* Funder Info */}
                      <div className={`p-4 rounded-lg ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
                        <div className="flex items-center gap-3 mb-2">
                          <Building className="w-4 h-4 opacity-60" />
                          <span className="font-medium">{proposal.funder.name}</span>
                        </div>
                        <div className="text-sm opacity-70">
                          {proposal.funder.org_type.replace('_', ' ')} • {proposal.funder.regions.join(", ")}
                        </div>
                      </div>

                      {/* Proposal Details */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 opacity-60" />
                          <span className="text-sm">
                            ${proposal.ask_amount.toLocaleString()}
                          </span>
                        </div>
                        {proposal.equity_seek && (
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 opacity-60" />
                            <span className="text-sm">
                              {proposal.equity_seek}% Equity
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 opacity-60" />
                          <span className="text-sm">
                            {proposal.documents.length} document{proposal.documents.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      {/* Climate Focus */}
                      {proposal.climate_focus.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {proposal.climate_focus.map((focus, index) => (
                            <span
                              key={index}
                              className={`px-2 py-1 rounded-full text-xs ${
                                isDark 
                                  ? "bg-gray-800 text-gray-300" 
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {focus.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 lg:w-48">
                      {proposal.status === "draft" && (
                        <button
                          onClick={() => router.push(`/proposals/${proposal.id}/edit`)}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                      )}
                      
                      <button
                        onClick={() => router.push(`/funders/${proposal.funder.id}`)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View Funder
                      </button>
                      
                      <button
                        onClick={() => downloadProposal(proposal.id, proposal.title)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                      
                      {proposal.status === "draft" && (
                        <button
                          onClick={() => deleteProposal(proposal.id)}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}