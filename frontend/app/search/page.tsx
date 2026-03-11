"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  FlaskConical,
  Building,
  User,
  Heart,
  MessageSquare,
  Eye,
  MapPin,
  BadgeCheck,
  ArrowLeft,
  ArrowUpDown,
  ExternalLink,
  Users,
  TrendingUp,
  Filter,
  X
} from "lucide-react";

interface LabResult {
  id: string;
  university: string;
  location: Record<string, string>;
  department: Record<string, string>;
  research_abstract: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
  university_favicon?: string;
  source_favicon?: string;
}

interface PartnerResult {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  sector_focus: string[];
  country: string | null;
  is_verified: boolean;
  member_count?: number;
  project_count?: number;
}

interface UserResult {
  id: string;
  username: string;
  profile_image_url: string | null;
  bio?: string;
  follower_count?: number;
  following_count?: number;
  is_verified?: boolean;
}

type TabType = "all" | "labs" | "partners" | "users";

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [partners, setPartners] = useState<PartnerResult[]>([]);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [counts, setCounts] = useState({ labs: 0, partners: 0, users: 0 });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minLikes: 0,
    hasLocation: false,
    verifiedOnly: false
  });

  const doSearch = useCallback(async (q: string, sortBy?: string, filterParams?: any) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    const sortParam = sortBy || sort;
    try {
      const params = new URLSearchParams({
        q: encodeURIComponent(q),
        limit: '20',
        sort: sortParam,
        ...filterParams
      });
      
      const res = await fetch(`/api/search/global?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLabs(data.labs || []);
        setPartners(data.partners || []);
        setUsers(data.users || []);
        setCounts(data.counts || { labs: 0, partners: 0, users: 0 });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    if (initialQuery) {
      doSearch(initialQuery);
    }
  }, [initialQuery, doSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
    doSearch(query);
  };

  const totalCount = counts.labs + counts.partners + counts.users;

  const tabs: { key: TabType; label: string; count: number; icon: React.ReactNode }[] = [
    { key: "all", label: "All Results", count: totalCount, icon: <Search className="w-4 h-4" /> },
    { key: "labs", label: "Labs", count: counts.labs, icon: <FlaskConical className="w-4 h-4" /> },
    { key: "partners", label: "Partners", count: counts.partners, icon: <Building className="w-4 h-4" /> },
    { key: "users", label: "Users", count: counts.users, icon: <Users className="w-4 h-4" /> },
  ];

  const handleApplyFilters = () => {
    const filterParams: any = {};
    if (filters.minLikes > 0) filterParams.minLikes = filters.minLikes;
    if (filters.hasLocation) filterParams.hasLocation = 'true';
    if (filters.verifiedOnly) filterParams.verifiedOnly = 'true';
    doSearch(query, sort, filterParams);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilters({
      minLikes: 0,
      hasLocation: false,
      verifiedOnly: false
    });
    doSearch(query);
  };

  const hasActiveFilters = filters.minLikes > 0 || filters.hasLocation || filters.verifiedOnly;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()} 
              className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>
            <div>
              <h1 className="text-3xl font-bold">Global Search</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Discover labs, partners, and users across the platform</p>
            </div>
          </div>
          
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
            >
              <X className="w-4 h-4" />
              Clear Filters
            </button>
          )}
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-[#00FB75] to-green-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
            <div className="relative flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search labs, partners, and users..."
                  className="w-full pl-14 pr-32 py-4 rounded-xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-base focus:outline-none focus:border-[#00FB75] transition-colors"
                  autoFocus
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#00FB75] text-black font-semibold px-4 py-2 rounded-lg hover:bg-green-400 transition-colors"
                >
                  Search
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-2 ${showFilters 
                  ? 'bg-[#00FB75] text-black border-[#00FB75]' 
                  : 'border-gray-200 dark:border-gray-800 hover:border-[#00FB75] bg-white dark:bg-gray-900'
                }`}
              >
                <Filter className="w-5 h-5" />
                <span className="font-medium">Filters</span>
              </button>
            </div>
          </div>
        </form>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <label className="block text-sm font-medium">Minimum Likes</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.minLikes}
                    onChange={(e) => setFilters({...filters, minLikes: parseInt(e.target.value)})}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-12">{filters.minLikes}+</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="block text-sm font-medium">Location</label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasLocation}
                    onChange={(e) => setFilters({...filters, hasLocation: e.target.checked})}
                    className="w-5 h-5 text-[#00FB75] rounded border-gray-300"
                  />
                  <span>Has location info</span>
                </label>
              </div>
              
              <div className="space-y-3">
                <label className="block text-sm font-medium">Verification</label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.verifiedOnly}
                    onChange={(e) => setFilters({...filters, verifiedOnly: e.target.checked})}
                    className="w-5 h-5 text-[#00FB75] rounded border-gray-300"
                  />
                  <span>Verified only</span>
                </label>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={clearFilters}
                className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleApplyFilters}
                className="px-4 py-2 rounded-lg bg-[#00FB75] text-black font-semibold hover:bg-green-400 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        {searched && (
          <div className="flex flex-wrap gap-2 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`group flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                  activeTab === tab.key
                    ? "bg-[#00FB75] text-black border-[#00FB75] shadow-lg shadow-[#00FB75]/20"
                    : "border-gray-200 dark:border-gray-800 hover:border-[#00FB75] hover:bg-gray-50 dark:hover:bg-gray-900"
                }`}
              >
                <div className={`transition-colors ${activeTab === tab.key ? 'text-black' : 'text-gray-500'}`}>
                  {tab.icon}
                </div>
                <span className="font-medium">{tab.label}</span>
                <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold transition-colors ${
                  activeTab === tab.key 
                    ? 'bg-black/20 text-black' 
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Sort Controls */}
        {searched && !loading && (activeTab === "labs" || activeTab === "all") && labs.length > 0 && (
          <div className="flex items-center justify-between mb-6 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium">Sort by:</span>
            </div>
            <div className="flex gap-2">
              {["newest", "most_liked", "most_viewed"].map((sortOption) => (
                <button
                  key={sortOption}
                  onClick={() => {
                    setSort(sortOption);
                    doSearch(query, sortOption);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    sort === sortOption
                      ? "bg-[#00FB75] text-black"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {sortOption.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-block w-12 h-12 border-3 border-[#00FB75] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-lg font-medium">Searching across the platform...</p>
            <p className="text-sm text-gray-500 mt-2">Finding the best matches for &quot;{query}&quot;</p>
          </div>
        )}

        {/* No Results */}
        {searched && !loading && totalCount === 0 && (
          <div className="text-center py-16 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
            <Search className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-bold mb-2">No results found</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              We couldn&apos;t find any matches for &quot;<span className="font-medium">{query}</span>&quot;. Try different keywords or check your spelling.
            </p>
            <button
              onClick={() => {
                setQuery("");
                router.push('/search');
              }}
              className="px-6 py-3 rounded-xl bg-[#00FB75] text-black font-semibold hover:bg-green-400 transition-colors"
            >
              Clear Search
            </button>
          </div>
        )}

        {/* Results Grid */}
        {!loading && searched && totalCount > 0 && (
          <div className="space-y-8">
            {/* Labs Results */}
            {(activeTab === "all" || activeTab === "labs") && labs.length > 0 && (
              <div>
                {activeTab === "all" && (
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-[#00FB75]/10">
                        <FlaskConical className="w-6 h-6 text-[#00FB75]" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Research Labs</h2>
                        <p className="text-sm text-gray-500">{counts.labs} labs found</p>
                      </div>
                    </div>
                    <Link
                      href={`/search?q=${encodeURIComponent(query)}&tab=labs`}
                      className="text-sm text-[#00FB75] hover:text-green-400 font-medium flex items-center gap-1"
                    >
                      View all labs
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                )}
                
                <div className="grid md:grid-cols-2 gap-4">
                  {labs.map((lab) => (
                    <Link
                      key={lab.id}
                      href={`/labs/${lab.id}`}
                      className="group block"
                    >
                      <div className="h-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:border-[#00FB75] hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                        <div className="flex items-start gap-3 mb-4">
                          {lab.university_favicon ? (
                            <Image
                              src={lab.university_favicon}
                              alt={lab.university}
                              width={48}
                              height={48}
                              className="rounded-full border-2 border-[#00FB75]"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gradient-to-br from-[#00FB75] to-green-500 rounded-full flex items-center justify-center">
                              <FlaskConical className="w-6 h-6 text-black" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg truncate group-hover:text-[#00FB75] transition-colors">
                              {lab.university || "Research Lab"}
                            </h3>
                            {lab.location?.city && lab.location?.country && (
                              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                                <MapPin className="w-4 h-4" />
                                {lab.location.city}, {lab.location.country}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {lab.research_abstract && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
                            {lab.research_abstract}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-sm">
                              <Heart className="w-4 h-4 text-red-500" />
                              <span className="font-medium">{lab.like_count}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm">
                              <MessageSquare className="w-4 h-4 text-blue-500" />
                              <span className="font-medium">{lab.comment_count}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm">
                              <Eye className="w-4 h-4 text-gray-500" />
                              <span className="font-medium">{lab.view_count}</span>
                            </div>
                          </div>
                          
                          {(lab.like_count + lab.comment_count + lab.view_count) >= 10 && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 text-orange-500 text-xs font-semibold">
                              <TrendingUp className="w-3 h-3" />
                              <span>Trending</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Partners Results */}
            {(activeTab === "all" || activeTab === "partners") && partners.length > 0 && (
              <div>
                {activeTab === "all" && (
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-blue-500/10">
                        <Building className="w-6 h-6 text-blue-500" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Partners</h2>
                        <p className="text-sm text-gray-500">{counts.partners} partners found</p>
                      </div>
                    </div>
                    <Link
                      href={`/search?q=${encodeURIComponent(query)}&tab=partners`}
                      className="text-sm text-[#00FB75] hover:text-green-400 font-medium flex items-center gap-1"
                    >
                      View all partners
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                )}
                
                <div className="grid md:grid-cols-2 gap-4">
                  {partners.map((partner) => (
                    <Link
                      key={partner.id}
                      href={`/partners/${partner.slug}`}
                      className="group block"
                    >
                      <div className="h-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:border-blue-500 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                        <div className="flex items-start gap-3 mb-4">
                          {partner.logo_url ? (
                            <Image
                              src={partner.logo_url}
                              alt={partner.name}
                              width={48}
                              height={48}
                              className="rounded-xl border-2 border-blue-500"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                              <Building className="w-6 h-6 text-white" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg truncate group-hover:text-blue-500 transition-colors">
                                {partner.name}
                              </h3>
                              {partner.is_verified && (
                                <BadgeCheck className="w-5 h-5 text-blue-500" />
                              )}
                            </div>
                            {partner.country && (
                              <p className="text-sm text-gray-500 mt-1">{partner.country}</p>
                            )}
                          </div>
                        </div>
                        
                        {partner.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
                            {partner.description}
                          </p>
                        )}
                        
                        {partner.sector_focus.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-4">
                            {partner.sector_focus.slice(0, 3).map((sector) => (
                              <span 
                                key={sector} 
                                className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-500"
                              >
                                {sector}
                              </span>
                            ))}
                            {partner.sector_focus.length > 3 && (
                              <span className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                +{partner.sector_focus.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          {partner.member_count !== undefined && (
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              <span>{partner.member_count} members</span>
                            </div>
                          )}
                          {partner.project_count !== undefined && (
                            <div className="flex items-center gap-1">
                              <FlaskConical className="w-4 h-4" />
                              <span>{partner.project_count} projects</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Users Results */}
            {(activeTab === "all" || activeTab === "users") && users.length > 0 && (
              <div>
                {activeTab === "all" && (
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-purple-500/10">
                        <Users className="w-6 h-6 text-purple-500" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Users</h2>
                        <p className="text-sm text-gray-500">{counts.users} users found</p>
                      </div>
                    </div>
                    <Link
                      href={`/search?q=${encodeURIComponent(query)}&tab=users`}
                      className="text-sm text-[#00FB75] hover:text-green-400 font-medium flex items-center gap-1"
                    >
                      View all users
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                )}
                
                <div className="grid md:grid-cols-2 gap-4">
                  {users.map((user) => (
                    <Link
                      key={user.id}
                      href={`/profile/${user.username}`}
                      className="group block"
                    >
                      <div className="h-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:border-purple-500 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="relative">
                            {user.profile_image_url ? (
                              <Image
                                src={user.profile_image_url}
                                alt={user.username}
                                width={56}
                                height={56}
                                className="rounded-full border-2 border-purple-500 group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                                <User className="w-7 h-7 text-white" />
                              </div>
                            )}
                            {user.is_verified && (
                              <div className="absolute -bottom-1 -right-1 bg-purple-500 rounded-full p-1 border-2 border-white dark:border-gray-900">
                                <BadgeCheck className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg truncate group-hover:text-purple-500 transition-colors">
                              {user.username}
                            </h3>
                            {user.bio && (
                              <p className="text-sm text-gray-500 mt-1 line-clamp-1">{user.bio}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm">
                          {user.follower_count !== undefined && (
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">{user.follower_count}</span>
                              <span className="text-gray-500">followers</span>
                            </div>
                          )}
                          {user.following_count !== undefined && (
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">{user.following_count}</span>
                              <span className="text-gray-500">following</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pagination or Load More */}
        {!loading && searched && totalCount > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <p className="text-gray-500">
                Showing {Math.min(totalCount, 20)} of {totalCount} results
              </p>
              {totalCount > 20 && (
                <button className="px-6 py-3 rounded-xl border-2 border-[#00FB75] text-[#00FB75] font-semibold hover:bg-[#00FB75] hover:text-black transition-all duration-200">
                  Load More Results
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}