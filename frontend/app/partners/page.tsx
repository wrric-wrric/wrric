"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building, Search, Globe, Tag, Plus, ChevronLeft, ChevronRight, Star, ArrowUpDown, FlaskConical, Users } from "lucide-react";
import type { Partner, PaginatedPartners } from "@/lib/types";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function PartnersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [partners, setPartners] = useState<Partner[]>([]);
  const [featuredPartners, setFeaturedPartners] = useState<Partner[]>([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [sectorFilter, setSectorFilter] = useState(searchParams.get("sector") || "");
  const [countryFilter, setCountryFilter] = useState(searchParams.get("country") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "newest");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const debouncedSearch = useDebounce(search, 400);
  const debouncedSector = useDebounce(sectorFilter, 400);
  const debouncedCountry = useDebounce(countryFilter, 400);

  // Fetch featured partners once
  useEffect(() => {
    fetch("/api/partners/featured?limit=6")
      .then(r => r.ok ? r.json() : [])
      .then(data => setFeaturedPartners(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "18");
      params.set("sort", sort);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (debouncedSector) params.set("sector", debouncedSector);
      if (debouncedCountry) params.set("country", debouncedCountry);

      const res = await fetch(`/api/partners?${params.toString()}`);
      if (res.ok) {
        const data: PaginatedPartners = await res.json();
        setPartners(data.items || []);
        setTotalPages(data.total_pages || 0);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch partners:", error);
    } finally {
      setLoading(false);
    }
  }, [page, sort, debouncedSearch, debouncedSector, debouncedCountry]);

  // Fetch partners list
  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const isAuthenticated = typeof window !== "undefined" && !!(localStorage.getItem("token") || sessionStorage.getItem("token"));

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Building className="w-8 h-8 text-[#00FB75]" />
              Partner Directory
            </h1>
            <p className="text-muted-foreground mt-2">
              Discover organizations driving innovation in climate tech
            </p>
          </div>
          {isAuthenticated && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/partners/me")}
                className="flex items-center gap-2 px-4 py-2 border border-[#00FB75] text-[#00FB75] rounded-lg font-medium hover:bg-[#00FB75]/10 transition-colors"
              >
                <Building className="w-4 h-4" />
                My Partners
              </button>
              <button
                onClick={() => router.push("/partners/new")}
                className="flex items-center gap-2 px-4 py-2 bg-[#00FB75] text-black rounded-lg font-medium hover:bg-[#00e065] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Apply as Partner
              </button>
            </div>
          )}
        </div>

        {/* Featured Partners */}
        {featuredPartners.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-[#00FB75]" />
              Featured Partners
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredPartners.map((p) => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/partners/${p.slug}`)}
                  className="border-2 border-[#00FB75]/30 rounded-xl p-5 hover:border-[#00FB75] hover:shadow-lg transition-all cursor-pointer bg-card relative"
                >
                  <Star className="absolute top-3 right-3 w-4 h-4 text-[#00FB75]" />
                  <div className="flex items-center gap-3 mb-3">
                    {p.logo_url ? (
                      <img src={p.logo_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#00FB75]/10 flex items-center justify-center">
                        <Building className="w-5 h-5 text-[#00FB75]" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold">{p.name}</h3>
                      {p.country && <p className="text-xs text-muted-foreground">{p.country}</p>}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{p.description || "No description"}</p>
                  <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><FlaskConical className="w-3 h-3" />{p.lab_count} labs</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{p.member_count} members</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search partners..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
            />
          </div>
          <input
            type="text"
            placeholder="Sector (e.g. climate)"
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
          />
          <input
            type="text"
            placeholder="Country"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
            <option value="featured">Featured</option>
          </select>
        </div>

        {/* Results count */}
        {!loading && (
          <p className="text-sm text-muted-foreground mb-4">{total} partner{total !== 1 ? "s" : ""} found</p>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border rounded-xl p-6 bg-card animate-pulse">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-muted" />
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
                <div className="h-3 bg-muted rounded w-full mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : partners.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No partners found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partners.map((partner) => (
              <div
                key={partner.id}
                onClick={() => router.push(`/partners/${partner.slug}`)}
                className="border rounded-xl p-6 hover:border-[#00FB75] hover:shadow-lg transition-all cursor-pointer bg-card"
              >
                <div className="flex items-center gap-4 mb-4">
                  {partner.logo_url ? (
                    <img src={partner.logo_url} alt={partner.name} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#00FB75]/10 flex items-center justify-center">
                      <Building className="w-6 h-6 text-[#00FB75]" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{partner.name}</h3>
                      {partner.is_verified && (
                        <span className="text-[10px] bg-[#00FB75] text-black px-1.5 py-0.5 rounded-full font-medium">Verified</span>
                      )}
                    </div>
                    {partner.country && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {partner.country}{partner.region ? `, ${partner.region}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {partner.description || "No description provided."}
                </p>
                {partner.sector_focus.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {partner.sector_focus.slice(0, 3).map((s) => (
                      <span key={s} className="text-xs px-2 py-1 bg-[#00FB75]/10 text-[#00FB75] rounded-full flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><FlaskConical className="w-3 h-3" />{partner.lab_count} lab{partner.lab_count !== 1 ? "s" : ""}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{partner.member_count} member{partner.member_count !== 1 ? "s" : ""}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 border rounded-lg hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-2 border rounded-lg hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PartnersPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <PartnersPageContent />
    </Suspense>
  );
}