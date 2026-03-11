"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";

export type Session = {
  id: string;
  title: string;
  start_time: string;
  queries: { query_text: string; timestamp: string }[];
  entities: any[]; // use LabProfile[] if available
};

interface SidebarContextType {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;

  // history state (array of sessions)
  history: Session[];
  setHistory: (data: Session[]) => void;
  refreshHistory: () => Promise<void>;

  // loadSession: function the sidebar calls when a user clicks a session
  loadSession?: (session: Session) => void;
  setLoadSession: (fn: ((s: Session) => void) | undefined) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isSidebarOpen: false,
  toggleSidebar: () => {},

  history: [],
  setHistory: () => {},
  refreshHistory: async () => {},

  loadSession: undefined,
  setLoadSession: () => {},
});

interface SidebarProviderProps {
  children: ReactNode;
}

const HISTORY_STORAGE_KEY = 'sidebar_session_history';
const MAX_HISTORY_ITEMS = 10;

export const SidebarProvider = ({ children }: SidebarProviderProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [history, setHistoryState] = useState<Session[]>([]);
  const [mounted, setMounted] = useState(false);
  
  // This holds a function that the labs page provides; default undefined.
  const [loadSession, setLoadSessionState] = useState<
    ((s: Session) => void) | undefined
  >(undefined);

  const toggleSidebar = useCallback(() => setIsSidebarOpen((prev) => !prev), []);

  // Load history from localStorage on mount, then fetch from backend
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load cached history from localStorage first for instant display
    try {
      const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory)) {
          setHistoryState(parsedHistory);
        }
      }
    } catch (error) {
      console.error('[SidebarProvider] Error loading history from localStorage:', error);
    }
    setMounted(true);

    // Fetch fresh history from backend if user is authenticated
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const userId = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
        if (!token || token === "null" || !userId || userId === "null") return;

        const response = await fetch(`/api/history/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            const limited = data.slice(0, MAX_HISTORY_ITEMS);
            setHistoryState(limited);
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(limited));
          }
        }
      } catch (error) {
        console.error('[SidebarProvider] Error fetching history from backend:', error);
      }
    };
    fetchHistory();
  }, []);

  // Refresh history from backend - memoized to prevent re-render loops
  const refreshHistory = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const userId = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
      if (!token || token === "null" || !userId || userId === "null") return;

      const response = await fetch(`/api/history/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          const limited = data.slice(0, MAX_HISTORY_ITEMS);
          setHistoryState(limited);
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(limited));
        }
      }
    } catch (error) {
      console.error('[SidebarProvider] Error refreshing history:', error);
    }
  }, []);

  // Persist history to localStorage whenever it changes - memoized to prevent re-render loops
  const setHistory = useCallback((data: Session[]) => {
    try {
      // Limit to MAX_HISTORY_ITEMS, keeping most recent
      const limitedHistory = data.slice(0, MAX_HISTORY_ITEMS);
      setHistoryState(limitedHistory);
      
      if (typeof window !== "undefined") {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(limitedHistory));
        if (process.env.NODE_ENV === 'development') {
          console.log('[SidebarProvider] History persisted to localStorage:', limitedHistory.length, 'items');
        }
      }
    } catch (error) {
      console.error('[SidebarProvider] Error saving history to localStorage:', error);
      setHistoryState(data);
    }
  }, []);

  // Memoized setLoadSession to prevent re-render loops
  const setLoadSession = useCallback((fn: ((s: Session) => void) | undefined) => {
    setLoadSessionState(() => fn);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isSidebarOpen,
        toggleSidebar,
        history,
        setHistory,
        refreshHistory,
        loadSession,
        setLoadSession,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => useContext(SidebarContext);
