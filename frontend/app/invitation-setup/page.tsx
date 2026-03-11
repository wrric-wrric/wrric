"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function InvitationSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    // Redirect to the actual complete-registration page with the token
    if (token) {
      router.replace(`/auth/complete-registration?token=${encodeURIComponent(token)}`);
    } else {
      router.replace("/auth/complete-registration");
    }
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-[#00FB75] animate-spin" />
        <p className="text-gray-400">Redirecting to setup page...</p>
      </div>
    </div>
  );
}

export default function InvitationSetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#00FB75] animate-spin" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <InvitationSetupContent />
    </Suspense>
  );
}
