"use client";

import {
  UserPlus,
  LogIn,
  User,
  LogOut,
  Sun,
  Moon,
  Menu,
  ChevronFirst,
  ChevronLast,
  LayoutDashboard,
  Calendar,
  Award,
  Star,
} from "lucide-react";
import { useSidebar } from "../hooks/sideBarProvider";
import Image from "next/image";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTheme } from "next-themes";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { checkAdminAccess } from "@/utils/auth";
import { getUserId, clearAuthCookies } from "@/utils/auth-cookies";
import toast from "react-hot-toast";
import type { Profile as UserProfile, LoginResponse } from "@/types/profile";
import { getProfileDisplayName } from "@/types/message";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  requiresAuth?: boolean;
  requiresProfile?: boolean;
  requiresAdmin?: boolean;
  requiresJudge?: boolean;
}

const baseItems: MenuItem[] = [
  { title: "Events", url: "/events", icon: Calendar },
  { title: "My Profiles", url: "/profiles", icon: User, requiresAuth: true },
];

const guestItems: MenuItem[] = [
  { title: "Register", url: "/auth/register", icon: UserPlus },
  { title: "Login", url: "/auth/login", icon: LogIn },
];

const authItems: MenuItem[] = [
  { title: "Logout", url: "/logout", icon: LogOut },
];

const adminItems: MenuItem[] = [
  { title: "Admin Dashboard", url: "/admin", icon: LayoutDashboard, requiresAuth: true, requiresAdmin: true },
];

const judgeItems: MenuItem[] = [
  { title: "Judge Portal", url: "/judge", icon: Award, requiresAuth: true, requiresJudge: true },
];

