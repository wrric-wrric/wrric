"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  FlaskConical,
  Globe,
  MapPin,
  GraduationCap,
  Mail,
  User2,
  ExternalLink,
  MessageSquare,
  Heart,
  Eye,
  TrendingUp,
  Share2,
} from "lucide-react";
import type { LabProfile } from "../../lib/types";
import LikeButton from "./LikeButton";
import ShareButton from "./ShareButton";

interface LabCardProps {
  lab: LabProfile;
  isDark: boolean;
  selectedLabs?: string[];
  setSelectedLabs?: (labs: string[]) => void;
  setShowInquiryModal: (show: boolean) => void;
  setSingleLabId: (id: string | null) => void;
  isAuthenticated: boolean;
  setIsAuthPromptOpen?: (open: boolean) => void;
  setAuthAction?: (action: string) => void;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  isLiked?: boolean;
}

export default function LabCard({
  lab,
  isDark,
  selectedLabs,
  setSelectedLabs,
  setShowInquiryModal,
  setSingleLabId,
  isAuthenticated,
  setIsAuthPromptOpen,
  setAuthAction,
  likeCount = 0,
  commentCount = 0,
  shareCount = 0,
  isLiked = false,
}: LabCardProps) {
  const selected = Array.isArray(selectedLabs) ? selectedLabs : [];

  const handleCheckboxChange = () => {
    if (!isAuthenticated) {
      setAuthAction?.("broadcast inquiry");
      setIsAuthPromptOpen?.(true);
      return;
    }
    if (typeof setSelectedLabs !== "function") return;
    const currentlySelected = Array.isArray(selectedLabs) ? selectedLabs : [];
    if (currentlySelected.includes(lab.id.toString())) {
      setSelectedLabs(currentlySelected.filter((id) => id !== lab.id.toString()));
    } else {
      setSelectedLabs([...currentlySelected, lab.id.toString()]);
    }
  };

  const handleContactClick = () => {
    if (!isAuthenticated) {
      setAuthAction?.("contact lab");
      setIsAuthPromptOpen?.(true);
      return;
    }
    setSingleLabId(lab.id.toString());
    setShowInquiryModal(true);
  };

  const getHostname = (url: string) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return url; }
  };

  // Render favicon with base64
  const renderFavicon = (favicon: string | null, alt: string, size: number = 48) => {
    if (!favicon) return null;
    return (
      <Image
        src={favicon}
        alt={alt}
        width={size}
        height={size}
        className={`rounded-full border-2 border-[#00FB75] transition-transform duration-200 ${
          size === 48 ? "group-hover:scale-105" : "group-hover:scale-110"
        }`}
      />
    );
  };

  return (
    <div className="group block">
      <div
        className={`relative h-full rounded-2xl border p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${
          isDark ? "bg-[#181818] border-[#333] hover:border-[#00FB75]/50" : "bg-white border-gray-200 hover:border-green-200/50"
        }`}
        title={lab.source === "scraped" ? "Identified by AI discovery agent" : "Manually verified lab"}
      >
        {/* Trending Badge (U-3.2.5) */}
        {(likeCount + commentCount + shareCount) >= 10 && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500 text-white text-xs font-semibold shadow-md">
            <TrendingUp className="w-3 h-3" />
            Trending
          </div>
        )}

        {/* Source Badge */}
        {lab.source?.toLowerCase() === "scraped" ? (
          <div className="absolute top-0 right-0 overflow-hidden w-32 h-32 pointer-events-none">
            <div className="absolute transform rotate-45 bg-gradient-to-r from-[#00FB75] to-green-500 text-black text-xs font-semibold py-1 px-4 shadow-md top-4 right-[-30px]">
              AI Discovery
            </div>
          </div>
        ) : (
          <div className="absolute top-0 right-0 overflow-hidden w-32 h-32 pointer-events-none">
            <div className="absolute transform rotate-45 bg-[#181818] text-[#00FB75] text-xs font-semibold py-1 px-4 shadow-md top-4 right-[-30px] border border-[#00FB75]">
              User Created
            </div>
          </div>
        )}

        <div className="flex items-start gap-4 mb-4">
          {isAuthenticated && (
            <input
              type="checkbox"
              checked={selected.includes(lab.id.toString())}
              onChange={handleCheckboxChange}
              className="mt-2 h-5 w-5 accent-[#00FB75] cursor-pointer hover:scale-110 transition-transform"
              aria-label={`Select ${lab.university || lab.display_name} for broadcast inquiry`}
            />
          )}

          {/* Main University Logo */}
          <div className="flex-shrink-0">
            {renderFavicon(lab.university_favicon, `${lab.university} logo`, 48) || (
              <div
                className={`w-12 h-12 bg-gradient-to-br from-[#00FB75] to-green-500 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform duration-200 ${
                  isDark ? "text-white" : "text-black"
                }`}
              >
                <FlaskConical className="w-6 h-6" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3
              className={`font-bold text-lg truncate transition-colors group-hover:text-[#00FB75] ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {lab.university || lab.display_name || "Research Lab"}
            </h3>

            {/* Lab URL with source favicon */}
            {lab.url ? (
              <a
                href={lab.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-sm flex items-center gap-1.5 mt-1 transition-colors group-hover:text-[#00FB75] ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
                title="Visit lab website"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="truncate">
                  {(() => {
                    try {
                      return new URL(lab.url).hostname.replace(/^www\./, "");
                    } catch {
                      return lab.url;
                    }
                  })()}
                </span>
                {/* Source Favicon (small) */}
                {renderFavicon(lab.source_favicon, `Source favicon`, 24) && (
                  <div className="ml-1 -mb-0.5">
                    {renderFavicon(lab.source_favicon, `Source favicon`, 24)}
                  </div>
                )}
              </a>
            ) : (
              <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                {lab.department?.name || "Department"}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-[#00FB75]" />
            <span className={isDark ? "text-gray-300" : "text-gray-700"}>
              {lab.location?.city || "N/A"}, {lab.location?.country || "N/A"}
            </span>
          </div>
          {lab.department?.focus && (
            <div className="flex items-center gap-2 text-sm">
              <GraduationCap className="w-4 h-4 text-[#00FB75]" />
              <span className={isDark ? "text-gray-300" : "text-gray-700"}>{lab.department.focus}</span>
            </div>
          )}
          {lab.point_of_contact?.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-[#00FB75]" />
              <span className={`truncate ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                {lab.point_of_contact.email}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mb-6">
          {lab.point_of_contact?.bio_url ? (
            <Image
              src={lab.point_of_contact.bio_url}
              alt={lab.point_of_contact.name || "Contact"}
              width={32}
              height={32}
              className="rounded-full border-2 border-[#00FB75] group-hover:scale-110 transition-transform"
            />
          ) : (
            <div
              className={`w-8 h-8 bg-[#00FB75] rounded-full flex items-center justify-center ${
                isDark ? "text-white" : "text-black"
              }`}
            >
              <User2 className="w-4 h-4" />
            </div>
          )}
          <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
            {lab.point_of_contact?.name || "Contact"}
          </span>
        </div>

        {/* Improved Like, Comment, Share Section */}
        <div className="flex items-center justify-between mb-6 p-3 rounded-xl border border-gray-700 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            {/* Like Button */}
            <LikeButton
              entityId={lab.id.toString()}
              initialCount={likeCount}
              initialLiked={isLiked}
              isAuthenticated={isAuthenticated}
              onAuthRequired={() => {
                setAuthAction?.("like a lab");
                setIsAuthPromptOpen?.(true);
              }}
              size="md"
            />
            
            {/* Comments Link */}
            <Link
              href={`/labs/${lab.id}#comments`}
              className="group/comments flex items-center gap-2 text-sm hover:text-[#00FB75] transition-all duration-200 cursor-pointer"
            >
              <div className="relative">
                <MessageSquare className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover/comments:text-[#00FB75] transition-colors duration-200" />
                {commentCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#00FB75] text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {commentCount}
                  </span>
                )}
              </div>
              <span className="font-medium text-gray-700 dark:text-gray-300 group-hover/comments:text-[#00FB75] transition-colors duration-200">
                {commentCount === 0 ? 'Comment' : `Comments (${commentCount})`}
              </span>
            </Link>
          </div>
          
          {/* Share Button */}
          <div className="relative">
            <ShareButton
              entityId={lab.id.toString()}
              labName={lab.university || lab.display_name || "Research Lab"}
              size="md"
            />
          </div>
        </div>

        {/* Stats Bar */}
        {(likeCount > 0 || commentCount > 0 || shareCount > 0) && (
          <div className="flex items-center gap-4 mb-4 px-2">
            {likeCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <Heart className="w-4 h-4 text-red-500" fill="currentColor" />
                <span className="font-medium text-gray-700 dark:text-gray-300">{likeCount}</span>
              </div>
            )}
            {commentCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-gray-700 dark:text-gray-300">{commentCount}</span>
              </div>
            )}
            {shareCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <Share2 className="w-4 h-4 text-green-500" />
                <span className="font-medium text-gray-700 dark:text-gray-300">{shareCount}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {isAuthenticated && (
            <Button
              className={`w-full bg-gradient-to-r from-[#00FB75] to-green-500 text-black font-bold hover:from-green-500 hover:to-emerald-500 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5`}
              onClick={handleContactClick}
            >
              Contact
              <MessageSquare className="w-4 h-4 ml-2" />
            </Button>
          )}
          <Link
            href={`/labs/${lab.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              className={`w-full bg-gradient-to-r from-[#00FB75] to-green-500 text-black font-bold hover:from-green-500 hover:to-emerald-500 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5`}
            >
              View Details
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}