// "use client";

// import { useState, useEffect, useRef, useCallback } from "react";
// import Link from "next/link";
// import Image from "next/image";
// import Script from "next/script";
// import { Button } from "@/components/ui/button";
// import { useRouter } from "next/navigation";
// import { useTheme } from "next-themes";
// import {
//   FlaskConical,
//   Search,
//   X,
//   MapPin,
//   Tags,
//   Mail,
//   User2,
//   ExternalLink,
//   ChevronDown,
//   Globe,
//   GraduationCap,
//   ArrowUp,
// } from "lucide-react";
// import { LabProfile } from "../../lib/types";
// import AuthPrompt from "../../components/ui/auth-prompt";

// // Define TypeScript interfaces
// declare global {
//   interface Window {
//     grecaptcha: {
//       reset: (widgetId?: number) => void;
//     };
//     onRecaptchaSuccess: (token: string) => void;
//     __setRecaptchaToken: (token: string) => void;
//   }
// }

// interface Payload {
//   sessionId: string | null;
//   userId?: string | null;
//   query?: string;
//   type?: string;
//   title?: string;
//   recaptchaResponse?: string | null;
//   action?: string;
// }

// // LabCard Component
// const LabCard = ({
//   lab,
//   isDark,
//   failedFaviconUrls,
//   handleFaviconError,
// }: {
//   lab: LabProfile;
//   isDark: boolean;
//   failedFaviconUrls: Set<string>;
//   handleFaviconError: (url: string | null) => void;
// }) => {
//   const getFaviconUrl = (labUrl: string | undefined): string | null => {
//     if (!labUrl) return null;
//     try {
//       const domain = new URL(labUrl).hostname;
//       return `https://www.google.com/s2/favicons?domain=${domain}&sz=40`;
//     } catch {
//       return null;
//     }
//   };

//   const faviconUrl = getFaviconUrl(lab.url);
//   const isFaviconFailed = faviconUrl && failedFaviconUrls.has(faviconUrl);

//   return (
//     <div className="group block">
//       <div
//         className={`h-full rounded-2xl border p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden ${
//           isDark
//             ? "bg-[#181818] border-[#333] hover:border-[#00FB75]/50"
//             : "bg-white border-gray-200 hover:border-green-200/50"
//         }`}
//         title={
//           lab.source === "scraped"
//             ? "Identified by AI discovery agent"
//             : "Manually verified lab"
//         }
//       >
//         {/* Diagonal Ribbon */}
//         {lab.source?.toLowerCase() === "scraped" ? (
//           <div className="absolute top-0 right-0 overflow-hidden w-32 h-32">
//             <div className="absolute transform rotate-45 bg-gradient-to-r from-[#00FB75] to-green-500 text-black text-xs font-semibold py-1 px-4 shadow-md top-4 right-[-30px]">
//               AI Discovery
//             </div>
//           </div>
//         ) : (
//           <div className="absolute top-0 right-0 overflow-hidden w-32 h-32">
//             <div className="absolute transform rotate-45 bg-[#181818] text-[#00FB75] text-xs font-semibold py-1 px-4 shadow-md top-4 right-[-30px] border border-[#00FB75]">
//               User Created
//             </div>
//           </div>
//         )}

//         {/* Header */}
//         <div className="flex items-start gap-4 mb-4">
//           <div className="flex-shrink-0">
//             {lab.logo_url ? (
//               <Image
//                 src={lab.logo_url}
//                 alt={`${lab.university || lab.display_name} logo`}
//                 width={48}
//                 height={48}
//                 className="rounded-full border-2 border-[#00FB75] group-hover:scale-105 transition-transform duration-200"
//                 onError={() => handleFaviconError(lab.logo_url)}
//               />
//             ) : faviconUrl && !isFaviconFailed ? (
//               <Image
//                 src={faviconUrl}
//                 alt={`${lab.university || lab.display_name} favicon`}
//                 width={48}
//                 height={48}
//                 className="rounded-full border-2 border-[#00FB75] group-hover:scale-105 transition-transform duration-200"
//                 onError={() => handleFaviconError(faviconUrl)}
//               />
//             ) : (
//               <div
//                 className={`w-12 h-12 bg-gradient-to-br from-[#00FB75] to-green-500 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform duration-200 ${
//                   isDark ? "text-white" : "text-black"
//                 }`}
//               >
//                 <FlaskConical className="w-6 h-6" />
//               </div>
//             )}
//           </div>
//           <div className="flex-1 min-w-0">
//             <h3
//               className={`font-bold text-lg truncate transition-colors group-hover:text-[#00FB75] ${
//                 isDark ? "text-white" : "text-gray-900"
//               }`}
//             >
//               {lab.university || lab.display_name || "Research Lab"}
//             </h3>
//             {lab.url ? (
//               <button
//                 onClick={(e) => {
//                   e.stopPropagation();
//                   window.open(lab.url, "_blank", "noopener,noreferrer");
//                 }}
//                 className={`text-sm flex items-center gap-1 mt-1 transition-colors ${
//                   isDark
//                     ? "text-gray-400 hover:text-[#00FB75]"
//                     : "text-gray-600 hover:text-[#00FB75]"
//                 }`}
//                 title="Visit website"
//               >
//                 <Globe className="w-3 h-3" />
//                 {new URL(lab.url).hostname.replace(/^www\./, "")}
//               </button>
//             ) : (
//               <p
//                 className={`text-sm mt-1 ${
//                   isDark ? "text-gray-400" : "text-gray-600"
//                 }`}
//               >
//                 {lab.department?.name || "Department"}
//               </p>
//             )}
//           </div>
//         </div>

//         {/* Details */}
//         <div className="space-y-3 mb-4">
//           <div className="flex items-center gap-2 text-sm text-gray-300">
//             <MapPin className="w-4 h-4 text-[#00FB75]" />
//             <span>
//               {lab.location?.city || "N/A"}, {lab.location?.country || "N/A"}
//             </span>
//           </div>
//           {lab.department?.focus && (
//             <div className="flex items-center gap-2 text-sm text-gray-300">
//               <GraduationCap className="w-4 h-4 text-[#00FB75]" />
//               <span>{lab.department.focus}</span>
//             </div>
//           )}
//           {lab.point_of_contact?.email && (
//             <div className="flex items-center gap-2 text-sm text-gray-300">
//               <Mail className="w-4 h-4 text-[#00FB75]" />
//               <span className="truncate">{lab.point_of_contact.email}</span>
//             </div>
//           )}
//         </div>

//         {/* Contact Avatar */}
//         <div className="flex items-center gap-3 mb-6">
//           {lab.point_of_contact?.bio_url ? (
//             <Image
//               src={lab.point_of_contact.bio_url}
//               alt={lab.point_of_contact.name || "Contact"}
//               width={32}
//               height={32}
//               className="rounded-full border-2 border-[#00FB75] group-hover:scale-110 transition-transform"
//               onError={() => handleFaviconError(lab.point_of_contact.bio_url)}
//             />
//           ) : (
//             <div
//               className={`w-8 h-8 bg-[#00FB75] rounded-full flex items-center justify-center ${
//                 isDark ? "text-white" : "text-black"
//               }`}
//             >
//               <User2 className="w-4 h-4" />
//             </div>
//           )}
//           <span
//             className={`text-sm font-medium ${
//               isDark ? "text-white" : "text-gray-900"
//             }`}
//           >
//             {lab.point_of_contact?.name || "Contact"}
//           </span>
//         </div>

//         {/* Action Button */}
//         <Link href={`/labs/${lab.id}`}>
//           <Button
//             className={`w-full bg-gradient-to-r from-[#00FB75] to-green-500 text-black font-bold hover:from-green-500 hover:to-emerald-500 transition-all duration-200 shadow-lg ${
//               isDark ? "text-white" : "text-black"
//             }`}
//           >
//             View Details
//             <ExternalLink className="w-4 h-4 ml-2" />
//           </Button>
//         </Link>
//       </div>
//     </div>
//   );
// };

// type SearchBarProps = {
//   searchQuery: string;
//   isSearching: boolean;
//   isDark: boolean;
//   handleSearchChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
//   handleSearchSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
//   clearSearch: () => void;
//   onCancelExternal?: () => void;
//   onSearchInitiate?: () => void;
// };

// function SearchBar({
//   searchQuery,
//   isSearching,
//   isDark,
//   handleSearchChange,
//   handleSearchSubmit,
//   clearSearch,
//   onCancelExternal,
//   onSearchInitiate,
// }: SearchBarProps) {
//   const formRef = useRef<HTMLFormElement | null>(null);
//   const textareaRef = useRef<HTMLTextAreaElement | null>(null);

