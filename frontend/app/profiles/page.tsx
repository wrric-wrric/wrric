"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/hooks/sideBarProvider";
import {
  User,
  Edit,
  MapPin,
  Building,
  Award,
  ExternalLink,
  Plus,
  Calendar,
  Home,
  Globe,
  Phone,
  Users
} from "lucide-react";
import { Profile, profileTypes } from "@/types/profile";
import toast from "react-hot-toast";
import Image from "next/image";

export default function ProfilesPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const router = useRouter();
  const { setLoadSession } = useSidebar();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLoadSession(() => {});
    return () => setLoadSession(() => {});
  }, [setLoadSession]);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const response = await fetch("/api/profiles", {
          headers: { Authorization: `Bearer ${token || ""}` },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          if (errorText.includes("Maximum of 2 profiles")) {
            toast.error("Maximum 2 profiles reached");
          }
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data: Profile[] = await response.json();
        setProfiles(data);
      } catch (error) {
        console.error("Fetch profiles error:", error);
        toast.error("Failed to load profiles");
      } finally {
        setLoading(false);
      }
    };
    fetchProfiles();
  }, []);

  const getProfileTypeInfo = (type: string) => {
    const match = profileTypes.find((t) => t.value === type);
    return match || { label: type.charAt(0).toUpperCase() + type.slice(1), icon: "👤" };
  };

  const handleSetAsDefault = async (profileId: string) => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) {
        toast.error("Please login again");
        return;
      }

      const response = await fetch(`/api/profiles/${profileId}/set-default`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed");

      toast.success("Default profile updated");
      setProfiles(prev => prev.map(p => ({ ...p, is_default: p.id === profileId })));
    } catch (error) {
      console.error("Set default error:", error);
      toast.error("Failed to set default");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getDisplayName = (profile: Profile) => {
    if (profile.display_name) return profile.display_name;
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
    return fullName || "Unnamed Profile";
  };

  if (!mounted || loading) {
    return (
      <div className={`p-4 ${isDark ? "bg-black" : "bg-gray-50"}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-40 bg-gray-200 dark:bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"}`}>
      <header className={`sticky top-0 z-10 border-b px-4 py-3 ${
        isDark ? "bg-[#0A0A0A] border-gray-800" : "bg-white border-gray-200"
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-[#00FB75]" />
            <div>
              <h1 className="font-semibold">My Profiles</h1>
              <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                {profiles.length} profile{profiles.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {profiles.length < 2 ? (
            <button
              onClick={() => router.push("/profiles/new")}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#00FB75] text-black text-sm font-medium rounded-lg hover:bg-green-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Profile
            </button>
          ) : (
            <span className={`text-xs px-3 py-2 rounded-lg ${
              isDark ? "bg-gray-800 text-gray-500" : "bg-gray-100 text-gray-500"
            }`}>
              Max 2 profiles
            </span>
          )}
        </div>
      </header>

      <main className="p-4">
        {profiles.length === 0 ? (
          <div className={`text-center py-16 ${
            isDark ? "text-gray-500" : "text-gray-400"
          }`}>
            <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="mb-4">No profiles yet</p>
            <button
              onClick={() => router.push("/profiles/new")}
              className="px-4 py-2 bg-[#00FB75] text-black font-medium rounded-lg hover:bg-green-400 transition-colors"
            >
              Create Your First Profile
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profiles.map((profile) => {
              const typeInfo = getProfileTypeInfo(profile.type);
              
              return (
                <div
                  key={profile.id}
                  className={`rounded-lg border overflow-hidden ${
                    isDark ? "bg-[#121212] border-gray-800" : "bg-white border-gray-200"
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        {profile.profile_image ? (
                          <Image
                            src={profile.profile_image}
                            alt={getDisplayName(profile)}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full object-cover"
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        ) : (
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            isDark ? "bg-gray-800" : "bg-gray-100"
                          }`}>
                            <User className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        {profile.is_default && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#00FB75] rounded-full flex items-center justify-center">
                            <span className="text-[8px]">✓</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`font-medium truncate ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}>
                            {getDisplayName(profile)}
                          </h3>
                          <span className="text-sm">{typeInfo.icon}</span>
                        </div>
                        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                          {typeInfo.label}
                        </p>
                      </div>
                    </div>

                    {profile.title && (
                      <p className={`text-sm mt-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                        {profile.title}
                      </p>
                    )}

                    {profile.organization && (
                      <div className="flex items-center gap-1.5 text-sm mt-1">
                        <Building className={`w-3.5 h-3.5 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                        <span className={isDark ? "text-gray-400" : "text-gray-600"}>
                          {profile.organization}
                        </span>
                      </div>
                    )}

                    {(profile.location?.city || profile.location?.country) && (
                      <div className="flex items-center gap-1.5 text-sm mt-1">
                        <MapPin className={`w-3.5 h-3.5 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                        <span className={isDark ? "text-gray-400" : "text-gray-600"}>
                          {[profile.location.city, profile.location.country].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}

                    {profile.expertise && profile.expertise.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {profile.expertise.slice(0, 3).map((skill, i) => (
                          <span
                            key={i}
                            className={`text-xs px-2 py-0.5 rounded ${
                              isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={`flex items-center justify-between px-4 py-3 border-t ${
                    isDark ? "border-gray-800" : "border-gray-100"
                  }`}>
                    <span className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                      {formatDate(profile.created_at)}
                    </span>
                    <div className="flex items-center gap-1">
                      {!profile.is_default && (
                        <button
                          onClick={() => handleSetAsDefault(profile.id)}
                          className={`p-1.5 rounded transition-colors ${
                            isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"
                          }`}
                          title="Set as default"
                        >
                          <Home className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/profiles/${profile.id}/edit`)}
                        className={`p-1.5 rounded transition-colors ${
                          isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"
                        }`}
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => router.push(`/profiles/${profile.id}`)}
                        className={`p-1.5 rounded transition-colors ${
                          isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"
                        }`}
                        title="View"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
