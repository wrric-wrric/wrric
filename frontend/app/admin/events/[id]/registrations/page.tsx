"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Calendar,
  MapPin,
  MoreVertical,
  Eye,
  Check,
  X,
  Plus,
  Upload,
  Mail,
  Loader2
} from "lucide-react";
import toast from "react-hot-toast";
import { KENYAN_UNIVERSITIES } from "@/utils/universities";


interface Event {
  id: string;
  title: string;
  slug: string;
  event_datetime: string;
  location_type: "PHYSICAL" | "VIRTUAL" | "HYBRID";
  physical_location?: string;
}

interface Registration {
  id: string;
  event_id: string;
  profile_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  position?: string;
  organization?: string;
  participation_type: "attendee" | "jury" | "speaker" | "idea_holder";
  attendance_type: "on_site" | "remote" | "hybrid";
  ticket_type?: string;
  wants_profile_visible: boolean;
  profile_visibility_types: string[];
  special_requirements?: string;
  status: "pending" | "confirmed" | "cancelled" | "waitlisted";
  registration_date: string;
  checked_in_at?: string;
  metadata_?: any;
}


interface PaginatedRegistrations {
  items: Registration[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export default function EventRegistrationsPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRegistrations, setSelectedRegistrations] = useState<Set<string>>(new Set());
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [universityFilter, setUniversityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stats, setStats] = useState<{
    total_registrations: number;
    total_groups: number;
    total_individuals: number;
    total_members: number;
    confirmed_members: number;
  } | null>(null);

