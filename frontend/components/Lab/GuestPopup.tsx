"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { X, Shield } from "lucide-react";

interface GuestPopupProps {
  isDark: boolean;
  showGuestPopup: boolean;
  setShowGuestPopup: (value: boolean) => void;
  recaptchaToken: string;
  recaptchaError: string;
}

export default function GuestPopup({
  isDark,
  showGuestPopup,
  setShowGuestPopup,
  recaptchaToken,
  recaptchaError,
}: GuestPopupProps) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // -----------------------------------------------------------------
  // Force reCAPTCHA rendering when popup becomes visible
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!showGuestPopup) return;
    
    const renderRecaptcha = () => {
      if (typeof window === "undefined") return;
      if (!window.grecaptcha || typeof window.grecaptcha.render !== "function") {
        // If grecaptcha isn't loaded yet, retry after a short delay
        setTimeout(renderRecaptcha, 200);
        return;
      }

      const siteKey = process.env.NEXT_PUBLIC_SITE_KEY;
      if (!siteKey) {
        console.error("reCAPTCHA site key not configured (NEXT_PUBLIC_SITE_KEY)");
        return;
      }

      const container = widgetRef.current;
      if (!container) return;

      // Clear any existing content
      container.innerHTML = '';

      // Reset existing widget if any
      if (widgetIdRef.current !== null) {
        window.grecaptcha.reset(widgetIdRef.current);
        return;
      }

      // Render new widget with explicit parameters to ensure visibility
      try {
        const widgetId = window.grecaptcha.render(container, {
          sitekey: siteKey,
          theme: isDark ? "dark" : "light",
          size: "normal",
          callback: (token: string) => {
            if ((window as any).__setRecaptchaToken) (window as any).__setRecaptchaToken(token);
          },
          "expired-callback": () => {
            if ((window as any).__setRecaptchaToken) (window as any).__setRecaptchaToken("");
          },
          "error-callback": () => {
            if ((window as any).__setRecaptchaToken) (window as any).__setRecaptchaToken("");
          }
        });

        widgetIdRef.current = widgetId;
        
        // Force visible state
        const iframe = container.querySelector('iframe');
        if (iframe) {
          iframe.style.visibility = 'visible';
          iframe.style.display = 'block';
        }
      } catch (error) {
        console.error('reCAPTCHA rendering error:', error);
      }
    };

    // Small delay to ensure DOM is ready
    setTimeout(renderRecaptcha, 50);
  }, [showGuestPopup, isDark]);

  // -----------------------------------------------------------------
  // Handle backdrop click
  // -----------------------------------------------------------------
  useEffect(() => {
    const handleBackdropClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowGuestPopup(false);
      }
    };

    if (showGuestPopup) {
      document.addEventListener('mousedown', handleBackdropClick);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleBackdropClick);
      document.body.style.overflow = 'unset';
    };
  }, [showGuestPopup, setShowGuestPopup]);

  // -----------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (widgetIdRef.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  if (!showGuestPopup) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${
        isDark ? "bg-black/80" : "bg-black/40"
      }`}
    >
      <div
        ref={popupRef}
        className={`relative rounded-2xl shadow-xl max-w-sm w-full p-5 border animate-in zoom-in duration-200 ${
          isDark
            ? "bg-[#1a1a1a] border-gray-700 text-white"
            : "bg-white border-gray-200 text-gray-900"
        }`}
      >
        {/* ----- Close button ----- */}
        <button
          onClick={() => setShowGuestPopup(false)}
          className={`absolute top-3 right-3 transition-colors p-1 rounded-full ${
            isDark
              ? "text-gray-400 hover:text-white hover:bg-gray-700"
              : "text-gray-400 hover:text-gray-900 hover:bg-gray-100"
          }`}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ----- Header ----- */}
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-[#00FB75]" />
          <h2 className="text-lg font-semibold">Verify to Continue</h2>
        </div>

        {/* ----- Instructions ----- */}
        <p className={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          Complete the check below to browse as a guest.
        </p>

        {/* ----- reCAPTCHA container ----- */}
        <div className="mb-4 flex justify-center">
          <div
            ref={widgetRef}
            className="g-recaptcha"
            style={{ visibility: 'visible', opacity: 1 }}
          />
        </div>
        {recaptchaError && (
          <p className="text-xs text-red-500 text-center mb-3">{recaptchaError}</p>
        )}

        {/* ----- Buttons ----- */}
        <div className="flex gap-2">
          <Button
            onClick={() => setShowGuestPopup(false)}
            disabled={!recaptchaToken}
            className={`flex-1 text-sm py-2 ${
              isDark
                ? "bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 disabled:opacity-50"
                : "bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300 disabled:opacity-50"
            }`}
          >
            Continue as Guest
          </Button>

          <Link href="/auth/login" className="flex-1">
            <Button className="w-full text-sm py-2 bg-[#00FB75] text-black font-medium hover:bg-green-400">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}