"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useTheme } from "next-themes";
import { Sun, Moon, Lock, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import toast from "react-hot-toast";


function ResetPasswordContent() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validToken, setValidToken] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  
  const validateToken = useCallback(async () => {
    if (!token) {
      setValidToken(false);
      return;
    }
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/reset-password/validate?token=${token}`
      );
      const data = await response.json();
      setValidToken(data.valid);
      setEmail(data.email || "");
    } catch (err) {
      console.error("Token validation error:", err);
      setValidToken(false);
    }
  }, [token]);

  useEffect(() => {
    setMounted(true);
    validateToken();
  }, [validateToken]);
  
  const renderRecaptcha = useCallback(() => {
    if (!window.grecaptcha || !recaptchaRef.current || widgetIdRef.current !== null) {
      return;
    }
    
    try {
      const widgetId = window.grecaptcha.render(recaptchaRef.current, {
        sitekey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || process.env.NEXT_PUBLIC_SITE_KEY!,
        theme: theme === "dark" ? "dark" : "light",
        callback: (token: string) => {
          console.log("reCAPTCHA callback triggered:", token);
          setRecaptchaToken(token);
          setError("");
        },
        "expired-callback": () => {
          setRecaptchaToken("");
          setError("reCAPTCHA expired. Please verify again.");
          if (widgetIdRef.current !== null) {
            window.grecaptcha.reset(widgetIdRef.current);
          }
        },
        "error-callback": () => {
          setError("reCAPTCHA error. Please refresh the page.");
        },
      });
      
      widgetIdRef.current = widgetId;
      console.log("reCAPTCHA widget rendered successfully, ID:", widgetId);
    } catch (err) {
      console.error("Error rendering reCAPTCHA:", err);
      setError("Failed to load reCAPTCHA. Please refresh the page.");
    }
  }, [theme]);
  
  const resetRecaptcha = () => {
    if (widgetIdRef.current !== null && window.grecaptcha) {
      window.grecaptcha.reset(widgetIdRef.current);
      setRecaptchaToken("");
    }
  };
  
  // Initialize reCAPTCHA when it's loaded and component is ready
  useEffect(() => {
    if (recaptchaReady && recaptchaRef.current && mounted && validToken === true) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        renderRecaptcha();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [recaptchaReady, mounted, validToken, renderRecaptcha]);
  
  // Handle reCAPTCHA script load
  const onRecaptchaLoad = () => {
    console.log("reCAPTCHA script loaded");
    setRecaptchaReady(true);
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Reset reCAPTCHA on unmount
      if (widgetIdRef.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(widgetIdRef.current);
      }
    };
  }, []);
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!recaptchaToken) {
      setError("Please complete the reCAPTCHA verification.");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          new_password: newPassword,
          recaptchaResponse: recaptchaToken
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success("Password reset successfully! You can now login.");
        setTimeout(() => {
          router.push("/auth/login");
        }, 2000);
      } else {
        setError(data.detail || "Failed to reset password");
        resetRecaptcha();
      }
    } catch (err) {
      console.error("Reset password error:", err);
      setError("An error occurred. Please try again.");
      resetRecaptcha();
    } finally {
      setLoading(false);
    }
  };
  
  if (validToken === null) {
    return (
      <div className="flex justify-center items-center h-screen w-full bg-[#E8E8E8] dark:bg-black dark:bg-opacity-50">
        <div className="flex flex-col items-center space-y-4">
          <Lock className="w-16 h-16 text-[#00FB75] animate-spin" />
          <p className="text-lg dark:text-white text-gray-800">Validating reset token...</p>
        </div>
      </div>
    );
  }
  
  if (!validToken) {
    return (
      <div className="flex flex-col justify-center items-center h-screen w-full bg-[#E8E8E8] dark:bg-black dark:bg-opacity-50 p-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-6 flex justify-center">
            <div className="p-4 bg-red-500/20 rounded-full">
              <XCircle className="w-16 h-16 text-red-500" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-4 dark:text-white text-gray-800">
            Invalid or Expired Link
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            This password reset link is invalid or has expired. Please request a new password reset link.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => router.push("/forgot-password")}
              className="bg-[#00FB75] hover:bg-[#00e065] text-black font-bold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105"
            >
              Request New Link
            </button>
            <button
              onClick={() => router.push("/auth/login")}
              className="border-2 border-[#00FB75] text-[#00FB75] font-bold py-3 px-6 rounded-xl transition-all duration-200 hover:bg-[#00FB75] hover:text-black"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=explicit&onload=onRecaptchaLoadCallback`}
        strategy="afterInteractive"
        onLoad={() => {
          // Define the callback function
          (window as any).onRecaptchaLoadCallback = () => {
            console.log("reCAPTCHA loaded via callback");
            setRecaptchaReady(true);
          };
          
          // Also set it directly if already loaded
          if ((window as any).grecaptcha) {
            setRecaptchaReady(true);
          }
        }}
      />
      
      <div className="md:p-2 flex items-center justify-center w-full h-screen flex-1 bg-[#E8E8E8] dark:bg-black dark:bg-opacity-50">
        <div className="relative grid grid-cols-1 md:grid-cols-2 items-center w-[90%] md:w-[70%] text-card-foreground rounded-2xl bg-sidebar">
          {mounted && (
            <button
              onClick={() => {
                setTheme(theme === "dark" ? "light" : "dark");
                // Reset reCAPTCHA on theme change to ensure proper rendering
                setTimeout(resetRecaptcha, 100);
              }}
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
                <div>
                  <h1 className="text-[34px] dark:text-white">Reset Password</h1>
                  <p className="text-[14px] text-muted-foreground">
                    {email ? `Resetting password for ${email}` : "Create your new password"}
                  </p>
                </div>
              </div>
            </div>
            
            {error && (
              <div className="p-4 rounded-lg text-sm bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30 flex items-start gap-3">
                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            
            <label className="flex flex-col gap-2">
              <span className="text-foreground text-[14px] font-medium">New Password</span>
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                placeholder="Enter new password"
                required
                minLength={8}
                className="border-2 border-solid bg-transparent border-border rounded-lg p-3 focus:border-[#00FB75] focus:outline-none transition-colors"
              />
              {newPassword && newPassword.length < 8 && (
                <p className="text-xs text-yellow-500">
                  Password must be at least 8 characters
                </p>
              )}
            </label>
            
            <label className="flex flex-col gap-2">
              <span className="text-foreground text-[14px] font-medium">Confirm Password</span>
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                placeholder="Confirm new password"
                required
                minLength={8}
                className="border-2 border-solid bg-transparent border-border rounded-lg p-3 focus:border-[#00FB75] focus:outline-none transition-colors"
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs text-red-500">
                  Passwords do not match
                </p>
              )}
              {confirmPassword && confirmPassword === newPassword && confirmPassword.length >= 8 && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Passwords match
                </p>
              )}
            </label>
            
            <div className="flex flex-col gap-2 my-2">
              <span className="text-foreground text-[14px] font-medium">Security Verification</span>
              <div 
                ref={recaptchaRef}
                id="reset-password-recaptcha"
                className="flex justify-center min-h-[78px]"
              >
                {!recaptchaReady && (
                  <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg w-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00FB75]"></div>
                    <span className="ml-3 text-sm text-muted-foreground mt-2">Loading security check...</span>
                  </div>
                )}
              </div>
              {recaptchaReady && !recaptchaToken && (
                <p className="text-xs text-center text-muted-foreground">
                  Please complete the security check above
                </p>
              )}
            </div>
            
            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 8 || !recaptchaToken}
              className="bg-[#00FB75] hover:bg-[#00e065] text-black font-bold rounded-xl py-3 px-4 my-2 w-full transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
            
            <p className="text-[12px] text-center">
              Remember your password?{" "}
              <a href="/auth/login" className="text-[#00FB75] cursor-pointer hover:underline font-semibold">
                Back to Login
              </a>
            </p>
          </form>
          
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="mb-4 p-4 bg-green-500/20 rounded-full inline-block">
                <CheckCircle2 className="w-16 h-16 text-[#00FB75]" />
              </div>
              <h3 className="text-xl font-bold mb-2 dark:text-white">Secure Your Account</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Create a strong password with at least 8 characters. Avoid using common words or personal information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}