"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Heart,
  MessageSquare,
  Share2,
  UserPlus,
  FlaskConical,
  TrendingUp,
  Compass,
  Rss,
  Sparkles,
  Users,
  Target,
  BarChart3,
  Clock,
  Zap,
  MoreVertical,
  Filter,
  Calendar,
  Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";

interface FeedItem {
  id: string;
  actor_user_id: string;
  actor_username: string;
  actor_profile_image: string | null;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  target_title?: string;
  target_image?: string;
}

interface TrendingLab {
  id: string;
  university: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  engagement_score: number;
  view_count: number;
  university_favicon?: string;
}

const ACTION_CONFIG: Record<
  string,
  {
    icon: React.ElementType;
    label: string;
    color: string;
    bgColor: string;
    verb: string;
  }
> = {
  created_lab: {
    icon: FlaskConical,
    label: "created a new research lab",
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    verb: "Created",
  },
  liked_lab: {
    icon: Heart,
    label: "liked a lab",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    verb: "Liked",
  },
  commented: {
    icon: MessageSquare,
    label: "commented on a lab",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    verb: "Commented",
  },
  followed: {
    icon: UserPlus,
    label: "started following",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    verb: "Followed",
  },
  shared: {
    icon: Share2,
    label: "shared a lab",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    verb: "Shared",
  },
  updated_lab: {
    icon: FlaskConical,
    label: "updated their lab",
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
    verb: "Updated",
  },
  viewed: {
    icon: Eye,
    label: "viewed a lab",
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
    verb: "Viewed",
  },
};

