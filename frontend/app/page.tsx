"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Redirect authenticated admins to /admin
    const loginData = localStorage.getItem("login_response");
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");

    if (loginData && token) {
      try {
        const data = JSON.parse(loginData);
        if (data.is_admin) {
          router.push("/admin");
        }
      } catch (e) {
        console.error("Error parsing login data:", e);
      }
    }
  }, [router]);

  if (!mounted) return null;

  return (
    <>
      <LandingPage />
    </>
  );
}
