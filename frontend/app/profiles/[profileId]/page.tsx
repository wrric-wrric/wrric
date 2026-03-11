"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useSidebar } from "@/hooks/sideBarProvider";
import toast from "react-hot-toast";
import {
  User,
  MapPin,
  Building,
  Award,
  Link,
  ArrowLeft,
  Edit,
  Globe,
  ShieldBan,
  Calendar,
  BadgeCheck,
  FlaskConical,
  Heart,
  Users,
  UserPlus,
  Bookmark,
  MessageSquare,
  ThumbsUp,
  Phone,
  Cake,
} from "lucide-react";
import Image from "next/image";
import { clsx } from "clsx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Profile {
  id: string;
  user_id?: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  type: string;
  title: string | null;
  organization: string | null;
  bio: string;
  location: Record<string, any>;
  social_links: Record<string, any>;
  expertise: string[];
  profile_image: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  phone?: string | null;
  website?: string | null;
  created_at: string;
  updated_at?: string;
}

interface UserSummary {
  user_id: string;
  username: string;
  profile_image_url: string | null;
  partner_badge: { name: string; slug: string } | null;
  stats: {
    labs_created: number;
    comments: number;
    likes_given: number;
  };
  follower_count: number;
  following_count: number;
}

// ---------------------------------------------------------------------------
// Simple markdown renderer (bold, italic, links, line breaks)
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): string {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#00FB75] underline">$1</a>'
  );
  html = html.replace(/\n/g, "<br/>");
  return html;
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabKey = "labs" | "liked" | "following" | "followers" | "collections";

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  ownOnly?: boolean;
}

