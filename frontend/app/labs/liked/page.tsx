"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Heart, FlaskConical, MapPin, ChevronLeft, ChevronRight } from "lucide-react";

interface LikedLab {
  id: string;
  university: string;
  research_abstract: string;
  website: string | null;
  location: Record<string, string>;
  scopes: string[];
  entity_type: string;
  like_count: number;
  images: { id: string; url: string; caption: string; is_primary: boolean }[];
}

export default function LikedLabsPage() {
  const router = useRouter();
  const [labs, setLabs] = useState<LikedLab[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  const fetchLikedLabs = useCallback(async () => {
    setLoading(true);
    try {
      const rawToken = localStorage.getItem("token") || sessionStorage.getItem("token");
      const token = rawToken && rawToken !== "null" && rawToken !== "undefined" ? rawToken : null;
      if (!token) {
        router.push("/login");
        return;
      }
      const res = await fetch(`/api/labs/me/liked?page=${page}&limit=18`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLabs(data.items || []);
        setTotalPages(data.total_pages || 0);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch liked labs:", error);
    } finally {
      setLoading(false);
    }
  }, [page, router]);

  useEffect(() => {
    fetchLikedLabs();
  }, [fetchLikedLabs]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Heart className="w-8 h-8 text-red-500 fill-red-500" />
            Liked Labs
          </h1>
          <p className="text-muted-foreground mt-2">
            {total} lab{total !== 1 ? "s" : ""} you have liked
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border rounded-xl p-6 bg-card animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                <div className="h-3 bg-muted rounded w-full mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : labs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Heart className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No liked labs yet.</p>
            <p className="mt-2">Browse labs and click the heart to save your favorites.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {labs.map((lab) => (
              <div
                key={lab.id}
                onClick={() => router.push(`/labs/${lab.id}`)}
                className="border rounded-xl p-6 hover:border-[#00FB75] hover:shadow-lg transition-all cursor-pointer bg-card"
              >
                <div className="flex items-center gap-3 mb-3">
                  <FlaskConical className="w-5 h-5 text-[#00FB75]" />
                  <h3 className="font-semibold text-lg truncate">{lab.university || "Unnamed Lab"}</h3>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {lab.research_abstract || "No description"}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {(lab.scopes || []).slice(0, 2).map((s) => (
                      <span key={s} className="text-xs px-2 py-0.5 bg-[#00FB75]/10 text-[#00FB75] rounded-full">{s}</span>
                    ))}
                    {lab.location?.country && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{lab.location.country}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-red-500">
                    <Heart className="w-4 h-4 fill-red-500" />
                    <span className="text-xs">{lab.like_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 border rounded-lg hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-2 border rounded-lg hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
