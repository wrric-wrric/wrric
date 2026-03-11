"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import LikeButton from "@/components/Lab/LikeButton";
import CommentSection from "@/components/Lab/CommentSection";
import ShareButton from "@/components/Lab/ShareButton";
import FollowButton from "@/components/Lab/FollowButton";
import BookmarkButton from "@/components/Lab/BookmarkButton";
import InquiryModal from "@/components/Lab/InquiryModal";
import AuthPrompt from "@/components/ui/auth-prompt";
import { clsx } from "clsx";
import {
  Building,
  MapPin,
  Globe,
  Mail,
  User,
  Calendar,
  ArrowLeft,
  Edit,
  FlaskConical,
  Target,
  Award,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  X,
  Play,
  Pause,
  Users,
  BookOpen,
  User2,
  Linkedin,
  Phone,
  NotebookTabs,
  Tags,
  FileText,
  ExternalLink,
  ChevronRight as ChevronRightIcon,
  Eye,
  Heart,
  Share2,
  BadgeCheck,
  MessageSquare,
  Star,
  BarChart3,
  GraduationCap,
  CheckCircle,
  Shield,
  Microscope,
  Cpu,
  Zap,
  Battery,
  Leaf,
} from "lucide-react";

interface LabProfile {
  id: string;
  university: string;
  research_abstract: string;
  location: {
    city?: string;
    country?: string;
    address?: string;
  };
  department: {
    name?: string;
    faculty?: string;
    focus?: string;
  };
  point_of_contact: {
    name?: string;
    email?: string;
    phone?: string;
    position?: string;
    title?: string;
    contact?: string;
  };
  scopes: string[];
  lab_equipment: {
    items?: string[];
    description?: string;
  };
  climate_tech_focus: string[];
  climate_impact_metrics: {
    description?: string;
    targets?: string[];
  };
  website?: string;
  url?: string;
  images: Array<{
    id: string;
    url: string;
    caption?: string;
    is_primary: boolean;
  }>;
  timestamp: string;
  last_updated: string;
  publications_meta?: {
    count?: number;
    google_scholar_url?: string;
  };
  edurank?: {
    score?: number;
    url?: string;
  };
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
  profile_id?: string;
  profile?: {
    id: string; user_id: string; is_default: boolean; type: string;
    display_name?: string | null; first_name?: string | null; last_name?: string | null;
    title?: string | null; organization?: string | null; bio?: string; profile_image?: string | null;
  };
  partner?: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    is_verified: boolean;
  } | null;
}