const TABS: TabDef[] = [
  { key: "labs", label: "Labs", icon: <FlaskConical className="w-4 h-4" /> },
  { key: "liked", label: "Liked Labs", icon: <Heart className="w-4 h-4" /> },
  { key: "following", label: "Following", icon: <UserPlus className="w-4 h-4" /> },
  { key: "followers", label: "Followers", icon: <Users className="w-4 h-4" /> },
  { key: "collections", label: "Collections", icon: <Bookmark className="w-4 h-4" />, ownOnly: true },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProfileDetailsPage() {
  const { profileId } = useParams();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { setLoadSession } = useSidebar();

  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("labs");
  const [tabData, setTabData] = useState<Record<string, any>>({});
  const [tabLoading, setTabLoading] = useState<Record<string, boolean>>({});
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  const isDark = mounted ? resolvedTheme === "dark" : false;

  useEffect(() => {
    setMounted(true);
    setLoadSession(() => {});
    return () => setLoadSession(() => {});
  }, [setLoadSession]);

  // Fetch profile + summary
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token =
          localStorage.getItem("token") || sessionStorage.getItem("token");
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token || ""}`,
        };

        // Try fetching by ID first (works for viewing any profile)
        const directRes = await fetch(`/api/profiles/${profileId}`, { headers });
        let foundProfile: Profile | null = null;

        if (directRes.ok) {
          foundProfile = await directRes.json();
        } else {
          // Fallback: fetch user's own profiles and find by ID
          const profileRes = await fetch("/api/profiles", { headers });
          if (!profileRes.ok) throw new Error(`HTTP ${profileRes.status}`);
          const profiles = await profileRes.json();
          foundProfile = profiles.find((p: Profile) => p.id === profileId) || null;
        }

        if (!foundProfile) {
          toast.error("Profile not found");
          router.push("/profiles");
          return;
        }

        setProfile(foundProfile);

        const storedUserId =
          localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
        const userId = foundProfile.user_id || storedUserId;
        if (storedUserId && storedUserId === foundProfile.user_id) {
          setIsOwnProfile(true);
        }

        if (userId) {
          try {
            const summaryRes = await fetch(
              `/api/users/${userId}/summary`,
              { headers }
            );
            if (summaryRes.ok) {
              setSummary(await summaryRes.json());
            }
          } catch {
            // Summary is optional
          }
        }
      } catch (error) {
        console.error("Fetch profile error:", error);
        toast.error("Failed to load profile");
        router.push("/profiles");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profileId, router]);

  // Tab data loader
  const loadTabData = useCallback(
    async (tab: TabKey) => {
      if (tabData[tab] || tabLoading[tab]) return;
      setTabLoading((prev) => ({ ...prev, [tab]: true }));

      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token || ""}`,
      };
      const userId = profile?.user_id || summary?.user_id;

      try {
        let data: any = null;

        switch (tab) {
          case "labs": {
            if (!userId) break;
            const res = await fetch(`/api/users/${userId}/labs?limit=20`, { headers });
            if (res.ok) data = await res.json();
            break;
          }
          case "liked": {
            if (!userId) break;
            const res = await fetch(`/api/users/${userId}/liked-labs?limit=20`, { headers });
            if (res.ok) data = await res.json();
            break;
          }
          case "following": {
            if (!userId) break;
            const res = await fetch(`/api/follow/users/${userId}/following?limit=20`, { headers });
            if (res.ok) data = await res.json();
            break;
          }
          case "followers": {
            if (!userId) break;
            const res = await fetch(`/api/follow/users/${userId}/followers?limit=20`, { headers });
            if (res.ok) data = await res.json();
            break;
          }
          case "collections": {
            if (!isOwnProfile) break;
            const res = await fetch("/api/bookmarks/collections", { headers });
            if (res.ok) data = await res.json();
            break;
          }
        }

        if (data) {
          setTabData((prev) => ({ ...prev, [tab]: data }));
        }
      } catch (err) {
        console.error(`Failed to load ${tab}:`, err);
      } finally {
        setTabLoading((prev) => ({ ...prev, [tab]: false }));
      }
    },
    [profile, summary, tabData, tabLoading, isOwnProfile]
  );

  useEffect(() => {
    if (profile) {
      loadTabData(activeTab);
    }
  }, [activeTab, profile, loadTabData]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const profileTypeLabels: Record<string, { label: string; icon: string; color: string }> = {
    lab: { label: "Research Lab", icon: "🔬", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
    participant: { label: "Hackathon Participant", icon: "🏆", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
    entrepreneur: { label: "Entrepreneur", icon: "💼", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
    academic: { label: "Academic", icon: "🎓", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
    funder: { label: "Funder", icon: "💰", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
    partner: { label: "Partner", icon: "🤝", color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200" },
  };

  const formatFullName = () => {
    if (!profile) return null;
    const parts = [profile.first_name, profile.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : null;
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    } catch { return dateString; }
  };

  // ---------------------------------------------------------------------------
  // Loading / not-found
  // ---------------------------------------------------------------------------

  if (!mounted || loading) {
    return (
      <div className={clsx("h-full flex items-center justify-center", isDark ? "bg-[#0A0A0A]" : "bg-gray-50")}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#00FB75] border-t-transparent rounded-full animate-spin" />
          <p className={isDark ? "text-gray-400" : "text-gray-600"}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={clsx("h-full flex items-center justify-center", isDark ? "bg-[#0A0A0A] text-white" : "bg-gray-50 text-gray-900")}>
        <div className="text-center">
          <p className="text-lg">Profile not found</p>
          <button onClick={() => router.push("/profiles")} className="mt-4 px-4 py-2 bg-[#00FB75] text-black rounded-lg font-medium hover:bg-green-400">Back to Profiles</button>
        </div>
      </div>
    );
  }

  const profileType = profileTypeLabels[profile.type] || {
    label: profile.type, icon: "👤",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  };
  const fullName = formatFullName();
  const visibleTabs = TABS.filter((t) => !t.ownOnly || isOwnProfile);

  // ---------------------------------------------------------------------------
  // Tab content
  // ---------------------------------------------------------------------------

  function renderTabContent() {
    const data = tabData[activeTab];
    const isTabLoading = tabLoading[activeTab];

    if (isTabLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`h-32 rounded-lg animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
          ))}
        </div>
      );
    }

    if (!data) return <p className="text-center opacity-50 py-12">No data available.</p>;

    const items: any[] = data.items || data || [];
    if (items.length === 0) return <p className="text-center opacity-50 py-12">Nothing here yet.</p>;

    if (activeTab === "labs" || activeTab === "liked") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item: any) => (
            <div
              key={item.id}
              onClick={() => router.push(`/labs/${item.id}`)}
              className={clsx("rounded-xl p-5 cursor-pointer transition-colors", isDark ? "bg-[#1A1A1A] hover:bg-[#222]" : "bg-gray-50 hover:bg-gray-100 shadow-sm")}
            >
              <h4 className="font-semibold mb-1 truncate">{item.university || "Unnamed Lab"}</h4>
              <p className="text-sm opacity-70 line-clamp-2 mb-3">{item.research_abstract || "No description"}</p>
              <div className="flex items-center gap-4 text-xs opacity-60">
                <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {item.like_count ?? 0}</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {item.comment_count ?? 0}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === "following" || activeTab === "followers") {
      return (
        <div className="space-y-3">
          {items.map((item: any, idx: number) => (
            <div key={item.id || idx} className={clsx("flex items-center gap-4 rounded-xl p-4", isDark ? "bg-[#1A1A1A]" : "bg-gray-50 shadow-sm")}>
              <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center overflow-hidden", isDark ? "bg-gray-700" : "bg-gray-200")}>
                {item.profile_image_url ? (
                  <Image src={item.profile_image_url} alt="" width={40} height={40} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 opacity-50" />
                )}
              </div>
              <div>
                <p className="font-medium">{item.username || item.name || "User"}</p>
                {item.target_type && <span className="text-xs opacity-50">{item.target_type}</span>}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === "collections") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((col: any, idx: number) => (
            <div key={col.id || idx} className={clsx("rounded-xl p-5", isDark ? "bg-[#1A1A1A]" : "bg-gray-50 shadow-sm")}>
              <h4 className="font-semibold mb-1">{col.name || "Untitled Collection"}</h4>
              <p className="text-sm opacity-60">{col.count ?? col.items?.length ?? 0} items</p>
            </div>
          ))}
        </div>
      );
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className={clsx("h-full flex flex-col", isDark ? "bg-[#0A0A0A] text-white" : "bg-gray-50 text-gray-900")}>
      {/* Sticky Header */}
      <header className={clsx("sticky top-0 z-40 backdrop-blur-md border-b flex-shrink-0", isDark ? "bg-[#0A0A0A]/95 border-gray-800" : "bg-white/95 border-gray-200")}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={() => router.back()} className={clsx("p-1.5 sm:p-2 rounded-lg transition-colors", isDark ? "hover:bg-gray-800" : "hover:bg-gray-100")}>
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="hidden sm:block">
                <h1 className="font-semibold">Profile Details</h1>
                <p className={clsx("text-xs", isDark ? "text-gray-500" : "text-gray-500")}>View professional and personal information</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOwnProfile && (
                <button
                  onClick={() => router.push(`/profiles/${profile.id}/edit`)}
                  className={clsx("flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors", isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700")}
                >
                  <Edit className="w-4 h-4" /><span className="hidden sm:inline">Edit Profile</span>
                </button>
              )}
              {!isOwnProfile && profile?.user_id && (
                <button
                  onClick={async () => {
                    if (!confirm("Are you sure you want to block this user? They won't be able to interact with your content.")) return;
                    try {
                      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
                      const res = await fetch("/api/blocks", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
                        body: JSON.stringify({ user_id: profile.user_id }),
                      });
                      if (res.ok) {
                        toast.success("User blocked");
                      } else {
                        const data = await res.json();
                        toast.error(data.error || data.detail || "Failed to block user");
                      }
                    } catch {
                      toast.error("Failed to block user");
                    }
                  }}
                  className={clsx("flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm transition-colors", isDark ? "bg-red-900/30 hover:bg-red-900/50 text-red-400" : "bg-red-50 hover:bg-red-100 text-red-600")}
                >
                  <ShieldBan className="w-4 h-4" />
                  <span className="hidden sm:inline">Block User</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24 sm:pb-8 space-y-4 sm:space-y-6">
          {/* Profile Header Card */}
          <div className={clsx("rounded-xl sm:rounded-2xl p-4 sm:p-6", isDark ? "bg-[#111] border border-gray-800" : "bg-white border border-gray-200 shadow-sm")}>
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
              <div className="flex-shrink-0">
                <div className={clsx("w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4", isDark ? "border-gray-700" : "border-gray-200")}>
                  {profile.profile_image ? (
                    <Image src={profile.profile_image} alt="Profile" width={128} height={128} className="w-full h-full object-cover" />
                  ) : (
                    <div className={clsx("w-full h-full flex items-center justify-center", isDark ? "bg-gray-800" : "bg-gray-200")}>
                      <User className={clsx("w-10 h-10 sm:w-14 sm:h-14", isDark ? "text-gray-600" : "text-gray-400")} />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h2 className="text-xl sm:text-2xl font-bold truncate">
                    {profile.display_name || fullName || profile.title || "Unnamed Profile"}
                  </h2>
                  {summary?.partner_badge && (
                    <a
                      href={`/partners/${summary.partner_badge.slug}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                    >
                      <BadgeCheck className="w-3.5 h-3.5" />
                      {summary.partner_badge.name}
                    </a>
                  )}
                </div>
                {profile.title && (
                  <p className={clsx("text-sm sm:text-base mt-1", isDark ? "text-[#00FB75]" : "text-green-600")}>{profile.title}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className={clsx("px-2.5 py-1 rounded-full text-xs font-medium", profileType.color)}>
                    {profileType.icon} {profileType.label}
                  </span>
                  {profile.organization && (
                    <span className={clsx("px-2.5 py-1 rounded-full text-xs", isDark ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700")}>
                      <Building className="w-3 h-3 inline mr-1" />{profile.organization}
                    </span>
                  )}
                  {(profile.location?.city || profile.location?.country) && (
                    <span className={clsx("px-2.5 py-1 rounded-full text-xs", isDark ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700")}>
                      <MapPin className="w-3 h-3 inline mr-1" />{[profile.location.city, profile.location.country].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>
                {profile.bio && (
                  <div
                    className={clsx("mt-4 text-sm sm:text-base leading-relaxed", isDark ? "text-gray-300" : "text-gray-700")}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(profile.bio) }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Personal Information */}
          {(fullName || profile.date_of_birth || profile.gender || profile.phone || profile.website) && (
            <div className={clsx("rounded-xl sm:rounded-2xl p-4 sm:p-6", isDark ? "bg-[#111] border border-gray-800" : "bg-white border border-gray-200 shadow-sm")}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-[#00FB75]" />Personal Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fullName && (
                  <div>
                    <p className={clsx("text-xs", isDark ? "text-gray-500" : "text-gray-500")}>Full Name</p>
                    <p className="font-medium">{fullName}</p>
                  </div>
                )}
                {profile.date_of_birth && (
                  <div>
                    <p className={clsx("text-xs", isDark ? "text-gray-500" : "text-gray-500")}>Date of Birth</p>
                    <p className="font-medium">{formatDate(profile.date_of_birth)}</p>
                  </div>
                )}
                {profile.gender && (
                  <div>
                    <p className={clsx("text-xs", isDark ? "text-gray-500" : "text-gray-500")}>Gender</p>
                    <p className="font-medium capitalize">{profile.gender}</p>
                  </div>
                )}
                {profile.phone && (
                  <div>
                    <p className={clsx("text-xs", isDark ? "text-gray-500" : "text-gray-500")}>Phone</p>
                    <p className="font-medium">{profile.phone}</p>
                  </div>
                )}
                {profile.website && (
                  <div className="sm:col-span-2">
                    <p className={clsx("text-xs", isDark ? "text-gray-500" : "text-gray-500")}>Website</p>
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" className="font-medium text-[#00FB75] hover:underline">{profile.website}</a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Activity Summary Bar */}
          {summary && (
            <div className={clsx("rounded-xl sm:rounded-2xl p-5", isDark ? "bg-[#111] border border-gray-800" : "bg-white border border-gray-200 shadow-sm")}>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{summary.stats.labs_created}</p>
                  <p className="text-xs opacity-60 flex items-center justify-center gap-1"><FlaskConical className="w-3 h-3" /> Labs Created</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.stats.comments}</p>
                  <p className="text-xs opacity-60 flex items-center justify-center gap-1"><MessageSquare className="w-3 h-3" /> Comments</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.stats.likes_given}</p>
                  <p className="text-xs opacity-60 flex items-center justify-center gap-1"><ThumbsUp className="w-3 h-3" /> Likes Given</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.follower_count}</p>
                  <p className="text-xs opacity-60 flex items-center justify-center gap-1"><Users className="w-3 h-3" /> Followers</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.following_count}</p>
                  <p className="text-xs opacity-60 flex items-center justify-center gap-1"><UserPlus className="w-3 h-3" /> Following</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab Bar + Content */}
          <div className={clsx("rounded-xl sm:rounded-2xl overflow-hidden", isDark ? "bg-[#111] border border-gray-800" : "bg-white border border-gray-200 shadow-sm")}>
            <div className={clsx("flex overflow-x-auto border-b", isDark ? "border-gray-800" : "border-gray-200")}>
              {visibleTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={clsx(
                    "flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                    activeTab === tab.key
                      ? isDark ? "border-b-2 border-[#00FB75] text-[#00FB75]" : "border-b-2 border-green-600 text-green-700"
                      : isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-800"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="p-6">{renderTabContent()}</div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Expertise */}
            <div className={clsx("rounded-xl sm:rounded-2xl p-4 sm:p-6", isDark ? "bg-[#111] border border-gray-800" : "bg-white border border-gray-200 shadow-sm")}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-[#00FB75]" />
                Expertise
              </h3>
              {profile.expertise && profile.expertise.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.expertise.map((skill, index) => (
                    <span key={index} className={clsx("px-3 py-1.5 rounded-full text-sm font-medium", isDark ? "bg-[#00FB75]/10 text-[#00FB75]" : "bg-green-100 text-green-700")}>
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={clsx("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>No expertise listed</p>
              )}
            </div>

            {/* Social Links */}
            {(profile.social_links?.twitter || profile.social_links?.linkedin || profile.social_links?.website) && (
              <div className={clsx("rounded-xl sm:rounded-2xl p-4 sm:p-6", isDark ? "bg-[#111] border border-gray-800" : "bg-white border border-gray-200 shadow-sm")}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Link className="w-5 h-5 text-[#00FB75]" />
                  Social Links
                </h3>
                <div className="space-y-3">
                  {profile.social_links?.twitter && (
                    <a href={profile.social_links.twitter} target="_blank" rel="noopener noreferrer"
                      className={clsx("flex items-center gap-3 p-3 rounded-lg transition-colors", isDark ? "bg-[#1A1A1A] hover:bg-[#222] text-blue-400" : "bg-gray-50 hover:bg-gray-100 text-blue-600")}>
                      <Globe className="w-4 h-4" />
                      <span className="text-sm">Twitter</span>
                    </a>
                  )}
                  {profile.social_links?.linkedin && (
                    <a href={profile.social_links.linkedin} target="_blank" rel="noopener noreferrer"
                      className={clsx("flex items-center gap-3 p-3 rounded-lg transition-colors", isDark ? "bg-[#1A1A1A] hover:bg-[#222] text-blue-400" : "bg-gray-50 hover:bg-gray-100 text-blue-600")}>
                      <Users className="w-4 h-4" />
                      <span className="text-sm">LinkedIn</span>
                    </a>
                  )}
                  {profile.social_links?.website && (
                    <a href={profile.social_links.website} target="_blank" rel="noopener noreferrer"
                      className={clsx("flex items-center gap-3 p-3 rounded-lg transition-colors", isDark ? "bg-[#1A1A1A] hover:bg-[#222] text-green-400" : "bg-gray-50 hover:bg-gray-100 text-green-600")}>
                      <Globe className="w-4 h-4" />
                      <span className="text-sm">Website</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Profile Info */}
            <div className={clsx("rounded-xl sm:rounded-2xl p-4 sm:p-6", isDark ? "bg-[#111] border border-gray-800" : "bg-white border border-gray-200 shadow-sm")}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#00FB75]" />
                Profile Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Profile Type</label>
                  <p className="text-sm opacity-70">{profileType.label}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Created</label>
                  <p className="text-sm opacity-70">{formatDate(profile.created_at)}</p>
                </div>
                {profile.updated_at && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Last Updated</label>
                    <p className="text-sm opacity-70">{formatDate(profile.updated_at)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
