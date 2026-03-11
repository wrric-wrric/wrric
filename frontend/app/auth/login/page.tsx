"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import Image from "next/image";
import { Eye, EyeOff, ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { LinkedInIcon } from "@/components/ui/linkedin-icon";
import toast from "react-hot-toast";

export default function Page() {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__setRecaptchaToken = (token: string) => {
      setRecaptchaToken(token);
      setErrorMsg("");
    };
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined" || !recaptchaRef.current) return;
    const renderRecaptcha = () => {
      if (!window.grecaptcha || !window.grecaptcha.render) return false;
      if (widgetIdRef.current !== null) { window.grecaptcha.reset(widgetIdRef.current); return true; }
      try {
        const widgetId = window.grecaptcha.render(recaptchaRef.current, {
          sitekey: process.env.NEXT_PUBLIC_SITE_KEY!,
          callback: (token: string) => {
            if ((window as any).__setRecaptchaToken) (window as any).__setRecaptchaToken(token);
          },
          "expired-callback": () => { setRecaptchaToken(""); setErrorMsg("reCAPTCHA expired. Please try again."); },
        });
        widgetIdRef.current = widgetId;
        return true;
      } catch { return false; }
    };
    let attempts = 0;
    const poll = setInterval(() => { if (renderRecaptcha() || attempts >= 10) clearInterval(poll); attempts++; }, 500);
    return () => { clearInterval(poll); if (widgetIdRef.current !== null && window.grecaptcha) { window.grecaptcha.reset(widgetIdRef.current); widgetIdRef.current = null; } };
  }, [mounted]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const data: any = { password, recaptchaResponse: recaptchaToken || "local_bypass" };
    if (/.+@.+\..+/.test(usernameOrEmail)) data.email = usernameOrEmail;
    else data.username = usernameOrEmail;
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const response = await res.json();
      if (response?.access_token && response?.user_id) {
        localStorage.setItem("token", response.access_token);
        localStorage.setItem("login_response", JSON.stringify({
          user_id: response.user_id, profiles: response.profiles, username: response.username,
          is_admin: response.is_admin || false, is_judge: response.is_judge || false,
        }));
        toast.success("Signed in successfully!");
        window.location.href = `/auth/login-processing?access_token=${response.access_token}&user_id=${response.user_id}`;
      } else {
        setErrorMsg(response.detail || "Invalid credentials. Please try again.");
      }
    } catch { setErrorMsg("Connection failed. Please check your network."); }
    finally { setLoading(false); }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex">
      <Script src="https://www.google.com/recaptcha/api.js" strategy="afterInteractive" />

      {/* Left panel – navy brand */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 bg-[#1e2a4a] p-12 text-white">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/logos/wrric-logo.jpeg"
            alt="WRRIC Logo"
            width={48}
            height={48}
            className="object-cover rounded-full bg-white shadow-sm flex-shrink-0"
            priority
          />
          <span className="text-xl font-bold tracking-wide">WRRIC Platform</span>
        </div>

        <div className="space-y-6 my-auto">
          <div className="w-16 h-1 bg-blue-500 rounded-full" />
          <h1 className="text-4xl font-bold leading-tight">
            Innovate.<br />
            <span className="text-blue-400">Evaluate.</span><br />
            Excel.
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
            Secure access portal for authorized event administrators and judges.
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>© 2025 WRRIC</span>
          <span>·</span>
          <span>All rights reserved</span>
        </div>
      </div>

      {/* Right panel – white form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden mb-6">
            <Image
              src="/assets/logos/wrric-logo2.jpeg"
              alt="WRRIC Logo"
              width={40}
              height={40}
              className="object-cover rounded-full bg-white shadow-sm flex-shrink-0"
              priority
            />
            <span className="font-bold text-slate-800 text-lg">WRRIC Platform</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-800">Sign in</h2>
            <p className="text-sm text-slate-500 mt-1">Enter your credentials to access your account</p>
          </div>

          {/* Social sign in */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => window.location.href = "/api/auth/google/login"}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Image src="/assets/icons/google.png" alt="Google" width={16} height={16} />
              Google
            </button>
            <button
              onClick={() => window.location.href = "/api/auth/linkedin/login"}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <LinkedInIcon className="w-4 h-4 text-[#0077B5]" />
              LinkedIn
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-slate-50 px-3 text-xs text-slate-400">or continue with email</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email or Username</label>
              <input
                value={usernameOrEmail}
                onChange={e => setUsernameOrEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <a href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Forgot password?</a>
              </div>
              <div className="relative">
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">Remember me</label>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errorMsg}
              </div>
            )}

            <div className="hidden">
              <div ref={recaptchaRef} className="grecaptcha" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign in'}
            </button>

            <p className="text-center text-sm text-slate-500">
              Don't have an account?{' '}
              <a href="/auth/register" className="text-blue-600 hover:text-blue-700 font-medium">Register here</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
