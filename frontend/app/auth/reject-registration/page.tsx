"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { AlertTriangle, ArrowLeft, Loader2, User, Mail, Calendar, CheckCircle2, XCircle } from "lucide-react";
import toast from "react-hot-toast";

interface RejectionResponse {
  valid: boolean;
  email: string;
  first_name: string;
  last_name: string;
  event_id: string;
  event_title?: string;
}

function RejectRegistrationPageContent() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [validationData, setValidationData] = useState<RejectionResponse | null>(null);
  const [validationError, setValidationError] = useState("");
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    setMounted(true);
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
          `/api/auth/reject-registration?token=${encodeURIComponent(token)}`
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

  const handleReject = async () => {
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("token", token);

      const response = await fetch("/api/auth/reject-registration", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setRejected(true);
        toast.success("Your registration has been cancelled");
      } else {
        toast.error(data.detail || "Failed to cancel registration");
      }
    } catch (err) {
      console.error("Reject registration error:", err);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push("/events");
  };

  if (!mounted) {
    return (
      <div className="h-full flex flex-col dark:bg-[#0A0A0A] bg-gray-50">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00FB75] animate-spin" />
        </div>
      </div>
    );
  }

  if (validating) {
    return (
      <div className="h-full flex flex-col dark:bg-[#0A0A0A] bg-gray-50">
        <header className="sticky top-0 z-40 backdrop-blur-md border-b dark:bg-[#0A0A0A]/80 bg-white/80 dark:border-gray-800 border-gray-200 flex-shrink-0">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-lg dark:hover:bg-gray-800 hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <h1 className="text-xl font-semibold">Cancel Registration</h1>
                <p className="text-sm opacity-70">Processing your request</p>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-[#00FB75] animate-spin" />
            <p className="dark:text-gray-400 text-gray-600">Validating your request...</p>
          </div>
        </div>
      </div>
    );
  }

  if (rejected) {
    return (
      <div className="h-full flex flex-col dark:bg-[#0A0A0A] bg-gray-50">
        <header className="sticky top-0 z-40 backdrop-blur-md border-b dark:bg-[#0A0A0A]/80 bg-white/80 dark:border-gray-800 border-gray-200 flex-shrink-0">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/events")}
                className="p-2 rounded-lg dark:hover:bg-gray-800 hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <h1 className="text-xl font-semibold">Cancel Registration</h1>
                <p className="text-sm opacity-70">Registration cancelled</p>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full mx-6 text-center">
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold dark:text-white text-gray-900 mb-2">Registration Cancelled</h2>
              <p className="dark:text-gray-400 text-gray-600 mb-6">
                Your registration has been cancelled and all your data has been removed from our system.
              </p>
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

  if (validationError || !validationData) {
    return (
      <div className="h-full flex flex-col dark:bg-[#0A0A0A] bg-gray-50">
        <header className="sticky top-0 z-40 backdrop-blur-md border-b dark:bg-[#0A0A0A]/80 bg-white/80 dark:border-gray-800 border-gray-200 flex-shrink-0">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-lg dark:hover:bg-gray-800 hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <h1 className="text-xl font-semibold">Cancel Registration</h1>
                <p className="text-sm opacity-70">Invalid request</p>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full mx-6 text-center">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold dark:text-white text-gray-900 mb-2">Invalid Request</h2>
              <p className="dark:text-gray-400 text-gray-600 mb-6">{validationError || "This cancellation link is invalid or has expired."}</p>
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
    <div className="h-full flex flex-col dark:bg-[#0A0A0A] bg-gray-50">
      <header className="sticky top-0 z-40 backdrop-blur-md border-b dark:bg-[#0A0A0A]/80 bg-white/80 dark:border-gray-800 border-gray-200 flex-shrink-0">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg dark:hover:bg-gray-800 hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">Cancel Registration</h1>
              <p className="text-sm opacity-70">Confirm your decision</p>
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
                <div className="p-3 bg-red-500/20 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Cancel Your Registration?</h2>
                  <p className="text-sm dark:text-gray-400 text-gray-600">This action cannot be undone</p>
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-400">
                  <strong>Warning:</strong> If you cancel, all your registration data will be permanently deleted
                  from our system. You will need to register again if you change your mind.
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 dark:dark:bg-gray-800 bg-gray-100/50 bg-gray-100 rounded-lg mb-6">
                <User className="w-5 h-5 text-[#00FB75] mt-0.5" />
                <div>
                  <p className="text-sm font-medium dark:text-white text-gray-900">
                    {validationData.first_name} {validationData.last_name}
                  </p>
                  <p className="text-xs dark:text-gray-400 text-gray-600 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {validationData.email}
                  </p>
                  {validationData.event_title && (
                    <p className="text-xs dark:text-gray-400 text-gray-600 flex items-center gap-1 mt-1">
                      <Calendar className="w-3 h-3" />
                      {validationData.event_title}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-6 py-3.5 rounded-lg border dark:border-gray-700 border-gray-300 dark:text-gray-300 text-gray-700 dark:hover:bg-gray-800 hover:bg-gray-100 transition-colors"
                  disabled={loading}
                >
                  Keep My Registration
                </button>
                <button
                  onClick={handleReject}
                  disabled={loading}
                  className="flex-1 bg-red-500 dark:text-white text-gray-900 font-semibold px-6 py-3.5 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Cancel Registration
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RejectRegistrationPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <RejectRegistrationPageContent />
    </Suspense>
  );
}