function getProfileDisplayName(profile: LabProfile['profile']): string {
  if (!profile) return "Unknown";
  if (profile.display_name) return profile.display_name;
  const parts = [profile.first_name, profile.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Unnamed Profile";
}

interface RelatedLab {
  id: string;
  university: string;
  location: Record<string, string>;
  department: Record<string, string>;
  like_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
}

// Enhanced Creative Image Gallery Component with Fallbacks
function CreativeImageGallery({ images, labName }: { images: LabProfile['images']; labName: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout>();

  // Filter out images that failed to load - handle undefined images
  const validImages = (images || []).filter(img => !imageErrors.has(img.id));

  // Auto-play slideshow
  useEffect(() => {
    if (isPlaying && validImages.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % validImages.length);
      }, 4000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isPlaying, validImages.length]);

  const handleImageError = (imageId: string) => {
    setImageErrors(prev => new Set(prev.add(imageId)));
  };

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % validImages.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
  };

  const openLightbox = (index: number) => {
    if (validImages.length > 0) {
      setLightboxIndex(index);
      setShowLightbox(true);
      setIsPlaying(false);
    }
  };

  const closeLightbox = () => {
    setShowLightbox(false);
    setZoomLevel(1);
  };

  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));

  // Research area icons mapping
  const researchIcons: Record<string, React.ReactNode> = {
    energy: <Zap className="w-4 h-4 sm:w-5 sm:h-5" />,
    battery: <Battery className="w-4 h-4 sm:w-5 sm:h-5" />,
    climate: <Leaf className="w-4 h-4 sm:w-5 sm:h-5" />,
    computing: <Cpu className="w-4 h-4 sm:w-5 sm:h-5" />,
    default: <FlaskConical className="w-4 h-4 sm:w-5 sm:h-5" />,
  };

  const getResearchIcon = (focus: string = "") => {
    const lowerFocus = focus.toLowerCase();
    for (const [key, icon] of Object.entries(researchIcons)) {
      if (lowerFocus.includes(key)) return icon;
    }
    return researchIcons.default;
  };

  if (validImages.length === 0) {
    return (
      <div className="w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-2xl flex items-center justify-center">
        <div className="text-center">
          <FlaskConical className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400">No images available</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Laboratory visual documentation coming soon
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Main Gallery */}
      <div className="relative w-full h-96 rounded-2xl overflow-hidden group">
        {/* Current Image */}
        <div 
          className="w-full h-full transition-transform duration-500 ease-out cursor-zoom-in"
          style={{ transform: `scale(${zoomLevel})` }}
          onClick={() => openLightbox(currentIndex)}
        >
          <img
            src={validImages[currentIndex].url}
            alt={validImages[currentIndex].caption || labName}
            className="w-full h-full object-cover"
            onError={() => handleImageError(validImages[currentIndex].id)}
          />
        </div>

        {/* Image Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-4 left-4 right-4">
            {validImages[currentIndex].caption && (
              <p className="text-white text-sm font-medium truncate">
                {validImages[currentIndex].caption}
              </p>
            )}
            <p className="text-white/80 text-xs">
              {currentIndex + 1} of {validImages.length}
            </p>
          </div>
        </div>

        {/* Navigation Controls */}
        {validImages.length > 1 && (
          <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={prevImage}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all hover:scale-110"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={nextImage}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all hover:scale-110"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {/* Play/Pause */}
          {validImages.length > 1 && (
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-8 h-8 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all hover:scale-110"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          )}
          
          {/* Zoom Controls */}
          <button
            onClick={zoomOut}
            disabled={zoomLevel <= 0.5}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all hover:scale-110 disabled:opacity-50"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={zoomIn}
            disabled={zoomLevel >= 3}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all hover:scale-110 disabled:opacity-50"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Thumbnail Strip */}
        {validImages.length > 1 && (
          <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 flex gap-2">
            {validImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentIndex 
                    ? 'bg-white scale-125' 
                    : 'bg-white/50 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Image Grid Preview */}
      {validImages.length > 1 && (
        <div className="mt-4">
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
            {validImages.map((image, index) => (
              <div
                key={image.id}
                className={`aspect-square rounded-lg overflow-hidden cursor-pointer transition-all ${
                  index === currentIndex 
                    ? 'ring-2 ring-[#00FB75] scale-105' 
                    : 'hover:scale-105'
                }`}
                onClick={() => setCurrentIndex(index)}
              >
                <img
                  src={image.url}
                  alt={image.caption || labName}
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(image.id)}
                />
                {image.is_primary && (
                  <div className="absolute top-1 left-1 bg-[#00FB75] text-black text-xs px-1.5 py-0.5 rounded-full font-medium">
                    Primary
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {showLightbox && validImages.length > 0 && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-7xl max-h-full">
            {/* Close Button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all hover:scale-110"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Lightbox Image */}
            <div className="relative">
              <img
                src={validImages[lightboxIndex].url}
                alt={validImages[lightboxIndex].caption || labName}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
                style={{ transform: `scale(${zoomLevel})` }}
                onError={() => {
                  handleImageError(validImages[lightboxIndex].id);
                  closeLightbox();
                }}
              />
              
              {/* Lightbox Controls */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                <button
                  onClick={() => setLightboxIndex((prev) => (prev - 1 + validImages.length) % validImages.length)}
                  className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all hover:scale-110"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                
                <button
                  onClick={zoomOut}
                  disabled={zoomLevel <= 0.5}
                  className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all hover:scale-110 disabled:opacity-50"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                
                <button
                  onClick={zoomIn}
                  disabled={zoomLevel >= 3}
                  className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all hover:scale-110 disabled:opacity-50"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => setLightboxIndex((prev) => (prev + 1) % validImages.length)}
                  className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all hover:scale-110"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>

              {/* Lightbox Thumbnails */}
              <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 flex gap-2">
                {validImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setLightboxIndex(index)}
                    className={`w-3 h-3 rounded-full transition-all ${
                      index === lightboxIndex 
                        ? 'bg-white scale-125' 
                        : 'bg-white/50 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Lightbox Caption */}
            {validImages[lightboxIndex].caption && (
              <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 text-white text-center max-w-2xl">
                <p className="text-lg font-medium bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
                  {validImages[lightboxIndex].caption}
                </p>
              </div>
            )}

            {/* Image Counter */}
            <div className="absolute top-4 left-4 text-white bg-black/50 backdrop-blur-sm rounded-full px-3 py-1 text-sm">
              {lightboxIndex + 1} / {validImages.length}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Reusable Info Card Component
const InfoCard = ({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className={`rounded-2xl p-6 ${isDark ? "bg-gray-900" : "bg-white shadow-lg"} ${className}`}>
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-3">
        <div className="p-2 bg-[#00FB75] rounded-lg">
          {icon}
        </div>
        {title}
      </h3>
      {children}
    </div>
  );
};

// Stat Card Component
const StatCard = ({
  value,
  label,
  icon,
  className = "",
}: {
  value: string;
  label: string;
  icon: React.ReactNode;
  className?: string;
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className={`rounded-xl p-4 text-center ${isDark ? "bg-gray-800" : "bg-gray-50"} ${className}`}>
      <div className="text-[#00FB75] mb-2 flex justify-center">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
    </div>
  );
};

export default function LabDetailsPage() {
  const { lab } = useParams();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  
  // Validate lab parameter - prevent routes like "map" from being processed
  useEffect(() => {
    if (lab && typeof lab === 'string') {
      // List of reserved paths that should not be treated as lab IDs
      const reservedPaths = ['map', 'liked', 'new', 'analytics'];
      if (reservedPaths.includes(lab.toLowerCase())) {
        router.push(`/${lab}`);
        return;
      }
    }
  }, [lab, router]);
  
  const [mounted, setMounted] = useState(false);
  const [labData, setLabData] = useState<LabProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [relatedLabs, setRelatedLabs] = useState<RelatedLab[]>([]);
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [inquiryText, setInquiryText] = useState("");
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const [authAction, setAuthAction] = useState("");

  const isDark = mounted ? resolvedTheme === "dark" : false;

  // Research area icons mapping
  const researchIcons: Record<string, React.ReactNode> = {
    energy: <Zap className="w-4 h-4 sm:w-5 sm:h-5" />,
    battery: <Battery className="w-4 h-4 sm:w-5 sm:h-5" />,
    climate: <Leaf className="w-4 h-4 sm:w-5 sm:h-5" />,
    computing: <Cpu className="w-4 h-4 sm:w-5 sm:h-5" />,
    default: <FlaskConical className="w-4 h-4 sm:w-5 sm:h-5" />,
  };

  const getResearchIcon = (focus: string = "") => {
    const lowerFocus = focus.toLowerCase();
    for (const [key, icon] of Object.entries(researchIcons)) {
      if (lowerFocus.includes(key)) return icon;
    }
    return researchIcons.default;
  };

  // Fix hydration
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setToken(localStorage.getItem("token"));
      setUserId(localStorage.getItem("user_id"));
    }
  }, []);

  // Extract domain and get favicon
  const extractDomain = (url: string): string | null => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname;
    } catch (e) {
      return null;
    }
  };

  const getFavicon = useCallback((url: string): string => {
    const domain = extractDomain(url);
    return domain
      ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
      : "";
  }, []);

  useEffect(() => {
    const fetchLab = async () => {
      try {
        const rawToken = localStorage.getItem("token") || sessionStorage.getItem("token");
        const token = rawToken && rawToken !== "null" && rawToken !== "undefined" ? rawToken : null;
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const response = await fetch(`/api/labs/${lab}`, { headers });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setLabData(data);

        if (data.url) {
          setFaviconUrl(getFavicon(data.url));
        }

        // Fetch like status
        try {
          const likeUrl = token
            ? `/api/labs/${lab}/likes/check`
            : `/api/labs/${lab}/likes`;
          const likeRes = await fetch(likeUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (likeRes.ok) {
            const likeData = await likeRes.json();
            setLikeCount(likeData.count ?? 0);
            setIsLiked(likeData.liked ?? false);
          }
        } catch {}

        // Fetch follow status
        try {
          const followUrl = token
            ? `/api/follow/status/check?target_type=lab&target_id=${data.id}`
            : `/api/follow/status?target_type=lab&target_id=${data.id}`;
          const followRes = await fetch(followUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (followRes.ok) {
            const followData = await followRes.json();
            setFollowerCount(followData.follower_count ?? 0);
            setIsFollowing(followData.is_following ?? false);
          }
        } catch {}

        // Fetch related labs
        try {
          const relatedRes = await fetch(`/api/labs/${lab}/related?limit=6`);
          if (relatedRes.ok) {
            const relatedData = await relatedRes.json();
            setRelatedLabs(relatedData.items || []);
          }
        } catch {}
      } catch (error) {
        console.error("Fetch lab error:", error);
        toast.error("Failed to load lab details");
        router.push("/labs");
      } finally {
        setLoading(false);
      }
    };
    fetchLab();
  }, [lab, router, getFavicon]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatEmptyData = (field: string, fallback: string = "Information not available") => (
    <span className={`italic text-sm ${isDark ? "text-gray-500" : "text-gray-500"}`}>
      {fallback}
    </span>
  );

  const handleInquirySubmit = async () => {
    if (!inquiryText.trim() || !labData) return;
    const u_id = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
    try {
      await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: u_id, labId: labData.id, inquiry: inquiryText }),
      });
      setShowInquiryModal(false);
      setInquiryText("");
      toast.success("Inquiry sent successfully!");
    } catch {
      toast.error("Failed to send inquiry");
    }
  };

  const handleContactClick = () => {
    if (!token || !userId) {
      setAuthAction("contact this lab");
      setIsAuthPromptOpen(true);
      return;
    }
    setShowInquiryModal(true);
  };

  if (!mounted || loading) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-black" : "bg-gray-50"}`}>
        <div className="container mx-auto px-6 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="animate-pulse space-y-6">
              <div className="h-96 bg-gray-200 rounded-2xl"></div>
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!labData) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"}`}>
        <div className="container mx-auto px-6 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <FlaskConical className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-lg opacity-70">Lab not found.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen overflow-y-auto ${isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"}`}>
      <InquiryModal
        showInquiryModal={showInquiryModal}
        setShowInquiryModal={setShowInquiryModal}
        inquiryText={inquiryText}
        setInquiryText={setInquiryText}
        handleInquirySubmit={handleInquirySubmit}
        labId={labData?.id || null}
      />

      {isAuthPromptOpen && (
        <AuthPrompt action={authAction} onClose={() => setIsAuthPromptOpen(false)} />
      )}

      {/* Header */}
      <div className={`border-b ${isDark ? "border-gray-800" : "border-gray-200"}`}>
        <div className="container mx-auto px-6 py-4">
          {/* Breadcrumb (U-3.1.5) */}
          <nav className="flex items-center gap-1.5 text-sm mb-3">
            <Link href="/labs" className="text-gray-500 hover:text-[#00FB75] transition-colors">
              Labs
            </Link>
            {labData.partner && (
              <>
                <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400" />
                <Link href={`/partners/${labData.partner.slug}`} className="text-gray-500 hover:text-[#00FB75] transition-colors">
                  {labData.partner.name}
                </Link>
              </>
            )}
            <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400" />
            <span className={isDark ? "text-white" : "text-gray-900"}>{labData.university}</span>
          </nav>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">Lab Details</h1>
                  {/* Partner badge (U-3.1.4) */}
                  {labData.partner && (
                    <Link
                      href={`/partners/${labData.partner.slug}`}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00FB75]/10 text-[#00FB75] text-xs font-medium hover:bg-[#00FB75]/20 transition-colors"
                    >
                      <BadgeCheck className="w-3.5 h-3.5" />
                      {labData.partner.name}
                    </Link>
                  )}
                </div>
                <p className="text-sm opacity-70">Research laboratory information</p>
              </div>
            </div>
            {token && userId && (
              <button
                onClick={() => router.push(`/user-labs/${labData.id}/edit`)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isDark 
                    ? "bg-gray-800 hover:bg-gray-700 text-white" 
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                <Edit className="w-4 h-4" />
                Edit Lab
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Creative Image Gallery */}
          <div className={`rounded-2xl p-6 ${isDark ? "bg-gray-900" : "bg-white shadow-lg"}`}>
            <CreativeImageGallery images={labData.images} labName={labData.university} />
          </div>

          {/* Lab Header Info */}
          <div className={`rounded-2xl p-8 ${isDark ? "bg-gray-900" : "bg-white shadow-lg"}`}>
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* Lab Info */}
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-6">
                  <div className={`rounded-full border-4 border-[#00FB75] ${
                    isDark ? "bg-[#222]" : "bg-gray-200"
                  } flex items-center justify-center w-16 h-16`}>
                    {faviconUrl ? (
                      <Image
                        src={faviconUrl}
                        alt={`${labData.university} favicon`}
                        width={48}
                        height={48}
                        className="rounded-full object-cover"
                        onError={() => setFaviconUrl(null)}
                      />
                    ) : (
                      <FlaskConical className="w-8 h-8 text-[#00FB75]" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-[#00FB75] to-green-400 bg-clip-text text-transparent">
                      {labData.university}
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {labData.department?.focus && (
                        <div className="flex items-center gap-1 bg-[#00FB75] bg-opacity-20 text-[#00FB75] px-3 py-1 rounded-full text-sm">
                          {getResearchIcon(labData.department.focus)}
                          <span>{labData.department.focus}</span>
                        </div>
                      )}
                      {labData.location?.country && (
                        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                          isDark ? "bg-[#333] text-gray-300" : "bg-gray-200 text-gray-700"
                        }`}>
                          <MapPin className="w-4 h-4" />
                          <span>{labData.location.country}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4 flex-wrap">
                    <LikeButton
                      entityId={labData.id}
                      initialCount={likeCount}
                      initialLiked={isLiked}
                      isAuthenticated={!!token}
                      onAuthRequired={() => toast.error("Please log in to like labs")}
                      size="lg"
                    />
                    <ShareButton
                      entityId={labData.id}
                      labName={labData.university}
                      size="lg"
                    />
                    <FollowButton
                      targetType="lab"
                      targetId={labData.id}
                      isAuthenticated={!!token}
                      onAuthRequired={() => toast.error("Please log in to follow labs")}
                      initialFollowing={isFollowing}
                      initialCount={followerCount}
                      size="md"
                    />
                    <BookmarkButton
                      entityId={labData.id}
                      isAuthenticated={!!token}
                      onAuthRequired={() => toast.error("Please log in to bookmark labs")}
                      size="lg"
                    />
                    {/* View count (U-3.1.1) */}
                    <span className={`flex items-center gap-1.5 text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      <Eye className="w-5 h-5" />
                      {labData.view_count ?? 0} views
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    {labData.department?.name && (
                      <div className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <Building className="w-6 h-6 text-[#00FB75] flex-shrink-0" />
                        <div>
                          <p className="font-semibold">{labData.department.name}</p>
                          {labData.department.faculty && (
                            <p className="text-sm opacity-70 mt-1">{labData.department.faculty}</p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {(labData.location?.city || labData.location?.country) && (
                      <div className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <MapPin className="w-6 h-6 text-[#00FB75] flex-shrink-0" />
                        <div>
                          <p className="font-semibold">
                            {[labData.location.city, labData.location.country].filter(Boolean).join(', ')}
                          </p>
                          {labData.location.address && (
                            <p className="text-sm opacity-70 mt-1">{labData.location.address}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <Calendar className="w-6 h-6 text-[#00FB75] flex-shrink-0" />
                      <div>
                        <p className="font-semibold">Last Updated</p>
                        <p className="text-sm opacity-70 mt-1">{formatDate(labData.last_updated)}</p>
                      </div>
                    </div>
                    
                    {(labData.website || labData.url) && (
                      <div className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <Globe className="w-6 h-6 text-[#00FB75] flex-shrink-0" />
                        <div>
                          <p className="font-semibold">Website</p>
                          <a 
                            href={labData.website || labData.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-[#00FB75] hover:underline mt-1 block"
                          >
                            Visit Website
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Info Card */}
              {labData.point_of_contact?.name && (
                <div className={`lg:w-80 rounded-xl p-6 ${
                  isDark ? "bg-gray-800 border border-gray-700" : "bg-gradient-to-br from-green-50 to-blue-50 border border-green-100"
                }`}>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-[#00FB75]" />
                    Contact Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm opacity-70">Name</p>
                      <p className="font-semibold">{labData.point_of_contact.name}</p>
                    </div>
                    {(labData.point_of_contact.position || labData.point_of_contact.title) && (
                      <div>
                        <p className="font-medium text-sm opacity-70">Position</p>
                        <p className="font-semibold">{labData.point_of_contact.position || labData.point_of_contact.title}</p>
                      </div>
                    )}
                    {(labData.point_of_contact.email || labData.point_of_contact.contact) && (
                      <div className="space-y-2">
                        {labData.point_of_contact.email && (
                          <div>
                            <p className="font-medium text-sm opacity-70">Email</p>
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 opacity-70" />
                              <a 
                                href={`mailto:${labData.point_of_contact.email}`}
                                className="font-semibold text-[#00FB75] hover:underline text-sm"
                              >
                                {labData.point_of_contact.email}
                              </a>
                            </div>
                          </div>
                        )}
                        {(labData.point_of_contact.phone || labData.point_of_contact.contact) && (
                          <div>
                            <p className="font-medium text-sm opacity-70">Phone</p>
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 opacity-70" />
                              <span className="font-semibold text-sm">
                                {labData.point_of_contact.phone || labData.point_of_contact.contact}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Research Abstract */}
              <InfoCard
                title="Research Abstract"
                icon={<FileText className="w-6 h-6" />}
              >
                {labData.research_abstract ? (
                  <p className={`leading-relaxed whitespace-pre-wrap text-lg ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}>
                    {labData.research_abstract}
                  </p>
                ) : (
                  formatEmptyData(
                    "research_abstract",
                    "A detailed research abstract is being prepared and will be available shortly."
                  )
                )}
              </InfoCard>

              {/* Research Scopes */}
              {labData.scopes && labData.scopes.length > 0 && (
                <InfoCard
                  title="Research Scopes"
                  icon={<Target className="w-6 h-6" />}
                >
                  <div className="space-y-3">
                    <p className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      Our laboratory specializes in the following cutting-edge research areas:
                    </p>
                    <ul className="space-y-2">
                      {labData.scopes.map((scope, idx) => (
                        <li key={idx} className="flex items-start group">
                          <div className="bg-[#00FB75] bg-opacity-20 p-1 rounded-full mr-3">
                            <ChevronRightIcon className="w-4 h-4 text-[#00FB75] group-hover:translate-x-1 transition-transform" />
                          </div>
                          <span className={`text-base ${
                            isDark
                              ? "text-white group-hover:text-[#00FB75]"
                              : "text-black group-hover:text-[#00FB75]"
                          } transition-colors`}>
                            {scope}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </InfoCard>
              )}

              {/* Lab Equipment */}
              {(labData.lab_equipment?.items && labData.lab_equipment.items.length > 0) && (
                <InfoCard
                  title="Lab Equipment"
                  icon={<FlaskConical className="w-6 h-6" />}
                >
                  {labData.lab_equipment.description && (
                    <p className={`mb-6 text-lg ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      {labData.lab_equipment.description}
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {labData.lab_equipment.items.map((item, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-all hover:scale-105 ${
                          isDark 
                            ? "bg-purple-500/20 border border-purple-500/30" 
                            : "bg-purple-50 border border-purple-200"
                        }`}
                      >
                        <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0"></div>
                        <span className="font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                </InfoCard>
              )}

              {/* Publications & Resources */}
              {(labData.publications_meta?.google_scholar_url || labData.url || labData.edurank?.url) && (
                <InfoCard
                  title="Publications & Resources"
                  icon={<BookOpen className="w-6 h-6" />}
                >
                  <div className="space-y-4">
                    {labData.publications_meta?.google_scholar_url && (
                      <a
                        href={labData.publications_meta.google_scholar_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 p-4 rounded-lg transition-all duration-200 group ${
                          isDark
                            ? "bg-[#222] hover:bg-[#00FB75] hover:text-black"
                            : "bg-gray-200 hover:bg-[#00FB75] hover:text-black"
                        }`}
                      >
                        <div className="bg-[#00FB75] text-black p-2 rounded-full">
                          <GraduationCap className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-base">
                            Google Scholar Profile
                          </div>
                          <div className={`text-sm ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          } group-hover:text-black`}>
                            Access publications and research papers
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                      </a>
                    )}

                    {labData.url && (
                      <a
                        href={labData.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 p-4 rounded-lg transition-all duration-200 group ${
                          isDark
                            ? "bg-[#222] hover:bg-[#00FB75] hover:text-black"
                            : "bg-gray-200 hover:bg-[#00FB75] hover:text-black"
                        }`}
                      >
                        <div className="bg-[#00FB75] text-black p-2 rounded-full">
                          <Globe className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-base">
                            Research Portal
                          </div>
                          <div className={`text-sm ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          } group-hover:text-black`}>
                            Visit official research resources
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                      </a>
                    )}

                    {labData.edurank?.url && (
                      <a
                        href={labData.edurank.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 p-4 rounded-lg transition-all duration-200 group ${
                          isDark
                            ? "bg-[#222] hover:bg-[#00FB75] hover:text-black"
                            : "bg-gray-200 hover:bg-[#00FB75] hover:text-black"
                        }`}
                      >
                        <div className="bg-[#00FB75] text-black p-2 rounded-full">
                          <Award className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-base">
                            University Ranking
                          </div>
                          <div className={`text-sm ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          } group-hover:text-black`}>
                            View institutional standing and reputation
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                      </a>
                    )}
                  </div>
                </InfoCard>
              )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-8">
              {/* Research Metrics */}
              <InfoCard
                title="Research Metrics"
                icon={<BarChart3 className="w-6 h-6" />}
              >
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    value={
                      labData.publications_meta?.count
                        ? `${labData.publications_meta.count}+`
                        : "N/A"
                    }
                    label="Publications"
                    icon={<FileText className="w-5 h-5" />}
                  />
                  <StatCard
                    value={labData.location?.country ? "Int'l" : "N/A"}
                    label="Collaboration"
                    icon={<Globe className="w-5 h-5" />}
                  />
                  <StatCard
                    value={
                      labData.scopes?.length
                        ? `${labData.scopes.length}`
                        : "N/A"
                    }
                    label="Research Areas"
                    icon={<Target className="w-5 h-5" />}
                  />
                  <StatCard
                    value={labData.edurank?.score ? "Top Tier" : "N/A"}
                    label="Excellence"
                    icon={<Star className="w-5 h-5" />}
                  />
                </div>
              </InfoCard>

              {/* Climate Tech Focus */}
              {labData.climate_tech_focus && labData.climate_tech_focus.length > 0 && (
                <InfoCard
                  title="Climate Tech Focus"
                  icon={<Award className="w-6 h-6" />}
                >
                  <div className="flex flex-wrap gap-2">
                    {labData.climate_tech_focus.map((focus, index) => (
                      <span
                        key={index}
                        className={`px-3 py-2 rounded-full text-sm font-medium transition-all hover:scale-105 ${
                          isDark 
                            ? "bg-green-500/20 text-green-300 border border-green-500/30" 
                            : "bg-green-100 text-green-700 border border-green-200"
                        }`}
                      >
                        {focus}
                      </span>
                    ))}
                  </div>
                </InfoCard>
              )}

              {/* Climate Impact Metrics */}
              {labData.climate_impact_metrics && (
                <InfoCard
                  title="Climate Impact"
                  icon={<Leaf className="w-6 h-6" />}
                >
                  {labData.climate_impact_metrics.description && (
                    <p className={`mb-4 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      {labData.climate_impact_metrics.description}
                    </p>
                  )}
                  {labData.climate_impact_metrics.targets && labData.climate_impact_metrics.targets.length > 0 && (
                    <ul className={`space-y-3 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      {labData.climate_impact_metrics.targets.map((target, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-[#00FB75] rounded-full mt-2 flex-shrink-0" />
                          <span className="flex-1">{target}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </InfoCard>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleContactClick}
                  className="w-full flex items-center justify-center gap-2 bg-[#00FB75] hover:bg-[#00e065] text-black font-bold py-3 text-base transition-all duration-200 transform hover:scale-105 rounded-xl"
                >
                  <MessageSquare className="w-5 h-5" />
                  Contact Lab
                </button>
                <a
                  href={labData.website || labData.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full flex items-center justify-center gap-2 bg-transparent hover:bg-[#222] border-2 border-[#00FB75] text-[#00FB75] font-bold py-3 text-base transition-all duration-200 rounded-xl`}
                >
                  <Globe className="w-5 h-5" />
                  Visit Website
                </a>
              </div>

              {/* Lab Creator */}
              {labData.profile && (
                <div className={`rounded-xl p-6 ${isDark ? "bg-gray-900" : "bg-white shadow-lg"}`}>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-[#00FB75]" />
                    Lab Creator
                  </h3>
                  <div className="flex gap-4 items-start">
                    <div className="flex-shrink-0">
                      {labData.profile.profile_image ? (
                        <img src={labData.profile.profile_image} alt={getProfileDisplayName(labData.profile)} className="w-16 h-16 rounded-full object-cover border-2 border-[#00FB75]" />
                      ) : (
                        <div className="w-16 h-16 rounded-full border-2 border-[#00FB75] bg-gray-700 flex items-center justify-center">
                          <User className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{getProfileDisplayName(labData.profile)}</h4>
                        {labData.profile.is_default && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-[#00FB75] text-black text-xs rounded-full font-medium">
                            <Star className="w-3 h-3" />Default
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {labData.profile.type && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700"}`}>
                            {labData.profile.type.replace("_", " ")}
                          </span>
                        )}
                        {labData.profile.title && (
                          <span className={`px-2 py-0.5 rounded-full text-xs ${isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"}`}>
                            {labData.profile.title}
                          </span>
                        )}
                      </div>
                      {labData.profile.bio && (
                        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>{labData.profile.bio}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Related Labs (U-3.1.3) */}
          {relatedLabs.length > 0 && (
            <div className={`rounded-2xl p-6 ${isDark ? "bg-gray-900" : "bg-white shadow-lg"}`}>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-3">
                <div className="p-2 bg-[#00FB75] rounded-lg">
                  <FlaskConical className="w-6 h-6" />
                </div>
                Related Labs
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {relatedLabs.map((rl) => (
                  <Link
                    key={rl.id}
                    href={`/labs/${rl.id}`}
                    className={`block p-4 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-md ${
                      isDark
                        ? "border-gray-700 hover:border-[#00FB75]/50 bg-gray-800"
                        : "border-gray-200 hover:border-green-200 bg-gray-50"
                    }`}
                  >
                    <p className="font-medium truncate mb-1">{rl.university || "Research Lab"}</p>
                    <p className={`text-xs truncate mb-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      {rl.location?.city && rl.location?.country
                        ? `${rl.location.city}, ${rl.location.country}`
                        : rl.department?.focus || ""}
                    </p>
                    <div className={`flex items-center gap-3 text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{rl.like_count}</span>
                      <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3" />{rl.comment_count}</span>
                      <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{rl.view_count}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Comment Section */}
          <div id="comments" />
          <CommentSection
            entityId={labData.id}
            isAuthenticated={!!token}
            currentUserId={userId}
            onAuthRequired={() => {
              setAuthAction("comment on a lab");
              setIsAuthPromptOpen(true);
            }}
          />
        </div>
      </div>
    </div>
  );
}