//   // Auto-resize textarea height to match content
//   useEffect(() => {
//     const ta = textareaRef.current;
//     if (!ta) return;
//     ta.style.height = "auto"; // reset
//     // clamp height to max (optional)
//     const maxHeight = 300; // px, change if needed
//     ta.style.height = Math.min(ta.scrollHeight, maxHeight) + "px";
//   }, [searchQuery]);

//   // Left-button click handler (arrow / cancel)
//   const handleLeftButtonClick = (e: React.MouseEvent) => {
//     e.preventDefault();
//     if (isSearching) {
//       // Cancel external API call (preferred)
//       if (onCancelExternal) {
//         onCancelExternal();
//       } else {
//         // fallback: clear the search text
//         clearSearch();
//       }
//     } else {
//       // Initiate search: submit the form programmatically so your
//       // existing handleSearchSubmit receives real FormEvent
//       if (formRef.current) {
//         formRef.current.requestSubmit();
//       }
//       if (onSearchInitiate) onSearchInitiate();
//     }
//   };

//   // Keyboard behavior: Ctrl/Cmd+Enter submits; Enter alone inserts newline
//   const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
//     if ((e.key === "Enter" && (e.ctrlKey || e.metaKey)) && formRef.current) {
//       // Programmatic submit (same as left-arrow click)
//       e.preventDefault();
//       formRef.current.requestSubmit();
//     }
//   };

//   return (
//     <form
//       ref={formRef}
//       onSubmit={handleSearchSubmit}
//       className="flex-1 relative min-w-0"
//       aria-label="Search form"
//     >
//       {/* Left icon button (arrow up or cancel) */}
//       <button
//         type="button"
//         onClick={handleLeftButtonClick}
//         className={`absolute left-3 top-2 z-10 p-1 rounded-full transition-colors focus:outline-none ${
//           isDark ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"
//         }`}
//         title={
//           isSearching
//             ? "Cancel search"
//             : "Start search (or Ctrl/Cmd+Enter)"
//         }
//         aria-label={isSearching ? "Cancel search" : "Start search"}
//       >
//         {isSearching ? <X className="w-5 h-5" /> : <ArrowUp className="w-5 h-5" />}
//       </button>

//       {/* Expanding textarea */}
//       <textarea
//         ref={textareaRef}
//         value={searchQuery}
//         onChange={handleSearchChange}
//         onKeyDown={handleKeyDown}
//         placeholder="Search labs by name, focus, or location..."
//         rows={1}
//         className={`w-full rounded-xl px-12 py-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00FB75] resize-none overflow-hidden transition-all duration-200 min-w-0 ${
//           isDark ? "bg-[#181818] border border-[#333] text-white" : "bg-white border border-gray-300 text-gray-900"
//         }`}
//         aria-label="Search labs"
//       />

//       {/* Right-side status / action (searching indicator or submit) */}
//       <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
//         {isSearching ? (
//           <div className="flex items-center gap-2 text-sm text-gray-400">
//             <div className="w-4 h-4 border-2 border-[#00FB75] border-t-transparent rounded-full animate-spin" />
//             <span className={`${isDark ? "text-gray-200" : "text-gray-800"}`}>Searching</span>
//           </div>
//         ) : (
//           // Accessible submit button as fallback (optional)
//           <button
//             type="submit"
//             className="bg-[#00FB75] text-black px-3 py-1 rounded-lg font-semibold hover:bg-green-500 transition-colors"
//             aria-label="Submit search"
//           >
//             Search
//           </button>
//         )}
//       </div>
//     </form>
//   );
// }

// // FilterDropdown Component
// const FilterDropdown = ({
//   filterType,
//   setFilterType,
//   isDark,
// }: {
//   filterType: string;
//   setFilterType: (value: string) => void;
//   isDark: boolean;
// }) => (
//   <select
//     value={filterType}
//     onChange={(e) => setFilterType(e.target.value)}
//     className={`rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00FB75] border ${
//       isDark
//         ? "bg-[#181818] border-[#333] text-white"
//         : "bg-white border-gray-300 text-gray-900"
//     }`}
//     aria-label="Filter labs"
//   >
//     <option value="all">All Labs</option>
//     <option value="pending">AI Discovered</option>
//     <option value="completed">Verified Labs</option>
//   </select>
// );

// function Page() {
//   // State Management
//   const [labProfileData, setLabProfileData] = useState<LabProfile[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [isSearching, setIsSearching] = useState(false);
//   const [searchResults, setSearchResults] = useState<LabProfile[]>([]);
//   const [searchStatus, setSearchStatus] = useState("Ready to search");
//   const [sessionId, setSessionId] = useState<string | null>(null);
//   const [recaptchaToken, setRecaptchaToken] = useState("");
//   const [recaptchaError, setRecaptchaError] = useState("");
//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const [showGuestPopup, setShowGuestPopup] = useState(false);
//   const [token, setToken] = useState<string | null>(null);
//   const [userId, setUserId] = useState<string | null>(null);
//   const [failedFaviconUrls, setFailedFaviconUrls] = useState<Set<string>>(
//     new Set()
//   );
//   const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
//   const [authAction, setAuthAction] = useState<string>("");
//   const [filterType, setFilterType] = useState("all");

//   const wsRef = useRef<WebSocket | null>(null);
//   const reconnectAttemptsRef = useRef(0);
//   const maxReconnectAttempts = 5;
//   const popupTimerRef = useRef<NodeJS.Timeout | null>(null);
//   const searchAbortControllerRef = useRef<AbortController | null>(null);

//   const router = useRouter();
//   const { theme, resolvedTheme } = useTheme();
//   const [mounted, setMounted] = useState(false);

//   const isDark = resolvedTheme === "dark" || theme === "dark";

//   // Set mounted state
//   useEffect(() => {
//     setMounted(true);
//   }, []);

//   // Check authentication status
//   const checkAuthStatus = useCallback(() => {
//     if (typeof window === "undefined") return false;

//     const t = localStorage.getItem("token") || sessionStorage.getItem("token");
//     const u = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");

//     const authStatus = !!t;
//     setToken(t);
//     setUserId(u);
//     setIsAuthenticated(authStatus);

//     return authStatus;
//   }, []);

//   // Fetch lab profile data
//   const fetchLabProfileData = async (authToken: string | null) => {
//     try {
//       setLoading(true);
//       setError(null);
//       const response = await fetch("/api/labs", {
//         method: "GET",
//         headers: {
//           Authorization: authToken || "",
//         },
//       });
//       if (!response.ok) throw new Error(`HTTP ${response.status}`);
//       const data = await response.json();
//       setLabProfileData(data);
//     } catch (error) {
//       console.error("Fetch labs error:", error);
//       setError((error as Error).message || "Unknown error");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Handle reCAPTCHA token
//   useEffect(() => {
//     if (typeof window !== "undefined") {
//       window.__setRecaptchaToken = (token: string) => {
//         setRecaptchaToken(token);
//         setRecaptchaError("");
//         console.log("reCAPTCHA token set:", token);
//       };
//     }
//   }, []);

//   // Monitor auth state and control guest popup
//   useEffect(() => {
//     const authStatus = checkAuthStatus();

//     if (popupTimerRef.current) {
//       clearTimeout(popupTimerRef.current);
//       popupTimerRef.current = null;
//     }

//     if (authStatus) {
//       setShowGuestPopup(false);
//       fetchLabProfileData(token);
//     } else {
//       fetchLabProfileData(null);
//       setLoading(false);
//       popupTimerRef.current = setTimeout(() => {
//         setShowGuestPopup(true);
//       }, 1000);
//     }

//     return () => {
//       if (popupTimerRef.current) {
//         clearTimeout(popupTimerRef.current);
//       }
//     };
//   }, [checkAuthStatus, token]);

//   // WebSocket connection
//   const connectWebSocket = useCallback(() => {
//     const wsUrl =
//       process.env.NEXT_PUBLIC_WEBSOCKET_URL ??
//       (process.env.NODE_ENV === "production"
//         ? "wss://api.unlokinno.com/ws"
//         : "ws://10.22.129.236/ws");
//     const ws = new WebSocket(wsUrl);

//     ws.onopen = () => {
//       reconnectAttemptsRef.current = 0;
//       console.log("Successfully connected to Unlokinno Intelligence");
//       setSearchStatus("Connected waiting for your search");
//     };

//     ws.onmessage = (event) => {
//       try {
//         const msg = JSON.parse(event.data);
//         console.log("WebSocket message:", msg);

