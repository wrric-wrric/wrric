"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Sun, Moon, Loader2, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

function LoginProcessingPageContent() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();

  const access_token = searchParams.get("access_token");
  const user_id = searchParams.get("user_id");
  const existing_user = searchParams.get("existing_user");
  const profile_id = searchParams.get("profile_id");
  const message = searchParams.get("message");
  const redirect = searchParams.get("redirect") || "/labs";

  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  const handleLoginProcessing = useCallback(async () => {
    if (!access_token || !user_id) {
      toast.error("Login information missing");
      setTimeout(() => {
        window.location.href = "/auth/login";
      }, 2000);
      setLoading(false);
      return;
    }

    // Check is_admin status and username from localStorage
    const loginData = localStorage.getItem("login_response");
    let is_admin_user = false;
    let userNameStr = "";
    if (loginData) {
      try {
        const parsedData = JSON.parse(loginData);
        is_admin_user = parsedData.is_admin || false;
        userNameStr = parsedData.username || "";
      } catch (e) { }
    }
    setUsername(userNameStr);

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("token", access_token);
        localStorage.setItem("user_id", user_id);

        const expires = new Date();
        expires.setTime(expires.getTime() + 7 * 24 * 60 * 60 * 1000);
        const cookieOptions = `expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
        document.cookie = `token=${access_token}; ${cookieOptions}`;
        document.cookie = `user_id=${user_id}; ${cookieOptions}`;

        if (profile_id) {
          localStorage.setItem("profile_id", profile_id);
        }

        // Set state to show welcome screen
        setLoading(false);

        // Transition to redirect after a pleasant delay
        setTimeout(() => {
          setRedirecting(true);
          const finalRedirect = (is_admin_user && (redirect === "/map" || !redirect || redirect === "/labs")) ? "/admin" : redirect;
          window.location.href = finalRedirect;
        }, 2000);
      }
    } catch (err) {
      console.error("Login processing error:", err);
      toast.error("An error occurred during login");
      setTimeout(() => {
        window.location.href = "/auth/login";
      }, 2000);
      setLoading(false);
    }
  }, [access_token, user_id, profile_id, existing_user, message, redirect]);

  useEffect(() => {
    setMounted(true);
    handleLoginProcessing();
  }, [handleLoginProcessing]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#E8E8E8] dark:bg-black">
        <div className="text-center animate-pulse">
          <div className="w-16 h-16 border-4 border-[#00FB75] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#E8E8E8] dark:bg-black overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 dark:opacity-40">
        <div className="absolute top-[10%] left-[20%] w-64 h-64 bg-[#00FB75] rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[20%] w-96 h-96 bg-blue-500 rounded-full blur-[150px]" />
      </div>

      <div className="z-10 text-center animate-in fade-in zoom-in duration-700">
        <div className="mb-8 relative inline-block">
          <div className="w-32 h-32 rounded-full bg-white p-1 shadow-2xl relative z-10">
            <img
              src="/assets/logos/wrric-logo.jpeg"
              alt="WRRIC Logo"
              className="w-full h-full rounded-full object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-[#00FB75] rounded-full blur-2xl opacity-40 animate-pulse" />
        </div>

        <h1 className="text-4xl md:text-5xl font-black mb-4 dark:text-white text-gray-900 tracking-tight">
          Welcome, <span className="text-[#00FB75]">{username || "User"}</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-500 dark:text-gray-400 font-medium max-w-lg mx-auto leading-relaxed">
          Initializing your research intelligence experience...
        </p>

        <div className="mt-12 flex flex-col items-center gap-4">
          <div className="w-48 h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div 
              className={`h-full bg-[#00FB75] transition-all duration-[2000ms] ease-out ${mounted && !loading ? 'w-full' : 'w-0'}`} 
            />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 font-bold animate-pulse">
            Secure Uplink Established
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginProcessingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <LoginProcessingPageContent />
    </Suspense>
  );
}