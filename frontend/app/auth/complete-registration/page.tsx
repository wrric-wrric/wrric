"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useTheme } from "next-themes";
import { Lock, CheckCircle2, ArrowLeft, Loader2, AlertCircle, User, Mail } from "lucide-react";
import toast from "react-hot-toast";

interface ValidationResponse {
  valid: boolean;
  email: string;
  first_name: string;
  last_name: string;
}

function CompleteRegistrationPageContent() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [validationData, setValidationData] = useState<ValidationResponse | null>(null);
  const [validationError, setValidationError] = useState("");
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__setRecaptchaToken = (token: string) => {
      setRecaptchaToken(token);
      console.log("reCAPTCHA token set:", token);
    };
  }, []);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setValidationError("Invalid or missing token");
        setValidating(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/auth/complete-registration/validate?token=${encodeURIComponent(token)}`
        );
        const data = await response.json();

        if (response.ok && data.valid) {
          setValidationData(data);
        } else {
          setValidationError(data.detail || "Invalid or expired token");
        }
      } catch (err) {
        console.error("Token validation error:", err);
        setValidationError("Failed to validate token");
      } finally {
        setValidating(false);
      }
    };

    if (mounted && token) {
      validateToken();
    }
  }, [mounted, token]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined" || !recaptchaRef.current || !validationData) return;

    const renderRecaptcha = () => {
      if (!window.grecaptcha || !window.grecaptcha.render) {
        console.warn("reCAPTCHA not loaded yet, retrying...");
        return false;
      }

      if (widgetIdRef.current !== null) {
        window.grecaptcha.reset(widgetIdRef.current);
        return true;
      }

      try {
        const widgetId = window.grecaptcha.render(recaptchaRef.current, {
          sitekey: process.env.NEXT_PUBLIC_SITE_KEY!,
          callback: (token: string) => {
            if ((window as any).__setRecaptchaToken) (window as any).__setRecaptchaToken(token);
          },
          "expired-callback": () => {
            setRecaptchaToken("");
          },
        });
        widgetIdRef.current = widgetId;
        console.log("reCAPTCHA rendered successfully");
        return true;
      } catch (err) {
        console.error("Error rendering reCAPTCHA:", err);
        return false;
      }
    };

    let attempts = 0;
    const maxAttempts = 10;
    const pollInterval = setInterval(() => {
      if (renderRecaptcha() || attempts >= maxAttempts) {
        clearInterval(pollInterval);
      }
      attempts++;
    }, 500);

    return () => {
      clearInterval(pollInterval);
      if (widgetIdRef.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [mounted, validationData]);

  const handleRecaptchaLoad = () => {
    console.log("reCAPTCHA script loaded");
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
      const response = await fetch("/api/auth/complete-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          new_password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Account created successfully!");
        setTimeout(() => {
          router.push(data.redirect_url || "/dashboard");
        }, 2000);
      } else {
        toast.error(data.detail || "Failed to complete registration");
        if (window.grecaptcha && widgetIdRef.current !== null) {
          window.grecaptcha.reset(widgetIdRef.current);
          setRecaptchaToken("");
        }
      }
    } catch (err) {
      console.error("Complete registration error:", err);
      toast.error("An error occurred. Please try again.");
      if (window.grecaptcha && widgetIdRef.current !== null) {
        window.grecaptcha.reset(widgetIdRef.current);
        setRecaptchaToken("");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00FB75] animate-spin" />
        </div>
      </div>
    );
  }

  if (validating) {
    return (
      <div className="h-full flex flex-col">
        <header className="sticky top-0 z-40 backdrop-blur-md border-b dark:bg-[#0A0A0A]/80 bg-white/80 dark:border-gray-800 border-gray-200 flex-shrink-0">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <h1 className="text-xl font-semibold dark:text-white text-gray-900">Complete Registration</h1>
                <p className="text-sm opacity-70 dark:text-gray-400 text-gray-600">Setting up your account</p>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-[#00FB75] animate-spin" />
            <p className="text-gray-400">Validating your setup link...</p>
          </div>
        </div>
      </div>
    );
  }

  if (validationError || !validationData) {
    return (
      <div className="h-full flex flex-col">
        <header className="sticky top-0 z-40 backdrop-blur-md border-b dark:bg-[#0A0A0A]/80 bg-white/80 dark:border-gray-800 border-gray-200 flex-shrink-0">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-lg dark:hover:bg-gray-800 hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 dark:text-white text-gray-900" />
              </button>
              <div className="flex-1">
                <h1 className="text-xl font-semibold dark:text-white text-gray-900">Complete Registration</h1>
                <p className="text-sm opacity-70 dark:text-gray-400 text-gray-600">Setup link invalid</p>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full mx-6 text-center">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold dark:text-white text-gray-900 mb-2">Invalid Setup Link</h2>
              <p className="dark:text-gray-400 text-gray-600 mb-6">{validationError || "This setup link is invalid or has expired."}</p>
              <button
                onClick={() => router.push("/events")}
                className="bg-[#00FB75] text-black font-semibold px-6 py-3 rounded-lg hover:bg-green-400 transition-colors"
              >
                Browse Events
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://www.google.com/recaptcha/api.js"
        strategy="afterInteractive"
        onLoad={handleRecaptchaLoad}
      />
      <div className="h-full flex flex-col">
        <header className="sticky top-0 z-40 backdrop-blur-md border-b dark:bg-[#0A0A0A]/80 bg-white/80 dark:border-gray-800 border-gray-200 flex-shrink-0">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <h1 className="text-xl font-semibold dark:text-white text-gray-900">Complete Registration</h1>
                <p className="text-sm opacity-70 dark:text-gray-400 text-gray-600">Set up your account password</p>
              </div>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-lg dark:hover:bg-gray-800 hover:bg-gray-100 transition-colors"
                title="Toggle dark mode"
              >
                {theme === "dark" ? (
                  <span className="text-sm">☀️</span>
                ) : (
                  <span className="text-sm">🌙</span>
                )}
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            <div className="max-w-xl mx-auto">
              <div className="rounded-xl p-6 dark:bg-[#1A1A1A] bg-white dark:border-gray-800 border-gray-200 border">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-[#00FB75] to-green-500 rounded-full">
                    <Lock className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold dark:text-white text-gray-900">Create Your Password</h2>
                    <p className="text-sm dark:text-gray-400 text-gray-600">Complete your account setup</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 dark:bg-gray-800/50 bg-gray-100 rounded-lg mb-6">
                  <User className="w-5 h-5 text-[#00FB75] mt-0.5" />
                  <div>
                    <p className="text-sm font-medium dark:text-white text-gray-900">
                      {validationData.first_name} {validationData.last_name}
                    </p>
                    <p className="text-xs dark:text-gray-400 text-gray-600 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {validationData.email}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium dark:text-white text-gray-900">Password</label>
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      placeholder="Min 8 characters"
                      minLength={8}
                      className="w-full p-3 rounded-lg dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 focus:border-[#00FB75] focus:ring-1 focus:ring-[#00FB75] transition-colors"
                      required
                    />
                    {password && password.length < 8 && (
                      <p className="text-xs text-yellow-500">Password must be at least 8 characters</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium dark:text-white text-gray-900">Confirm Password</label>
                    <input
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      type="password"
                      placeholder="Confirm your password"
                      minLength={8}
                      className="w-full p-3 rounded-lg dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 focus:border-[#00FB75] focus:ring-1 focus:ring-[#00FB75] transition-colors"
                      required
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

                  <div className="flex justify-center my-4">
                    <div
                      ref={recaptchaRef}
                      className="g-recaptcha bg-[#E8E8E8] dark:bg-black dark:bg-opacity-50"
                    />
                  </div>

                  {!recaptchaToken && (
                    <p className="text-xs text-yellow-500 text-center">
                      ⚠️ Please complete the reCAPTCHA verification above to continue
                    </p>
                  )}

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={
                        loading ||
                        !password ||
                        !confirmPassword ||
                        password !== confirmPassword ||
                        password.length < 8 ||
                        !recaptchaToken
                      }
                      className="w-full bg-[#00FB75] text-black font-semibold px-6 py-3.5 rounded-lg hover:bg-green-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </button>
                  </div>
                </form>

                <div className="mt-6 pt-6 border-t dark:border-gray-800 border-gray-200">
                  <div className="text-center mb-4">
                    <p className="text-sm dark:text-gray-400 text-gray-600 mb-2">
                      Don&apos;t want to join?
                    </p>
                    <button
                      onClick={() => router.push(`/auth/reject-registration?token=${encodeURIComponent(token)}`)}
                      className="text-sm text-red-400 hover:text-red-300 transition-colors underline"
                    >
                      Decline this invitation
                    </button>
                  </div>
                  
                  <div className="space-y-2 text-sm dark:text-gray-400 text-gray-600">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#00FB75] flex-shrink-0 mt-0.5" />
                      <p>Use at least 8 characters</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#00FB75] flex-shrink-0 mt-0.5" />
                      <p>Include numbers and special characters</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#00FB75] flex-shrink-0 mt-0.5" />
                      <p>Make it unique to this platform</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function CompleteRegistrationPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <CompleteRegistrationPageContent />
    </Suspense>
  );
}