//         if (msg.status === "connected" || msg.status === "authenticated") {
//           setSessionId(msg.sessionId);
//           localStorage.setItem("sessionId", msg.sessionId);
//           setSearchStatus("Connected waiting for your search");
//         } else if (msg.status === "queued") {
//           setSearchStatus(
//             `Query "${msg.message?.split('"')[1] || "query"}" queued for processing`
//           );
//         } else if (msg.status === "processing") {
//           setSearchStatus(`Processing: ${msg.url || "query"}`);
//         } else if (msg.status === "entity") {
//           setSearchResults((prev) => [...prev, msg.data]);
//           setSearchStatus(
//             `Found result: ${msg.data.university || msg.data.display_name || "lab"}`
//           );
//         } else if (msg.status === "complete") {
//           setIsSearching(false);
//           setSearchStatus("Search completed successfully.");
//           searchAbortControllerRef.current = null;
//         } else if (msg.status === "stopped") {
//           setIsSearching(false);
//           setSearchStatus("Search stopped.");
//           searchAbortControllerRef.current = null;
//         } else if (msg.status === "error") {
//           setIsSearching(false);
//           setSearchStatus(`Error: ${msg.reason || msg.message || "Unknown"}`);
//           searchAbortControllerRef.current = null;
//         }
//       } catch (e) {
//         console.error(
//           "Error processing WebSocket message:",
//           e,
//           "Raw data:",
//           event.data
//         );
//       }
//     };

//     ws.onclose = () => {
//       setIsSearching(false);
//       searchAbortControllerRef.current = null;
//       if (reconnectAttemptsRef.current < maxReconnectAttempts) {
//         reconnectAttemptsRef.current++;
//         console.log(
//           `Connection lost. Reconnecting (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`
//         );
//         setTimeout(connectWebSocket, 1000 * reconnectAttemptsRef.current);
//       } else {
//         setSearchStatus("Unable to connect after multiple attempts.");
//       }
//     };

//     ws.onerror = (event) => {
//       if (ws.readyState === WebSocket.CLOSED) {
//         console.info("ℹ️ WebSocket closed (readyState 3). Will attempt reconnect...");
//         console.info("🔎 URL:", ws.url);
//       } else {
//         console.error("❌ WebSocket error event:", event);
//         console.error("🔎 Ready state:", ws.readyState);
//         console.error("🔎 URL:", ws.url);
//       }
//       setSearchStatus("Connection error. Attempting to reconnect...");
//     };

//     wsRef.current = ws;

//     return () => {
//       ws.close();
//     };
//   }, []);

//   useEffect(() => {
//     const cleanup = connectWebSocket();
//     return cleanup;
//   }, [connectWebSocket]);

//   // Send search query
//   const sendSearchQuery = () => {
//     if (!searchQuery.trim()) return;

//     if (!isAuthenticated && !recaptchaToken) {
//       setRecaptchaError("Please complete the reCAPTCHA.");
//       setSearchStatus("reCAPTCHA required for guest search.");
//       return;
//     }

//     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
//       setSearchStatus("WebSocket not connected.");
//       return;
//     }

//     // Cancel any ongoing search
//     if (searchAbortControllerRef.current) {
//       searchAbortControllerRef.current.abort();
//     }

//     // Create new abort controller for this search
//     searchAbortControllerRef.current = new AbortController();

//     setIsSearching(true);
//     setSearchResults([]);
//     setSearchStatus("Initiating search...");

//     const payload: Payload = {
//       sessionId,
//       ...(isAuthenticated && { userId }),
//       query: searchQuery,
//       type: "general",
//       title: searchQuery,
//       ...(isAuthenticated ? { token } : { recaptchaResponse: recaptchaToken }),
//     };

//     try {
//       wsRef.current.send(JSON.stringify(payload));

//       if (!isAuthenticated) {
//         setRecaptchaToken("");
//         if (window.grecaptcha && document.getElementById("recaptcha-widget")) {
//           window.grecaptcha.reset();
//         }
//       }
//     } catch (error) {
//       console.error("Error sending search query:", error);
//       setIsSearching(false);
//       setSearchStatus("Failed to send search query.");
//       searchAbortControllerRef.current = null;
//     }
//   };

//   // Cancel search - Enhanced version
//   const cancelSearch = useCallback(() => {
//     console.log("Cancelling search...");
    
//     // Abort any fetch requests
//     if (searchAbortControllerRef.current) {
//       searchAbortControllerRef.current.abort();
//       searchAbortControllerRef.current = null;
//     }

//     // Send cancel message via WebSocket if connected
//     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && sessionId) {
//       try {
//         wsRef.current.send(
//           JSON.stringify({
//             sessionId,
//             action: "cancel",
//           })
//         );
//         console.log("Cancel message sent via WebSocket");
//       } catch (error) {
//         console.error("Error sending cancel message:", error);
//       }
//     }

//     // Reset search state
//     setIsSearching(false);
//     setSearchStatus("Search cancelled.");
//     setSearchResults([]);
    
//     // Clear any ongoing timers or timeouts
//     if (popupTimerRef.current) {
//       clearTimeout(popupTimerRef.current);
//       popupTimerRef.current = null;
//     }
//   }, [sessionId]);

//   // Handle search input change for textarea
//   const handleSearchChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
//     setSearchQuery(e.target.value);
//   };

//   // Handle search submit
//   const handleSearchSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
//     if (searchQuery.trim()) {
//       sendSearchQuery();
//     }
//   };

//   // Clear search
//   const clearSearch = () => {
//     setSearchQuery("");
//     setSearchResults([]);
//     setSearchStatus("Ready to search");
//     setRecaptchaToken("");
//     setRecaptchaError("");
//     if (window.grecaptcha && document.getElementById("recaptcha-widget")) {
//       window.grecaptcha.reset();
//     }
//   };

//   // Handle failed favicon load
//   const handleFaviconError = (url: string | null) => {
//     if (url) {
//       setFailedFaviconUrls((prev) => new Set(prev).add(url));
//     }
//   };

//   // Handle Add Lab click
//   const handleAddLabClick = () => {
//     if (!token || !userId) {
//       setAuthAction("add lab");
//       setIsAuthPromptOpen(true);
//     } else {
//       router.push(`/labs/new`);
//     }
//   };

//   // Filter labs based on source
//   const filteredLabs = labProfileData.filter((lab) => {
//     if (filterType === "all") return true;
//     if (filterType === "pending") return lab.source === "scraped";
//     if (filterType === "completed") return lab.source === "user";
//     return true;
//   });

//   // Combine with search results
//   const displayData =
//     searchResults.length > 0
//       ? searchResults
//       : filteredLabs.filter((lab) =>
//           [
//             lab.university || "",
//             lab.display_name || "",
//             lab.department?.focus || "",
//             lab.location?.city || "",
//             lab.location?.country || "",
//           ]
//             .join(" ")
//             .toLowerCase()
//             .includes(searchQuery.toLowerCase())
//         );

//   // Cleanup on unmount
//   useEffect(() => {
//     return () => {
//       if (searchAbortControllerRef.current) {
//         searchAbortControllerRef.current.abort();
//       }
//       if (popupTimerRef.current) {
//         clearTimeout(popupTimerRef.current);
//       }
//       if (wsRef.current) {
//         wsRef.current.close();
//       }
//     };
//   }, []);

//   // Render loading state
//   if (!mounted) {
//     return (
//       <div className="flex justify-center items-center h-screen w-full bg-white text-black">
//         <div className="flex flex-col items-center space-y-4">
//           <FlaskConical className="w-12 h-12 text-gray-800 animate-spin" />
//           <p className="text-lg text-gray-800">Loading labs...</p>
//         </div>
//       </div>
//     );
//   }

