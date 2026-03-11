"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Sun, Moon, Loader2, CheckCircle2, XCircle, Chrome, Linkedin } from "lucide-react";
import toast from "react-hot-toast";
import { setAuthCookies } from "@/utils/auth-cookies";

function OAuthCallbackPageContent() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const access_token = searchParams.get("access_token");
  const user_id = searchParams.get("user_id");
  const existing_user = searchParams.get("existing_user");
  const profile_id = searchParams.get("profile_id");
  const message = searchParams.get("message");
  const error = searchParams.get("error");
  const provider = searchParams.get("provider") || "OAuth";
  const profiles_json = searchParams.get("profiles_json");
  const default_profile_id = searchParams.get("default_profile_id");
  const username = searchParams.get("username");
  const email = searchParams.get("email");
  const profile_image_url = searchParams.get("profile_image_url");
  
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const handleOAuthCallback = useCallback(async () => {
    if (error) {
      toast.error(`OAuth Error: ${decodeURIComponent(error)}`);
      setTimeout(() => {
        window.location.href = "/auth/login";
      }, 2000);
      setLoading(false);
      return;
    }

    if (!access_token || !user_id) {
      toast.error("OAuth callback missing required information");
      setTimeout(() => {
        window.location.href = "/auth/login";
      }, 2000);
      setLoading(false);
      return;
    }

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("token", access_token);
        localStorage.setItem("user_id", user_id);
        setAuthCookies(access_token, user_id);
        
        if (username) {
          localStorage.setItem("username", username);
        }
        
        if (email) {
          localStorage.setItem("email", email);
        }
        
        if (profile_image_url) {
          localStorage.setItem("profile_image_url", profile_image_url);
        }
        
        if (profile_id) {
          localStorage.setItem("profile_id", profile_id);
        }
        
        setLoading(false);
        
        if (existing_user === "true") {
          toast.success("Successfully logged in!");
          setTimeout(() => {
            window.location.href = "/map";
          }, 1500);
        } else {
          const decodedMessage = message ? decodeURIComponent(message) : "";
          
          if (decodedMessage && decodedMessage.toLowerCase().includes("set your password")) {
            toast.success("Account created! Please set your password.");
            setTimeout(() => {
              window.location.href = `/auth/set-password?user_id=${user_id}`;
            }, 2000);
          } else if (profile_id) {
            toast.success("Account created! Please complete your profile.");
            setTimeout(() => {
              window.location.href = "/profiles/new";
            }, 2000);
          } else {
            toast.success("Account created!");
            setTimeout(() => {
              window.location.href = "/profiles/new";
            }, 2000);
          }
        }
      }
    } catch (err) {
      console.error("OAuth callback error:", err);
      toast.error("An error occurred during OAuth login");
      setTimeout(() => {
        window.location.href = "/auth/login";
      }, 2000);
      setLoading(false);
    }
  }, [error, access_token, user_id, username, email, profile_image_url, profile_id, existing_user, message]);

  useEffect(() => {
    setMounted(true);
    handleOAuthCallback();
  }, [handleOAuthCallback]);

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
          <h1 className="text-3xl font-bold mb-3 dark:text-white">
            Processing {provider}
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

        <h1 className="text-3xl font-bold mb-4 dark:text-white">
          {existing_user === "true" ? "Welcome Back!" : "Account Created!"}
        </h1>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg mb-6">
          <div className="space-y-4">
            <div className="flex items-center justify-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-[#00FB75] mr-3" />
              <p className="text-sm font-medium dark:text-white">
                {existing_user === "true" 
                  ? "Successfully authenticated"
                  : "Account successfully created"}
              </p>
            </div>

            {existing_user === "true" ? (
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
            ) : (
              <div className="text-left">
                <p className="text-sm text-muted-foreground mb-4">
                  Your {provider} account has been linked successfully!
                </p>
                <h3 className="text-lg font-semibold mb-3 dark:text-white">
                  {message && decodeURIComponent(message).toLowerCase().includes("set your password")
                    ? "Complete Your Account"
                    : "What's Next?"
                  }
                </h3>
                <div className="space-y-2 text-sm">
                  {message && decodeURIComponent(message).toLowerCase().includes("set your password") ? (
                    <>
                      <div className="flex items-start gap-3 text-muted-foreground">
                        <span className="bg-[#00FB75] text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          1
                        </span>
                        <span>Set a secure password for your account</span>
                      </div>
                      <div className="flex items-start gap-3 text-muted-foreground">
                        <span className="bg-[#00FB75] text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          2
                        </span>
                        <span>Create your profile</span>
                      </div>
                      <div className="flex items-start gap-3 text-muted-foreground">
                        <span className="bg-[#00FB75] text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          3
                        </span>
                        <span>Start exploring the platform</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-3 text-muted-foreground">
                        <span className="bg-[#00FB75] text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          1
                        </span>
                        <span>Complete your profile setup</span>
                      </div>
                      <div className="flex items-start gap-3 text-muted-foreground">
                        <span className="bg-[#00FB75] text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          2
                        </span>
                        <span>Explore climate tech labs and events</span>
                      </div>
                      <div className="flex items-start gap-3 text-muted-foreground">
                        <span className="bg-[#00FB75] text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          3
                        </span>
                        <span>Connect with the community</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {existing_user === "true" ? (
            <button
              onClick={() => window.location.href = "/map"}
              className="w-full bg-[#00FB75] hover:bg-[#00e065] text-black font-bold rounded-xl py-4 px-6 transition-all duration-200 transform hover:scale-105 mt-6"
            >
              Go to Dashboard →
            </button>
          ) : message && decodeURIComponent(message).toLowerCase().includes("set your password") ? (
            <button
              onClick={() => window.location.href = `/auth/set-password?user_id=${user_id}`}
              className="w-full bg-[#00FB75] hover:bg-[#00e065] text-black font-bold rounded-xl py-4 px-6 transition-all duration-200 transform hover:scale-105 mt-6"
            >
              Set Your Password →
            </button>
          ) : (
            <button
              onClick={() => window.location.href = "/profiles/new"}
              className="w-full bg-[#00FB75] hover:bg-[#00e065] text-black font-bold rounded-xl py-4 px-6 transition-all duration-200 transform hover:scale-105 mt-6"
            >
              Create Profile →
            </button>
          )}
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

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <OAuthCallbackPageContent />
    </Suspense>
  );
}