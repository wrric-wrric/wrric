"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { Bell, Check, X, Heart, MessageSquare, UserPlus, Share2, Award, FlaskConical } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

interface GroupedNotification {
  id: string;
  ids: string[];
  type: string;
  content: string;
  related_id: string | null;
  is_read: boolean;
  count: number;
  created_at: string | null;
  group_key: string | null;
}

export default function NotificationBell() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [notifications, setNotifications] = useState<GroupedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const getToken = () =>
    typeof window !== "undefined"
      ? localStorage.getItem("token") || sessionStorage.getItem("token")
      : null;

  // Fetch unread count (lightweight, replaces heavy polling) — U-3.3.0
  const fetchUnreadCount = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/notifications/unread-count", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count ?? 0);
      }
    } catch {}
  }, []);

  // Fetch grouped notifications — U-3.3.2
  const fetchGrouped = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/notifications/grouped?unread_only=false&limit=15", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadCount(data.filter((n: GroupedNotification) => !n.is_read).length);
      }
    } catch {}
  }, []);

  // WebSocket for real-time updates — U-3.3.4
  useEffect(() => {
    fetchUnreadCount();

    // Set up WebSocket listener for notifications
    const setupWs = () => {
      const token = getToken();
      if (!token) return;

      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "wss://api.unlokinno.com/ws/messages";
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "notification") {
              // Increment badge count in real-time
              setUnreadCount((prev) => prev + 1);
              // If dropdown is open, refresh
              if (isOpen) fetchGrouped();
            }
          } catch {}
        };

        ws.onclose = () => {
          // Reconnect after 10s
          setTimeout(setupWs, 10000);
        };
      } catch {}
    };

    setupWs();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [fetchUnreadCount, fetchGrouped, isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch grouped when dropdown opens
  useEffect(() => {
    if (isOpen) fetchGrouped();
  }, [isOpen, fetchGrouped]);

  const markAsRead = async (notificationId: string) => {
    const token = getToken();
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      toast.error("Failed to mark notification as read");
    }
  };

  const markAllAsRead = async () => {
    const token = getToken();
    try {
      await fetch("/api/notifications/read-all", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "lab_liked": return <Heart className="w-4 h-4 text-red-400" />;
      case "lab_comment":
      case "comment_reply": return <MessageSquare className="w-4 h-4 text-blue-400" />;
      case "new_follower":
      case "partner_new_follower":
      case "lab_new_follower": return <UserPlus className="w-4 h-4 text-[#00FB75]" />;
      case "lab_shared": return <Share2 className="w-4 h-4 text-purple-400" />;
      case "partner_approved":
      case "partner_rejected": return <Award className="w-4 h-4 text-yellow-400" />;
      case "new_lab_from_followed": return <FlaskConical className="w-4 h-4 text-[#00FB75]" />;
      default: return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-colors ${
          isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 top-12 w-96 rounded-xl shadow-lg border z-50 ${
            isDark ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
          }`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between p-4 border-b ${
              isDark ? "border-gray-700" : "border-gray-200"
            }`}
          >
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-[#00FB75] hover:underline transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm opacity-70">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 border-b transition-colors cursor-pointer ${
                    isDark
                      ? `border-gray-800 hover:bg-gray-800 ${!n.is_read ? "bg-[#00FB75]/5" : ""}`
                      : `border-gray-100 hover:bg-gray-50 ${!n.is_read ? "bg-green-50" : ""}`
                  }`}
                  onClick={() => {
                    if (!n.is_read) markAsRead(n.id);
                    if (n.related_id) {
                      if (n.type.includes("lab") || n.type === "comment_reply") {
                        window.location.href = `/labs/${n.related_id}`;
                      } else if (n.type.includes("partner")) {
                        window.location.href = `/partners`;
                      } else if (n.type === "new_follower") {
                        // related_id is follower user id
                      }
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getNotificationIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">
                        {n.content}
                        {n.count > 1 && (
                          <span className="ml-1 text-xs opacity-60">({n.count})</span>
                        )}
                      </p>
                      <span className="text-xs opacity-50 mt-0.5 block">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    {!n.is_read && (
                      <div className="w-2 h-2 rounded-full bg-[#00FB75] mt-2 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className={`p-3 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className={`block w-full text-center text-sm py-2 rounded-lg transition-colors ${
                isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"
              }`}
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