//   if (loading) {
//     return (
//       <div
//         className={`flex justify-center items-center h-screen w-full ${
//           isDark ? "bg-black text-white" : "bg-white text-black"
//         }`}
//       >
//         <div className="flex flex-col items-center space-y-4">
//           <FlaskConical
//             className={`w-12 h-12 ${
//               isDark ? "text-[#00FB75]" : "text-gray-800"
//             } animate-spin`}
//           />
//           <p className={`text-lg ${isDark ? "text-white" : "text-gray-800"}`}>
//             Loading labs...
//           </p>
//         </div>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div
//         className={`flex justify-center items-center h-screen w-full ${
//           isDark ? "bg-black text-white" : "bg-white text-black"
//         }`}
//       >
//         <div
//           className={`text-center max-w-md p-6 rounded-xl ${
//             isDark ? "bg-[#181818]" : "bg-gray-100"
//           }`}
//         >
//           <FlaskConical className="w-12 h-12 text-red-500 mx-auto mb-4" />
//           <h2 className="text-xl font-bold mb-2">Error Loading Labs</h2>
//           <p className={`mb-6 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
//             {error}
//           </p>
//           <Button
//             onClick={() => fetchLabProfileData(token)}
//             className="bg-[#00FB75] text-black font-bold"
//           >
//             Retry
//           </Button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <>
//       {/* Guest Mode Popup */}
//       {showGuestPopup && !isAuthenticated && (
//         <div
//           className={`fixed inset-0 z-50 flex justify-center items-center p-4 ${
//             isDark ? "bg-black/80" : "bg-white/80"
//           }`}
//         >
//           <div
//             className={`rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 border animate-in fade-in duration-300 ${
//               isDark ? "bg-[#181818] border-[#00FB75]" : "bg-white border-gray-200"
//             }`}
//           >
//             <div className="flex items-center justify-between mb-4">
//               <h2
//                 className={`text-xl font-bold ${
//                   isDark ? "text-white" : "text-gray-900"
//                 }`}
//               >
//                 Guest Access
//               </h2>
//               <button
//                 onClick={() => setShowGuestPopup(false)}
//                 className={`transition-colors ${
//                   isDark
//                     ? "text-gray-400 hover:text-white"
//                     : "text-gray-600 hover:text-gray-900"
//                 }`}
//                 aria-label="Close guest popup"
//               >
//                 <X className="w-5 h-5" />
//               </button>
//             </div>
//             <p
//               className={`text-sm mb-4 ${
//                 isDark ? "text-gray-300" : "text-gray-600"
//               }`}
//             >
//               Welcome! Verify you're human to continue browsing as a guest.
//             </p>
//             <div className="mb-4">
//               <div
//                 id="recaptcha-widget"
//                 className="g-recaptcha"
//                 data-sitekey={process.env.NEXT_PUBLIC_SITE_KEY}
//                 data-callback="onRecaptchaSuccess"
//               ></div>
//               {recaptchaError && (
//                 <p
//                   className={`text-xs mt-2 ${
//                     isDark ? "text-red-400" : "text-red-600"
//                   }`}
//                 >
//                   {recaptchaError}
//                 </p>
//               )}
//             </div>
//             <p
//               className={`text-xs mb-6 ${
//                 isDark ? "text-gray-400" : "text-gray-500"
//               }`}
//             >
//               Sign in for unlimited access and advanced features.
//             </p>
//             <div className="flex flex-col sm:flex-row gap-3">
//               <Button
//                 onClick={() => setShowGuestPopup(false)}
//                 className={`flex-1 ${
//                   isDark
//                     ? "bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
//                     : "bg-gray-100 hover:bg-gray-200 text-black border border-gray-300"
//                 } disabled:opacity-50`}
//                 disabled={!recaptchaToken}
//               >
//                 Continue as Guest
//               </Button>
//               <Link href="/auth/login">
//                 <Button
//                   className={`flex-1 bg-[#00FB75] text-black font-bold hover:bg-green-500 ${
//                     isDark ? "text-white" : "text-black"
//                   }`}
//                 >
//                   Sign In
//                 </Button>
//               </Link>
//             </div>
//           </div>
//         </div>
//       )}

//       <Script
//         src="https://www.google.com/recaptcha/api.js"
//         strategy="afterInteractive"
//       />
//       <div
//         className={`h-screen flex flex-col w-full overflow-hidden ${
//           isDark ? "bg-black text-white" : "bg-white text-black"
//         }`}
//       >
//         {/* Header Section */}
//         <header
//           className={`sticky top-0 z-30 w-full ${
//             isDark
//               ? "bg-gradient-to-r from-black via-[#181818] to-black border-b border-[#00FB75]/20"
//               : "bg-gradient-to-r from-white via-gray-50 to-white border-b border-gray-200/20"
//           } backdrop-blur-md`}
//         >
//           <div className="w-full mx-auto px-4 py-4">
//             <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
//               <div className="flex items-center gap-3 flex-shrink-0">
//                 <FlaskConical className="w-8 h-8 text-[#00FB75]" />
//                 <h1
//                   className={`text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent ${
//                     isDark ? "from-white to-gray-300" : "from-gray-900 to-gray-700"
//                   }`}
//                 >
//                   Unlokinno Labs
//                 </h1>
//               </div>
//               <div className="flex items-center gap-2 w-full max-w-md flex-1 min-w-0">
//                 <SearchBar
//                   searchQuery={searchQuery}
//                   isSearching={isSearching}
//                   isDark={isDark}
//                   handleSearchChange={handleSearchChange}
//                   handleSearchSubmit={handleSearchSubmit}
//                   clearSearch={clearSearch}
//                   onCancelExternal={cancelSearch}
//                   onSearchInitiate={sendSearchQuery}
//                 />
//               </div>
//               <div className="flex items-center gap-2 flex-shrink-0">
//                 <FilterDropdown
//                   filterType={filterType}
//                   setFilterType={setFilterType}
//                   isDark={isDark}
//                 />
//                 <Button
//                   className="bg-[#00FB75] text-black font-bold hover:bg-green-500 transition-all duration-200 whitespace-nowrap"
//                   onClick={handleAddLabClick}
//                 >
//                   + Add Lab
//                 </Button>
//               </div>
//             </div>
//           </div>
//         </header>

//         {/* Main Content - Scrollable */}
//         <main className="flex-1 overflow-y-auto w-full h-0 min-h-0">
          
//           {/* Status Bar */}
//           {searchStatus && searchStatus !== "Ready to search" && (
//             <div className="w-full mx-auto px-4 py-2">
//               <div
//                 className={`rounded-xl p-3 ${
//                   isDark
//                     ? "bg-[#181818] border border-[#00FB75]/20"
//                     : "bg-gray-50 border border-gray-200/20"
//                 }`}
//               >
//                 <p
//                   className={`text-sm flex items-center gap-2 ${
//                     isDark ? "text-gray-300" : "text-gray-700"
//                   }`}
//                 >
//                   <span className="w-2 h-2 bg-[#00FB75] rounded-full animate-pulse" />
//                   {searchStatus}
//                 </p>
//               </div>
//             </div>
//           )}

//           {/* Results Header */}
//           {searchResults.length > 0 && (
//             <div className="w-full mx-auto px-4 py-4">
//               <div className="flex items-center justify-between">
//                 <p className={`${isDark ? "text-gray-400" : "text-gray-600"}`}>
//                   Found {searchResults.length} result
//                   {searchResults.length !== 1 ? "s" : ""} for "{searchQuery}"
//                 </p>
//                 <Button
//                   variant="ghost"
//                   size="sm"
//                   onClick={clearSearch}
//                   className={`${
//                     isDark
//                       ? "text-gray-400 hover:text-white"
//                       : "text-gray-600 hover:text-gray-900"
//                   }`}
//                 >
//                   Clear Search
//                 </Button>
//               </div>
//             </div>
//           )}

//           {/* Labs Grid */}
//           <section className="w-full mx-auto px-4 py-6">
//             {displayData.length === 0 ? (
//               <div
//                 className={`flex flex-col items-center justify-center h-64 text-center ${
//                   isDark ? "text-gray-300" : "text-gray-600"
//                 }`}
//               >
//                 <FlaskConical
//                   className={`w-16 h-16 mb-4 ${
//                     isDark ? "text-gray-500" : "text-gray-400"
//                   }`}
//                 />
//                 <h3
//                   className={`text-xl font-semibold mb-2 ${
//                     isDark ? "text-gray-300" : "text-gray-700"
//                   }`}
//                 >
//                   No Labs Found
//                 </h3>
//                 <p
//                   className={`mb-6 ${isDark ? "text-gray-500" : "text-gray-500"}`}
//                 >
//                   Try adjusting your search or explore all labs.
//                 </p>
//                 <Button
//                   onClick={clearSearch}
//                   className="bg-[#00FB75] text-black font-bold"
//                 >
//                   Browse All Labs
//                 </Button>
//               </div>
//             ) : (
//               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
//                 {displayData.map((lab) => (
//                   <LabCard
//                     key={lab.id}
//                     lab={lab}
//                     isDark={isDark}
//                     failedFaviconUrls={failedFaviconUrls}
//                     handleFaviconError={handleFaviconError}
//                   />
//                 ))}
//               </div>
//             )}
//           </section>
//         </main>
//       </div>

//       {/* reCAPTCHA Scripts */}
//       <Script id="recaptcha-callback" strategy="afterInteractive">
//         {`
//           window.onRecaptchaSuccess = function(token) {
//             const event = new CustomEvent('recaptcha-success', { detail: token });
//             window.dispatchEvent(event);
//           };
//         `}
//       </Script>
//       <Script id="recaptcha-listener" strategy="afterInteractive">
//         {`
//           window.addEventListener('recaptcha-success', function(e) {
//             if (e.detail) {
//               const reactSetToken = window.__setRecaptchaToken;
//               if (typeof reactSetToken === 'function') reactSetToken(e.detail);
//             }
//           });
//         `}
//       </Script>

//       {/* Auth Prompt for Add Lab */}
//       {isAuthPromptOpen && (
//         <AuthPrompt
//           action={authAction}
//           onClose={() => setIsAuthPromptOpen(false)}
//         />
//       )}
//     </>
//   );
// }// "use client";