  const fetchEvent = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch(`/api/admin/events/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Event not found");
      const data = await response.json();
      setEvent(data);
    } catch (error) {
      console.error("Failed to fetch event:", error);
      toast.error("Event not found");
      router.push("/admin/events");
    }
  }, [id, router]);

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
      });

      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (universityFilter !== "all" && universityFilter !== "") params.append("university", universityFilter);
      if (categoryFilter) params.append("category", categoryFilter);

      const response = await fetch(
        `/api/admin/events/${id}/registrations?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch registrations");

      const data: PaginatedRegistrations = await response.json();
      setRegistrations(data.items);
      setTotal(data.total);
      setTotalPages(data.pages);
    } catch (error) {
      console.error("Failed to fetch registrations:", error);
      toast.error("Failed to load registrations");
    } finally {
      setLoading(false);
    }
  }, [id, currentPage, searchQuery, statusFilter, universityFilter, categoryFilter]);

  const fetchStats = useCallback(async () => {
    if (!id) return;
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const params = new URLSearchParams();
      if (universityFilter !== "all" && universityFilter !== "") params.append("university", universityFilter);
      if (categoryFilter) params.append("category", categoryFilter);

      const response = await fetch(
        `/api/admin/events/${id}/registrations/stats?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        setStats(await response.json());
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, [id, universityFilter, categoryFilter]);

  useEffect(() => {
    fetchEvent();
    fetchRegistrations();
    fetchStats();
  }, [fetchEvent, fetchRegistrations, fetchStats]);

  const handleStatusUpdate = async (
    registrationId: string,
    newStatus: "pending" | "confirmed" | "cancelled" | "waitlisted"
  ) => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const formData = new FormData();
      formData.append("status", newStatus);

      const response = await fetch(
        `/api/admin/events/${id}/registrations/${registrationId}/status`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      if (!response.ok) throw new Error("Failed to update status");

      toast.success(`Registration ${newStatus}`);
      fetchRegistrations();
      fetchStats();
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleBulkAction = async (
    action: "confirm" | "cancel" | "waitlist"
  ) => {
    if (selectedRegistrations.size === 0) {
      toast.error("No registrations selected");
      return;
    }

    const newStatus =
      action === "confirm"
        ? "confirmed"
        : action === "cancel"
          ? "cancelled"
          : "waitlisted";

    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const promises = Array.from(selectedRegistrations).map((regId) => {
        const formData = new FormData();
        formData.append("status", newStatus);

        return fetch(`/api/admin/events/${id}/registrations/${regId}/status`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      });

      const results = await Promise.all(promises);
      const allOk = results.every(res => res.ok);

      if (allOk) {
        toast.success(
          `${selectedRegistrations.size} registration(s) ${newStatus}`
        );
        setSelectedRegistrations(new Set());
        fetchRegistrations();
        fetchStats();
      } else {
        toast.error("Some registrations failed to update");
      }
    } catch (error) {
      console.error("Bulk action error:", error);
      toast.error("An error occurred");
    }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "100",
      });

      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(
        `/api/export/event/${id}/registrations?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `event-${id}-registrations.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Export successful");
      } else {
        toast.error("Failed to export registrations");
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("An error occurred");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      pending: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
      confirmed: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30",
      cancelled: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
      waitlisted: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium border ${statusStyles[status as keyof typeof statusStyles] ||
          "bg-gray-500/20 text-gray-700 dark:text-gray-400 text-gray-600 border-gray-500/30"
          }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getParticipationBadge = (type: string) => {
    const colors = {
      attendee: "bg-[#00FB75] text-black",
      jury: "bg-purple-500 dark:text-white text-gray-900",
      speaker: "bg-blue-500 dark:text-white text-gray-900",
      idea_holder: "bg-orange-500 dark:text-white text-gray-900",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium ${colors[type as keyof typeof colors] || "bg-gray-500 dark:text-white text-gray-900"
          }`}
      >
        {type.replace("_", " ").toUpperCase()}
      </span>
    );
  };

  if (!event) {
    return (
      <div className="flex justify-center items-center h-screen w-full bg-gray-50 dark:bg-[#0A0A0A]">
        <div className="animate-pulse text-muted-foreground">Loading event details...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <button
            onClick={() => router.push("/admin/events")}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="font-medium">Back to Events</span>
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold dark:text-white text-gray-900">
              {event?.title || "Event Registrations"}
            </h1>
            <p className="text-muted-foreground">Event Registrations Management</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl font-medium transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={() => router.push(`/admin/events/${id}/import-attendees`)}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl font-medium transition-all flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Participant
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400">
                <User className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Participants</p>
                <h3 className="text-2xl font-bold dark:text-white">
                  {stats?.total_registrations ?? total}
                </h3>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/40 rounded-xl text-purple-600 dark:text-purple-400">
                <Plus className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Groups</p>
                <h3 className="text-2xl font-bold dark:text-white">
                  {stats?.total_groups || 0}
                </h3>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/40 rounded-xl text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Attended Members</p>
                <h3 className="text-2xl font-bold dark:text-white">
                  {stats?.confirmed_members ?? registrations.filter(r => r.checked_in_at).length}
                </h3>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/40 rounded-xl text-orange-600 dark:text-orange-400">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Individuals</p>
                <h3 className="text-2xl font-bold dark:text-white">
                  {stats?.total_individuals || 0}
                </h3>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex-1 w-full md:max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 dark:text-gray-400 text-gray-600" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or organization..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors dark:text-white text-gray-900 bg-white dark:bg-gray-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-4 pr-10 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors dark:text-white text-gray-900 appearance-none text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="waitlisted">Waitlisted</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={universityFilter}
                onChange={(e) => {
                  setUniversityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-4 pr-10 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors dark:text-white text-gray-900 appearance-none text-sm"
              >
                <option value="all">All Universities</option>
                {KENYAN_UNIVERSITIES.map((uni) => (
                  <option key={uni} value={uni}>
                    {uni}
                  </option>
                ))}
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative min-w-[200px]">
              <input
                type="text"
                placeholder="Filter by Category..."
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors dark:text-white text-gray-900 text-sm"
              />
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>

            <button
              onClick={() => setSelectedRegistrations(new Set())}
              className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${selectedRegistrations.size > 0
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                }`}
            >
              {selectedRegistrations.size > 0 ? `Clear (${selectedRegistrations.size})` : "Select All"}
            </button>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Showing <span className="font-semibold">{registrations.length}</span> of{" "}
            <span className="font-semibold">{total}</span> registrations
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-900 dark:text-gray-100"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-900 dark:text-gray-100"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-muted-foreground">Loading registrations...</p>
          </div>
        ) : registrations.length === 0 ? (
          <div className="text-center py-16">
            <User className="w-16 h-16 mx-auto mb-4 dark:text-gray-400 text-gray-600" />
            <h3 className="text-xl font-semibold mb-2 dark:text-white text-gray-900">
              No Registrations Found
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your search or filters"
                : "No one has registered for this event yet"}
            </p>
            <button
              onClick={() => router.push(`/admin/events/${id}`)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all"
            >
              <Eye className="w-4 h-4" />
              View Event Details
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        selectedRegistrations.size === registrations.length &&
                        registrations.length > 0
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRegistrations(
                            new Set(registrations.map((r) => r.id))
                          );
                        } else {
                          setSelectedRegistrations(new Set());
                        }
                      }}
                      className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Registrant
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Contact Info
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Participation
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Attendance
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Project / Group
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((registration) => (
                  <tr
                    key={registration.id}
                    className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selectedRegistrations.has(registration.id)
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : ""
                      }`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedRegistrations.has(registration.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedRegistrations);
                          if (e.target.checked) {
                            newSet.add(registration.id);
                          } else {
                            newSet.delete(registration.id);
                          }
                          setSelectedRegistrations(newSet);
                        }}
                        className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
                          {registration.first_name.charAt(0)}
                          {registration.last_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm dark:text-white text-gray-900">
                            {registration.first_name} {registration.last_name}
                          </p>
                          {registration.organization && (
                            <p className="text-xs text-muted-foreground">
                              {registration.organization}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 dark:text-gray-400 text-gray-600" />
                          <a
                            href={`mailto:${registration.email}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {registration.email}
                          </a>
                        </div>
                        {registration.position && (
                          <p className="text-xs text-muted-foreground">
                            {registration.position}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        {getParticipationBadge(registration.participation_type)}
                        {registration.profile_visibility_types.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {registration.profile_visibility_types.map((type) => (
                              <span
                                key={type}
                                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-xs rounded text-muted-foreground"
                              >
                                {type.replace("_", " ")}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 dark:text-gray-400 text-gray-600" />
                        <span className="capitalize">
                          {registration.attendance_type.replace("_", " ")}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        {registration.metadata_?.participant_type === "group" ? (
                          <>
                            <p className="text-sm font-medium">
                              {registration.metadata_.group_name || registration.metadata_.project_name || "No Group Name"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {registration.metadata_.project_name && registration.metadata_.project_name !== (registration.metadata_.group_name || "") ? registration.metadata_.project_name + " - " : ""}
                              {registration.metadata_.members?.length || 1} members
                            </p>
                            <p className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-600 px-1 inline-block rounded">GROUP</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium">
                              {registration.metadata_?.project_name || registration.metadata_?.group_name || "No Project"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {registration.metadata_?.university || registration.organization}
                            </p>
                            <p className="text-[10px] bg-green-100 dark:bg-green-900 text-green-600 px-1 inline-block rounded">INDIVIDUAL</p>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {getStatusBadge(registration.status)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative">
                        <button
                          onClick={() => setSelectedRegistration(registration)}
                          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 dark:text-gray-400 text-gray-600" />
                        </button>

                        {selectedRegistration?.id === registration.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-10">
                            {registration.status === "pending" && (
                              <>
                                <button
                                  onClick={() => {
                                    handleStatusUpdate(registration.id, "confirmed");
                                    setSelectedRegistration(null);
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 transition-colors first:rounded-t-lg"
                                >
                                  <Check className="w-4 h-4 text-green-500" />
                                  Confirm Registration
                                </button>
                                <button
                                  onClick={() => {
                                    handleStatusUpdate(registration.id, "waitlisted");
                                    setSelectedRegistration(null);
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 transition-colors"
                                >
                                  <Clock className="w-4 h-4 text-blue-500" />
                                  Add to Waitlist
                                </button>
                              </>
                            )}
                            {(registration.status === "confirmed" ||
                              registration.status === "waitlisted") && (
                                <button
                                  onClick={() => {
                                    handleStatusUpdate(registration.id, "cancelled");
                                    setSelectedRegistration(null);
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 transition-colors last:rounded-b-lg"
                                >
                                  <X className="w-4 h-4 text-red-500" />
                                  Cancel Registration
                                </button>
                              )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddRegistrationModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        eventId={id as string}
        onSuccess={fetchRegistrations}
      />
    </div >
  );
}

// Separate component for the Add Registration Modal
function AddRegistrationModal({
  isOpen,
  onClose,
  eventId,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [participantType, setParticipantType] = useState<"individual" | "group">("individual");

  // Form State
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    university: "",
    project_name: "",
    participation_type: "attendee",
    organization: "",
  });

  // Group specific state
  const [groupData, setGroupData] = useState({
    group_name: "",
    category: "",
    members: [{ name: "", email: "", university: "" }]
  });

  if (!isOpen) return null;

  const handleAddMember = () => {
    setGroupData(prev => ({
      ...prev,
      members: [...prev.members, { name: "", email: "", university: "" }]
    }));
  };

  const handleRemoveMember = (index: number) => {
    setGroupData(prev => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index)
    }));
  };

  const handleMemberChange = (index: number, field: string, value: string) => {
    const newMembers = [...groupData.members];
    (newMembers[index] as any)[field] = value;
    setGroupData(prev => ({ ...prev, members: newMembers }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const submitData = new FormData();

      // Basic fields
      submitData.append("first_name", formData.first_name || (participantType === "group" ? groupData.members[0].name.split(' ')[0] : ""));
      submitData.append("last_name", formData.last_name || (participantType === "group" ? groupData.members[0].name.split(' ').slice(1).join(' ') : ""));
      submitData.append("email", formData.email || (participantType === "group" ? groupData.members[0].email : ""));
      submitData.append("participation_type", formData.participation_type);
      submitData.append("organization", formData.organization || formData.university);

      // Metdata field
      const metadata: any = {
        participant_type: participantType,
        project_name: formData.project_name,
        university: formData.university
      };

      if (participantType === "group") {
        metadata.group_name = groupData.group_name;
        metadata.category = groupData.category;
        metadata.members = groupData.members;
      }

      submitData.append("metadata_", JSON.stringify(metadata));

      // Add a dummy recaptcha token for admin manual registration if backend requires it
      submitData.append("recaptcha_token", "admin_manual_bypass");

      const response = await fetch(`/api/admin/events/${eventId}/register`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: submitData
      });

      if (response.ok) {
        toast.success("Registration added successfully");
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to add registration");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-800">
        <div className="sticky top-0 bg-white dark:bg-[#111] px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold dark:text-white">New Manual Registration</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Toggle Participant Type */}
          <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <button
              type="button"
              onClick={() => setParticipantType("individual")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${participantType === "individual"
                ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setParticipantType("group")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${participantType === "group"
                ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              Group
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {participantType === "individual" ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
                  <input
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
                  <input
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Group Name</label>
                  <input
                    required
                    value={groupData.group_name}
                    onChange={(e) => setGroupData({ ...groupData, group_name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="e.g. Team Alpha"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                  <input
                    required
                    value={groupData.category}
                    onChange={(e) => setGroupData({ ...groupData, category: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="e.g. Software Engineering"
                  />
                </div>
              </>
            )}

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Project Name</label>
              <input
                required
                value={formData.project_name}
                onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="Name of the innovation/project"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">University</label>
              <select
                required
                value={formData.university}
                onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value="">Select University</option>
                {KENYAN_UNIVERSITIES.map(uni => (
                  <option key={uni} value={uni}>{uni}</option>
                ))}
              </select>
            </div>
          </div>

          {participantType === "group" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Group Members</h3>
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Member
                </button>
              </div>

              <div className="space-y-3">
                {groupData.members.map((member, index) => (
                  <div key={index} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border dark:border-gray-800 relative group/member">
                    {groupData.members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(index)}
                        className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200 opacity-0 group-hover/member:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        required
                        placeholder="Member Full Name"
                        value={member.name}
                        onChange={(e) => handleMemberChange(index, "name", e.target.value)}
                        className="px-3 py-1.5 text-sm rounded-lg border dark:bg-gray-900 dark:border-gray-700"
                      />
                      <input
                        required
                        type="email"
                        placeholder="Member Email"
                        value={member.email}
                        onChange={(e) => handleMemberChange(index, "email", e.target.value)}
                        className="px-3 py-1.5 text-sm rounded-lg border dark:bg-gray-900 dark:border-gray-700"
                      />
                      <div className="md:col-span-2">
                        <select
                          required
                          value={member.university}
                          onChange={(e) => handleMemberChange(index, "university", e.target.value)}
                          className="w-full px-3 py-1.5 text-sm rounded-lg border dark:bg-gray-900 dark:border-gray-700"
                        >
                          <option value="">Select University</option>
                          {KENYAN_UNIVERSITIES.map(uni => (
                            <option key={uni} value={uni}>{uni}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              type="submit"
              className="flex-2 px-8 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Complete Registration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
