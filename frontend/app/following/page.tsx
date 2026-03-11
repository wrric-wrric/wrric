"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import {
  UserCheck,
  Users,
  Building,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import FollowButton from "@/components/Lab/FollowButton";

interface FollowItem {
  target_type: string;
  target_id: string;
  name: string;
  image_url?: string;
  slug?: string;
  followed_at: string;
}

type TabType = "all" | "user" | "partner" | "lab";

export default function FollowingPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<FollowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [token, setToken] = useState<string | null>(null);

  const isDark = mounted ? resolvedTheme === "dark" : false;

  useEffect(() => {
    setMounted(true);
    const t = localStorage.getItem("token") || sessionStorage.getItem("token");
    setToken(t);
    if (!t) {
      router.push("/auth/login?redirect=/following");
    }
  }, [router]);

  useEffect(() => {
    if (!token) return;
    const fetchFollowing = async () => {
      setLoading(true);
      try {
        const typeParam = tab !== "all" ? `&target_type=${tab}` : "";
        const res = await fetch(`/api/follow/me/following?page=${page}&limit=20${typeParam}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
          setTotalPages(data.total_pages || 0);
          setTotal(data.total || 0);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchFollowing();
  }, [token, tab, page]);

  const getIcon = (type: string) => {
    switch (type) {
      case "user": return <Users className="w-5 h-5 text-blue-500" />;
      case "partner": return <Building className="w-5 h-5 text-purple-500" />;
      case "lab": return <FlaskConical className="w-5 h-5 text-[#00FB75]" />;
      default: return <UserCheck className="w-5 h-5" />;
    }
  };

  const getLink = (item: FollowItem) => {
    switch (item.target_type) {
      case "user": return `/profiles/${item.target_id}`;
      case "partner": return item.slug ? `/partners/${item.slug}` : `/partners`;
      case "lab": return `/labs/${item.target_id}`;
      default: return "#";
    }
  };

  if (!mounted) return null;

  const tabs: { key: TabType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "user", label: "Users" },
    { key: "partner", label: "Partners" },
    { key: "lab", label: "Labs" },
  ];

  return (
    <div className={`min-h-screen ${isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"}`}>
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <UserCheck className="w-8 h-8 text-[#00FB75]" />
          <div>
            <h1 className="text-3xl font-bold">Following</h1>
            <p className="text-sm opacity-70">{total} total</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-[#00FB75] text-black"
                  : isDark
                  ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`h-16 rounded-xl animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <UserCheck className={`w-16 h-16 mx-auto mb-4 ${isDark ? "text-gray-600" : "text-gray-400"}`} />
            <p className="text-lg font-medium mb-2">Not following anything yet</p>
            <p className="text-sm opacity-70">Follow users, partners, and labs to see them here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={`${item.target_type}:${item.target_id}`}
                className={`flex items-center justify-between p-4 rounded-xl transition-colors ${
                  isDark ? "bg-gray-900 hover:bg-gray-800" : "bg-white hover:bg-gray-50 shadow-sm"
                }`}
              >
                <Link href={getLink(item)} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isDark ? "bg-gray-800" : "bg-gray-100"
                  }`}>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      getIcon(item.target_type)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.name || "Unknown"}</p>
                    <p className="text-xs opacity-60 capitalize">{item.target_type}</p>
                  </div>
                </Link>
                <FollowButton
                  targetType={item.target_type as "user" | "partner" | "lab"}
                  targetId={item.target_id}
                  isAuthenticated={!!token}
                  initialFollowing={true}
                  size="sm"
                  showCount={false}
                />
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
