"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Eye, Heart, MessageSquare, Share2 } from "lucide-react";

interface DailyPoint {
  date: string;
  count: number;
}

interface AnalyticsData {
  entity_id: string;
  period_days: number;
  summary: {
    view_count: number;
    like_count: number;
    comment_count: number;
    share_count: number;
  };
  daily_views: DailyPoint[];
  daily_likes: DailyPoint[];
  daily_comments: DailyPoint[];
  daily_shares: DailyPoint[];
}

function MiniChart({ data, color }: { data: DailyPoint[]; color: string }) {
  if (!data || data.length === 0) {
    return <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">No data</div>;
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const w = 400;
  const h = 120;
  const px = 40;
  const py = 10;
  const chartW = w - px * 2;
  const chartH = h - py * 2;

  const points = data.map((d, i) => {
    const x = px + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
    const y = py + chartH - (d.count / maxCount) * chartH;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points.join(" ")} />
      {data.map((d, i) => {
        const x = px + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
        const y = py + chartH - (d.count / maxCount) * chartH;
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
      })}
    </svg>
  );
}

export default function LabAnalyticsPage() {
  const { lab } = useParams<{ lab: string }>();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [error, setError] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") || sessionStorage.getItem("token") : null;

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/labs/${lab}/analytics?days=${days}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || "Failed to load analytics");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [lab, days, token]);

  useEffect(() => {
    if (lab) fetchAnalytics();
  }, [lab, fetchAnalytics]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading analytics...</div>;
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-red-500">{error}</p>
      <button onClick={() => router.back()} className="text-sm text-muted-foreground hover:text-foreground">Go back</button>
    </div>
  );
  if (!data) return null;

  const cards = [
    { label: "Views", value: data.summary.view_count, icon: Eye, color: "#3b82f6" },
    { label: "Likes", value: data.summary.like_count, icon: Heart, color: "#ef4444" },
    { label: "Comments", value: data.summary.comment_count, icon: MessageSquare, color: "#f59e0b" },
    { label: "Shares", value: data.summary.share_count, icon: Share2, color: "#00FB75" },
  ];

  const charts = [
    { label: "Views", data: data.daily_views, color: "#3b82f6" },
    { label: "Likes", data: data.daily_likes, color: "#ef4444" },
    { label: "Comments", data: data.daily_comments, color: "#f59e0b" },
    { label: "Shares", data: data.daily_shares, color: "#00FB75" },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Lab Analytics</h1>
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                  days === d ? "bg-[#00FB75] text-black border-[#00FB75]" : "border-border hover:border-foreground"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {cards.map((c) => (
            <div key={c.label} className="border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <c.icon className="w-4 h-4" style={{ color: c.color }} />
                <span className="text-sm">{c.label}</span>
              </div>
              <p className="text-2xl font-bold">{c.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {charts.map((c) => (
            <div key={c.label} className="border rounded-xl p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">{c.label} over time</h3>
              <MiniChart data={c.data} color={c.color} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