// import { useState, useEffect, useRef, useCallback } from "react";
// import Link from "next/link";
// import Image from "next/image";
// import Script from "next/script";
// import { Button } from "@/components/ui/button";
// import { useRouter } from "next/navigation";
// import { useTheme } from "next-themes";
// import {
//   FlaskConical,
//   Search,
//   X,
//   MapPin,
//   Tags,
//   Mail,
//   User2,
//   ExternalLink,
//   ChevronDown,
//   Globe,
//   GraduationCap,
//   ArrowUp,
// } from "lucide-react";
// import { LabProfile } from "../../lib/types";
// import AuthPrompt from "../../components/ui/auth-prompt";

// // Define TypeScript interfaces
// declare global {
//   interface Window {
//     grecaptcha: {
//       reset: (widgetId?: number) => void;
//     };
//     onRecaptchaSuccess: (token: string) => void;
//     __setRecaptchaToken: (token: string) => void;
//   }
// }

// interface Payload {
//   sessionId: string | null;
//   userId?: string | null;
//   query?: string;
//   type?: string;
//   title?: string;
//   recaptchaResponse?: string | null;
//   action?: string;
// }

// // LabCard Component
// const LabCard = ({
//   lab,
//   isDark,
//   failedFaviconUrls,
//   handleFaviconError,
// }: {
//   lab: LabProfile;
//   isDark: boolean;
//   failedFaviconUrls: Set<string>;
//   handleFaviconError: (url: string | null) => void;
// }) => {
//   const getFaviconUrl = (labUrl: string | undefined): string | null => {
//     if (!labUrl) return null;
//     try {
//       const domain = new URL(labUrl).hostname;
//       return `https://www.google.com/s2/favicons?domain=${domain}&sz=40`;
//     } catch {
//       return null;
//     }
//   };

//   const faviconUrl = getFaviconUrl(lab.url);
//   const isFaviconFailed = faviconUrl && failedFaviconUrls.has(faviconUrl);

//   return (
//     <div className="group block">
//       <div
//         className={`h-full rounded-2xl border p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden ${
//           isDark
//             ? "bg-[#181818] border-[#333] hover:border-[#00FB75]/50"
//             : "bg-white border-gray-200 hover:border-green-200/50"
//         }`}
//         title={
//           lab.source === "scraped"
//             ? "Identified by AI discovery agent"
//             : "Manually verified lab"
//         }
//       >
//         {/* Diagonal Ribbon */}
//         {lab.source?.toLowerCase() === "scraped" ? (
//           <div className="absolute top-0 right-0 overflow-hidden w-32 h-32">
//             <div className="absolute transform rotate-45 bg-gradient-to-r from-[#00FB75] to-green-500 text-black text-xs font-semibold py-1 px-4 shadow-md top-4 right-[-30px]">
//               AI Discovery
//             </div>
//           </div>
//         ) : (
//           <div className="absolute top-0 right-0 overflow-hidden w-32 h-32">
//             <div className="absolute transform rotate-45 bg-[#181818] text-[#00FB75] text-xs font-semibold py-1 px-4 shadow-md top-4 right-[-30px] border border-[#00FB75]">
//               User Created
//             </div>
//           </div>
//         )}

//         {/* Header */}
//         <div className="flex items-start gap-4 mb-4">
//           <div className="flex-shrink-0">
//             {lab.logo_url ? (
//               <Image
//                 src={lab.logo_url}
//                 alt={`${lab.university || lab.display_name} logo`}
//                 width={48}
//                 height={48}
//                 className="rounded-full border-2 border-[#00FB75] group-hover:scale-105 transition-transform duration-200"
//                 onError={() => handleFaviconError(lab.logo_url)}
//               />
//             ) : faviconUrl && !isFaviconFailed ? (
//               <Image
//                 src={faviconUrl}
//                 alt={`${lab.university || lab.display_name} favicon`}
//                 width={48}
//                 height={48}
//                 className="rounded-full border-2 border-[#00FB75] group-hover:scale-105 transition-transform duration-200"
//                 onError={() => handleFaviconError(faviconUrl)}
//               />
//             ) : (
//               <div
//                 className={`w-12 h-12 bg-gradient-to-br from-[#00FB75] to-green-500 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform duration-200 ${
//                   isDark ? "text-white" : "text-black"
//                 }`}
//               >
//                 <FlaskConical className="w-6 h-6" />
//               </div>
//             )}
//           </div>
//           <div className="flex-1 min-w-0">
//             <h3
//               className={`font-bold text-lg truncate transition-colors group-hover:text-[#00FB75] ${
//                 isDark ? "text-white" : "text-gray-900"
//               }`}
//             >
//               {lab.university || lab.display_name || "Research Lab"}
//             </h3>
//             {lab.url ? (
//               <button
//                 onClick={(e) => {
//                   e.stopPropagation();
//                   window.open(lab.url, "_blank", "noopener,noreferrer");
//                 }}
//                 className={`text-sm flex items-center gap-1 mt-1 transition-colors ${
//                   isDark
//                     ? "text-gray-400 hover:text-[#00FB75]"
//                     : "text-gray-600 hover:text-[#00FB75]"
//                 }`}
//                 title="Visit website"
//               >
//                 <Globe className="w-3 h-3" />
//                 {new URL(lab.url).hostname.replace(/^www\./, "")}
//               </button>
//             ) : (
//               <p
//                 className={`text-sm mt-1 ${
//                   isDark ? "text-gray-400" : "text-gray-600"
//                 }`}
//               >
//                 {lab.department?.name || "Department"}
//               </p>
//             )}
//           </div>
//         </div>

//         {/* Details */}
//         <div className="space-y-3 mb-4">
//           <div className="flex items-center gap-2 text-sm text-gray-300">
//             <MapPin className="w-4 h-4 text-[#00FB75]" />
//             <span>
//               {lab.location?.city || "N/A"}, {lab.location?.country || "N/A"}
//             </span>
//           </div>
//           {lab.department?.focus && (
//             <div className="flex items-center gap-2 text-sm text-gray-300">
//               <GraduationCap className="w-4 h-4 text-[#00FB75]" />
//               <span>{lab.department.focus}</span>
//             </div>
//           )}
//           {lab.point_of_contact?.email && (
//             <div className="flex items-center gap-2 text-sm text-gray-300">
//               <Mail className="w-4 h-4 text-[#00FB75]" />
//               <span className="truncate">{lab.point_of_contact.email}</span>
//             </div>
//           )}
//         </div>

//         {/* Contact Avatar */}
//         <div className="flex items-center gap-3 mb-6">
//           {lab.point_of_contact?.bio_url ? (
//             <Image
//               src={lab.point_of_contact.bio_url}
//               alt={lab.point_of_contact.name || "Contact"}
//               width={32}
//               height={32}
//               className="rounded-full border-2 border-[#00FB75] group-hover:scale-110 transition-transform"
//               onError={() => handleFaviconError(lab.point_of_contact.bio_url)}
//             />
//           ) : (
//             <div
//               className={`w-8 h-8 bg-[#00FB75] rounded-full flex items-center justify-center ${
//                 isDark ? "text-white" : "text-black"
//               }`}
//             >
//               <User2 className="w-4 h-4" />
//             </div>
//           )}
//           <span
//             className={`text-sm font-medium ${
//               isDark ? "text-white" : "text-gray-900"
//             }`}
//           >
//             {lab.point_of_contact?.name || "Contact"}
//           </span>
//         </div>

//         {/* Action Button */}
//         <Link href={`/labs/${lab.id}`}>
//           <Button
//             className={`w-full bg-gradient-to-r from-[#00FB75] to-green-500 text-black font-bold hover:from-green-500 hover:to-emerald-500 transition-all duration-200 shadow-lg ${
//               isDark ? "text-white" : "text-black"
//             }`}
//           >
//             View Details
//             <ExternalLink className="w-4 h-4 ml-2" />
//           </Button>
//         </Link>
//       </div>
//     </div>
//   );
// };

// type SearchBarProps = {
//   searchQuery: string;
//   isSearching: boolean;
//   isDark: boolean;
//   handleSearchChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
//   handleSearchSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
//   clearSearch: () => void;
//   onCancelExternal?: () => void;
//   onSearchInitiate?: () => void;
// };

// function SearchBar({
//   searchQuery,
//   isSearching,
//   isDark,
//   handleSearchChange,
//   handleSearchSubmit,
//   clearSearch,
//   onCancelExternal,
//   onSearchInitiate,
// }: SearchBarProps) {
//   const formRef = useRef<HTMLFormElement | null>(null);
//   const textareaRef = useRef<HTMLTextAreaElement | null>(null);

