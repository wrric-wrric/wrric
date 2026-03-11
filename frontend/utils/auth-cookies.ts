"use client";

import { useEffect, useState, useCallback } from "react";

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  token: string | null;
  isLoading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    userId: null,
    token: null,
    isLoading: true,
  });

  const getCookie = useCallback((name: string): string | null => {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(";").shift() || null;
    }
    return null;
  }, []);

  useEffect(() => {
    const checkAuth = () => {
      const token = getCookie("token");
      const userId = getCookie("user_id");

      setAuthState({
        isAuthenticated: !!(token && userId),
        userId,
        token: null, // Can't read httpOnly token, but we don't need it
        isLoading: false,
      });
    };

    checkAuth();
  }, [getCookie]);

  return authState;
}

export function getUserId(): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; user_id=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }
  return null;
}

export function clearAuthCookies() {
  if (typeof document === "undefined") return;
  document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  document.cookie = "user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

export function setAuthCookies(token: string, userId: string) {
  if (typeof document === "undefined") return;
  const expires = new Date();
  expires.setTime(expires.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const cookieOptions = `expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  
  document.cookie = `token=${token}; ${cookieOptions}`;
  document.cookie = `user_id=${userId}; ${cookieOptions}`;
}
