"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import AuthPrompt from "@/components/ui/auth-prompt";
import GuestPageContent from "@/components/Lab/GuestPageContent";
import RegisteredUserPageContent from "@/components/Lab/RegisteredUserPageContent";
import { LabProfile } from "../../lib/types";
import { useSidebar } from "@/hooks/sideBarProvider";
import { FlaskConical } from "lucide-react";

// Define TypeScript interfaces
declare global {
  interface Window {
    grecaptcha: {
      render: any;
      reset: (widgetId?: number) => void;
    };
    onRecaptchaSuccess: (token: string) => void;
  }
}

interface Payload {
  sessionId: string | null;
  userId?: string | null;
  query?: string;
  type?: string;
  title?: string;
  recaptchaResponse?: string | null;
  action?: string;
}

export default function Page() {
  // State Management
  const [labProfileData, setLabProfileData] = useState<LabProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LabProfile[]>([]);
  const [searchStatus, setSearchStatus] = useState("Ready to search");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [recaptchaError, setRecaptchaError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showGuestPopup, setShowGuestPopup] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const [authAction, setAuthAction] = useState<string>("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [countryFilter, setCountryFilter] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [selectedType, setSelectedType] = useState("general"); // New for search types: general, publications, websites
  const [history, setLocalHistory] = useState([]); // For query history
  const { setHistory, setLoadSession } = useSidebar();
  const [currentSession, setCurrentSession] = useState(null); // For loaded session
  const [selectedLabs, setSelectedLabs] = useState<string[]>([]); // For broadcast inquiry
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [inquiryText, setInquiryText] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [singleLabId, setSingleLabId] = useState<string | null>(null); // For single inquiry

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchAbortControllerRef = useRef<AbortController | null>(null);

  const router = useRouter();
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const isDark = resolvedTheme === "dark" || theme === "dark";

  // Set mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check authentication status
  const checkAuthStatus = useCallback(() => {
    if (typeof window === "undefined") return false;

    // Check localStorage, sessionStorage, and cookies for token
    let t = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!t || t === "null" || t === "undefined") {
      // Try cookie
      const cookieMatch = document.cookie.match(/(?:^|; )token=([^;]*)/);
      t = cookieMatch ? cookieMatch[1] : null;
    }
    let u = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
    if (!u || u === "null" || u === "undefined") {
      const cookieMatch = document.cookie.match(/(?:^|; )user_id=([^;]*)/);
      u = cookieMatch ? cookieMatch[1] : null;
    }

    const authStatus = !!(t && t !== "null" && t !== "undefined");
    setToken(t);
    setUserId(u);
    setIsAuthenticated(authStatus);

    return authStatus;
  }, []);

  // Fetch lab profile data
  const fetchLabProfileData = useCallback(async (authToken: string | null) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/labs", {
        method: "GET",
        headers: {
          Authorization: authToken || "",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      // console.log("Fetched labs data:", data);
      setLabProfileData(data);
    } catch (error) {
      console.error("Fetch labs error:", error);
      setError((error as Error).message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Session
  const loadSession = useCallback(async (session: any) => {
    setCurrentSession(session);
    setSearchResults(session.entities || []);
  }, []);

  // Track if we've already fetched data to prevent duplicate calls
  const hasFetchedDataRef = useRef(false);

  // Fetch user history for registered users
  const fetchUserHistory = useCallback(async () => {
    if (!userId || !token) return;
    try {
      const response = await fetch(`/api/history/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        // console.log('History', data)
        setLocalHistory(data);
        setHistory?.(data);

        // register the local loadSession handler so sidebar can call it
        setLoadSession?.(() => loadSession);
      }
    } catch (error) {
      console.error("Fetch history error:", error);
    }
  }, [userId, token, setHistory, setLoadSession, loadSession]);

  // Handle reCAPTCHA token
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__setRecaptchaToken = (token: string) => {
        setRecaptchaToken(token);
        setRecaptchaError("");
        // console.log("reCAPTCHA token set:", token);
      };
    }
  }, []);

  // Track if this is the user's first visit to show guest popup
  const hasShownGuestPopupRef = useRef(false);
  const GUEST_POPUP_SHOWN_KEY = 'labs_guest_popup_shown';

  // Monitor auth state and fetch data (separated from popup logic)
  // Use refs to prevent infinite loops from callback dependencies
  useEffect(() => {
    // Skip if we've already fetched data for this auth state
    if (hasFetchedDataRef.current) return;
    
    const authStatus = checkAuthStatus();

    if (authStatus) {
      setShowGuestPopup(false);
      hasFetchedDataRef.current = true;
      fetchLabProfileData(token);
      fetchUserHistory();
    } else {
      hasFetchedDataRef.current = true;
      fetchLabProfileData(null);
      setLoading(false);
      
      // Only show guest popup on first visit (not every time sidebar opens or page re-renders)
      // Check if we've already shown the popup in this session
      if (!hasShownGuestPopupRef.current) {
        const hasSeenPopup = sessionStorage.getItem(GUEST_POPUP_SHOWN_KEY);
        if (!hasSeenPopup) {
          // Show popup after a short delay on first visit only
          popupTimerRef.current = setTimeout(() => {
            setShowGuestPopup(true);
            sessionStorage.setItem(GUEST_POPUP_SHOWN_KEY, 'true');
            hasShownGuestPopupRef.current = true;
          }, 1500);
        }
      }
    }

    return () => {
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
        popupTimerRef.current = null;
      }
    };
  }, [checkAuthStatus, token, userId, fetchLabProfileData, fetchUserHistory]);

  // Reset fetch flag when user changes (login/logout)
  useEffect(() => {
    hasFetchedDataRef.current = false;
  }, [userId]);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_WEBSOCKET_URL ??
      (process.env.NODE_ENV === "production"
        ? "wss://api.unlokinno.com/ws"
        : "ws://192.168.156.236/ws");
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      // console.log("Successfully connected to Unlokinno Intelligence");
      setSearchStatus("Connected waiting for your search");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // console.log("WebSocket message:", msg);

        if (msg.status === "connected" || msg.status === "authenticated") {
          setSessionId(msg.sessionId);
          localStorage.setItem("sessionId", msg.sessionId);
          setSearchStatus("Connected waiting for your search");
        } else if (msg.status === "queued") {
          setSearchStatus(
            `Query "${msg.message?.split('"')[1] || "query"}" queued for processing`
          );
        } else if (msg.status === "processing") {
          setSearchStatus(`Processing: ${msg.url || "query"}`);
        } else if (msg.status === "entity") {
          setSearchResults((prev) => [...prev, msg.data]);
          setSearchStatus(
            `Found result: ${msg.data.university || msg.data.display_name || "lab"}`
          );
        } else if (msg.status === "complete") {
          setIsSearching(false);
          setSearchStatus("Search completed successfully.");
          searchAbortControllerRef.current = null;
        } else if (msg.status === "stopped") {
          setIsSearching(false);
          setSearchStatus("Search stopped.");
          searchAbortControllerRef.current = null;
        } else if (msg.status === "error") {
          setIsSearching(false);
          // Log backend error to console for debugging but show user-friendly message
          console.error("Search error from backend:", msg.reason || msg.message || "Unknown error");
          setSearchStatus("Search encountered an issue. Please try again.");
          searchAbortControllerRef.current = null;
        }
      } catch (e) {
        console.error("Error processing WebSocket message:", e, "Raw data:", event.data);
      }
    };

    ws.onclose = () => {
      setIsSearching(false);
      searchAbortControllerRef.current = null;
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        // console.log(
        //   `Connection lost. Reconnecting (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`
        // );
        setTimeout(connectWebSocket, 1000 * reconnectAttemptsRef.current);
      } else {
        setSearchStatus("Unable to connect after multiple attempts.");
      }
    };

    ws.onerror = (event) => {
      if (ws.readyState === WebSocket.CLOSED) {
        console.info("ℹ️ WebSocket closed (readyState 3). Will attempt reconnect...");
        console.info("🔎 URL:", ws.url);
      } else {
        console.error("❌ WebSocket error event:", event);
        console.error("🔎 Ready state:", ws.readyState);
        console.error("🔎 URL:", ws.url);
      }
      setSearchStatus("Connection error. Attempting to reconnect...");
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    const cleanup = connectWebSocket();
    return cleanup;
  }, [connectWebSocket]);

  // Send search query
  const sendSearchQuery = () => {
    if (!searchQuery.trim()) return;

    if (!isAuthenticated && !recaptchaToken) {
      setRecaptchaError("Please complete the reCAPTCHA.");
      setSearchStatus("reCAPTCHA required for guest search.");
      // Show guest popup when guest tries to search without reCAPTCHA
      setShowGuestPopup(true);
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setSearchStatus("WebSocket not connected.");
      return;
    }

    // Cancel any ongoing search
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }

    // Create new abort controller for this search
    searchAbortControllerRef.current = new AbortController();

    setIsSearching(true);
    setSearchResults([]);
    setSearchStatus("Initiating search...");

    const payload: Payload = {
      sessionId,
      ...(isAuthenticated && { userId }),
      query: searchQuery,
      type: selectedType,
      title: searchQuery,
      ...(isAuthenticated ? { token } : { recaptchaResponse: recaptchaToken }),
    };

    try {
      wsRef.current.send(JSON.stringify(payload));

      if (!isAuthenticated) {
        setRecaptchaToken("");
        if (window.grecaptcha && document.getElementById("recaptcha-widget")) {
          window.grecaptcha.reset();
        }
      }
    } catch (error) {
      console.error("Error sending search query:", error);
      setIsSearching(false);
      setSearchStatus("Failed to send search query.");
      searchAbortControllerRef.current = null;
    }
  };

  // Cancel search
  const cancelSearch = useCallback(() => {
    // console.log("Cancelling search...");
    
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
      searchAbortControllerRef.current = null;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && sessionId) {
      try {
        wsRef.current.send(
          JSON.stringify({
            sessionId,
            action: "cancel",
          })
        );
        // console.log("Cancel message sent via WebSocket");
      } catch (error) {
        console.error("Error sending cancel message:", error);
      }
    }

    setIsSearching(false);
    setSearchStatus("Search cancelled.");
    setSearchResults([]);
    
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }
  }, [sessionId]);

  // Handle search input change for textarea
  const handleSearchChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      sendSearchQuery();
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchStatus("Ready to search");
    setRecaptchaToken("");
    setRecaptchaError("");
    if (window.grecaptcha && document.getElementById("recaptcha-widget")) {
      window.grecaptcha.reset();
    }
  };


  // Handle Add Lab click
  const handleAddLabClick = () => {
    if (!token || !userId) {
      setAuthAction("add lab");
      setIsAuthPromptOpen(true);
    } else {
      router.push(`/labs/new`);
    }
  };

  // Handle View Labs
  const handleViewLabs = () => {
    router.push('/labs');
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('sessionId');
    localStorage.removeItem('currentTitle');
    localStorage.removeItem('banner_dismissed'); // Clear banner dismissals on logout
    router.push('/auth/login');
  };

  // Handle Feedback Submit
  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim()) return;
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ feedback: feedbackText }),
      });
      setShowFeedbackModal(false);
      setFeedbackText('');
    } catch (error) {
      console.error('Feedback error:', error);
    }
  };

  // Handle Inquiry Submit (single)
  const handleInquirySubmit = async () => {
    if (!inquiryText.trim() || !singleLabId) return;
    const u_id = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
    try {
      await fetch('/api/inquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({user_id: u_id, labId: singleLabId, inquiry: inquiryText }),
      });
      setShowInquiryModal(false);
      setInquiryText('');
      setSingleLabId(null);
    } catch (error) {
      console.error('Inquiry error:', error);
    }
  };

  // Handle Broadcast Submit
  const handleBroadcastSubmit = async () => {
    if (!inquiryText.trim() || selectedLabs.length === 0) return;
    const u_id = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
    try {
      await fetch('/api/broadcast-inquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({user_id: u_id, labIds: selectedLabs, inquiry: inquiryText }),
      });
      setShowBroadcastModal(false);
      setInquiryText('');
      setSelectedLabs([]);
    } catch (error) {
      console.error('Broadcast error:', error);
    }
  };

  // Filter labs based on source + country + sector (U-3.2.4)
  const filteredLabs = labProfileData.filter((lab) => {
    if (filterType === "pending" && lab.source !== "scraped") return false;
    if (filterType === "completed" && lab.source !== "user") return false;
    if (countryFilter && !(lab.location?.country || "").toLowerCase().includes(countryFilter.toLowerCase())) return false;
    if (sectorFilter) {
      const techFocus = Array.isArray(lab.climate_tech_focus) ? lab.climate_tech_focus.join(" ").toLowerCase() : "";
      const deptFocus = (lab.department?.focus || "").toLowerCase();
      if (!techFocus.includes(sectorFilter.toLowerCase()) && !deptFocus.includes(sectorFilter.toLowerCase())) return false;
    }
    return true;
  });

  // Sort labs (U-3.2.3)
  const sortedLabs = [...filteredLabs].sort((a, b) => {
    switch (sortBy) {
      case "most_liked": return ((b as any).like_count || 0) - ((a as any).like_count || 0);
      case "most_commented": return ((b as any).comment_count || 0) - ((a as any).comment_count || 0);
      case "most_viewed": return ((b as any).view_count || 0) - ((a as any).view_count || 0);
      case "newest":
      default:
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
    }
  });

  // Combine with search results
  const displayData =
    searchResults.length > 0
      ? searchResults
      : sortedLabs.filter((lab) =>
          [
            lab.university || "",
            lab.display_name || "",
            lab.department?.focus || "",
            lab.location?.city || "",
            lab.location?.country || "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Render loading state
  if (!mounted) {
    // Use neutral colors that work for both light and dark themes during SSR
    // to avoid hydration mismatch
    return (
      <div className="flex justify-center items-center h-screen w-full transition-colors duration-300 bg-neutral-100 dark:bg-[#0A0A0A]">
        <div className="flex flex-col items-center space-y-4">
          <FlaskConical className="w-16 h-16 animate-spin text-[#00FB75]" />
          <p className="text-lg text-neutral-600 dark:text-gray-200">
            Loading labs...
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={`flex justify-center items-center h-screen w-full ${
          isDark ? "bg-black text-white" : "bg-white text-black"
        }`}
      >
        <div className="flex flex-col items-center space-y-4">
          <FlaskConical
            className={`w-16 h-16 animate-spin ${
              isDark ? "text-[#00FB75]" : "text-gray-800"
            }`}
          />
          <p className={`text-lg ${isDark ? "text-white" : "text-gray-800"}`}>
            Loading labs...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex justify-center items-center h-screen w-full ${
          isDark ? "bg-black text-white" : "bg-white text-black"
        }`}
      >
        <div
          className={`text-center max-w-md p-6 rounded-xl ${
            isDark ? "bg-[#181818]" : "bg-gray-100"
          }`}
        >
            <div className="flex justify-center mb-4">
              <FlaskConical
                className="w-16 h-16 text-[#00FB75] animate-spin"
              />
            </div>
          <h2 className="text-xl font-bold mb-2">Error Loading Labs</h2>
          <p className={`mb-6 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {error}
          </p>
          <button
            onClick={() => fetchLabProfileData(token)}
            className="bg-[#00FB75] text-black font-bold px-4 py-2 rounded-lg hover:bg-green-500 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {isAuthenticated ? (
        <RegisteredUserPageContent
          isDark={isDark}
          searchQuery={searchQuery}
          isSearching={isSearching}
          filterType={filterType}
          setFilterType={setFilterType}
          handleSearchChange={handleSearchChange}
          handleSearchSubmit={handleSearchSubmit}
          clearSearch={clearSearch}
          onCancelExternal={cancelSearch}
          onSearchInitiate={sendSearchQuery}
          handleAddLabClick={handleAddLabClick}
          searchStatus={searchStatus}
          searchResults={searchResults}
          displayData={displayData}
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          history={history}
          loadSession={loadSession}
          currentSession={currentSession}
          selectedLabs={selectedLabs}
          setSelectedLabs={setSelectedLabs}
          showBroadcastModal={showBroadcastModal}
          setShowBroadcastModal={setShowBroadcastModal}
          inquiryText={inquiryText}
          setInquiryText={setInquiryText}
          handleBroadcastSubmit={handleBroadcastSubmit}
          showFeedbackModal={showFeedbackModal}
          setShowFeedbackModal={setShowFeedbackModal}
          feedbackText={feedbackText}
          setFeedbackText={setFeedbackText}
          handleFeedbackSubmit={handleFeedbackSubmit}
          showInquiryModal={showInquiryModal}
          setShowInquiryModal={setShowInquiryModal}
          singleLabId={singleLabId}
          setSingleLabId={setSingleLabId}
          handleInquirySubmit={handleInquirySubmit}
          handleViewLabs={handleViewLabs}
          handleLogout={handleLogout}
          sortBy={sortBy}
          setSortBy={setSortBy}
          countryFilter={countryFilter}
          setCountryFilter={setCountryFilter}
          sectorFilter={sectorFilter}
          setSectorFilter={setSectorFilter}
        />
      ) : (
        <GuestPageContent
          isDark={isDark}
          searchQuery={searchQuery}
          isSearching={isSearching}
          filterType={filterType}
          setFilterType={setFilterType}
          handleSearchChange={handleSearchChange}
          handleSearchSubmit={handleSearchSubmit}
          clearSearch={clearSearch}
          onCancelExternal={cancelSearch}
          onSearchInitiate={sendSearchQuery}
          handleAddLabClick={handleAddLabClick}
          showGuestPopup={showGuestPopup}
          setShowGuestPopup={setShowGuestPopup}
          recaptchaToken={recaptchaToken}
          recaptchaError={recaptchaError}
          searchStatus={searchStatus}
          searchResults={searchResults}
          displayData={displayData}
          setIsAuthPromptOpen={setIsAuthPromptOpen}
          setAuthAction={setAuthAction}
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          sortBy={sortBy}
          setSortBy={setSortBy}
          countryFilter={countryFilter}
          setCountryFilter={setCountryFilter}
          sectorFilter={sectorFilter}
          setSectorFilter={setSectorFilter}
        />
      )}

      {isAuthPromptOpen && (
        <AuthPrompt
          action={authAction}
          onClose={() => setIsAuthPromptOpen(false)}
        />
      )}
    </>
  );
}