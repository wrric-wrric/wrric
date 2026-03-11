"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Building, Users, Mail, Trash2, ArrowLeft, FlaskConical, Plus, Search, X, BarChart3, Eye, Heart, MessageSquare, Share2, Settings, Upload, Image as ImageIcon } from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import type { Partner, PartnerMember } from "@/lib/types";

interface PartnerLab {
  id: string;
  university: string;
  research_abstract: string;
  website: string | null;
  location: Record<string, string>;
  scopes: string[];
  entity_type: string;
  source: string;
  timestamp: string | null;
  images: { id: string; url: string; caption: string; is_primary: boolean }[];
}

export default function ManagePartnerPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [members, setMembers] = useState<PartnerMember[]>([]);
  const [labs, setLabs] = useState<PartnerLab[]>([]);
  const [labsTotal, setLabsTotal] = useState(0);
  const [labSearch, setLabSearch] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [assignEntityId, setAssignEntityId] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"members" | "labs" | "analytics" | "settings">("labs");
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Lab search/picker states
  const [labPickerSearch, setLabPickerSearch] = useState("");
  const [labPickerResults, setLabPickerResults] = useState<PartnerLab[]>([]);
  const [labPickerLoading, setLabPickerLoading] = useState(false);
  const [showLabPicker, setShowLabPicker] = useState(false);
  
  // Logo/Banner upload states
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string>("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const token = typeof window !== "undefined" ? (localStorage.getItem("token") || sessionStorage.getItem("token")) : null;

  // Check authentication on mount
  useEffect(() => {
    if (!token) {
      toast.error("You must be logged in to manage partners");
      router.push("/auth/login");
      return;
    }
    
    // Get current user ID from localStorage
    const userId = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;
    setCurrentUserId(userId);
  }, [token, router]);

  const fetchAnalytics = useCallback(async () => {
    if (!partner) return;
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/partners/${partner.id}/analytics?days=${analyticsDays}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setAnalyticsData(await res.json());
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [partner, analyticsDays, token]);

  const fetchData = useCallback(async () => {
    if (!slug || slug === 'undefined') { router.push("/partners"); return; }
    if (!token) {
      toast.error("Authentication required");
      router.push("/auth/login");
      return;
    }
    
    try {
      const res = await fetch(`/api/partners/${slug}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { router.push("/partners"); return; }
      const p = await res.json();
      
      // Check if user is owner or member
      const userId = currentUserId || (typeof window !== "undefined" ? localStorage.getItem("user_id") : null);
      
      // Fetch members to check if user has access
      const membersRes = await fetch(`/api/partners/${p.id}/members`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      let userMember = null;
      if (membersRes.ok) {
        const membersList = await membersRes.json();
        setMembers(membersList);
        userMember = membersList.find((m: PartnerMember) => m.user_id === userId);
      }
      
      // Check authorization: user must be owner or have editor/owner role
      const isOwner = p.owner?.id === userId;
      const hasEditAccess = userMember && (userMember.role === "owner" || userMember.role === "editor");
      
      if (!isOwner && !hasEditAccess) {
        toast.error("You don't have permission to manage this partner");
        router.push(`/partners/${slug}`);
        return;
      }
      
      setIsAuthorized(true);
      setPartner(p);
    } catch { 
      toast.error("Failed to load partner data");
      router.push("/partners"); 
    } finally { 
      setLoading(false);
    }
  }, [slug, token, currentUserId, router]);

  const fetchLabs = useCallback(async () => {
    if (!partner) return;
    try {
      const params = new URLSearchParams();
      if (labSearch) params.set("search", labSearch);
      const res = await fetch(`/api/partners/${partner.id}/labs?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setLabs(data.items || []);
        setLabsTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch labs:", err);
    }
  }, [partner, labSearch, token]);

  useEffect(() => {
    if (slug && slug !== 'undefined') fetchData();
  }, [slug, fetchData]);

  useEffect(() => {
    if (partner) fetchLabs();
  }, [partner, fetchLabs]);

  useEffect(() => {
    if (partner && activeTab === "analytics") fetchAnalytics();
  }, [partner, activeTab, fetchAnalytics]);

  // Search labs for the picker (excludes already assigned labs)
  const searchLabsForPicker = useCallback(async (query: string) => {
    if (!query.trim()) {
      setLabPickerResults([]);
      return;
    }
    setLabPickerLoading(true);
    try {
      const res = await fetch(`/api/search/labs?q=${encodeURIComponent(query)}&limit=10`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        // Filter out labs already assigned to this partner
        const assignedIds = new Set(labs.map(l => l.id));
        const available = (data.items || data || []).filter((l: PartnerLab) => !assignedIds.has(l.id));
        setLabPickerResults(available);
      }
    } catch (err) {
      console.error("Failed to search labs:", err);
    } finally {
      setLabPickerLoading(false);
    }
  }, [token, labs]);

  // Debounce lab picker search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (labPickerSearch) searchLabsForPicker(labPickerSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [labPickerSearch, searchLabsForPicker]);

  const handleAssignLabFromPicker = async (labId: string) => {
    if (!partner) return;
    try {
      const res = await fetch(`/api/partners/${partner.id}/labs/${labId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Lab assigned to partner!");
        setLabPickerSearch("");
        setLabPickerResults([]);
        setShowLabPicker(false);
        fetchLabs();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to assign lab");
      }
    } catch { toast.error("Failed to assign lab"); }
  };

  const handleAssignLab = async () => {
    if (!assignEntityId.trim() || !partner) return;
    try {
      const res = await fetch(`/api/partners/${partner.id}/labs/${assignEntityId.trim()}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Lab assigned to partner!");
        setAssignEntityId("");
        fetchLabs();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to assign lab");
      }
    } catch { toast.error("Failed to assign lab"); }
  };

  const handleUnassignLab = async (entityId: string) => {
    if (!partner || !confirm("Remove this lab from the partner?")) return;
    try {
      const res = await fetch(`/api/partners/${partner.id}/labs/${entityId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Lab removed from partner");
        setLabs(labs.filter((l) => l.id !== entityId));
        setLabsTotal((t) => t - 1);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to remove lab");
      }
    } catch { toast.error("Failed to remove lab"); }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !partner) return;
    try {
      const res = await fetch(`/api/partners/${partner.id}/members/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (res.ok) {
        toast.success("Invitation sent!");
        setInviteEmail("");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to send invitation");
      }
    } catch { toast.error("Failed to send invitation"); }
  };

  const handleRemove = async (userId: string) => {
    if (!partner || !confirm("Remove this member?")) return;
    try {
      const res = await fetch(`/api/partners/${partner.id}/members/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Member removed");
        setMembers(members.filter((m) => m.user_id !== userId));
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to remove member");
      }
    } catch { toast.error("Failed to remove member"); }
  };

  // Logo handlers
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image must be less than 2MB. Please compress or resize your image.");
        return;
      }
      if (file.size > 1 * 1024 * 1024) {
        toast("Large file detected. Upload may be slow.", { icon: "⚠️" });
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async () => {
    if (!logoFile || !partner) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", logoFile);
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const res = await fetch(`/api/partners/${partner.id}/logo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const updated = await res.json();
        setPartner(updated);
        setLogoFile(null);
        setLogoPreview("");
        toast.success("Logo uploaded successfully");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to upload logo");
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast.error("Upload timed out. Please try a smaller image.");
      } else {
        toast.error("Failed to upload logo");
      }
    }
    finally { setUploadingLogo(false); }
  };

  const deleteLogo = async () => {
    if (!partner || !confirm("Delete the logo?")) return;
    setUploadingLogo(true);
    try {
      const res = await fetch(`/api/partners/${partner.id}/logo`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const updated = await res.json();
        setPartner(updated);
        toast.success("Logo deleted");
      } else {
        toast.error("Failed to delete logo");
      }
    } catch { toast.error("Failed to delete logo"); }
    finally { setUploadingLogo(false); }
  };

  // Banner handlers
  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 3 * 1024 * 1024) {
        toast.error("Image must be less than 3MB. Please compress or resize your image.");
        return;
      }
      if (file.size > 1.5 * 1024 * 1024) {
        toast("Large file detected. Upload may be slow.", { icon: "⚠️" });
      }
      setBannerFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setBannerPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadBanner = async () => {
    if (!bannerFile || !partner) return;
    setUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append("file", bannerFile);
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const res = await fetch(`/api/partners/${partner.id}/banner`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const updated = await res.json();
        setPartner(updated);
        setBannerFile(null);
        setBannerPreview("");
        toast.success("Banner uploaded successfully");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to upload banner");
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast.error("Upload timed out. Please try a smaller image.");
      } else {
        toast.error("Failed to upload banner");
      }
    }
    finally { setUploadingBanner(false); }
  };

  const deleteBanner = async () => {
    if (!partner || !confirm("Delete the banner?")) return;
    setUploadingBanner(true);
    try {
      const res = await fetch(`/api/partners/${partner.id}/banner`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const updated = await res.json();
        setPartner(updated);
        toast.success("Banner deleted");
      } else {
        toast.error("Failed to delete banner");
      }
    } catch { toast.error("Failed to delete banner"); }
    finally { setUploadingBanner(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!partner || !isAuthorized) return null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.push(`/partners/${slug}`)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Storefront
        </button>

        <div className="flex items-center gap-3 mb-8">
          {partner.logo_url ? (
            <Image src={partner.logo_url} alt={partner.name} width={40} height={40} className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <Building className="w-8 h-8 text-[#00FB75]" />
          )}
          <h1 className="text-3xl font-bold">Manage: {partner.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            partner.status === "approved" ? "bg-green-100 text-green-800" :
            partner.status === "pending" ? "bg-yellow-100 text-yellow-800" :
            "bg-red-100 text-red-800"
          }`}>{partner.status}</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab("labs")}
            className={`pb-3 px-1 font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "labs" ? "border-[#00FB75] text-[#00FB75]" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FlaskConical className="w-4 h-4" /> Labs ({labsTotal})
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`pb-3 px-1 font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "members" ? "border-[#00FB75] text-[#00FB75]" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-4 h-4" /> Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`pb-3 px-1 font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "analytics" ? "border-[#00FB75] text-[#00FB75]" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Analytics
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-3 px-1 font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "settings" ? "border-[#00FB75] text-[#00FB75]" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings className="w-4 h-4" /> Settings
          </button>
        </div>

        {/* Labs Tab */}
        {activeTab === "labs" && (
          <div className="space-y-6">
            {/* Add Lab - Searchable Picker */}
            <div className="border rounded-xl p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Lab to Partner
              </h3>
              <p className="text-sm text-muted-foreground mb-4">Search for labs to add to your partner organization.</p>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search labs by name, research area, or location..."
                  value={labPickerSearch}
                  onChange={(e) => { setLabPickerSearch(e.target.value); setShowLabPicker(true); }}
                  onFocus={() => setShowLabPicker(true)}
                  className="w-full pl-10 pr-4 py-3 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
                />
                {labPickerLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-[#00FB75] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              
              {/* Search Results Dropdown */}
              {showLabPicker && labPickerSearch && (
                <div className="mt-2 border rounded-lg bg-background shadow-lg max-h-80 overflow-y-auto">
                  {labPickerResults.length === 0 && !labPickerLoading ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      {labPickerSearch.length < 2 ? "Type at least 2 characters to search" : "No labs found matching your search"}
                    </div>
                  ) : (
                    labPickerResults.map((lab) => (
                      <button
                        key={lab.id}
                        onClick={() => handleAssignLabFromPicker(lab.id)}
                        className="w-full p-4 text-left border-b last:border-b-0 hover:bg-[#00FB75]/10 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <FlaskConical className="w-5 h-5 text-[#00FB75] flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{lab.university || "Unnamed Lab"}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                              {lab.research_abstract || "No description"}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {(lab.scopes || []).slice(0, 2).map((s) => (
                                <span key={s} className="text-xs px-2 py-0.5 bg-[#00FB75]/10 text-[#00FB75] rounded-full">{s}</span>
                              ))}
                              {lab.location?.country && (
                                <span className="text-xs text-muted-foreground">📍 {lab.location.country}</span>
                              )}
                            </div>
                          </div>
                          <Plus className="w-5 h-5 text-[#00FB75] flex-shrink-0" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
              
              {/* Advanced: Manual ID entry (collapsed) */}
              <details className="mt-4">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  Advanced: Add by Lab ID
                </summary>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    placeholder="Lab UUID"
                    value={assignEntityId}
                    onChange={(e) => setAssignEntityId(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
                  />
                  <button onClick={handleAssignLab} className="px-3 py-2 text-sm bg-[#00FB75] text-black rounded-lg font-medium hover:bg-[#00e065]">
                    Add
                  </button>
                </div>
              </details>
              
              {/* Create New Lab Link */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Don&apos;t see your lab? Create a new one:</p>
                <button
                  onClick={() => router.push(`/user-labs/new?partner_id=${partner?.id}`)}
                  className="inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[#00FB75]/50 text-[#00FB75] rounded-lg hover:bg-[#00FB75]/10 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create New Lab
                </button>
              </div>
            </div>

            {/* Search existing partner labs */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm text-muted-foreground">Your Partner Labs ({labsTotal})</h3>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search partner labs..."
                value={labSearch}
                onChange={(e) => setLabSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
              />
            </div>

            {/* Lab List */}
            {labs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No labs assigned to this partner yet.
              </div>
            ) : (
              <div className="space-y-3">
                {labs.map((lab) => (
                  <div key={lab.id} className="border rounded-lg p-4 flex items-start justify-between hover:border-[#00FB75] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FlaskConical className="w-4 h-4 text-[#00FB75] flex-shrink-0" />
                        <h4 className="font-medium truncate">{lab.university || "Unnamed Lab"}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {lab.research_abstract || "No description"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(lab.scopes || []).slice(0, 3).map((s) => (
                          <span key={s} className="text-xs px-2 py-0.5 bg-[#00FB75]/10 text-[#00FB75] rounded-full">{s}</span>
                        ))}
                        {lab.location?.country && (
                          <span className="text-xs text-muted-foreground">{lab.location.country}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">ID: {lab.id}</p>
                    </div>
                    <button
                      onClick={() => handleUnassignLab(lab.id)}
                      className="ml-4 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                      title="Remove lab from partner"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="flex justify-end gap-2">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setAnalyticsDays(d)}
                  className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                    analyticsDays === d ? "bg-[#00FB75] text-black border-[#00FB75]" : "border-border hover:border-foreground"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            {analyticsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading analytics...</div>
            ) : analyticsData ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Total Views", value: analyticsData.total_views, icon: Eye, color: "#3b82f6" },
                    { label: "Total Likes", value: analyticsData.total_likes, icon: Heart, color: "#ef4444" },
                    { label: "Total Comments", value: analyticsData.total_comments, icon: MessageSquare, color: "#f59e0b" },
                    { label: "Total Shares", value: analyticsData.total_shares, icon: Share2, color: "#00FB75" },
                  ].map((c) => (
                    <div key={c.label} className="border rounded-xl p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <c.icon className="w-4 h-4" style={{ color: c.color }} />
                        <span className="text-sm">{c.label}</span>
                      </div>
                      <p className="text-2xl font-bold">{(c.value || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                {/* Top Labs */}
                {analyticsData.top_labs && analyticsData.top_labs.length > 0 && (
                  <div className="border rounded-xl p-6">
                    <h3 className="font-semibold mb-4">Top Labs by Engagement</h3>
                    <div className="space-y-3">
                      {analyticsData.top_labs.map((lab: any, i: number) => (
                        <div key={lab.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground text-sm w-6">{i + 1}.</span>
                            <span className="font-medium truncate max-w-[200px]">{lab.name}</span>
                          </div>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span>{lab.views} views</span>
                            <span>{lab.likes} likes</span>
                            <span className="font-semibold text-foreground">{lab.total_engagement} total</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follower Growth Mini Chart */}
                {analyticsData.daily_followers && analyticsData.daily_followers.length > 0 && (
                  <div className="border rounded-xl p-6">
                    <h3 className="font-semibold mb-4">Follower Growth</h3>
                    <svg viewBox="0 0 400 100" className="w-full h-24" preserveAspectRatio="none">
                      {(() => {
                        const d = analyticsData.daily_followers;
                        const max = Math.max(...d.map((p: any) => p.count), 1);
                        const pts = d.map((p: any, i: number) => {
                          const x = 20 + (d.length === 1 ? 180 : (i / (d.length - 1)) * 360);
                          const y = 10 + 80 - (p.count / max) * 80;
                          return `${x},${y}`;
                        });
                        return (
                          <>
                            <polyline fill="none" stroke="#00FB75" strokeWidth="2" points={pts.join(" ")} />
                            {d.map((p: any, i: number) => {
                              const x = 20 + (d.length === 1 ? 180 : (i / (d.length - 1)) * 360);
                              const y = 10 + 80 - (p.count / max) * 80;
                              return <circle key={i} cx={x} cy={y} r="3" fill="#00FB75" />;
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No analytics data available</div>
            )}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === "members" && (
          <div className="border rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" /> Members ({members.length})
            </h2>
            <div className="space-y-3 mb-6">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="font-medium">{m.username || m.email}</span>
                    <span className="ml-2 text-xs px-2 py-0.5 bg-[#00FB75]/10 text-[#00FB75] rounded-full">{m.role}</span>
                  </div>
                  {m.role !== "owner" && (
                    <button onClick={() => handleRemove(m.user_id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Invite */}
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4" /> Invite Member
              </h3>
              <div className="flex gap-3">
                <input
                  type="email"
                  placeholder="Email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 px-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-4 py-2 border rounded-lg bg-background"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="owner">Owner</option>
                </select>
                <button onClick={handleInvite} className="px-4 py-2 bg-[#00FB75] text-black rounded-lg font-medium hover:bg-[#00e065]">
                  Invite
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            {/* Logo Upload */}
            <div className="border rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" /> Organization Logo
              </h3>
              <p className="text-sm text-muted-foreground mb-4">Upload your organization&apos;s logo (recommended: 200x200px, max 2MB)</p>
              
              <div className="flex items-start gap-6">
                {/* Current Logo */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs text-muted-foreground">Current</span>
                  {partner.logo_url ? (
                    <div className="relative">
                      <Image
                        src={partner.logo_url}
                        alt="Current logo"
                        width={96}
                        height={96}
                        className="w-24 h-24 rounded-lg object-cover border"
                      />
                      <button
                        onClick={deleteLogo}
                        disabled={uploadingLogo}
                        className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground">
                      <Building className="w-8 h-8" />
                    </div>
                  )}
                </div>

                {/* New Logo Preview / Upload */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs text-muted-foreground">New</span>
                  {logoPreview ? (
                    <div className="relative">
                      <Image
                        src={logoPreview}
                        alt="New logo preview"
                        width={96}
                        height={96}
                        className="w-24 h-24 rounded-lg object-cover border"
                      />
                      <button
                        onClick={() => { setLogoFile(null); setLogoPreview(""); }}
                        className="absolute -top-2 -right-2 p-1 bg-muted text-muted-foreground rounded-full hover:bg-muted/80"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => logoInputRef.current?.click()}
                      className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-[#00FB75] hover:bg-[#00FB75]/5 transition-colors"
                    >
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">Upload</span>
                    </div>
                  )}
                </div>

                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />

                {logoFile && (
                  <button
                    onClick={uploadLogo}
                    disabled={uploadingLogo}
                    className="px-4 py-2 bg-[#00FB75] text-black rounded-lg font-medium hover:bg-[#00e065] disabled:opacity-50 self-end"
                  >
                    {uploadingLogo ? "Uploading..." : "Save Logo"}
                  </button>
                )}
              </div>
            </div>

            {/* Banner Upload */}
            <div className="border rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" /> Banner Image
              </h3>
              <p className="text-sm text-muted-foreground mb-4">Upload a banner image for your partner page (recommended: 1200x400px, max 10MB)</p>
              
              <div className="space-y-4">
                {/* Current Banner */}
                {partner.banner_url && (
                  <div className="relative">
                    <span className="text-xs text-muted-foreground mb-2 block">Current Banner</span>
                    <Image
                      src={partner.banner_url}
                      alt="Current banner"
                      width={800}
                      height={200}
                      className="w-full h-40 rounded-lg object-cover border"
                    />
                    <button
                      onClick={deleteBanner}
                      disabled={uploadingBanner}
                      className="absolute top-6 right-2 p-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* New Banner Preview */}
                {bannerPreview && (
                  <div className="relative">
                    <span className="text-xs text-muted-foreground mb-2 block">New Banner</span>
                    <Image
                      src={bannerPreview}
                      alt="New banner preview"
                      width={800}
                      height={200}
                      className="w-full h-40 rounded-lg object-cover border"
                    />
                    <button
                      onClick={() => { setBannerFile(null); setBannerPreview(""); }}
                      className="absolute top-6 right-2 p-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Upload Area */}
                {!bannerPreview && (
                  <div
                    onClick={() => bannerInputRef.current?.click()}
                    className="w-full h-32 rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-[#00FB75] hover:bg-[#00FB75]/5 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground mt-2">Click to upload banner</span>
                  </div>
                )}

                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerChange}
                  className="hidden"
                />

                {bannerFile && (
                  <button
                    onClick={uploadBanner}
                    disabled={uploadingBanner}
                    className="px-4 py-2 bg-[#00FB75] text-black rounded-lg font-medium hover:bg-[#00e065] disabled:opacity-50"
                  >
                    {uploadingBanner ? "Uploading..." : "Save Banner"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