//   // Auto-resize textarea height to match content
//   useEffect(() => {
//     const ta = textareaRef.current;
//     if (!ta) return;
//     ta.style.height = "auto"; // reset
//     // clamp height to max (optional)
//     const maxHeight = 300; // px, change if needed
//     ta.style.height = Math.min(ta.scrollHeight, maxHeight) + "px";
//   }, [searchQuery]);

//   // Left-button click handler (arrow / cancel)
//   const handleLeftButtonClick = (e: React.MouseEvent) => {
//     e.preventDefault();
//     if (isSearching) {
//       // Cancel external API call (preferred)
//       if (onCancelExternal) {
//         onCancelExternal();
//       } else {
//         // fallback: clear the search text
//         clearSearch();
//       }
//     } else {
//       // Initiate search: submit the form programmatically so your
//       // existing handleSearchSubmit receives real FormEvent
//       if (formRef.current) {
//         formRef.current.requestSubmit();
//       }
//       if (onSearchInitiate) onSearchInitiate();
//     }
//   };

//   // Keyboard behavior: Ctrl/Cmd+Enter submits; Enter alone inserts newline
//   const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
//     if ((e.key === "Enter" && (e.ctrlKey || e.metaKey)) && formRef.current) {
//       // Programmatic submit (same as left-arrow click)
//       e.preventDefault();
//       formRef.current.requestSubmit();
//     }
//   };

//   return (
//     <form
//       ref={formRef}
//       onSubmit={handleSearchSubmit}
//       className="flex-1 relative min-w-0"
//       aria-label="Search form"
//     >
//       {/* Left icon button (arrow up or cancel) */}
//       <button
//         type="button"
//         onClick={handleLeftButtonClick}
//         className={`absolute left-3 top-2 z-10 p-1 rounded-full transition-colors focus:outline-none ${
//           isDark ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"
//         }`}
//         title={
//           isSearching
//             ? "Cancel search"
//             : "Start search (or Ctrl/Cmd+Enter)"
//         }
//         aria-label={isSearching ? "Cancel search" : "Start search"}
//       >
//         {isSearching ? <X className="w-5 h-5" /> : <ArrowUp className="w-5 h-5" />}
//       </button>

//       {/* Expanding textarea */}
//       <textarea
//         ref={textareaRef}
//         value={searchQuery}
//         onChange={handleSearchChange}
//         onKeyDown={handleKeyDown}
//         placeholder="Search labs by name, focus, or location..."
//         rows={1}
//         className={`w-full rounded-xl px-12 py-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00FB75] resize-none overflow-hidden transition-all duration-200 min-w-0 ${
//           isDark ? "bg-[#181818] border border-[#333] text-white" : "bg-white border border-gray-300 text-gray-900"
//         }`}
//         aria-label="Search labs"
//       />

//       {/* Right-side status / action (searching indicator or submit) */}
//       <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
//         {isSearching ? (
//           <div className="flex items-center gap-2 text-sm text-gray-400">
//             <div className="w-4 h-4 border-2 border-[#00FB75] border-t-transparent rounded-full animate-spin" />
//             <span className={`${isDark ? "text-gray-200" : "text-gray-800"}`}>Searching</span>
//           </div>
//         ) : (
//           // Accessible submit button as fallback (optional)
//           <button
//             type="submit"
//             className="bg-[#00FB75] text-black px-3 py-1 rounded-lg font-semibold hover:bg-green-500 transition-colors"
//             aria-label="Submit search"
//           >
//             Search
//           </button>
//         )}
//       </div>
//     </form>
//   );
// }

// // FilterDropdown Component
// const FilterDropdown = ({
//   filterType,
//   setFilterType,
//   isDark,
// }: {
//   filterType: string;
//   setFilterType: (value: string) => void;
//   isDark: boolean;
// }) => (
//   <select
//     value={filterType}
//     onChange={(e) => setFilterType(e.target.value)}
//     className={`rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00FB75] border ${
//       isDark
//         ? "bg-[#181818] border-[#333] text-white"
//         : "bg-white border-gray-300 text-gray-900"
//     }`}
//     aria-label="Filter labs"
//   >
//     <option value="all">All Labs</option>
//     <option value="pending">AI Discovered</option>
//     <option value="completed">Verified Labs</option>
//   </select>
// );

// function Page() {
//   // State Management
//   const [labProfileData, setLabProfileData] = useState<LabProfile[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [isSearching, setIsSearching] = useState(false);
//   const [searchResults, setSearchResults] = useState<LabProfile[]>([]);
//   const [searchStatus, setSearchStatus] = useState("Ready to search");
//   const [sessionId, setSessionId] = useState<string | null>(null);
//   const [recaptchaToken, setRecaptchaToken] = useState("");
//   const [recaptchaError, setRecaptchaError] = useState("");
//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const [showGuestPopup, setShowGuestPopup] = useState(false);
//   const [token, setToken] = useState<string | null>(null);
//   const [userId, setUserId] = useState<string | null>(null);
//   const [failedFaviconUrls, setFailedFaviconUrls] = useState<Set<string>>(
//     new Set()
//   );
//   const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
//   const [authAction, setAuthAction] = useState<string>("");
//   const [filterType, setFilterType] = useState("all");

//   const wsRef = useRef<WebSocket | null>(null);
//   const reconnectAttemptsRef = useRef(0);
//   const maxReconnectAttempts = 5;
//   const popupTimerRef = useRef<NodeJS.Timeout | null>(null);
//   const searchAbortControllerRef = useRef<AbortController | null>(null);

//   const router = useRouter();
//   const { theme, resolvedTheme } = useTheme();
//   const [mounted, setMounted] = useState(false);

//   const isDark = resolvedTheme === "dark" || theme === "dark";

//   // Set mounted state
//   useEffect(() => {
//     setMounted(true);
//   }, []);

//   // Check authentication status
//   const checkAuthStatus = useCallback(() => {
//     if (typeof window === "undefined") return false;

//     const t = localStorage.getItem("token") || sessionStorage.getItem("token");
//     const u = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");

//     const authStatus = !!t;
//     setToken(t);
//     setUserId(u);
//     setIsAuthenticated(authStatus);

//     return authStatus;
//   }, []);

//   // Fetch lab profile data
//   const fetchLabProfileData = async (authToken: string | null) => {
//     try {
//       setLoading(true);
//       setError(null);
//       const response = await fetch("/api/labs", {
//         method: "GET",
//         headers: {
//           Authorization: authToken || "",
//         },
//       });
//       if (!response.ok) throw new Error(`HTTP ${response.status}`);
//       const data = await response.json();
//       setLabProfileData(data);
//     } catch (error) {
//       console.error("Fetch labs error:", error);
//       setError((error as Error).message || "Unknown error");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Handle reCAPTCHA token
//   useEffect(() => {
//     if (typeof window !== "undefined") {
//       window.__setRecaptchaToken = (token: string) => {
//         setRecaptchaToken(token);
//         setRecaptchaError("");
//         console.log("reCAPTCHA token set:", token);
//       };
//     }
//   }, []);

//   // Monitor auth state and control guest popup
//   useEffect(() => {
//     const authStatus = checkAuthStatus();

//     if (popupTimerRef.current) {
//       clearTimeout(popupTimerRef.current);
//       popupTimerRef.current = null;
//     }

//     if (authStatus) {
//       setShowGuestPopup(false);
//       fetchLabProfileData(token);
//     } else {
//       fetchLabProfileData(null);
//       setLoading(false);
//       popupTimerRef.current = setTimeout(() => {
//         setShowGuestPopup(true);
//       }, 1000);
//     }

//     return () => {
//       if (popupTimerRef.current) {
//         clearTimeout(popupTimerRef.current);
//       }
//     };
//   }, [checkAuthStatus, token]);

//   // WebSocket connection
//   const connectWebSocket = useCallback(() => {
//     const wsUrl =
//       process.env.NEXT_PUBLIC_WEBSOCKET_URL ??
//       (process.env.NODE_ENV === "production"
//         ? "wss://api.unlokinno.com/ws"
//         : "ws://10.22.129.236/ws");
//     const ws = new WebSocket(wsUrl);

//     ws.onopen = () => {
//       reconnectAttemptsRef.current = 0;
//       console.log("Successfully connected to Unlokinno Intelligence");
//       setSearchStatus("Connected waiting for your search");
//     };

//     ws.onmessage = (event) => {
//       try {
//         const msg = JSON.parse(event.data);
//         console.log("WebSocket message:", msg);

