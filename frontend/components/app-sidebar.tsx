"use client";

import {
  Book,
  FlaskConical,
  UserPlus,
  LogIn,
  User,
  History,
  PlusSquare,
  ClipboardList,
  Sun,
  Moon,
  Menu,
  ChevronFirst,
  ChevronLast,
  LogOut,
  Trash2,
  Share2,
  Download,
  Building,
  MessageSquare,
  Bell,
  Target,
  FileText,
  Mail,
  ChevronDown,
  Clock,
  Map,
  Calendar,
  LayoutDashboard,
  Star,
  Users,
  Search,
  Rss,
  Heart,
  Bookmark,
  Award,
} from "lucide-react";
import { useSidebar } from "../hooks/sideBarProvider";
import Image from "next/image";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTheme } from "next-themes";
import { useRouter, usePathname } from "next/navigation";
import FeedbackModal from "./feedback/FeedbackModal";
import { ShareLinkPopup } from "./ui/share-link-popup";
import Link from "next/link";
import { checkAdminAccess } from "@/utils/auth";
import { getUserId, clearAuthCookies } from "@/utils/auth-cookies";
import toast from "react-hot-toast";
import type { LabProfile } from "../lib/types";
import type { Profile as UserProfile, LoginResponse } from "@/types/profile";
import { getProfileDisplayName } from "@/types/message";
import NotificationBell from "@/components/auxiliaries/NotificationBell";

interface Session {
  id: string;
  title: string;
  start_time: string;
  queries: { query_text: string; timestamp: string }[];
  entities: LabProfile[];
}

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  requiresAuth?: boolean;
  requiresProfile?: boolean;
  requiresFunder?: boolean;
  requiresAdmin?: boolean;
  requiresJudge?: boolean;
}

const baseItems: MenuItem[] = [
  { title: "Mapped Labs", url: "/map", icon: Map },
  { title: "Discover Labs", url: "/labs", icon: FlaskConical },
  { title: "Ecosystem", url: "/ecosystem", icon: Users },
  {
    title: "Your Labs",
    url: "/user-labs",
    icon: ClipboardList,
    requiresAuth: true,
  },
  { title: "Add Lab", url: "/user-labs/new", icon: PlusSquare, requiresAuth: true },
  { title: "My Profiles", url: "/profiles", icon: User, requiresAuth: true },
  { title: "Events", url: "/events", icon: Calendar },
];

const guestItems: MenuItem[] = [
  { title: "Register", url: "/auth/register", icon: UserPlus },
  { title: "Login", url: "/auth/login", icon: LogIn },
];

const authItems: MenuItem[] = [
  { title: "Logout", url: "/logout", icon: LogOut },
];

const messagesItems: MenuItem[] = [
  { title: "Messages", url: "/auxiliaries/messages", icon: MessageSquare, requiresAuth: true },
];

const partnerItems: MenuItem[] = [
  { title: "Partners", url: "/partners", icon: Building },
  { title: "My Partner", url: "/partners/me", icon: Building, requiresAuth: true },
];

const socialItems: MenuItem[] = [
  { title: "Search", url: "/search", icon: Search },
  { title: "Feed", url: "/feed", icon: Rss },
  { title: "Liked Labs", url: "/labs/liked", icon: Heart, requiresAuth: true },
  { title: "Following", url: "/following", icon: UserPlus, requiresAuth: true },
  { title: "Bookmarks", url: "/bookmarks", icon: Bookmark, requiresAuth: true },
];

const funderItems: MenuItem[] = [
  { title: "Review Proposals", url: "/funders/proposals", icon: FileText, requiresAuth: true, requiresFunder: true },
  { title: "Match Management", url: "/funders/matches", icon: Target, requiresAuth: true, requiresFunder: true },
];

const adminItems: MenuItem[] = [
  { title: "Admin Dashboard", url: "/admin/events", icon: LayoutDashboard, requiresAuth: true, requiresAdmin: true },
];

