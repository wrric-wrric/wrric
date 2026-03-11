"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Search,
  MapPin,
  Users,
  FlaskConical,
  Building,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface BrowseProfile {
  id: string;
  type: string;
  title: string | null;
  display_name: string | null;
  organization: string | null;
  bio: string;
  location: Record<string, string> | null;
  expertise: string[];
  profile_image: string | null;
  created_at: string | null;
  labs_created: number;
  follower_count: number;
}

interface Partner {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  country: string | null;
  description: string | null;
  sector: string[] | string | null;
  is_verified: boolean;
  lab_count: number;
  member_count: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const PROFILE_TYPES = [
  { value: "", label: "All Types" },
  { value: "lab", label: "Lab" },
  { value: "entrepreneur", label: "Entrepreneur" },
  { value: "academic", label: "Academic" },
  { value: "funder", label: "Funder" },
];

function typeBadgeColor(type: string) {
  switch (type) {
    case "lab":
      return "bg-blue-500/20 text-blue-400";
    case "entrepreneur":
      return "bg-emerald-500/20 text-emerald-400";
    case "academic":
      return "bg-purple-500/20 text-purple-400";
    case "funder":
      return "bg-amber-500/20 text-amber-400";
    default:
      return "bg-gray-500/20 text-gray-400";
  }
}

function locationString(loc: Record<string, string> | null | undefined) {
  if (!loc) return null;
  const parts = [loc.city, loc.region, loc.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function sectorList(s: string[] | string | null | undefined): string[] {
  if (!s) return [];
  if (Array.isArray(s)) return s;
  try { return JSON.parse(s); } catch { return [s]; }
}

/* ------------------------------------------------------------------ */
/* Skeleton cards                                                      */
/* ------------------------------------------------------------------ */

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800 p-5 h-64" />
  );
}

/* ------------------------------------------------------------------ */
/* Profile Card                                                        */
/* ------------------------------------------------------------------ */

function ProfileCard({ profile }: { profile: BrowseProfile }) {
  const router = useRouter();
  const loc = locationString(profile.location);
  const name = profile.display_name || profile.title || "Unnamed";

  return (
    <div
      onClick={() => router.push(`/profiles/${profile.id}`)}
      className="cursor-pointer rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 hover:shadow-lg hover:border-[#00FB75] transition-all duration-200 flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-gray-300 dark:bg-gray-700 overflow-hidden flex-shrink-0">
          {profile.profile_image ? (
            <Image
              src={profile.profile_image}
              alt={name}
              width={56}
              height={56}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-500">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm truncate dark:text-white">{name}</h3>
          {profile.organization && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{profile.organization}</p>
          )}
          <span className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${typeBadgeColor(profile.type)}`}>
            {profile.type}
          </span>
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{profile.bio}</p>
      )}

      {/* Location */}
      {loc && (
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <MapPin className="w-3 h-3" /> {loc}
        </div>
      )}

      {/* Expertise tags */}
      {profile.expertise.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {profile.expertise.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
          {profile.expertise.length > 3 && (
            <span className="text-[10px] text-gray-400">+{profile.expertise.length - 3}</span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="mt-auto flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
        <span className="flex items-center gap-1"><FlaskConical className="w-3 h-3" /> {profile.labs_created} labs</span>
        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {profile.follower_count} followers</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Partner Card                                                        */
/* ------------------------------------------------------------------ */

function PartnerCard({ partner }: { partner: Partner }) {
  const router = useRouter();
  const sectors = sectorList(partner.sector);

  return (
    <div
      onClick={() => router.push(`/partners/${partner.slug}`)}
      className="cursor-pointer rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 hover:shadow-lg hover:border-[#00FB75] transition-all duration-200 flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl bg-gray-300 dark:bg-gray-700 overflow-hidden flex-shrink-0">
          {partner.logo_url ? (
            <Image src={partner.logo_url} alt={partner.name} width={56} height={56} className="object-cover w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building className="w-6 h-6 text-gray-500" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm truncate dark:text-white flex items-center gap-1">
            {partner.name}
            {partner.is_verified && <BadgeCheck className="w-4 h-4 text-[#00FB75]" />}
          </h3>
          {partner.country && (
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {partner.country}
            </p>
          )}
        </div>
      </div>

      {partner.description && (
        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{partner.description}</p>
      )}

      {sectors.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sectors.slice(0, 3).map((s) => (
            <span key={s} className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">{s}</span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
        <span className="flex items-center gap-1"><FlaskConical className="w-3 h-3" /> {partner.lab_count ?? 0} labs</span>
        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {partner.member_count ?? 0} members</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-6">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {pages}</span>
      <button
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function EcosystemPage() {
  const [tab, setTab] = useState<"people" | "partners">("people");

  /* People state */
  const [profiles, setProfiles] = useState<BrowseProfile[]>([]);
  const [profileSearch, setProfileSearch] = useState("");
  const [profileType, setProfileType] = useState("");
  const [profilePage, setProfilePage] = useState(1);
  const [profilePages, setProfilePages] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);

  /* Partners state */
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerPage, setPartnerPage] = useState(1);
  const [partnerPages, setPartnerPages] = useState(0);
  const [partnerLoading, setPartnerLoading] = useState(true);

  /* Fetch people */
  const fetchProfiles = useCallback(async () => {
    setProfileLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(profilePage));
      params.set("limit", "12");
      if (profileSearch) params.set("search", profileSearch);
      if (profileType) params.set("type", profileType);

      const res = await fetch(`/api/profiles/browse?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.items || []);
        setProfilePages(data.pages || 0);
      }
    } catch (e) {
      console.error("Failed to fetch profiles", e);
    } finally {
      setProfileLoading(false);
    }
  }, [profilePage, profileSearch, profileType]);

  /* Fetch partners */
  const fetchPartners = useCallback(async () => {
    setPartnerLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(partnerPage));
      params.set("limit", "12");
      if (partnerSearch) params.set("search", partnerSearch);

      const res = await fetch(`/api/partners?${params}`);
      if (res.ok) {
        const data = await res.json();
        const items = data.items || data.partners || data;
        setPartners(Array.isArray(items) ? items : []);
        setPartnerPages(data.pages || (data.total ? Math.ceil(data.total / 12) : 0));
      }
    } catch (e) {
      console.error("Failed to fetch partners", e);
    } finally {
      setPartnerLoading(false);
    }
  }, [partnerPage, partnerSearch]);

  useEffect(() => { if (tab === "people") fetchProfiles(); }, [tab, fetchProfiles]);
  useEffect(() => { if (tab === "partners") fetchPartners(); }, [tab, fetchPartners]);

  /* Debounced search */
  useEffect(() => {
    const t = setTimeout(() => { setProfilePage(1); }, 0);
    return () => clearTimeout(t);
  }, [profileSearch, profileType]);

  useEffect(() => {
    const t = setTimeout(() => { setPartnerPage(1); }, 0);
    return () => clearTimeout(t);
  }, [partnerSearch]);

  return (
    <main className="p-4 md:p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold dark:text-white mb-1">Ecosystem</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Discover people and partner organizations in the community.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {(["people", "partners"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "bg-[#00FB75] text-black"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ---- People tab ---- */}
      {tab === "people" && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search people..."
                value={profileSearch}
                onChange={(e) => setProfileSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:outline-none focus:border-[#00FB75]"
              />
            </div>
            <select
              value={profileType}
              onChange={(e) => setProfileType(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:outline-none focus:border-[#00FB75]"
            >
              {PROFILE_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>{pt.label}</option>
              ))}
            </select>
          </div>

          {/* Grid */}
          {profileLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-20 text-gray-500 dark:text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No profiles found</p>
              <p className="text-sm mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {profiles.map((p) => <ProfileCard key={p.id} profile={p} />)}
            </div>
          )}

          <Pagination page={profilePage} pages={profilePages} onChange={setProfilePage} />
        </>
      )}

      {/* ---- Partners tab ---- */}
      {tab === "partners" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search partners..."
                value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:outline-none focus:border-[#00FB75]"
              />
            </div>
          </div>

          {partnerLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : partners.length === 0 ? (
            <div className="text-center py-20 text-gray-500 dark:text-gray-400">
              <Building className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No partners found</p>
              <p className="text-sm mt-1">Try adjusting your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {partners.map((p) => <PartnerCard key={p.id} partner={p} />)}
            </div>
          )}

          <Pagination page={partnerPage} pages={partnerPages} onChange={setPartnerPage} />
        </>
      )}
    </main>
  );
}