//         if (msg.status === "connected" || msg.status === "authenticated") {
//           setSessionId(msg.sessionId);
//           localStorage.setItem("sessionId", msg.sessionId);
//           setSearchStatus("Connected waiting for your search");
//         } else if (msg.status === "queued") {
//           setSearchStatus(
//             `Query "${msg.message?.split('"')[1] || "query"}" queued for processing`
//           );
//         } else if (msg.status === "processing") {
//           setSearchStatus(`Processing: ${msg.url || "query"}`);
//         } else if (msg.status === "entity") {
//           setSearchResults((prev) => [...prev, msg.data]);
//           setSearchStatus(
//             `Found result: ${msg.data.university || msg.data.display_name || "lab"}`
//           );
//         } else if (msg.status === "complete") {
//           setIsSearching(false);
//           setSearchStatus("Search completed successfully.");
//           searchAbortControllerRef.current = null;
//         } else if (msg.status === "stopped") {
//           setIsSearching(false);
//           setSearchStatus("Search stopped.");
//           searchAbortControllerRef.current = null;
//         } else if (msg.status === "error") {
//           setIsSearching(false);
//           setSearchStatus(`Error: ${msg.reason || msg.message || "Unknown"}`);
//           searchAbortControllerRef.current = null;
//         }
//       } catch (e) {
//         console.error(
//           "Error processing WebSocket message:",
//           e,
//           "Raw data:",
//           event.data
//         );
//       }
//     };

//     ws.onclose = () => {
//       setIsSearching(false);
//       searchAbortControllerRef.current = null;
//       if (reconnectAttemptsRef.current < maxReconnectAttempts) {
//         reconnectAttemptsRef.current++;
//         console.log(
//           `Connection lost. Reconnecting (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`
//         );
//         setTimeout(connectWebSocket, 1000 * reconnectAttemptsRef.current);
//       } else {
//         setSearchStatus("Unable to connect after multiple attempts.");
//       }
//     };

//     ws.onerror = (event) => {
//       if (ws.readyState === WebSocket.CLOSED) {
//         console.info("ℹ️ WebSocket closed (readyState 3). Will attempt reconnect...");
//         console.info("🔎 URL:", ws.url);
//       } else {
//         console.error("❌ WebSocket error event:", event);
//         console.error("🔎 Ready state:", ws.readyState);
//         console.error("🔎 URL:", ws.url);
//       }
//       setSearchStatus("Connection error. Attempting to reconnect...");
//     };

//     wsRef.current = ws;

//     return () => {
//       ws.close();
//     };
//   }, []);

//   useEffect(() => {
//     const cleanup = connectWebSocket();
//     return cleanup;
//   }, [connectWebSocket]);

//   // Send search query
//   const sendSearchQuery = () => {
//     if (!searchQuery.trim()) return;

//     if (!isAuthenticated && !recaptchaToken) {
//       setRecaptchaError("Please complete the reCAPTCHA.");
//       setSearchStatus("reCAPTCHA required for guest search.");
//       return;
//     }

//     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
//       setSearchStatus("WebSocket not connected.");
//       return;
//     }

//     // Cancel any ongoing search
//     if (searchAbortControllerRef.current) {
//       searchAbortControllerRef.current.abort();
//     }

//     // Create new abort controller for this search
//     searchAbortControllerRef.current = new AbortController();

//     setIsSearching(true);
//     setSearchResults([]);
//     setSearchStatus("Initiating search...");

//     const payload: Payload = {
//       sessionId,
//       ...(isAuthenticated && { userId }),
//       query: searchQuery,
//       type: "general",
//       title: searchQuery,
//       ...(isAuthenticated ? { token } : { recaptchaResponse: recaptchaToken }),
//     };

//     try {
//       wsRef.current.send(JSON.stringify(payload));

//       if (!isAuthenticated) {
//         setRecaptchaToken("");
//         if (window.grecaptcha && document.getElementById("recaptcha-widget")) {
//           window.grecaptcha.reset();
//         }
//       }
//     } catch (error) {
//       console.error("Error sending search query:", error);
//       setIsSearching(false);
//       setSearchStatus("Failed to send search query.");
//       searchAbortControllerRef.current = null;
//     }
//   };

//   // Cancel search - Enhanced version
//   const cancelSearch = useCallback(() => {
//     console.log("Cancelling search...");
    
//     // Abort any fetch requests
//     if (searchAbortControllerRef.current) {
//       searchAbortControllerRef.current.abort();
//       searchAbortControllerRef.current = null;
//     }

//     // Send cancel message via WebSocket if connected
//     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && sessionId) {
//       try {
//         wsRef.current.send(
//           JSON.stringify({
//             sessionId,
//             action: "cancel",
//           })
//         );
//         console.log("Cancel message sent via WebSocket");
//       } catch (error) {
//         console.error("Error sending cancel message:", error);
//       }
//     }

//     // Reset search state
//     setIsSearching(false);
//     setSearchStatus("Search cancelled.");
//     setSearchResults([]);
    
//     // Clear any ongoing timers or timeouts
//     if (popupTimerRef.current) {
//       clearTimeout(popupTimerRef.current);
//       popupTimerRef.current = null;
//     }
//   }, [sessionId]);

//   // Handle search input change for textarea
//   const handleSearchChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
//     setSearchQuery(e.target.value);
//   };

//   // Handle search submit
//   const handleSearchSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
//     if (searchQuery.trim()) {
//       sendSearchQuery();
//     }
//   };

//   // Clear search
//   const clearSearch = () => {
//     setSearchQuery("");
//     setSearchResults([]);
//     setSearchStatus("Ready to search");
//     setRecaptchaToken("");
//     setRecaptchaError("");
//     if (window.grecaptcha && document.getElementById("recaptcha-widget")) {
//       window.grecaptcha.reset();
//     }
//   };

//   // Handle failed favicon load
//   const handleFaviconError = (url: string | null) => {
//     if (url) {
//       setFailedFaviconUrls((prev) => new Set(prev).add(url));
//     }
//   };

//   // Handle Add Lab click
//   const handleAddLabClick = () => {
//     if (!token || !userId) {
//       setAuthAction("add lab");
//       setIsAuthPromptOpen(true);
//     } else {
//       router.push(`/labs/new`);
//     }
//   };

//   // Filter labs based on source
//   const filteredLabs = labProfileData.filter((lab) => {
//     if (filterType === "all") return true;
//     if (filterType === "pending") return lab.source === "scraped";
//     if (filterType === "completed") return lab.source === "user";
//     return true;
//   });

//   // Combine with search results
//   const displayData =
//     searchResults.length > 0
//       ? searchResults
//       : filteredLabs.filter((lab) =>
//           [
//             lab.university || "",
//             lab.display_name || "",
//             lab.department?.focus || "",
//             lab.location?.city || "",
//             lab.location?.country || "",
//           ]
//             .join(" ")
//             .toLowerCase()
//             .includes(searchQuery.toLowerCase())
//         );

//   // Cleanup on unmount
//   useEffect(() => {
//     return () => {
//       if (searchAbortControllerRef.current) {
//         searchAbortControllerRef.current.abort();
//       }
//       if (popupTimerRef.current) {
//         clearTimeout(popupTimerRef.current);
//       }
//       if (wsRef.current) {
//         wsRef.current.close();
//       }
//     };
//   }, []);

//   // Render loading state
//   if (!mounted) {
//     return (
//       <div className="flex justify-center items-center h-screen w-full bg-white text-black">
//         <div className="flex flex-col items-center space-y-4">
//           <FlaskConical className="w-12 h-12 text-gray-800 animate-spin" />
//           <p className="text-lg text-gray-800">Loading labs...</p>
//         </div>
//       </div>
//     );
//   }

