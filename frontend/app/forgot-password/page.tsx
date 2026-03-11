"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Sun, Moon, Lock, ArrowLeft, Mail } from "lucide-react";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
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
    if (!mounted || typeof window === "undefined" || !recaptchaRef.current) return;

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
            setMessage({ type: "error", text: "reCAPTCHA expired. Please try again." });
          },
        });
        widgetIdRef.current = widgetId;
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
  }, [mounted]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!recaptchaToken) {
      setMessage({ type: "error", text: "Please complete the reCAPTCHA verification." });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase(),
          recaptchaResponse: recaptchaToken
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: data.message || "Password reset link sent to your email!" });
        toast.success("Check your email for the reset link");
      } else {
        setMessage({ type: "error", text: data.detail || "Failed to send reset email" });
        if (window.grecaptcha && widgetIdRef.current !== null) {
          window.grecaptcha.reset(widgetIdRef.current);
          setRecaptchaToken("");
        }
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      setMessage({ type: "error", text: "An error occurred. Please try again." });
      if (window.grecaptcha && widgetIdRef.current !== null) {
        window.grecaptcha.reset(widgetIdRef.current);
        setRecaptchaToken("");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen w-full bg-[#E8E8E8] dark:bg-black dark:bg-opacity-50">
        <div className="flex flex-col items-center space-y-4">
          <Lock className="w-16 h-16 text-[#00FB75] animate-pulse" />
          <p className="text-lg dark:text-white text-gray-800">Sending reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://www.google.com/recaptcha/api.js"
        strategy="afterInteractive"
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

          <form className="flex flex-col gap-4 p-8" onSubmit={handleSubmit}>
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
                <h1 className="text-[34px] dark:text-white">Forgot Password?</h1>
              </div>
              <p className="text-[14px] text-muted-foreground">
                No worries! Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-foreground text-[14px] font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="Enter your email address"
                className="border-2 border-solid bg-transparent border-border rounded-lg p-3 focus:border-[#00FB75] focus:outline-none transition-colors"
                required
              />
            </label>

            {message && (
              <div
                className={`p-4 rounded-lg text-sm ${
                  message.type === 'success'
                    ? 'bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30'
                    : 'bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="flex justify-center my-2">
              <div
                ref={recaptchaRef}
                className="g-recaptcha bg-[#E8E8E8] dark:bg-black dark:bg-opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-[#00FB75] hover:bg-[#00e065] text-black font-bold rounded-xl py-3 px-4 my-2 w-full transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>

            <p className="text-[12px] text-center">
              Remember your password?{" "}
              <a href="/auth/login" className="text-[#00FB75] cursor-pointer hover:underline font-semibold">
                Back to Login
              </a>
            </p>
          </form>

          <div>
            <Image
              src="/assets/login.png"
              alt="Reset password illustration"
              width={400}
              height={400}
              className="hidden md:block"
            />
          </div>
        </div>
      </div>
    </>
  );
}