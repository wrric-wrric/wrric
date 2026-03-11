"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building,
  Check,
  X,
  Star,
  StarOff,
  Trash2,
  Globe,
  Tag,
  Clock,
  Search,
  ChevronDown,
  ExternalLink,
  Users,
  FlaskConical,
  AlertCircle,
  Mail,
  Send,
} from "lucide-react";
import toast from "react-hot-toast";

interface Partner {
  id: string;
  name: string;
  slug: string;
  description: string;
  website: string | null;
  logo_url: string | null;
  banner_url: string | null;
  contact_email: string | null;
  sector_focus: string[];
  country: string | null;
  region: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  is_verified: boolean;
  is_featured: boolean;
  organization_type: string | null;
  member_count: number;
  lab_count: number;
  created_at: string;
  owner: { id: string; username: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-yellow-600", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  approved: { label: "Approved", color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" },
  rejected: { label: "Rejected", color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30" },
  suspended: { label: "Suspended", color: "text-gray-600", bg: "bg-gray-100 dark:bg-gray-900/30" },
};

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", organization_name: "", message: "" });
  const [inviteLoading, setInviteLoading] = useState(false);

  const getToken = () =>
    localStorage.getItem("token") || sessionStorage.getItem("token") || "";

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/partners?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPartners(Array.isArray(data) ? data : []);
      } else {
        toast.error("Failed to load partners");
      }
    } catch {
      toast.error("Failed to load partners");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleAction = async (
    partnerId: string,
    action: "approve" | "reject" | "feature" | "delete"
  ) => {
    const endpoint =
      action === "delete"
        ? `/api/admin/partners/${partnerId}`
        : `/api/admin/partners/${partnerId}/${action}`;
    const method = action === "delete" ? "DELETE" : "POST";

    setActionLoading(`${partnerId}-${action}`);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        toast.success(
          action === "approve"
            ? "Partner approved"
            : action === "reject"
              ? "Partner rejected"
              : action === "feature"
                ? "Featured status toggled"
                : "Partner suspended"
        );
        fetchPartners();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || `Failed to ${action} partner`);
      }
    } catch {
      toast.error(`Failed to ${action} partner`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleInvite = async () => {
    if (!inviteForm.email.trim()) {
      toast.error("Email is required");
      return;
    }
    setInviteLoading(true);
    try {
      const res = await fetch("/api/admin/partners/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          email: inviteForm.email,
          organization_name: inviteForm.organization_name || undefined,
          message: inviteForm.message || undefined,
        }),
      });
      if (res.ok) {
        toast.success(`Invitation sent to ${inviteForm.email}`);
        setShowInviteModal(false);
        setInviteForm({ email: "", organization_name: "", message: "" });
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || "Failed to send invitation");
      }
    } catch {
      toast.error("Failed to send invitation");
    } finally {
      setInviteLoading(false);
    }
  };

  const pendingCount = partners.filter((p) => p.status === "pending").length;

  return (
    <div className="p-6 max-w-6xl mx-auto overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building className="w-6 h-6 text-[#00FB75]" />
            Partner Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review applications, manage partners, and toggle featured status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              {pendingCount} pending application{pendingCount !== 1 ? "s" : ""}
            </div>
          )}
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#00FB75] text-black rounded-lg text-sm font-semibold hover:bg-[#00e065] transition-colors"
          >
            <Mail className="w-4 h-4" />
            Invite Partner
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-[#121212] dark:border-[#1A1A1A] focus:ring-2 focus:ring-[#00FB75] focus:outline-none text-sm"
          />
        </div>
        <div className="flex gap-1 p-1 border rounded-lg dark:border-[#1A1A1A]">
          {["all", "pending", "approved", "rejected", "suspended"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-[#00FB75] text-black"
                  : "hover:bg-gray-100 dark:hover:bg-[#1A1A1A] text-gray-600 dark:text-gray-400"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              {s === "pending" && pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-yellow-500 text-white rounded-full text-[10px]">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Partner List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="border rounded-xl p-5 animate-pulse dark:border-[#1A1A1A]"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-800" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : partners.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <Building className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No partners found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {partners.map((partner) => {
            const statusConf = STATUS_CONFIG[partner.status] || STATUS_CONFIG.pending;
            const isExpanded = expandedId === partner.id;

            return (
              <div
                key={partner.id}
                className="border rounded-xl dark:border-[#1A1A1A] bg-white dark:bg-[#121212] overflow-hidden"
              >
                {/* Row */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1A1A1A]/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : partner.id)}
                >
                  {partner.logo_url ? (
                    <img
                      src={partner.logo_url}
                      alt={partner.name}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[#00FB75]/10 flex items-center justify-center">
                      <Building className="w-5 h-5 text-[#00FB75]" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">
                        {partner.name}
                      </span>
                      {partner.is_verified && (
                        <span className="text-[10px] bg-[#00FB75] text-black px-1.5 py-0.5 rounded-full font-medium">
                          Verified
                        </span>
                      )}
                      {partner.is_featured && (
                        <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {partner.country && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {partner.country}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <FlaskConical className="w-3 h-3" />
                        {partner.lab_count} labs
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {partner.member_count} members
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(partner.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConf.bg} ${statusConf.color}`}
                  >
                    {statusConf.label}
                  </span>

                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t dark:border-[#1A1A1A] p-4 bg-gray-50/50 dark:bg-[#0A0A0A]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          Description
                        </p>
                        <p className="text-sm">
                          {partner.description || "No description provided."}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {partner.owner && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              Owner
                            </p>
                            <p className="text-sm">{partner.owner.username}</p>
                          </div>
                        )}
                        {partner.contact_email && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              Contact
                            </p>
                            <p className="text-sm">{partner.contact_email}</p>
                          </div>
                        )}
                        {partner.website && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              Website
                            </p>
                            <a
                              href={partner.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[#00FB75] hover:underline flex items-center gap-1"
                            >
                              {partner.website}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                        {partner.organization_type && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              Type
                            </p>
                            <p className="text-sm capitalize">
                              {partner.organization_type.replace(/_/g, " ")}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {partner.sector_focus.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          Sectors
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {partner.sector_focus.map((s) => (
                            <span
                              key={s}
                              className="text-xs px-2 py-0.5 bg-[#00FB75]/10 text-[#00FB75] rounded-full flex items-center gap-1"
                            >
                              <Tag className="w-3 h-3" />
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t dark:border-[#1A1A1A]">
                      {partner.status === "pending" && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(partner.id, "approve");
                            }}
                            disabled={actionLoading === `${partner.id}-approve`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(partner.id, "reject");
                            }}
                            disabled={actionLoading === `${partner.id}-reject`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </>
                      )}
                      {partner.status === "approved" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(partner.id, "feature");
                          }}
                          disabled={actionLoading === `${partner.id}-feature`}
                          className="flex items-center gap-1.5 px-3 py-1.5 border dark:border-[#1A1A1A] rounded-lg text-xs font-medium hover:bg-gray-100 dark:hover:bg-[#1A1A1A] disabled:opacity-50 transition-colors"
                        >
                          {partner.is_featured ? (
                            <>
                              <StarOff className="w-3.5 h-3.5" />
                              Unfeature
                            </>
                          ) : (
                            <>
                              <Star className="w-3.5 h-3.5" />
                              Feature
                            </>
                          )}
                        </button>
                      )}
                      <a
                        href={`/partners/${partner.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 border dark:border-[#1A1A1A] rounded-lg text-xs font-medium hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Storefront
                      </a>
                      {partner.status !== "suspended" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Suspend partner "${partner.name}"?`)) {
                              handleAction(partner.id, "delete");
                            }
                          }}
                          disabled={actionLoading === `${partner.id}-delete`}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-red-500 border border-red-200 dark:border-red-900/30 rounded-lg text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Suspend
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Invite Partner Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-[#121212] rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#00FB75]" />
                Invite Partner
              </h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Send an email invitation to an organization to register as a partner.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-[#0A0A0A] dark:border-[#1A1A1A] focus:ring-2 focus:ring-[#00FB75] focus:outline-none text-sm"
                  placeholder="partner@organization.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Organization Name</label>
                <input
                  type="text"
                  value={inviteForm.organization_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, organization_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-[#0A0A0A] dark:border-[#1A1A1A] focus:ring-2 focus:ring-[#00FB75] focus:outline-none text-sm"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Custom Message</label>
                <textarea
                  value={inviteForm.message}
                  onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-[#0A0A0A] dark:border-[#1A1A1A] focus:ring-2 focus:ring-[#00FB75] focus:outline-none text-sm resize-none"
                  placeholder="Optional personal message"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 border dark:border-[#1A1A1A] rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={inviteLoading || !inviteForm.email.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[#00FB75] text-black rounded-lg text-sm font-semibold hover:bg-[#00e065] transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {inviteLoading ? "Sending..." : "Send Invitation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
