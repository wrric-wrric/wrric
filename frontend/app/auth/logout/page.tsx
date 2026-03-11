"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Sun, Moon, Loader2, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import { clearAuthCookies } from "@/utils/auth-cookies";

function LogoutPageContent() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const redirect = searchParams.get("redirect") || "/";
  const [mounted, setMounted] = useState(false);

  const handleLogout = useCallback(async () => {
    try {
      // Clear localStorage auth data
      localStorage.removeItem("token");
      localStorage.removeItem("user_id");
      localStorage.removeItem("login_response");
      localStorage.removeItem("username");
      localStorage.removeItem("email");
      localStorage.removeItem("profile_image_url");
      localStorage.removeItem("profile_id");
      
      // Clear auth cookies
      clearAuthCookies();
      
      toast.success("Successfully logged out!");
      
      // Redirect after a short delay
      setTimeout(() => {
        window.location.href = redirect;
      }, 1500);
    } catch (err) {
      console.error("Logout error:", err);
      toast.error("An error occurred during logout");
      setTimeout(() => {
        window.location.href = redirect;
      }, 1500);
    }
  }, [redirect]);

  useEffect(() => {
    setMounted(true);
    handleLogout();
  }, [handleLogout]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#E8E8E8] dark:bg-black dark:bg-opacity-50">
      <div className="text-center">
        <div className="mb-6 relative">
          <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
          <div className="relative p-6 bg-gradient-to-br from-red-500 to-red-600 rounded-full">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-3 dark:text-white text-gray-800">
          Logging Out
        </h1>
        <p className="text-lg text-muted-foreground">
          Signing you out securely...
        </p>
      </div>
    </div>
  );
}

export default function LogoutPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <LogoutPageContent />
    </Suspense>
  );
}