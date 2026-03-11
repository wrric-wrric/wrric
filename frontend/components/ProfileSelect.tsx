"use client";

import { useState, useEffect } from "react";
import { User, Star } from "lucide-react";
import Image from "next/image";
import type { Profile } from "@/types/profile";
import { getProfileDisplayName } from "@/types/message";

interface ProfileSelectProps {
  onProfileSelect: (profileId: string) => void;
  selectedProfileId?: string | null;
  disabled?: boolean;
}

export default function ProfileSelect({
  onProfileSelect,
  selectedProfileId,
  disabled = false,
}: ProfileSelectProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await fetch("/api/profiles", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          console.error("Failed to fetch profiles");
          setLoading(false);
          return;
        }

        const data: Profile[] = await response.json();
        setProfiles(data);
      } catch (error) {
        console.error("Fetch profiles error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  if (!mounted) return null;

  return (
    <div className="profile-selector">
      <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
        Select Profile
      </label>
      <select
        value={selectedProfileId || ""}
        onChange={(e) => onProfileSelect(e.target.value)}
        disabled={disabled || loading || profiles.length === 0}
        className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-[#00FB75] focus:ring-2 focus:ring-[#00FB75]/20 transition-colors"
      >
        {loading ? (
          <option value="">Loading profiles...</option>
        ) : profiles.length === 0 ? (
          <option value="">No profiles available</option>
        ) : (
          profiles.map((profile) => (
            <option
              key={profile.id}
              value={profile.id}
              className="flex items-center gap-2"
            >
              {profile.is_default && "* "}
              {getProfileDisplayName(profile)}
              {profile.type && ` (${profile.type})`}
            </option>
          ))
        )}
      </select>
      {profiles.length > 0 && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          * denotes default profile
        </p>
      )}
    </div>
  );
}
