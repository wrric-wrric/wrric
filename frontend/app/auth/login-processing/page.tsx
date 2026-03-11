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
  const redirect = searchParams.get("redirect") || "/map";

  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const handleLoginProcessing = useCallback(async () => {
    if (!access_token || !user_id) {
      toast.error("Login information missing");
      setTimeout(() => {
        window.location.href = "/auth/login";
      }, 2000);
      setLoading(false);
      return;
    }

    // Check is_admin status from localStorage (set by login page)
    const loginData = localStorage.getItem("login_response");
    let is_admin_user = false;
    if (loginData) {
      try {
        const parsedData = JSON.parse(loginData);
        is_admin_user = parsedData.is_admin || false;
      } catch (e) { }
    }

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("token", access_token);
        localStorage.setItem("user_id", user_id);

        // Set auth cookies
        const expires = new Date();
        expires.setTime(expires.getTime() + 7 * 24 * 60 * 60 * 1000);
        const cookieOptions = `expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
        document.cookie = `token=${access_token}; ${cookieOptions}`;
        document.cookie = `user_id=${user_id}; ${cookieOptions}`;

        if (profile_id) {
          localStorage.setItem("profile_id", profile_id);
        }

        setLoading(false);

        if (existing_user === "true") {
          toast.success("Login successful!");
          setTimeout(() => {
            // If admin and no specific redirect, go to /admin
            const finalRedirect = (is_admin_user && (redirect === "/map" || !redirect)) ? "/admin" : redirect;
            window.location.href = finalRedirect;
          }, 1500);
        } else {
          const decodedMessage = message ? decodeURIComponent(message) : "";

          if (decodedMessage && decodedMessage.toLowerCase().includes("set your password")) {
            toast.success("Please set your password.");
            setTimeout(() => {
              window.location.href = `/auth/set-password?user_id=${user_id}`;
            }, 2000);
          } else {
            toast.success("Please complete your profile.");
            setTimeout(() => {
              window.location.href = "/profiles/new";
            }, 2000);
          }
        }
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
      <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#E8E8E8] dark:bg-black dark:bg-opacity-50">
        <div className="text-center">
          <div className="mb-6 relative">
            <div className="absolute inset-0 bg-[#00FB75]/20 rounded-full animate-ping" />
            <div className="relative p-6 bg-gradient-to-br from-[#00FB75] to-green-500 rounded-full">
              <Loader2 className="w-12 h-12 text-black animate-spin" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-3 dark:text-white text-gray-800">
            Logging In
          </h1>
          <p className="text-lg text-muted-foreground">
            Completing your authentication...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#E8E8E8] dark:bg-black dark:bg-opacity-50 p-6">
      {mounted && (
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="absolute top-4 right-4 p-2 rounded-full bg-accent hover:bg-muted"
          title="Toggle dark mode"
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>
      )}

      <div className="max-w-md w-full text-center">
        <div className="mb-6 flex justify-center">
          <div className="p-6 bg-green-500/20 rounded-full">
            <CheckCircle2 className="w-16 h-16 text-[#00FB75]" />
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-4 dark:text-white text-gray-800">
          Login Successful!
        </h1>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg mb-6">
          <div className="space-y-4">
            <div className="flex items-center justify-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-[#00FB75] mr-3" />
              <p className="text-sm font-medium dark:text-white">
                Successfully authenticated
              </p>
            </div>

            <div className="text-left">
              <p className="text-sm text-muted-foreground mb-4">
                You&apos;re now logged in and ready to continue!
              </p>

              <h3 className="text-lg font-semibold mb-3 dark:text-white">
                What&apos;s Next?
              </h3>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-3 text-muted-foreground">
                  <span className="bg-[#00FB75] text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    1
                  </span>
                  <span>Explore climate tech labs and events</span>
                </div>
                <div className="flex items-start gap-3 text-muted-foreground">
                  <span className="bg-[#00FB75] text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    2
                  </span>
                  <span>Connect with the community</span>
                </div>
                <div className="flex items-start gap-3 text-muted-foreground">
                  <span className="bg-[#00FB75] text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    3
                  </span>
                  <span>Create and manage your profile</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => window.location.href = redirect}
            className="w-full bg-[#00FB75] hover:bg-[#00e065] text-black font-bold rounded-xl py-4 px-6 transition-all duration-200 transform hover:scale-105 mt-6"
          >
            Continue →
          </button>
        </div>

        <button
          onClick={() => window.location.href = "/auth/login"}
          className="text-sm text-muted-foreground hover:text-foreground mt-4"
        >
          Back to Login
        </button>
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