const judgeItems: MenuItem[] = [
  { title: "Judge Portal", url: "/judge", icon: Award, requiresAuth: true, requiresJudge: true },
];

interface HistorySession {
  id: string;
  title: string;
  start_time: string;
  queries: { query_text: string; timestamp: string }[];
  entities: LabProfile[];
}

// History Flyout Component
function HistoryFlyout({
  history,
  onSessionClick,
  onShare,
  onDownload,
  onDelete,
  isOpen
}: {
  history: HistorySession[];
  onSessionClick: (session: HistorySession) => void;
  onShare: (sessionId: string, event: React.MouseEvent) => void;
  onDownload: (sessionId: string, event: React.MouseEvent) => void;
  onDelete: (sessionId: string, event: React.MouseEvent) => void;
  isOpen: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (!isOpen) return null;

  return (
    <div className={`
      absolute left-full top-0 ml-2 w-80 max-h-96 overflow-y-auto rounded-lg border shadow-lg z-50
      ${isDark
        ? "bg-gray-900 border-gray-700 text-white"
        : "bg-white border-gray-200 text-black"
      }
    `}>
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Recent Sessions
        </h3>
      </div>

      <div className="p-2 max-h-80 overflow-y-auto">
        {(!Array.isArray(history) || history.length === 0) ? (
          <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
            No query history available.
          </div>
        ) : (
          <div className="space-y-1">
            {history.slice(0, 10).map((session) => (
              <div
                key={session.id}
                className="group relative p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                onClick={() => onSessionClick(session)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {session.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(session.start_time).toLocaleDateString()} •
                      {session.queries.length} queries
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShare(session.id, e);
                      }}
                      className="p-1 hover:bg-blue-500 hover:text-white rounded transition-colors"
                      title="Share session"
                    >
                      <Share2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownload(session.id, e);
                      }}
                      className="p-1 hover:bg-green-500 hover:text-white rounded transition-colors"
                      title="Download session"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(session.id, e);
                      }}
                      className="p-1 hover:bg-red-500 hover:text-white rounded transition-colors"
                      title="Delete session"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AppSidebar() {
  const { isSidebarOpen, toggleSidebar, history, loadSession, setHistory } = useSidebar();
  const [linkClicked, setLinkClicked] = useState<number | undefined>();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = mounted ? resolvedTheme === "dark" : false;
  const [sharePopup, setSharePopup] = useState({ isOpen: false, url: '' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFunder, setIsFunder] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isJudge, setIsJudge] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);
  const [historyHovered, setHistoryHovered] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [authChecked, setAuthChecked] = useState(false); // Track if initial auth check is done
  const authCheckRef = useRef(false); // Prevent duplicate auth checks
  const router = useRouter();

  // Get default profile to display — prefer userProfiles (has presigned image URLs) over loginData
  const defaultProfileId = loginData?.default_profile_id || userProfiles[0]?.id;
  const defaultProfile = (userProfiles.length > 0
    ? (userProfiles.find(p => p.id === defaultProfileId) || userProfiles[0])
    : loginData?.profiles?.find(p => p.id === loginData.default_profile_id)) || null;
  const pathname = usePathname();
  const historyRef = useRef<HTMLDivElement>(null);

  const getCookie = useCallback((name: string): string | null => {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(";").shift() || null;
    }
    return null;
  }, []);

  // Initial mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth check effect - runs once on mount and when auth state might change
  useEffect(() => {
    // Skip if not mounted or already checking
    if (!mounted || authCheckRef.current) return;

    const checkAuthAndProfile = async () => {
      if (typeof window === "undefined") return;

      authCheckRef.current = true;

      // Check cookies and localStorage for auth
      const userId = getCookie("user_id") || localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
      const authenticated = !!userId && userId !== "null" && userId !== "undefined";

      // Reset all state if not authenticated
      if (!authenticated) {
        setIsAuthenticated(false);
        setIsAdmin(false);
        setIsJudge(false);
        setIsFunder(false);
        setHasProfile(false);
        setUserProfiles([]);
        setLoginData(null);
        setAuthChecked(true);
        authCheckRef.current = false;
        return;
      }

      setIsAuthenticated(true);

      // Load login response data from localStorage if available
      const loginDataLocal = localStorage.getItem("login_response");
      if (loginDataLocal) {
        try {
          const data: LoginResponse = JSON.parse(loginDataLocal);
          setLoginData(data);
          // Pre-set admin and judge from cached login data if available
          if (data.is_admin) {
            setIsAdmin(true);
          }
          if (data.is_judge) {
            setIsJudge(true);
          }
        } catch (error) {
          console.error("Parse login data error:", error);
        }
      }

      const token = localStorage.getItem("token") || sessionStorage.getItem("token");

      // Run all checks in parallel for better performance
      const [profilesResult, adminResult, judgeResult] = await Promise.allSettled([
        // Fetch profiles
        fetch("/api/profiles", {
          headers: { Authorization: `Bearer ${token}` },
        }).then(async (res) => {
          if (res.ok) return res.json();
          return [];
        }),
        // Check admin access
        checkAdminAccess(),
        // Check judge access
        fetch("/api/judge/hackathons", {
          headers: { Authorization: `Bearer ${token}` },
        }).then(async (res) => {
          if (res.ok) {
            const hackathons = await res.json();
            return Array.isArray(hackathons) && hackathons.length > 0;
          }
          return false;
        }),
      ]);

      // Process profiles result
      if (profilesResult.status === "fulfilled") {
        const profiles: UserProfile[] = profilesResult.value;
        setUserProfiles(profiles);
        setHasProfile(profiles.length > 0);
        setIsFunder(profiles.some((profile) => profile.type === "funder"));
      }

      // Process admin result
      if (adminResult.status === "fulfilled") {
        console.log('[AppSidebar] Admin check result:', adminResult.value);
        setIsAdmin(adminResult.value);
      } else {
        console.error("[AppSidebar] Admin check failed:", adminResult.reason);
        setIsAdmin(false);
      }

      // Process judge result
      if (judgeResult.status === "fulfilled") {
        setIsJudge(judgeResult.value);
      } else {
        console.error("Judge check failed:", judgeResult.reason);
        setIsJudge(false);
      }

      setAuthChecked(true);
      authCheckRef.current = false;
    };

    checkAuthAndProfile();
  }, [getCookie, mounted]);

  // Re-check auth when pathname changes to auth routes (login/logout/register)
  useEffect(() => {
    if (pathname?.startsWith('/auth/')) {
      authCheckRef.current = false; // Allow re-check after auth actions
    }
  }, [pathname]);

  // Fetch unread message count once on mount, then use WebSocket for real-time updates
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wsReconnectAttempts = useRef(0);
  const maxWsReconnectAttempts = 3;

  useEffect(() => {
    if (!isAuthenticated || !authChecked) {
      setUnreadMessageCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const response = await fetch("/api/messages/unread-count", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUnreadMessageCount(data.total_unread || 0);
        }
      } catch (error) {
        console.error("Failed to fetch unread message count:", error);
      }
    };

    // Initial fetch only
    fetchUnreadCount();

    // WebSocket for real-time message updates - with proper authentication
    const setupWs = async () => {
      // Don't attempt if max retries reached
      if (wsReconnectAttempts.current >= maxWsReconnectAttempts) {
        console.log('[AppSidebar] Max WebSocket reconnect attempts reached, using polling fallback');
        return;
      }

      try {
        // Get token from server API (for HTTP-only cookie support)
        const tokenResponse = await fetch('/api/auth/token');
        let token: string | null = null;

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          token = tokenData.token;
        }

        // Fallback to localStorage/sessionStorage
        if (!token) {
          token = localStorage.getItem("token") || sessionStorage.getItem("token");
        }

        const userId = getCookie("user_id") || localStorage.getItem("user_id") || sessionStorage.getItem("user_id");

        if (!token || !userId) {
          console.warn('[AppSidebar] Missing token or userId for WebSocket connection');
          return;
        }

        const baseWsUrl = process.env.NEXT_PUBLIC_WS_URL || "wss://api.unlokinno.com/ws/messages";
        const wsUrl = `${baseWsUrl}?token=${encodeURIComponent(token)}&user_id=${encodeURIComponent(userId)}`;

        console.log('[AppSidebar] Connecting to WebSocket...');
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[AppSidebar] WebSocket connected successfully');
          wsReconnectAttempts.current = 0; // Reset on successful connection
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "new_message") {
              setUnreadMessageCount((prev) => prev + 1);
            }
          } catch { }
        };

        ws.onerror = (error) => {
          console.error('[AppSidebar] WebSocket error:', error);
        };

        ws.onclose = (event) => {
          console.log('[AppSidebar] WebSocket closed:', event.code, event.reason);
          wsRef.current = null;

          // Don't reconnect if auth failed (403) or normal closure
          if (event.code === 1008 || event.code === 1000 || event.code === 403) {
            console.log('[AppSidebar] WebSocket closed due to auth or normal closure, not reconnecting');
            return;
          }

          // Exponential backoff for reconnection
          wsReconnectAttempts.current++;
          if (wsReconnectAttempts.current < maxWsReconnectAttempts) {
            const delay = Math.min(5000 * Math.pow(2, wsReconnectAttempts.current), 30000);
            console.log(`[AppSidebar] Reconnecting WebSocket in ${delay}ms (attempt ${wsReconnectAttempts.current})`);
            wsReconnectTimeoutRef.current = setTimeout(setupWs, delay);
          }
        };
      } catch (error) {
        console.error('[AppSidebar] Failed to setup WebSocket:', error);
      }
    };

    setupWs();

    return () => {
      if (wsReconnectTimeoutRef.current) {
        clearTimeout(wsReconnectTimeoutRef.current);
        wsReconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
    };
  }, [isAuthenticated, authChecked, getCookie]);

  // Reset unread count when viewing messages
  useEffect(() => {
    if (pathname?.startsWith("/auxiliaries/messages") && isAuthenticated) {
      setUnreadMessageCount(0);
    }
  }, [pathname, isAuthenticated]);

  const handleLinkClick = (index: number) => setLinkClicked(index);

  const handleDarkModeToggle = () => setTheme(theme === "dark" ? "light" : "dark");

  // Build menu items based on user roles and authentication - memoized to prevent unnecessary rebuilds
  const menuItems: MenuItem[] = useMemo(() => {
    // If admin is logged in, only show admin items and auth items to maintain isolation
    if (isAuthenticated && isAdmin) {
      return [...adminItems, ...authItems];
    }

    let items = [...baseItems];

    // Add partner items (Partners is public, My Partner requires auth)
    items = [...items, ...partnerItems.filter(item => !item.requiresAuth || isAuthenticated)];

    // Add social items (some public, some require auth)
    items = [...items, ...socialItems.filter(item => !item.requiresAuth || isAuthenticated)];

    // Add Messages for all authenticated users
    if (isAuthenticated) {
      items = [...items, ...messagesItems];
    }

    // Add funder-specific features
    if (isAuthenticated && isFunder) {
      items.push({ title: "Funder", url: "/funders", icon: Building, requiresAuth: true });
    }

    // Add judge portal if user is a judge
    if (isAuthenticated && isJudge) {
      items = [...items, ...judgeItems];
    }

    // Add admin features if user is admin
    if (isAuthenticated && isAdmin) {
      items = [...items, ...adminItems];
    }

    // Add auth/guest items
    items = [...items, ...(isAuthenticated ? authItems : guestItems)];

    return items;
  }, [isAuthenticated, isFunder, isJudge, isAdmin]);

  const handleItemClick = (url: string, requiresAuth?: boolean, requiresProfile?: boolean, requiresFunder?: boolean, requiresAdmin?: boolean, requiresJudge?: boolean) => {
    if (requiresAuth && !isAuthenticated) {
      toast.error("Please log in or register to access this feature.");
      router.push(`/auth/login?redirect=${encodeURIComponent(url)}`);
      return;
    }

    if (requiresProfile && !hasProfile) {
      toast.error("Please create a profile to access this feature.");
      router.push("/profiles/new");
      return;
    }

    if (requiresFunder && !isFunder) {
      toast.error("You need a funder profile to access this feature.");
      router.push("/profiles/new?type=funder");
      return;
    }

    if (requiresAdmin && !isAdmin) {
      toast.error("You need admin access to view this page.");
      router.push("/");
      return;
    }

    if (requiresJudge && !isJudge) {
      toast.error("You are not assigned as a judge for any hackathons.");
      router.push("/");
      return;
    }

    if (url === "/logout") {
      router.push("/auth/logout");
      return;
    }

    const idx = menuItems.findIndex((item) => item.url === url);
    if (idx !== -1) handleLinkClick(idx);

    router.push(url);

    if (typeof window !== "undefined" && window.innerWidth < 768) toggleSidebar();
  };

  const handleDeleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!confirm(`Are you sure you want to delete this session?`)) {
      return;
    }

    const userId = getUserId();

    if (!userId) {
      toast.error("You must be logged in to delete sessions.");
      return;
    }

    const res = await fetch(`/api/history/${userId}/${sessionId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Failed to delete session:", res.status, errorText);
      throw new Error(`Failed to delete session: ${res.status}`);
    }

    toast.success("Session deleted successfully.");

    if (Array.isArray(history)) {
      const updatedHistory = history.filter((session) => session.id !== sessionId);
      setHistory(updatedHistory);
    }
  };

  const handleShareSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    const userId = getUserId();

    if (!userId) {
      toast.error("Please sign in to share sessions.");
      return;
    }

    toast.loading("Generating share link...", { id: "share-loading" });

    const response = await fetch(`/api/share/${sessionId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      toast.dismiss("share-loading");
      throw new Error(`Share failed: ${response.status}`);
    }

    const data = await response.json();

    const share_url = data.share_url || data.url;

    if (!share_url) {
      toast.dismiss("share-loading");
      throw new Error("No share URL returned from server");
    }

    const fullUrl = `${window.location.origin}${share_url}`;

    toast.dismiss("share-loading");

    try {
      await navigator.clipboard.writeText(fullUrl);
      toast.success("Share link copied to clipboard!");
      setSharePopup({ isOpen: true, url: fullUrl });
    } catch (clipboardError) {
      setSharePopup({ isOpen: true, url: fullUrl });
    }
  };

  const handleDownloadSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    const userId = getUserId();

    if (!userId) {
      toast.error("Please sign in to download sessions.");
      return;
    }

    const format = confirm("Download as Excel? (Cancel for CSV)") ? "excel" : "csv";

    const apiUrl = `/api/export/${sessionId}/${format}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Export failed: ${response.status}`);
    }

    const blob = await response.blob();

    if (blob.size === 0) {
      throw new Error("Empty file received");
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session_${sessionId}.${format === "excel" ? "xlsx" : "csv"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success("Session downloaded successfully!");
  };

  const handleSessionClick = (session: Session) => {
    if (typeof loadSession === "function") {
      loadSession(session);
      toast.success(`Loaded session: ${session.title}`);
    }
    setHistoryHovered(false);
  };

  // Get user role display text
  const getUserRoleText = () => {
    if (!isAuthenticated) return "";

    const roles = [];
    if (hasProfile) roles.push("Entrepreneur");
    if (isFunder) roles.push("Funder");

    return roles.length > 0 ? `(${roles.join(" / ")})` : "(No Profile)";
  };

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        className="fixed top-4 left-4 z-50 p-2 bg-[#00FB75] rounded-md text-black md:hidden"
        onClick={toggleSidebar}
        aria-label="Open sidebar"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`
          fixed md:hidden top-0 left-0 h-screen z-50 flex flex-col
          transform transition-transform duration-500 ease-in-out
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          w-80 flex-shrink-0 overflow-hidden glass border-r
          ${isDark ? "border-white/10" : "border-gray-200"}
        `}
      >
        {/* Mobile Header */}
        <div className="flex-shrink-0 mb-6 flex items-center justify-between p-4">
          <Link href="/labs" className="flex items-center gap-3">
            <Image
              src={isDark ? "/assets/logos/logo-white.png" : "/assets/logos/logo-black.png"}
              alt="WRRIC Logo"
              width={40}
              height={40}
              className="cursor-pointer hover:opacity-80 transition-opacity object-contain flex-shrink-0"
            />
            <span className="font-bold text-lg tracking-wide text-foreground">WRRIC Platform</span>
          </Link>
          <button
            onClick={toggleSidebar}
            className={`p-2 rounded-md ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
          >
            <span className={`text-2xl ${isDark ? "text-white" : "text-gray-900"}`}>×</span>
          </button>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex-1 overflow-y-auto px-4">
          <ul className="space-y-2">
            {menuItems.map((item, index) => (
              <li key={index}>
                <button
                  onClick={() => handleItemClick(
                    item.url,
                    item.requiresAuth,
                    (item as any).requiresProfile,
                    (item as any).requiresFunder,
                    (item as any).requiresAdmin,
                    (item as any).requiresJudge
                  )}
                  className={`
                    flex items-center space-x-2 p-3 rounded-xl w-full transition-all duration-300 group
                    ${pathname === item.url
                      ? "glass-emerald neon-border text-primary scale-[1.02]"
                      : "text-foreground hover:bg-white/5"
                    }
                  `}
                >
                  <div className="relative">
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {item.title === "Messages" && unreadMessageCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center min-w-[16px]">
                        {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium">{item.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mobile Footer */}
        <div className={`flex-shrink-0 pt-4 px-4 pb-4 border-t ${isDark ? "border-white/10" : "border-gray-200"}`}>
          <button
            onClick={handleDarkModeToggle}
            className={`flex items-center space-x-2 p-3 rounded-md w-full transition-colors ${isDark
              ? "text-white hover:bg-white/10"
              : "text-gray-900 hover:bg-gray-100"
              }`}
          >
            {mounted && theme === "dark" ? (
              <Sun className="w-5 h-5 text-[#00FB75]" />
            ) : (
              <Moon className="w-5 h-5 text-gray-900" />
            )}
            <span className="text-sm">
              {mounted && theme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          </button>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={`
          hidden md:flex flex-col h-[calc(100vh-2rem)] sticky top-4 left-4 z-40 
          glass rounded-3xl m-4 transition-all duration-500 ease-out overflow-hidden
          ${isSidebarOpen ? "w-72" : "w-20"}
          flex-shrink-0
        `}
      >
        {/* Header Section */}
        <div className="flex-shrink-0 mb-6 flex items-center justify-center md:justify-start">
          <Link href="/labs" className="flex items-center gap-3 w-full">
            <Image
              src={isDark ? "/assets/logos/logo-white.png" : "/assets/logos/logo-black.png"}
              alt="WRRIC Logo"
              width={40}
              height={40}
              priority
              className="cursor-pointer hover:opacity-80 transition-opacity object-contain flex-shrink-0"
            />
            {isSidebarOpen && <span className="font-bold text-lg tracking-wide hidden md:block text-foreground">WRRIC Platform</span>}
          </Link>
        </div>

        {/* User Status Display */}
        {isAuthenticated && isSidebarOpen && defaultProfile && (
          <div className="flex-shrink-0 mb-6 px-4">
            <div className="flex items-center gap-3 p-3 glass-emerald rounded-2xl animate-float">
              {/* Profile Image */}
              {defaultProfile.profile_image ? (
                <img
                  src={defaultProfile.profile_image}
                  alt={getProfileDisplayName(defaultProfile)}
                  className="w-10 h-10 rounded-full object-cover border-2 border-[#00FB75]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : loginData?.profile_image_url ? (
                <img
                  src={loginData.profile_image_url}
                  alt={getProfileDisplayName(defaultProfile)}
                  className="w-10 h-10 rounded-full object-cover border-2 border-[#00FB75]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={`w-10 h-10 rounded-full border-2 border-[#00FB75] bg-gray-700 flex items-center justify-center ${(defaultProfile.profile_image || loginData?.profile_image_url) ? 'hidden' : ''}`}>
                <User className="w-5 h-5 text-gray-400" />
              </div>

              {/* Profile Info */}
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium truncate">
                  {getProfileDisplayName(defaultProfile)}
                </div>
                <div className="text-xs opacity-70 flex items-center gap-1">
                  {defaultProfile.type && (
                    <>
                      <span className="capitalize">{defaultProfile.type.replace('_', ' ')}</span>
                      {defaultProfile.is_default && (
                        <Star className="w-3 h-3 fill-[#00FB75] text-[#00FB75]" />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toggle Button - Desktop Only */}
        <button
          className="flex-shrink-0 mb-4 p-2 rounded-md hover:bg-sidebar-accent transition-colors w-full justify-center hidden md:flex"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar width"
        >
          {isSidebarOpen ? (
            <ChevronFirst className="w-5 h-5" />
          ) : (
            <ChevronLast className="w-5 h-5" />
          )}
        </button>

        {/* Main Navigation - Scrollable */}
        <nav className={`flex-1 overflow-y-auto ${!isSidebarOpen ? 'no-scrollbar' : 'custom-scrollbar'}`}>
          <ul className="space-y-2">
            {menuItems.map((item, index) => (
              <li key={index} className="relative">
                {item.title === "History" && isAuthenticated ? (
                  <div
                    ref={historyRef}
                    onMouseEnter={() => setHistoryHovered(true)}
                    onMouseLeave={() => setHistoryHovered(false)}
                    className="relative"
                  >
                    <button
                      onClick={() => handleItemClick(
                        item.url,
                        item.requiresAuth,
                        (item as any).requiresProfile,
                        (item as any).requiresFunder,
                        (item as any).requiresAdmin,
                        (item as any).requiresJudge
                      )}
                      className={`
                        flex items-center space-x-2 p-2 hover:bg-[#00FB75] rounded-md w-full transition-all duration-200
                        ${linkClicked === index ? "bg-[#00FB75] text-black" : "text-sidebar-foreground"}
                        ${!isSidebarOpen ? "justify-center space-x-0" : ""}
                      `}
                      title={!isSidebarOpen ? item.title : undefined}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {isSidebarOpen && (
                        <>
                          <span className="text-sm font-medium flex-1 text-left">{item.title}</span>
                          <ChevronDown className={`w-4 h-4 transition-transform ${historyHovered ? 'rotate-180' : ''}`} />
                        </>
                      )}
                    </button>

                    {/* History Flyout */}
                    <HistoryFlyout
                      history={history}
                      onSessionClick={handleSessionClick}
                      onShare={handleShareSession}
                      onDownload={handleDownloadSession}
                      onDelete={handleDeleteSession}
                      isOpen={historyHovered && isAuthenticated}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => handleItemClick(
                      item.url,
                      item.requiresAuth,
                      (item as any).requiresProfile,
                      (item as any).requiresFunder,
                      (item as any).requiresAdmin,
                      (item as any).requiresJudge
                    )}
                    className={`
                      flex items-center space-x-3 p-3 rounded-xl w-full transition-all duration-300 group
                      ${pathname === item.url
                        ? "glass-emerald neon-border text-primary font-bold scale-[1.02]"
                        : "text-foreground/70 hover:text-foreground hover:bg-white/5"
                      }
                      ${!isSidebarOpen ? "justify-center px-0 hover:scale-110" : "px-4"}
                    `}
                    title={!isSidebarOpen ? item.title : undefined}
                  >
                    <div className="relative">
                      <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:rotate-12 ${pathname === item.url ? "text-primary" : ""}`} />
                      {item.title === "Messages" && unreadMessageCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-primary text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-[0_0_10px_rgba(0,251,117,0.5)]">
                          {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                        </span>
                      )}
                    </div>
                    {isSidebarOpen && (
                      <span className="text-sm tracking-wide">{item.title}</span>
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {/* History Section - Only when sidebar is open and user is authenticated */}
          {isAuthenticated && isSidebarOpen && (
            <div className="mt-6 flex-shrink-0">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Sessions
              </h3>
              <div className="history-list max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {(!Array.isArray(history) || history.length === 0) ? (
                  <div className="text-muted text-center text-sm py-4">
                    No query history available.
                  </div>
                ) : (
                  history.slice(0, 5).map((session) => (
                    <div
                      key={session.id}
                      className="history-item group flex justify-between items-center p-2 hover:bg-[#00FB75] hover:text-black rounded-md cursor-pointer transition-all duration-200 border border-transparent hover:border-[#00FB75]"
                      onClick={() => handleSessionClick(session)}
                      title={`Session: ${session.title}\nTime: ${new Date(
                        session.start_time
                      ).toLocaleString()}\nQueries: ${session.queries.length
                        }\nResults: ${session.entities.length}`}
                    >
                      <span className="history-text truncate flex-1 text-sm">
                        {session.title}
                      </span>
                      <div className="history-actions flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={(e) => {
                            handleShareSession(session.id, e);
                          }}
                          className="p-1 hover:bg-blue-500 hover:text-white rounded transition-colors"
                          title="Share session"
                        >
                          <Share2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            handleDownloadSession(session.id, e);
                          }}
                          className="p-1 hover:bg-green-500 hover:text-white rounded transition-colors"
                          title="Download session"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            handleDeleteSession(session.id, e);
                          }}
                          className="p-1 hover:bg-red-500 hover:text-white rounded transition-colors"
                          title="Delete session"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </nav>

        {/* Bottom Section - Fixed */}
        <div className="flex-shrink-0 space-y-3 border-t border-border pt-4 mt-4">
          {/* Notification Bell for authenticated users */}
          {isAuthenticated && isSidebarOpen && (
            <Link
              href="/auxiliaries/notifications"
              className="flex items-center gap-2 w-full p-2 bg-sidebar-accent hover:bg-[#00FB75] hover:text-black rounded-lg transition-colors cursor-pointer"
            >
              <NotificationBell />
              {isSidebarOpen && <span className="text-sm">Notifications</span>}
            </Link>
          )}

          {/* Theme Toggle */}
          <button
            className="flex items-center gap-2 w-full p-2 bg-sidebar-accent hover:bg-[#00FB75] hover:text-black rounded-lg transition-colors"
            onClick={handleDarkModeToggle}
            aria-label="Toggle color theme"
          >
            {mounted && theme === "dark" ? (
              <Sun className="w-5 h-5 text-[#00FB75]" />
            ) : (
              <Moon className="w-5 h-5 text-[#00FB75]" />
            )}
            {isSidebarOpen && (
              <span className="text-sm">
                {mounted && theme === "dark" ? "Light Mode" : "Dark Mode"}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Share Popup */}
      <ShareLinkPopup
        isOpen={sharePopup.isOpen}
        url={sharePopup.url}
        onClose={() => setSharePopup({ isOpen: false, url: '' })}
        onCopy={() => { }}
      />

      {/* Feedback Modal - Fixed Position - Hidden on messages page */}
      {!pathname.startsWith('/auxiliaries/messages') && (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
          <div className="pointer-events-auto">
            <FeedbackModal />
          </div>
        </div>
      )}

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #00FB75;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #00e065;
        }

        /* Hide scrollbar in collapsed mode */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
      `}</style>
    </>
  );
}
