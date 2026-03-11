"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Sun, Moon, Eye, EyeOff } from "lucide-react";
import { LinkedInIcon } from "@/components/ui/linkedin-icon";

export default function Page() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);

  // Set mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize reCAPTCHA callback
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__setRecaptchaToken = (token: string) => {
      setRecaptchaToken(token);
      setErrorMsg("");
      console.log("reCAPTCHA token set:", token);
    };
  }, []);

  // Wait for reCAPTCHA script to load and render widget
  useEffect(() => {
    if (!mounted || typeof window === "undefined" || !recaptchaRef.current) return;

    const renderRecaptcha = () => {
      if (!window.grecaptcha || !window.grecaptcha.render) {
        console.warn("reCAPTCHA not loaded yet, retrying...");
        return false;
      }

      // Reset existing widget if present
      if (widgetIdRef.current !== null) {
        window.grecaptcha.reset(widgetIdRef.current);
        return true;
      }

      // Render new widget
      try {
        const widgetId = window.grecaptcha.render(recaptchaRef.current, {
          sitekey: process.env.NEXT_PUBLIC_SITE_KEY!,
          callback: (token: string) => {
            if ((window as any).__setRecaptchaToken) (window as any).__setRecaptchaToken(token);
          },
          "expired-callback": () => {
            setRecaptchaToken("");
            setErrorMsg("reCAPTCHA expired. Please try again.");
          },
        });
        widgetIdRef.current = widgetId;
        return true;
      } catch (err) {
        console.error("Error rendering reCAPTCHA:", err);
        return false;
      }
    };

    // Poll for grecaptcha availability
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
  }, [mounted]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username || !email || !password) {
      setErrorMsg("All fields are required.");
      return;
    }
    // reCAPTCHA bypass for local environment
    const recaptchaToUse = recaptchaToken || "local_bypass";

    const data: Record<string, string> = {
      username,
      email,
      password,
      recaptchaResponse: recaptchaToUse,
    };
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const response = await res.json();

      console.log("register data from page: ", response);
      if (res.ok && response.access_token && response.user_id) {
        if (rememberMe) {
          localStorage.setItem("token", response.access_token);
          localStorage.setItem("user_id", response.user_id);
        } else {
          sessionStorage.setItem("token", response.access_token);
          sessionStorage.setItem("user_id", response.user_id);
        }
        router.push("/map");
      } else {
        setErrorMsg(response.detail || "Registration failed.");
        if (window.grecaptcha && widgetIdRef.current !== null) {
          window.grecaptcha.reset(widgetIdRef.current);
          setRecaptchaToken("");
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred. Please try again.");
      if (window.grecaptcha && widgetIdRef.current !== null) {
        window.grecaptcha.reset(widgetIdRef.current);
        setRecaptchaToken("");
      }
    }
  };

  return (
    <>
      <Script
        src="https://www.google.com/recaptcha/api.js"
        strategy="afterInteractive"
      />
      <div className="p-4 flex items-center justify-center min-h-screen w-full bg-[#E8E8E8] dark:bg-black dark:bg-opacity-50">
        <div className="relative grid grid-cols-1 lg:grid-cols-2 items-center w-full max-w-6xl bg-sidebar text-card-foreground rounded-2xl shadow-lg overflow-hidden">
          {/* Image Section */}
          <div className="hidden lg:flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-4">
            <div className="relative w-full h-full max-h-[600px] flex items-center justify-center">
              <Image
                src="/assets/register.png"
                alt="Register illustration"
                width={500}
                height={500}
                className="w-full h-auto max-w-md object-contain"
                priority
              />
            </div>
          </div>

          {/* Form Section */}
          <div className="p-6 md:p-8 lg:p-10 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <div className="flex flex-col gap-1 mb-4">
                <div className="flex items-center gap-3 mb-4">
                  <Image
                    src="/assets/logos/wrric-logo2.jpeg"
                    alt="WRRIC Logo"
                    width={48}
                    height={48}
                    className="object-cover rounded-full bg-white shadow-sm flex-shrink-0"
                    priority
                  />
                  <span className="font-bold text-xl text-slate-800 dark:text-white">WRRIC Platform</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold dark:text-white">Create Account</h1>
                <p className="text-sm md:text-base text-muted-foreground">
                  Join us today! Fill in your details to get started.
                </p>
              </div>
              {mounted && (
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="p-2 rounded-full bg-accent hover:bg-muted transition-colors"
                  title="Toggle dark mode"
                >
                  {theme === "dark" ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </button>
              )}
            </div>

            {/* OAuth Buttons */}
            {mounted && (
              <div className="flex flex-col gap-3 mb-6">
                <button
                  onClick={() => window.location.href = "/api/auth/google/login"}
                  className="rounded-xl border border-border transition-colors flex items-center justify-center bg-secondary text-foreground gap-3 hover:bg-muted py-3 px-4 no-underline text-sm md:text-base"
                >
                  <Image
                    src="/assets/icons/google.png"
                    alt="Google icon"
                    width={20}
                    height={20}
                  />
                  Sign up with Google
                </button>

                <button
                  onClick={() => window.location.href = "/api/auth/linkedin/login"}
                  className="rounded-xl border border-[#0077B5] transition-colors text-white flex items-center justify-center gap-3 bg-[#0077B5] hover:bg-[#005885] py-3 px-4 no-underline text-sm md:text-base"
                >
                  <LinkedInIcon className="w-5 h-5" />
                  Sign up with LinkedIn
                </button>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-border"></div>
              <span className="mx-4 text-sm text-muted-foreground">or continue with email</span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              {/* Form Fields */}
              <div className="space-y-4">
                <label className="flex flex-col gap-2">
                  <span className="text-foreground text-sm">Username</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="border border-border bg-transparent rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00FB75] focus:border-transparent"
                    required
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-foreground text-sm">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="border border-border bg-transparent rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00FB75] focus:border-transparent"
                    required
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-foreground text-sm">Password</span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      className="border border-border bg-transparent rounded-lg p-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#00FB75] focus:border-transparent w-full"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </label>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer">
                  Remember me
                </label>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="text-red-500 text-sm p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  {errorMsg}
                </div>
              )}

              {/* reCAPTCHA hidden for simplicity */}
              <div className="hidden">
                <div
                  ref={recaptchaRef}
                  className="g-recaptcha transform scale-90 md:scale-100"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="rounded-xl border border-transparent transition-colors flex items-center justify-center bg-[#00FB75] text-black hover:bg-[#00FB75]/90 font-medium py-3 px-4 text-sm md:text-base mt-2"
              >
                Create Account
              </button>

              {/* Login Link */}
              <p className="text-sm text-center text-muted-foreground mt-4">
                Already have an account?{" "}
                <a href="/auth/login" className="text-[#00FB75] hover:underline font-medium">
                  Sign in here
                </a>
              </p>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}