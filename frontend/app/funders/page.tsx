"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useSidebar } from "@/hooks/sideBarProvider";
import toast from "react-hot-toast";
import { 
  Building, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  MoreVertical,
  Eye
} from "lucide-react";

interface Funder {
  id: string;
  name: string;
  website: string;
  contact: {
    email: string;
    phone: string;
  };
  profile: string;
  org_type: string;
  regions: string[];
  thematic_focus: string[];
  min_ticket: number | null;
  max_ticket: number | null;
  investment_history: any[];
  created_at: string;
}

export default function FundersPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { setLoadSession } = useSidebar();
  
  const [mounted, setMounted] = useState(false);
  const [funders, setFunders] = useState<Funder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const isDark = mounted ? resolvedTheme === "dark" : false;

  // Fix hydration
  useEffect(() => {
    setMounted(true);
    setLoadSession(() => {});
    return () => setLoadSession(() => {});
  }, [setLoadSession]);

  useEffect(() => {
    fetchFunders();
  }, []);

  const fetchFunders = async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch("/api/funders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setFunders(data);
    } catch (error) {
      console.error("Fetch funders error:", error);
      toast.error("Failed to load funders");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (funderId: string) => {
    if (!confirm("Are you sure you want to delete this funder organization? This action cannot be undone.")) {
      return;
    }

    setDeleteLoading(funderId);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch(`/api/funders/${funderId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      toast.success("Funder organization deleted successfully");
      setFunders(funders.filter(f => f.id !== funderId));
    } catch (error) {
      console.error("Delete funder error:", error);
      toast.error("Failed to delete funder organization");
    } finally {
      setDeleteLoading(null);
    }
  };

  const orgTypeLabels: Record<string, string> = {
    vc: "Venture Capital",
    angel: "Angel Investor", 
    gov: "Government Fund",
    foundation: "Foundation",
    corporate: "Corporate VC"
  };

  const orgTypeIcons: Record<string, string> = {
    vc: "💼",
    angel: "👼",
    gov: "🏛️",
    foundation: "🏢",
    corporate: "🏭"
  };

  // Filter funders based on search and filter
  const filteredFunders = funders.filter(funder => {
    const matchesSearch = funder.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         funder.contact?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === "all" || funder.org_type === filterType;
    return matchesSearch && matchesFilter;
  });

  if (!mounted) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-black" : "bg-gray-50"}`}>
        <div className="container mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"}`}>
      {/* Header */}
      <div className={`border-b ${isDark ? "border-gray-800" : "border-gray-200"}`}>
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Funder Organizations</h1>
              <p className="opacity-70 mt-1">Manage your investment organizations</p>
            </div>
            <button
              onClick={() => router.push("/funders/new")}
              className="bg-[#00FB75] text-black font-semibold px-6 py-3 rounded-lg hover:bg-green-400 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Funder
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="container mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 opacity-50" />
            <input
              type="text"
              placeholder="Search funders by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-lg border transition-colors ${
                isDark 
                  ? "bg-gray-900 border-gray-700 text-white focus:border-[#00FB75]" 
                  : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
              }`}
            />
          </div>
          <div className="flex gap-4">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={`px-4 py-3 rounded-lg border transition-colors ${
                isDark 
                  ? "bg-gray-900 border-gray-700 text-white focus:border-[#00FB75]" 
                  : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
              }`}
            >
              <option value="all">All Types</option>
              <option value="vc">Venture Capital</option>
              <option value="angel">Angel Investor</option>
              <option value="gov">Government Fund</option>
              <option value="foundation">Foundation</option>
              <option value="corporate">Corporate VC</option>
            </select>
          </div>
        </div>

        {/* Funders List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`animate-pulse rounded-xl p-6 ${
                  isDark ? "bg-gray-900" : "bg-white shadow-sm"
                }`}
              >
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : filteredFunders.length === 0 ? (
          <div className={`text-center py-12 rounded-xl ${
            isDark ? "bg-gray-900" : "bg-white shadow-sm"
          }`}>
            <Building className="w-16 h-16 opacity-50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No funders found</h3>
            <p className="opacity-70 mb-6">
              {searchTerm || filterType !== "all" 
                ? "Try adjusting your search or filter criteria"
                : "Get started by creating your first funder organization"
              }
            </p>
            {!searchTerm && filterType === "all" && (
              <button
                onClick={() => router.push("/funders/new")}
                className="bg-[#00FB75] text-black font-semibold px-6 py-3 rounded-lg hover:bg-green-400 transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Funder
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFunders.map((funder) => (
              <div
                key={funder.id}
                className={`rounded-xl p-6 transition-all hover:shadow-lg ${
                  isDark 
                    ? "bg-gray-900 border border-gray-800 hover:border-gray-700" 
                    : "bg-white shadow-sm border border-transparent hover:border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">
                        {orgTypeIcons[funder.org_type] || "🏢"}
                      </span>
                      <h3 className="text-xl font-semibold">{funder.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        isDark ? "bg-gray-800" : "bg-gray-100"
                      }`}>
                        {orgTypeLabels[funder.org_type] || funder.org_type}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                          Contact Email
                        </p>
                        <p className="font-medium">
                          {funder.contact?.email || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                          Investment Range
                        </p>
                        <p className="font-medium">
                          {funder.min_ticket && funder.max_ticket 
                            ? `$${funder.min_ticket.toLocaleString()} - $${funder.max_ticket.toLocaleString()}`
                            : "Not specified"
                          }
                        </p>
                      </div>
                      <div>
                        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                          Regions
                        </p>
                        <p className="font-medium">
                          {funder.regions.length > 0 
                            ? funder.regions.slice(0, 2).join(", ") + (funder.regions.length > 2 ? "..." : "")
                            : "Not specified"
                          }
                        </p>
                      </div>
                    </div>

                    {funder.thematic_focus.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {funder.thematic_focus.slice(0, 3).map((focus, index) => (
                          <span
                            key={index}
                            className={`px-2 py-1 rounded-full text-xs ${
                              isDark ? "bg-gray-800" : "bg-gray-100"
                            }`}
                          >
                            {focus}
                          </span>
                        ))}
                        {funder.thematic_focus.length > 3 && (
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            isDark ? "bg-gray-800" : "bg-gray-100"
                          }`}>
                            +{funder.thematic_focus.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => router.push(`/funders/${funder.id}`)}
                      className={`p-2 rounded-lg transition-colors ${
                        isDark 
                          ? "hover:bg-gray-800 text-gray-400 hover:text-white" 
                          : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                      }`}
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => router.push(`/funders/${funder.id}/edit`)}
                      className={`p-2 rounded-lg transition-colors ${
                        isDark 
                          ? "hover:bg-gray-800 text-gray-400 hover:text-white" 
                          : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                      }`}
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(funder.id)}
                      disabled={deleteLoading === funder.id}
                      className={`p-2 rounded-lg transition-colors ${
                        deleteLoading === funder.id
                          ? "opacity-50 cursor-not-allowed"
                          : isDark
                            ? "hover:bg-red-900/20 text-red-400 hover:text-red-300"
                            : "hover:bg-red-50 text-red-600 hover:text-red-700"
                      }`}
                      title="Delete"
                    >
                      {deleteLoading === funder.id ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}