//   if (loading) {
//     return (
//       <div
//         className={`flex justify-center items-center h-screen w-full ${
//           isDark ? "bg-black text-white" : "bg-white text-black"
//         }`}
//       >
//         <div className="flex flex-col items-center space-y-4">
//           <FlaskConical
//             className={`w-12 h-12 ${
//               isDark ? "text-[#00FB75]" : "text-gray-800"
//             } animate-spin`}
//           />
//           <p className={`text-lg ${isDark ? "text-white" : "text-gray-800"}`}>
//             Loading labs...
//           </p>
//         </div>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div
//         className={`flex justify-center items-center h-screen w-full ${
//           isDark ? "bg-black text-white" : "bg-white text-black"
//         }`}
//       >
//         <div
//           className={`text-center max-w-md p-6 rounded-xl ${
//             isDark ? "bg-[#181818]" : "bg-gray-100"
//           }`}
//         >
//           <FlaskConical className="w-12 h-12 text-red-500 mx-auto mb-4" />
//           <h2 className="text-xl font-bold mb-2">Error Loading Labs</h2>
//           <p className={`mb-6 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
//             {error}
//           </p>
//           <Button
//             onClick={() => fetchLabProfileData(token)}
//             className="bg-[#00FB75] text-black font-bold"
//           >
//             Retry
//           </Button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <>
//       {/* Guest Mode Popup */}
//       {showGuestPopup && !isAuthenticated && (
//         <div
//           className={`fixed inset-0 z-50 flex justify-center items-center p-4 ${
//             isDark ? "bg-black/80" : "bg-white/80"
//           }`}
//         >
//           <div
//             className={`rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 border animate-in fade-in duration-300 ${
//               isDark ? "bg-[#181818] border-[#00FB75]" : "bg-white border-gray-200"
//             }`}
//           >
//             <div className="flex items-center justify-between mb-4">
//               <h2
//                 className={`text-xl font-bold ${
//                   isDark ? "text-white" : "text-gray-900"
//                 }`}
//               >
//                 Guest Access
//               </h2>
//               <button
//                 onClick={() => setShowGuestPopup(false)}
//                 className={`transition-colors ${
//                   isDark
//                     ? "text-gray-400 hover:text-white"
//                     : "text-gray-600 hover:text-gray-900"
//                 }`}
//                 aria-label="Close guest popup"
//               >
//                 <X className="w-5 h-5" />
//               </button>
//             </div>
//             <p
//               className={`text-sm mb-4 ${
//                 isDark ? "text-gray-300" : "text-gray-600"
//               }`}
//             >
//               Welcome! Verify you're human to continue browsing as a guest.
//             </p>
//             <div className="mb-4">
//               <div
//                 id="recaptcha-widget"
//                 className="g-recaptcha"
//                 data-sitekey={process.env.NEXT_PUBLIC_SITE_KEY}
//                 data-callback="onRecaptchaSuccess"
//               ></div>
//               {recaptchaError && (
//                 <p
//                   className={`text-xs mt-2 ${
//                     isDark ? "text-red-400" : "text-red-600"
//                   }`}
//                 >
//                   {recaptchaError}
//                 </p>
//               )}
//             </div>
//             <p
//               className={`text-xs mb-6 ${
//                 isDark ? "text-gray-400" : "text-gray-500"
//               }`}
//             >
//               Sign in for unlimited access and advanced features.
//             </p>
//             <div className="flex flex-col sm:flex-row gap-3">
//               <Button
//                 onClick={() => setShowGuestPopup(false)}
//                 className={`flex-1 ${
//                   isDark
//                     ? "bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
//                     : "bg-gray-100 hover:bg-gray-200 text-black border border-gray-300"
//                 } disabled:opacity-50`}
//                 disabled={!recaptchaToken}
//               >
//                 Continue as Guest
//               </Button>
//               <Link href="/auth/login">
//                 <Button
//                   className={`flex-1 bg-[#00FB75] text-black font-bold hover:bg-green-500 ${
//                     isDark ? "text-white" : "text-black"
//                   }`}
//                 >
//                   Sign In
//                 </Button>
//               </Link>
//             </div>
//           </div>
//         </div>
//       )}

//       <Script
//         src="https://www.google.com/recaptcha/api.js"
//         strategy="afterInteractive"
//       />
//       <div
//         className={`h-screen flex flex-col w-full overflow-hidden ${
//           isDark ? "bg-black text-white" : "bg-white text-black"
//         }`}
//       >
//         {/* Header Section */}
//         <header
//           className={`sticky top-0 z-30 w-full ${
//             isDark
//               ? "bg-gradient-to-r from-black via-[#181818] to-black border-b border-[#00FB75]/20"
//               : "bg-gradient-to-r from-white via-gray-50 to-white border-b border-gray-200/20"
//           } backdrop-blur-md`}
//         >
//           <div className="w-full mx-auto px-4 py-4">
//             <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
//               <div className="flex items-center gap-3 flex-shrink-0">
//                 <FlaskConical className="w-8 h-8 text-[#00FB75]" />
//                 <h1
//                   className={`text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent ${
//                     isDark ? "from-white to-gray-300" : "from-gray-900 to-gray-700"
//                   }`}
//                 >
//                   Unlokinno Labs
//                 </h1>
//               </div>
//               <div className="flex items-center gap-2 w-full max-w-md flex-1 min-w-0">
//                 <SearchBar
//                   searchQuery={searchQuery}
//                   isSearching={isSearching}
//                   isDark={isDark}
//                   handleSearchChange={handleSearchChange}
//                   handleSearchSubmit={handleSearchSubmit}
//                   clearSearch={clearSearch}
//                   onCancelExternal={cancelSearch}
//                   onSearchInitiate={sendSearchQuery}
//                 />
//               </div>
//               <div className="flex items-center gap-2 flex-shrink-0">
//                 <FilterDropdown
//                   filterType={filterType}
//                   setFilterType={setFilterType}
//                   isDark={isDark}
//                 />
//                 <Button
//                   className="bg-[#00FB75] text-black font-bold hover:bg-green-500 transition-all duration-200 whitespace-nowrap"
//                   onClick={handleAddLabClick}
//                 >
//                   + Add Lab
//                 </Button>
//               </div>
//             </div>
//           </div>
//         </header>

//         {/* Main Content - Scrollable */}
//         <main className="flex-1 overflow-y-auto w-full h-0 min-h-0">
          
//           {/* Status Bar */}
//           {searchStatus && searchStatus !== "Ready to search" && (
//             <div className="w-full mx-auto px-4 py-2">
//               <div
//                 className={`rounded-xl p-3 ${
//                   isDark
//                     ? "bg-[#181818] border border-[#00FB75]/20"
//                     : "bg-gray-50 border border-gray-200/20"
//                 }`}
//               >
//                 <p
//                   className={`text-sm flex items-center gap-2 ${
//                     isDark ? "text-gray-300" : "text-gray-700"
//                   }`}
//                 >
//                   <span className="w-2 h-2 bg-[#00FB75] rounded-full animate-pulse" />
//                   {searchStatus}
//                 </p>
//               </div>
//             </div>
//           )}

//           {/* Results Header */}
//           {searchResults.length > 0 && (
//             <div className="w-full mx-auto px-4 py-4">
//               <div className="flex items-center justify-between">
//                 <p className={`${isDark ? "text-gray-400" : "text-gray-600"}`}>
//                   Found {searchResults.length} result
//                   {searchResults.length !== 1 ? "s" : ""} for "{searchQuery}"
//                 </p>
//                 <Button
//                   variant="ghost"
//                   size="sm"
//                   onClick={clearSearch}
//                   className={`${
//                     isDark
//                       ? "text-gray-400 hover:text-white"
//                       : "text-gray-600 hover:text-gray-900"
//                   }`}
//                 >
//                   Clear Search
//                 </Button>
//               </div>
//             </div>
//           )}

//           {/* Labs Grid */}
//           <section className="w-full mx-auto px-4 py-6">
//             {displayData.length === 0 ? (
//               <div
//                 className={`flex flex-col items-center justify-center h-64 text-center ${
//                   isDark ? "text-gray-300" : "text-gray-600"
//                 }`}
//               >
//                 <FlaskConical
//                   className={`w-16 h-16 mb-4 ${
//                     isDark ? "text-gray-500" : "text-gray-400"
//                   }`}
//                 />
//                 <h3
//                   className={`text-xl font-semibold mb-2 ${
//                     isDark ? "text-gray-300" : "text-gray-700"
//                   }`}
//                 >
//                   No Labs Found
//                 </h3>
//                 <p
//                   className={`mb-6 ${isDark ? "text-gray-500" : "text-gray-500"}`}
//                 >
//                   Try adjusting your search or explore all labs.
//                 </p>
//                 <Button
//                   onClick={clearSearch}
//                   className="bg-[#00FB75] text-black font-bold"
//                 >
//                   Browse All Labs
//                 </Button>
//               </div>
//             ) : (
//               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
//                 {displayData.map((lab) => (
//                   <LabCard
//                     key={lab.id}
//                     lab={lab}
//                     isDark={isDark}
//                     failedFaviconUrls={failedFaviconUrls}
//                     handleFaviconError={handleFaviconError}
//                   />
//                 ))}
//               </div>
//             )}
//           </section>
//         </main>
//       </div>

//       {/* reCAPTCHA Scripts */}
//       <Script id="recaptcha-callback" strategy="afterInteractive">
//         {`
//           window.onRecaptchaSuccess = function(token) {
//             const event = new CustomEvent('recaptcha-success', { detail: token });
//             window.dispatchEvent(event);
//           };
//         `}
//       </Script>
//       <Script id="recaptcha-listener" strategy="afterInteractive">
//         {`
//           window.addEventListener('recaptcha-success', function(e) {
//             if (e.detail) {
//               const reactSetToken = window.__setRecaptchaToken;
//               if (typeof reactSetToken === 'function') reactSetToken(e.detail);
//             }
//           });
//         `}
//       </Script>

//       {/* Auth Prompt for Add Lab */}
//       {isAuthPromptOpen && (
//         <AuthPrompt
//           action={authAction}
//           onClose={() => setIsAuthPromptOpen(false)}
//         />
//       )}
//     </>
//   );
// }

// export default Page;

// export default Page;