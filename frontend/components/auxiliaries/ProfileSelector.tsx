"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { User, Building, MapPin, Award, Calendar, Plus, Check, Star, X } from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import { getProfileDisplayName } from "@/types/message";

interface Profile {
  id: string;
  user_id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  is_default: boolean;
  type: string;
  title: string | null;
  organization: string | null;
  bio: string;
  location: Record<string, any>;
  social_links: Record<string, any>;
  expertise: string[];
  profile_image: string | null;
  created_at: string;
}

interface ProfileSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileSelect: (profileId: string) => void;
  currentProfileId?: string | null;
}

export default function ProfileSelector({
  isOpen,
  onClose,
  onProfileSelect,
  currentProfileId,
}: ProfileSelectorProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    currentProfileId || null
  );

  const fetchUserProfiles = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/profiles");

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Please login again");
          router.push("/auth/login");
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const userProfiles = await response.json();
      setProfiles(userProfiles);

      if (!selectedProfileId && userProfiles.length > 0) {
        setSelectedProfileId(userProfiles[0].id);
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
      toast.error("Failed to load profiles");
    } finally {
      setLoading(false);
    }
  }, [router, selectedProfileId]);

  useEffect(() => {
    if (isOpen) {
      fetchUserProfiles();
    }
  }, [isOpen, fetchUserProfiles]);

  const handleProfileSelect = (profileId: string) => {
    setSelectedProfileId(profileId);
  };

  const handleConfirm = () => {
    if (selectedProfileId) {
      onProfileSelect(selectedProfileId);
      onClose();
    }
  };

  const getProfileTypeIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      lab: "🔬",
      entrepreneur: "💼",
      academic: "🎓",
      funder: "💰",
      participant: "🏆",
      partner: "🤝",
    };
    return icons[type] || "👤";
  };

  const getProfileImage = (profile: Profile) =>
    profile.profile_image ||
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face";

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div
        className={`w-full max-w-md rounded-2xl overflow-hidden shadow-2xl ${
          isDark ? "bg-gray-900" : "bg-white"
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isDark ? "border-gray-800" : "border-gray-200"
          }`}
        >
          <div>
            <h2 className="text-xl font-bold">Select Profile</h2>
            <p
              className={`text-sm ${
                isDark ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Choose a profile for messaging
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? "hover:bg-gray-800 text-gray-400"
                : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profiles List */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl animate-pulse ${
                    isDark ? "bg-gray-800" : "bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-full ${
                        isDark ? "bg-gray-700" : "bg-gray-300"
                      }`}
                    />
                    <div className="flex-1">
                      <div
                        className={`h-4 rounded w-3/4 mb-2 ${
                          isDark ? "bg-gray-700" : "bg-gray-300"
                        }`}
                      />
                      <div
                        className={`h-3 rounded w-1/2 ${
                          isDark ? "bg-gray-700" : "bg-gray-300"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-8">
              <div
                className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  isDark ? "bg-gray-800" : "bg-gray-100"
                }`}
              >
                <User className="w-8 h-8 opacity-50" />
              </div>
              <h3 className="font-semibold mb-2">No Profiles</h3>
              <p className={`text-sm mb-6 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Create a profile to start messaging
              </p>
              <button
                onClick={() => router.push("/profiles/new")}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium bg-[#00FB75] text-black hover:bg-green-400 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Profile
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => handleProfileSelect(profile.id)}
                  className={`w-full rounded-xl p-3 transition-all duration-200 flex items-center gap-3 ${
                    selectedProfileId === profile.id
                      ? isDark
                        ? "bg-gray-800 ring-1 ring-[#00FB75]"
                        : "bg-gray-50 ring-1 ring-[#00FB75]"
                      : isDark
                      ? "hover:bg-gray-800"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div
                      className={`w-12 h-12 rounded-full overflow-hidden ${
                        isDark ? "bg-gray-800" : "bg-gray-200"
                      }`}
                    >
                      <img
                        src={getProfileImage(profile)}
                        alt={getProfileDisplayName(profile)}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src =
                            "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face";
                        }}
                      />
                    </div>
                    {selectedProfileId === profile.id && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#00FB75] rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-black" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{getProfileTypeIcon(profile.type)}</span>
                      <h3
                        className={`font-semibold truncate ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {getProfileDisplayName(profile)}
                      </h3>
                    </div>
                    <p
                      className={`text-xs capitalize ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      {profile.type.replace("_", " ")}
                      {profile.is_default && " · Default"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          className={`px-4 py-4 border-t flex gap-3 ${
            isDark ? "border-gray-800" : "border-gray-200"
          }`}
        >
          <button
            onClick={onClose}
            className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${
              isDark
                ? "bg-gray-800 hover:bg-gray-700 text-white"
                : "bg-gray-100 hover:bg-gray-200 text-gray-900"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedProfileId}
            className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${
              selectedProfileId
                ? "bg-[#00FB75] text-black hover:bg-green-400"
                : isDark
                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