function FeedItemCard({ item }: { item: FeedItem }) {
  const router = useRouter();
  const config = ACTION_CONFIG[item.action] || {
    icon: Rss,
    label: item.action,
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    verb: "Activity",
  };
  const Icon = config.icon;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const handleClick = () => {
    if (item.target_type === "lab") {
      router.push(`/labs/${item.target_id}`);
    } else if (item.actor_user_id) {
      router.push(`/profile/${item.actor_username}`);
    }
  };

  return (
    <div
      className="group relative p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
      onClick={handleClick}
    >
      {/* Decorative accent line */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${config.bgColor} rounded-l-2xl`}
      />

      <div className="flex items-start gap-4">
        {/* Avatar with status indicator */}
        <div className="relative flex-shrink-0">
          <div className="relative w-14 h-14 rounded-2xl border-2 border-white dark:border-gray-800 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
            {item.actor_profile_image ? (
              <Image
                src={item.actor_profile_image}
                alt={item.actor_username}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-xl font-bold text-gray-500 dark:text-gray-400">
                  {(item.actor_username || "?")[0].toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div
            className={`absolute -bottom-1 -right-1 ${config.bgColor} p-2 rounded-full border-2 border-white dark:border-gray-900`}
          >
            <Icon className={`w-4 h-4 ${config.color}`} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-[#00FB75] transition-colors">
                {item.actor_username || "Anonymous User"}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                <span className={`font-medium ${config.color}`}>
                  {config.verb}
                </span>{" "}
                <span className="text-gray-500 dark:text-gray-500">
                  {config.label.replace(config.verb.toLowerCase(), "")}
                </span>
              </p>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
              {timeAgo(item.created_at)}
            </span>
          </div>

          {/* Target Preview */}
          {item.target_title && (
            <div className="mt-4 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-3">
                {item.target_image && (
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-[#00FB75] to-green-500 flex items-center justify-center flex-shrink-0">
                    {item.target_image.startsWith("http") ? (
                      <Image
                        src={item.target_image}
                        alt={item.target_title}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FlaskConical className="w-5 h-5 text-white" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {item.target_title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {item.target_type === "lab" ? "Research Lab" : "User"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          {item.metadata && Object.keys(item.metadata).length > 0 && (
            <div className="flex items-center gap-3 mt-4">
              {typeof item.metadata.like_count === 'number' && item.metadata.like_count > 0 && (
                <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                  <Heart className="w-4 h-4" />
                  <span>{item.metadata.like_count}</span>
                </div>
              )}
              {typeof item.metadata.comment_count === 'number' && item.metadata.comment_count > 0 && (
                <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                  <MessageSquare className="w-4 h-4" />
                  <span>{item.metadata.comment_count}</span>
                </div>
              )}
              {typeof item.metadata.share_count === 'number' && item.metadata.share_count > 0 && (
                <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                  <Share2 className="w-4 h-4" />
                  <span>{item.metadata.share_count}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FeedPage() {
  const [activeTab, setActiveTab] = useState<
    "following" | "discover" | "trending"
  >("discover");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [trendingLabs, setTrendingLabs] = useState<TrendingLab[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [timeFilter, setTimeFilter] = useState<
    "all" | "today" | "week" | "month"
  >("all");
  const [stats, setStats] = useState({
    total_activities: 0,
    active_users: 0,
    trending_labs: 0,
  });
  const loaderRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    setIsAuthenticated(!!token);
  }, []);

  const fetchFeed = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      try {
        const token =
          localStorage.getItem("token") || sessionStorage.getItem("token");
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        params.set("limit", "15");
        params.set("time_filter", timeFilter);

        const endpoint =
          activeTab === "following"
            ? "/api/feed"
            : activeTab === "trending"
              ? "/api/feed/trending"
              : "/api/feed/discover";

        const res = await fetch(`${endpoint}?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
          if (res.status === 401 && activeTab === "following") {
            toast.error("Please log in to see your personalized feed");
            return;
          }
          throw new Error("Failed to load feed");
        }

        const data = await res.json();
        if (cursor) {
          setItems((prev) => [...prev, ...(data.items || [])]);
        } else {
          setItems(data.items || []);
        }
        setNextCursor(data.next_cursor || null);

        // Update stats if available
        if (data.stats) {
          setStats(data.stats);
        }
      } catch {
        toast.error("Failed to load feed");
      } finally {
        setLoading(false);
      }
    },
    [activeTab, timeFilter],
  );

  const fetchTrendingLabs = useCallback(async () => {
    try {
      const res = await fetch("/api/feed/trending?limit=5");
      if (res.ok) {
        const data = await res.json();
        setTrendingLabs(data.trending || []);
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    fetchFeed();
    fetchTrendingLabs();
  }, [activeTab, timeFilter, fetchFeed, fetchTrendingLabs]);

  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current || !nextCursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !loading) {
          fetchFeed(nextCursor);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [nextCursor, loading, fetchFeed]);

  const tabs = [
    {
      key: "discover" as const,
      label: "Discover",
      icon: Compass,
      description: "Latest activity from everyone",
    },
    ...(isAuthenticated
      ? [
          {
            key: "following" as const,
            label: "Following",
            icon: Rss,
            description: "Updates from people you follow",
          },
        ]
      : []),
    {
      key: "trending" as const,
      label: "Trending",
      icon: TrendingUp,
      description: "Most engaging content",
    },
  ];

  const timeFilters = [
    { key: "all" as const, label: "All Time", icon: Calendar },
    { key: "today" as const, label: "Today", icon: Clock },
    { key: "week" as const, label: "This Week", icon: Calendar },
    { key: "month" as const, label: "This Month", icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#00FB75] to-green-500 bg-clip-text text-transparent">
                Activity Feed
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-2xl">
                Stay updated with the latest research labs, user activities, and
                trending content across the platform.
              </p>
            </div>

            {/* Stats Summary */}
            <div className="hidden md:flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.total_activities}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Activities
                </div>
              </div>
              <div className="h-8 w-px bg-gray-200 dark:bg-gray-800" />
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.active_users}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Active Users
                </div>
              </div>
              <div className="h-8 w-px bg-gray-200 dark:bg-gray-800" />
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.trending_labs}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Trending Labs
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`group flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                      activeTab === tab.key
                        ? "bg-[#00FB75] text-black border-[#00FB75] shadow-lg shadow-[#00FB75]/20"
                        : "border-gray-200 dark:border-gray-800 hover:border-[#00FB75] hover:bg-gray-50 dark:hover:bg-gray-900"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${activeTab === tab.key ? "text-black" : "text-gray-500"}`}
                    />
                    <div className="text-left">
                      <div className="font-semibold">{tab.label}</div>
                      <div className="text-xs opacity-70">
                        {tab.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Time Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <div className="flex flex-wrap gap-1">
                {timeFilters.map((filter) => {
                  const FilterIcon = filter.icon;
                  return (
                    <button
                      key={filter.key}
                      onClick={() => setTimeFilter(filter.key)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        timeFilter === filter.key
                          ? "bg-[#00FB75] text-black"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                      }`}
                    >
                      <FilterIcon className="w-3 h-3 inline mr-1.5" />
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Feed */}
          <div className="flex-1">
            {loading && items.length === 0 ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
                  {activeTab === "following" ? (
                    <Users className="w-10 h-10 text-gray-400" />
                  ) : (
                    <Sparkles className="w-10 h-10 text-gray-400" />
                  )}
                </div>
                <h3 className="text-xl font-bold mb-2">
                  {activeTab === "following"
                    ? "Your feed is empty"
                    : "No activities yet"}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                  {activeTab === "following"
                    ? "Follow users, partners, or labs to see their activity here."
                    : "Be the first to like, comment, or share a lab!"}
                </p>
                <button
                  onClick={() => router.push("/labs")}
                  className="px-6 py-3 rounded-xl bg-[#00FB75] text-black font-semibold hover:bg-green-400 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  Explore Labs
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <FeedItemCard key={item.id} item={item} />
                ))}
              </div>
            )}

            {/* Infinite scroll loader */}
            <div ref={loaderRef} className="py-8 text-center">
              {loading && items.length > 0 && (
                <div className="flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-3 border-[#00FB75] border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Loading more activities...
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="sticky top-8 space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stats.total_activities}
                      </div>
                      <div className="text-sm text-blue-600 dark:text-blue-400">
                        Total Activities
                      </div>
                    </div>
                    <BarChart3 className="w-8 h-8 text-blue-500 opacity-70" />
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stats.active_users}
                      </div>
                      <div className="text-sm text-purple-600 dark:text-purple-400">
                        Active Users
                      </div>
                    </div>
                    <Users className="w-8 h-8 text-purple-500 opacity-70" />
                  </div>
                </div>
              </div>

              {/* Trending Labs */}
              <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#00FB75]" />
                    Trending Labs
                  </h3>
                  <Zap className="w-4 h-4 text-gray-400" />
                </div>
                <div className="space-y-3">
                  {trendingLabs.map((lab, i) => (
                    <div
                      key={lab.id}
                      className="group p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-[#00FB75] hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 cursor-pointer"
                      onClick={() => router.push(`/labs/${lab.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00FB75] to-green-500 flex items-center justify-center">
                            {lab.university_favicon ? (
                              <Image
                                src={lab.university_favicon}
                                alt={lab.university}
                                width={40}
                                height={40}
                                className="rounded-xl"
                              />
                            ) : (
                              <FlaskConical className="w-5 h-5 text-white" />
                            )}
                          </div>
                          {i < 3 && (
                            <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                              {i + 1}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate group-hover:text-[#00FB75] transition-colors">
                            {lab.university || "Unnamed Lab"}
                          </h4>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <Heart className="w-3 h-3" />
                              <span>{lab.like_count}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <MessageSquare className="w-3 h-3" />
                              <span>{lab.comment_count}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <Eye className="w-3 h-3" />
                              <span>{lab.view_count || 0}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs font-bold bg-[#00FB75]/10 text-[#00FB75] px-2 py-1 rounded-full">
                          {Math.round(lab.engagement_score)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <h3 className="font-bold text-lg mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => router.push("/labs")}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-[#00FB75] hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 group"
                  >
                    <div className="p-2 rounded-lg bg-[#00FB75]/10 group-hover:bg-[#00FB75]/20">
                      <Compass className="w-5 h-5 text-[#00FB75]" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">Explore Labs</div>
                      <div className="text-xs text-gray-500">
                        Discover new research
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => router.push("/matches")}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 group"
                  >
                    <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20">
                      <Target className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">View Matches</div>
                      <div className="text-xs text-gray-500">
                        Find funding opportunities
                      </div>
                    </div>
                  </button>
                  {!isAuthenticated && (
                    <button
                      onClick={() => router.push("/auth/login")}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-green-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 group"
                    >
                      <div className="p-2 rounded-lg bg-green-500/10 group-hover:bg-green-500/20">
                        <UserPlus className="w-5 h-5 text-green-500" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium">Sign In</div>
                        <div className="text-xs text-gray-500">
                          Personalize your feed
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
