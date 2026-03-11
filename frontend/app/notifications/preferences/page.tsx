"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Mail } from "lucide-react";
import toast from "react-hot-toast";

interface PrefCategory {
  in_app: boolean;
  email: boolean;
}

interface Preferences {
  like: PrefCategory;
  comment: PrefCategory;
  reply: PrefCategory;
  follow: PrefCategory;
  share: PrefCategory;
  partner: PrefCategory;
  new_lab: PrefCategory;
}

const LABELS: Record<string, string> = {
  like: "Likes",
  comment: "Comments",
  reply: "Replies",
  follow: "Follows",
  share: "Shares",
  partner: "Partner updates",
  new_lab: "New labs from followed",
};

export default function NotificationPreferencesPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) { router.push("/"); return; }
    fetch("/api/notifications/preferences", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { setPrefs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [router]);

  const toggle = async (category: string, channel: "in_app" | "email") => {
    if (!prefs) return;
    const cat = prefs[category as keyof Preferences];
    const newValue = !cat[channel];

    // Optimistic update
    setPrefs({
      ...prefs,
      [category]: { ...cat, [channel]: newValue },
    });

    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    setSaving(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [category]: { [channel]: newValue } }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setPrefs(updated);
    } catch {
      // Revert
      setPrefs({ ...prefs, [category]: { ...cat, [channel]: !newValue } });
      toast.error("Failed to save preference");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !prefs) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-6 h-6 border-2 border-[#00FB75] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold">Notification Preferences</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Choose which notifications you receive and how.
      </p>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-3 gap-4 p-4 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <span>Type</span>
          <span className="text-center flex items-center justify-center gap-1"><Bell className="w-3 h-3" />In-App</span>
          <span className="text-center flex items-center justify-center gap-1"><Mail className="w-3 h-3" />Email</span>
        </div>

        {Object.entries(LABELS).map(([key, label]) => {
          const cat = prefs[key as keyof Preferences];
          return (
            <div
              key={key}
              className="grid grid-cols-3 gap-4 p-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
            >
              <span className="text-sm font-medium">{label}</span>
              <div className="flex justify-center">
                <button
                  onClick={() => toggle(key, "in_app")}
                  className={`w-10 h-6 rounded-full transition-colors ${
                    cat.in_app ? "bg-[#00FB75]" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${
                      cat.in_app ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => toggle(key, "email")}
                  className={`w-10 h-6 rounded-full transition-colors ${
                    cat.email ? "bg-[#00FB75]" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${
                      cat.email ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