export function AppSidebar() {
  const { isSidebarOpen, toggleSidebar } = useSidebar();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = mounted ? resolvedTheme === "dark" : false;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isJudge, setIsJudge] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const authCheckRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  const defaultProfileId = loginData?.default_profile_id || userProfiles[0]?.id;
  const defaultProfile = (userProfiles.length > 0
    ? (userProfiles.find(p => p.id === defaultProfileId) || userProfiles[0])
    : loginData?.profiles?.find(p => p.id === loginData.default_profile_id)) || null;

  const getCookie = useCallback((name: string): string | null => {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
    return null;
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || authCheckRef.current) return;

    const checkAuthAndProfile = async () => {
      if (typeof window === "undefined") return;
      authCheckRef.current = true;

      const userId = getCookie("user_id") || localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
      const authenticated = !!userId && userId !== "null" && userId !== "undefined";

      if (!authenticated) {
        setIsAuthenticated(false);
        setIsAdmin(false);
        setIsJudge(false);
        setHasProfile(false);
        setUserProfiles([]);
        setLoginData(null);
        setAuthChecked(true);
        authCheckRef.current = false;
        return;
      }

      setIsAuthenticated(true);
      const loginDataLocal = localStorage.getItem("login_response");
      if (loginDataLocal) {
        try {
          const data: LoginResponse = JSON.parse(loginDataLocal);
          setLoginData(data);
          if (data.is_admin) setIsAdmin(true);
          if (data.is_judge) setIsJudge(true);
        } catch (error) {
          console.error("Parse login data error:", error);
        }
      }

      const token = localStorage.getItem("token") || sessionStorage.getItem("token");

      try {
        const [profilesResult, adminResult, judgeResult] = await Promise.allSettled([
          fetch("/api/profiles", { headers: { Authorization: `Bearer ${token}` } }).then(res => res.ok ? res.json() : []),
          checkAdminAccess(),
          fetch("/api/judge/hackathons", { headers: { Authorization: `Bearer ${token}` } }).then(res => res.ok ? res.json().then(h => Array.isArray(h) && h.length > 0) : false),
        ]);

        if (profilesResult.status === "fulfilled") {
          const profiles: UserProfile[] = profilesResult.value;
          setUserProfiles(profiles);
          setHasProfile(profiles.length > 0);
        }

        if (adminResult.status === "fulfilled") setIsAdmin(adminResult.value);
        if (judgeResult.status === "fulfilled") setIsJudge(judgeResult.value);
      } catch (err) {
        console.error("Auth check failed:", err);
      }

      setAuthChecked(true);
      authCheckRef.current = false;
    };

    checkAuthAndProfile();
  }, [getCookie, mounted]);

  useEffect(() => {
    if (pathname?.startsWith('/auth/')) authCheckRef.current = false;
  }, [pathname]);

  const handleDarkModeToggle = () => setTheme(theme === "dark" ? "light" : "dark");

  const menuItems: MenuItem[] = useMemo(() => {
    if (isAuthenticated && isJudge && !isAdmin) return [...judgeItems, ...authItems];
    if (isAuthenticated && isAdmin) return [...adminItems, ...baseItems, ...authItems];
    return [...baseItems, ...(isAuthenticated ? authItems : guestItems)];
  }, [isAuthenticated, isJudge, isAdmin]);

  const handleItemClick = (url: string, requiresAuth?: boolean, requiresProfile?: boolean, requiresAdmin?: boolean, requiresJudge?: boolean) => {
    if (requiresAuth && !isAuthenticated) {
      toast.error("Please log in to access this feature.");
      router.push(`/auth/login?redirect=${encodeURIComponent(url)}`);
      return;
    }
    if (requiresProfile && !hasProfile) {
      toast.error("Please create a profile to access this feature.");
      router.push("/profiles/new");
      return;
    }
    if (requiresAdmin && !isAdmin) {
      toast.error("You need admin access to view this page.");
      router.push("/");
      return;
    }
    if (requiresJudge && !isJudge) {
      toast.error("You are not assigned as a judge.");
      router.push("/");
      return;
    }
    if (url === "/logout") {
      router.push("/auth/logout");
      return;
    }
    router.push(url);
    if (typeof window !== "undefined" && window.innerWidth < 768) toggleSidebar();
  };

  if (!mounted) return null;

  return (
    <>
      <button
        className="fixed top-4 left-4 z-50 p-2 bg-[#00FB75] rounded-md text-black md:hidden"
        onClick={toggleSidebar}
      >
        <Menu className="w-6 h-6" />
      </button>

      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={toggleSidebar} />}

      <aside className={`fixed md:hidden top-0 left-0 h-screen z-50 flex flex-col transform transition-transform duration-500 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} w-80 glass border-r ${isDark ? "border-white/10" : "border-gray-200"}`}>
        <div className="flex-shrink-0 flex items-center justify-between p-4 mb-6">
          <Link href="/events" className="flex items-center gap-3" onClick={() => isSidebarOpen && toggleSidebar()}>
            <Image src="/assets/logos/wrric-logo.jpeg" alt="WRRIC" width={40} height={40} className="rounded-full" />
            <span className="font-bold text-lg text-foreground">WRRIC Platform</span>
          </Link>
          <button onClick={toggleSidebar} className="p-2 text-2xl">&times;</button>
        </div>
        <nav className="flex-1 overflow-y-auto px-4">
          <ul className="space-y-2">
            {menuItems.map((item, index) => (
              <li key={index}>
                <button
                  onClick={() => handleItemClick(item.url, item.requiresAuth, item.requiresProfile, item.requiresAdmin, item.requiresJudge)}
                  className={`flex items-center space-x-2 p-3 rounded-xl w-full transition-all ${pathname === item.url ? "glass-emerald text-primary" : "text-foreground hover:bg-white/5"}`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{item.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <aside className={`hidden md:flex flex-col h-[calc(100vh-2rem)] sticky top-4 left-4 z-40 glass rounded-3xl m-4 transition-all duration-500 ease-out overflow-hidden ${isSidebarOpen ? "w-72" : "w-20"}`}>
        <div className="flex-shrink-0 mb-4 flex items-center p-4">
          <Link href="/events" className="flex items-center gap-3">
            <Image src="/assets/logos/wrric-logo.jpeg" alt="WRRIC" width={40} height={40} priority className="rounded-full" />
            {isSidebarOpen && <span className="font-bold text-lg text-foreground truncate">WRRIC Platform</span>}
          </Link>
        </div>

        {isAuthenticated && isSidebarOpen && defaultProfile && (
          <div className="flex-shrink-0 mb-6 px-4">
            <div className="flex items-center gap-3 p-3 glass-emerald rounded-2xl">
              {defaultProfile.profile_image ? (
                <img src={defaultProfile.profile_image} alt={getProfileDisplayName(defaultProfile)} className="w-10 h-10 rounded-full object-cover border-2 border-primary" />
              ) : (
                <div className="w-10 h-10 rounded-full border-2 border-primary bg-gray-700 flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{getProfileDisplayName(defaultProfile)}</div>
                <div className="text-xs opacity-70 flex items-center gap-1 capitalize">
                  {defaultProfile.type?.replace('_', ' ')}
                  {defaultProfile.is_default && <Star className="w-3 h-3 fill-primary text-primary" />}
                </div>
              </div>
            </div>
          </div>
        )}

        <button className="flex-shrink-0 mb-4 p-2 w-full flex justify-center hover:bg-white/5" onClick={toggleSidebar}>
          {isSidebarOpen ? <ChevronFirst className="w-5 h-5" /> : <ChevronLast className="w-5 h-5" />}
        </button>

        <nav className={`flex-1 overflow-y-auto px-2 ${!isSidebarOpen ? 'no-scrollbar' : 'custom-scrollbar'}`}>
          <ul className="space-y-2">
            {menuItems.map((item, index) => (
              <li key={index}>
                <button
                  onClick={() => handleItemClick(item.url, item.requiresAuth, item.requiresProfile, item.requiresAdmin, item.requiresJudge)}
                  className={`flex items-center space-x-3 p-3 rounded-xl w-full transition-all group ${pathname === item.url ? "glass-emerald text-primary font-bold" : "text-foreground/70 hover:text-foreground hover:bg-white/5"} ${!isSidebarOpen ? "justify-center" : "px-4"}`}
                  title={!isSidebarOpen ? item.title : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {isSidebarOpen && <span className="text-sm truncate">{item.title}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex-shrink-0 p-4 border-t border-border mt-4">
          <button className="flex items-center gap-2 w-full p-2 hover:bg-white/5 rounded-lg transition-colors" onClick={handleDarkModeToggle}>
            {theme === "dark" ? <Sun className="w-5 h-5 text-primary" /> : <Moon className="w-5 h-5 text-primary" />}
            {isSidebarOpen && <span className="text-sm">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
          </button>
        </div>
      </aside>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #00FB75; border-radius: 2px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
}
