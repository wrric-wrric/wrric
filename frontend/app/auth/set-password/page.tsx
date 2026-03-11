"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useTheme } from "next-themes";
import { Sun, Moon, Lock, CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

function SetPasswordPageContent() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("user_id") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const recaptchaRef = useRef<number | null>(null);
  const widgetIdRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__setRecaptchaToken = (token: string) => {
      setRecaptchaToken(token);
    };
  }, []);

  const handleRecaptchaLoad = () => {
    if (typeof window !== "undefined" && window.grecaptcha) {
      const widgetId = window.grecaptcha.render("recaptcha-container", {
        sitekey: process.env.NEXT_PUBLIC_SITE_KEY!,
        callback: (token: string) => {
          if ((window as any).__setRecaptchaToken) (window as any).__setRecaptchaToken(token);
        },
        "expired-callback": () => {
          setRecaptchaToken("");
        },
      });
      recaptchaRef.current = widgetId;
      widgetIdRef.current = widgetId;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!recaptchaToken) {
      toast.error("Please complete reCAPTCHA verification");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/oauth/set-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password,
            recaptchaResponse: recaptchaToken,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("Password set successfully!");
        setTimeout(() => {
          router.push("/auth/login");
        }, 2000);
      } else {
        toast.error(data.detail || "Failed to set password");
        if (window.grecaptcha && widgetIdRef.current !== null) {
          window.grecaptcha.reset(widgetIdRef.current);
          setRecaptchaToken("");
        }
      }
    } catch (err) {
      console.error("Set password error:", err);
      toast.error("An error occurred. Please try again.");
      if (window.grecaptcha && widgetIdRef.current !== null) {
        window.grecaptcha.reset(widgetIdRef.current);
        setRecaptchaToken("");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Script
        src="https://www.google.com/recaptcha/api.js"
        strategy="afterInteractive"
        onLoad={handleRecaptchaLoad}
      />
      <div className="md:p-2 flex items-center justify-center w-full h-screen flex-1 bg-[#E8E8E8] dark:bg-black dark:bg-opacity-50">
        <div className="relative grid grid-cols-1 md:grid-cols-2 items-center w-[90%] md:w-[70%] text-card-foreground rounded-2xl bg-sidebar">
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

          <form className="flex flex-col gap-6 p-8" onSubmit={handleSubmit}>
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2 w-fit"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-[#00FB75] to-green-500 rounded-full">
                  <Lock className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="text-[34px] dark:text-white">Set Your Password</h1>
                  <p className="text-[14px] text-muted-foreground">
                    Create a secure password for your account
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-foreground text-[14px] font-medium">Password</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="Enter your password"
                  required
                  minLength={8}
                  className="border-2 border-solid bg-transparent border-border rounded-lg p-3 w-full focus:border-[#00FB75] focus:outline-none transition-colors dark:text-white"
                />
                {password && password.length < 8 && (
                  <p className="text-xs text-yellow-500">
                    Password must be at least 8 characters
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-foreground text-[14px] font-medium">
                  Confirm Password
                </label>
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  placeholder="Confirm your password"
                  required
                  minLength={8}
                  className="border-2 border-solid bg-transparent border-border rounded-lg p-3 w-full focus:border-[#00FB75] focus:outline-none transition-colors dark:text-white"
                />
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs text-red-500">Passwords do not match</p>
                )}
                {confirmPassword && confirmPassword === password && confirmPassword.length >= 8 && (
                  <p className="text-xs text-green-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Passwords match
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-center my-2">
              <div
                id="recaptcha-container"
                className="g-recaptcha bg-[#E8E8E8] dark:bg-black dark:bg-opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword || password !== confirmPassword || password.length < 8}
              className="bg-[#00FB75] hover:bg-[#00e065] text-black font-bold rounded-xl py-3 px-4 my-2 w-full transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Setting Password...
                </>
              ) : (
                "Set Password"
              )}
            </button>

            <p className="text-[12px] text-center">
              Need help?{" "}
              <a href="/forgot-password" className="text-[#00FB75] cursor-pointer hover:underline font-semibold">
                Contact Support
              </a>
            </p>
          </form>

          <div className="flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="mb-6 p-4 bg-green-500/20 rounded-full inline-block">
                <Lock className="w-16 h-16 text-[#00FB75]" />
              </div>
              <h3 className="text-xl font-bold mb-3 dark:text-white">
                Secure Your Account
              </h3>
              <div className="text-left space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00FB75] flex-shrink-0 mt-0.5" />
                  <p className="flex-1">Use at least 8 characters</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00FB75] flex-shrink-0 mt-0.5" />
                  <p className="flex-1">Include numbers and special characters</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00FB75] flex-shrink-0 mt-0.5" />
                  <p className="flex-1">Avoid using personal information</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00FB75] flex-shrink-0 mt-0.5" />
                  <p className="flex-1">Make it unique to this platform</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <SetPasswordPageContent />
    </Suspense>
  );
}