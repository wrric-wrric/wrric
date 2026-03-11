"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { Search, User, Building, MapPin, X, MessageCircle, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import { getProfileDisplayName } from "@/types/message";

interface Profile {
  id: string;
  user_id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  type: string;
  title: string | null;
  organization: string | null;
  bio: string;
  location: Record<string, any>;
  social_links: Record<string, any>;
  expertise: string[];
  profile_image: string | null;
  metadata_: Record<string, any>;
  created_at: string;
}

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartConversation: (profileId: string) => void;
  existingConversations: string[];
  currentUserId?: string | null;
}

export default function NewConversationModal({
  isOpen,
  onClose,
  onStartConversation,
  existingConversations,
  currentUserId
}: NewConversationModalProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");
  const [hasSearched, setHasSearched] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  // Search profiles - FIXED: Use correct API endpoint and handle empty search
  const searchProfiles = useCallback(async (query: string, type: string = "") => {
    try {
      setLoading(true);
      
      // Build query parameters - use the main /api/profiles endpoint
      const params = new URLSearchParams();
      params.append('limit', '20');
      
      if (query.trim()) {
        params.append('search', query.trim());
      }
      if (type) {
        params.append('type', type);
      }

      const url = `/api/profiles/search?${params.toString()}`;
      // console.log('Searching profiles with URL:', url);

      const response = await fetch(url);
      // console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      // console.log('Profiles data received:', data);
      
      // The API returns the array directly, not nested under 'profiles'
      // Filter out profiles belonging to the current user
      const profiles = Array.isArray(data) ? data : [];
      const filtered = currentUserId
        ? profiles.filter((p: Profile) => p.user_id !== currentUserId)
        : profiles;
      setSearchResults(filtered);
      setHasSearched(true);
      
    } catch (error) {
      console.error("Search profiles error:", error);
      toast.error("Failed to search profiles");
      setSearchResults([]);
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedType("");
      setSearchResults([]);
      setHasSearched(false);
      // Load some initial profiles when modal opens
      searchProfiles("", "");
    }
  }, [isOpen, searchProfiles]);

  // Debounced search - FIXED: Always search, even with empty query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchProfiles(searchQuery, selectedType);
    }, 500); // Increased debounce time

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedType, searchProfiles]);

  const handleStartConversation = (profile: Profile) => {
    onStartConversation(profile.id);
    onClose();
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
  };

  const getProfileTypeIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      lab: "🔬",
      entrepreneur: "💼",
      academic: "🎓",
      funder: "💰"
    };
    return icons[type] || "👤";
  };

  const isExistingConversation = (profileId: string) => {
    return existingConversations.includes(profileId);
  };

  // Get display message based on search state
  const getDisplayMessage = () => {
    if (loading) return null;
    
    if (!hasSearched) {
      return "Type to search for profiles...";
    }
    
    if (searchResults.length === 0) {
      if (searchQuery || selectedType) {
        return "No profiles found matching your criteria";
      } else {
        return "No profiles available to message";
      }
    }
    
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div
        ref={modalRef}
        className={`w-full max-w-2xl rounded-xl ${
          isDark ? "bg-gray-900 text-white" : "bg-white text-gray-900"
        } shadow-2xl`}
      >
        {/* Header */}
        <div className={`p-6 border-b ${
          isDark ? "border-gray-800" : "border-gray-200"
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Start New Conversation</h2>
              <p className={`text-sm mt-1 ${
                isDark ? "text-gray-400" : "text-gray-600"
              }`}>
                Find and message other professionals
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
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Search Section */}
        <div className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 opacity-60" />
              <input
                type="text"
                placeholder="Search by name, organization, or expertise..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 rounded-lg border ${
                  isDark
                    ? "bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                    : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500"
                } focus:outline-none focus:ring-2 focus:ring-[#00FB75] focus:border-transparent`}
              />
            </div>

            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className={`px-4 py-3 rounded-lg border ${
                isDark
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-gray-50 border-gray-300 text-gray-900"
              } focus:outline-none focus:ring-2 focus:ring-[#00FB75] focus:border-transparent`}
            >
              <option value="">All Types</option>
              <option value="lab">Lab</option>
              <option value="entrepreneur">Entrepreneur</option>
              <option value="academic">Academic</option>
              <option value="funder">Funder</option>
            </select>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className={`p-4 rounded-lg animate-pulse ${
                    isDark ? "bg-gray-800" : "bg-gray-100"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full ${
                        isDark ? "bg-gray-700" : "bg-gray-300"
                      }`}></div>
                      <div className="flex-1">
                        <div className={`h-4 rounded w-3/4 mb-2 ${
                          isDark ? "bg-gray-700" : "bg-gray-300"
                        }`}></div>
                        <div className={`h-3 rounded w-1/2 ${
                          isDark ? "bg-gray-700" : "bg-gray-300"
                        }`}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Display message when no results or initial state */}
                {getDisplayMessage() && (
                  <div className="text-center py-8">
                    <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">
                      {getDisplayMessage()}
                    </h3>
                    <p className={`text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}>
                      {!hasSearched 
                        ? "Start typing to find professionals to message"
                        : "Try different search terms or clear filters"
                      }
                    </p>
                  </div>
                )}

                {/* Display results when available */}
                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    {searchResults.map((profile) => (
                      <div
                        key={profile.id}
                        className={`p-4 rounded-lg border transition-colors ${
                          isDark
                            ? "bg-gray-800 border-gray-700 hover:border-gray-600"
                            : "bg-gray-50 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Profile Image */}
                            {profile.profile_image ? (
                              <Image
                                src={profile.profile_image}
                                alt="Profile"
                                width={48}
                                height={48}
                                className="rounded-full object-cover border-2 border-[#00FB75]"
                              />
                            ) : (
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                isDark ? "bg-gray-700" : "bg-gray-200"
                              }`}>
                                <User className="w-6 h-6 opacity-60" />
                              </div>
                            )}

                            {/* Profile Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">
                                  {getProfileTypeIcon(profile.type)}
                                </span>
                                <h3 className="font-semibold truncate">
                                  {getProfileDisplayName(profile)}
                                </h3>
                              </div>
                              
                              <div className="flex items-center gap-4 text-sm">
                                {profile.organization && (
                                  <div className="flex items-center gap-1">
                                    <Building className="w-3 h-3 opacity-60" />
                                    <span className="truncate">{profile.organization}</span>
                                  </div>
                                )}
                                
                                {(profile.location?.city || profile.location?.country) && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 opacity-60" />
                                    <span className="truncate">
                                      {[profile.location.city, profile.location.country].filter(Boolean).join(', ')}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Expertise */}
                              {profile.expertise && profile.expertise.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {profile.expertise.slice(0, 3).map((skill, index) => (
                                    <span
                                      key={index}
                                      className={`px-2 py-1 rounded-full text-xs ${
                                        isDark 
                                          ? "bg-gray-700 text-gray-300" 
                                          : "bg-gray-200 text-gray-700"
                                      }`}
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                  {profile.expertise.length > 3 && (
                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                      isDark 
                                        ? "bg-gray-700 text-gray-400" 
                                        : "bg-gray-200 text-gray-500"
                                    }`}>
                                      +{profile.expertise.length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="flex-shrink-0 ml-4">
                            {isExistingConversation(profile.id) ? (
                              <button
                                onClick={() => onStartConversation(profile.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                  isDark
                                    ? "bg-gray-700 hover:bg-gray-600 text-white"
                                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                                }`}
                              >
                                <MessageCircle className="w-4 h-4" />
                                Open Chat
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStartConversation(profile)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                                  isDark
                                    ? "bg-[#00FB75] text-black hover:bg-green-400"
                                    : "bg-[#00FB75] text-black hover:bg-green-400"
                                }`}
                              >
                                <UserPlus className="w-4 h-4" />
                                Message
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}