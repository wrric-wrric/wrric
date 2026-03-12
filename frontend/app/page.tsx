"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect logic: check auth first, then send to login or dashboard
    const loginData = localStorage.getItem("login_response");
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");

    if (loginData && token) {
      try {
        const data = JSON.parse(loginData);
        if (data.is_admin) {
          router.push("/admin");
          return;
        }
        // Authenticated non-admin users go to events dashboard
        router.push("/events");
        return;
      } catch (e) {
        console.error("Error parsing login data:", e);
      }
    }

    // Unauthenticated users go directly to login page
    router.push("/auth/login");
  }, [router]);

  return null;
}
