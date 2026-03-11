"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useSidebar } from "@/hooks/sideBarProvider";
import { 
  Bell, 
  Check, 
  CheckCircle, 
  XCircle, 
  Target, 
  FileText, 
  MessageCircle, 
  User,
  Building,
  Clock,
  Filter,
  Trash2,
  Settings
} from "lucide-react";
import toast from "react-hot-toast";

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
  related_id?: string;
  metadata?: {
    funder_name?: string;
    entity_name?: string;
    proposal_title?: string;
    match_score?: number;
  };
}

export default function NotificationsPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { setLoadSession } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, unread, read
  const [typeFilter, setTypeFilter] = useState("all"); // all, match, proposal, message, system

  const isDark = mounted ? resolvedTheme === "dark" : false;

  useEffect(() => {
    setMounted(true);
    setLoadSession(() => {});
    return () => setLoadSession(() => {});
  }, [setLoadSession]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch("/api/notifications?limit=100");
      
      if (!response.ok) throw new Error("Failed to fetch notifications");
      
      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error("Fetch notifications error:", error);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to mark notification as read");
      
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, is_read: true }
            : notification
        )
      );
    } catch (error) {
      console.error("Mark notification read error:", error);
      toast.error("Failed to mark notification as read");
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch("/api/notifications/read-all", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to mark all as read");
      
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, is_read: true }))
      );
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Mark all read error:", error);
      toast.error("Failed to mark all as read");
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to delete notification");
      
      setNotifications(prev => 
        prev.filter(notification => notification.id !== notificationId)
      );
      toast.success("Notification deleted");
    } catch (error) {
      console.error("Delete notification error:", error);
      toast.error("Failed to delete notification");
    }
  };

  const clearAllNotifications = async () => {
    if (!confirm("Are you sure you want to clear all notifications? This action cannot be undone.")) {
      return;
    }

    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch("/api/notifications", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to clear notifications");
      
      setNotifications([]);
      toast.success("All notifications cleared");
    } catch (error) {
      console.error("Clear notifications error:", error);
      toast.error("Failed to clear notifications");
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read when clicked
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Navigate based on notification type and related ID
    switch (notification.type) {
      case "match_suggested":
        router.push("/auxiliaries/matches");
        break;
      case "proposal_received":
        if (notification.related_id) {
          router.push(`/funders/proposals`);
        } else {
          router.push("/proposals");
        }
        break;
      case "proposal_status_updated":
        router.push("/proposals");
        break;
      case "message_received":
        if (notification.related_id) {
          router.push(`/messages?to=${notification.related_id}`);
        } else {
          router.push("/messages");
        }
        break;
      case "match_status_updated":
        router.push("/matches");
        break;
      default:
        // For system notifications, no specific navigation
        break;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "match_suggested":
        return <Target className="w-5 h-5 text-blue-400" />;
      case "proposal_received":
        return <FileText className="w-5 h-5 text-green-400" />;
      case "proposal_status_updated":
        return <CheckCircle className="w-5 h-5 text-yellow-400" />;
      case "message_received":
        return <MessageCircle className="w-5 h-5 text-purple-400" />;
      case "match_status_updated":
        return <User className="w-5 h-5 text-indigo-400" />;
      case "system":
        return <Bell className="w-5 h-5 text-gray-400" />;
      default:
        return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      match_suggested: "Match Suggested",
      proposal_received: "Proposal Received",
      proposal_status_updated: "Proposal Updated",
      message_received: "New Message",
      match_status_updated: "Match Updated",
      system: "System"
    };
    return labels[type] || type;
  };

  const filteredNotifications = notifications.filter(notification => {
    // Filter by read status
    if (filter === "unread" && notification.is_read) return false;
    if (filter === "read" && !notification.is_read) return false;
    
    // Filter by type
    if (typeFilter !== "all" && notification.type !== typeFilter) return false;
    
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!mounted || loading) {
    return (
      <div className={`h-full flex flex-col ${isDark ? "bg-[#0A0A0A] text-white" : "bg-gray-50 text-gray-900"}`}>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-800 rounded w-1/4" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-800 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${isDark ? "bg-[#0A0A0A] text-white" : "bg-gray-50 text-gray-900"}`}>
      <header className={`sticky top-0 z-10 border-b px-4 py-3 ${
        isDark ? "bg-[#0A0A0A] border-gray-800" : "bg-white border-gray-200"
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-[#00FB75]" />
            <div>
              <h1 className="font-semibold">Notifications</h1>
              <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                {unreadCount > 0 ? `${unreadCount} unread` : "All read"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative flex-1">
              <Filter className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                isDark ? "text-gray-500" : "text-gray-400"
              }`} />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#00FB75] ${
                  isDark 
                    ? "bg-[#121212] border-gray-700 text-white" 
                    : "bg-white border-gray-300"
                }`}
              >
                <option value="all">All Types</option>
                <option value="match_suggested">Matches</option>
                <option value="proposal_received">Proposals</option>
                <option value="message_received">Messages</option>
                <option value="system">System</option>
              </select>
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={`px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#00FB75] ${
                isDark 
                  ? "bg-[#121212] border-gray-700 text-white" 
                  : "bg-white border-gray-300"
              }`}
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  isDark 
                    ? "bg-gray-800 hover:bg-gray-700" 
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                Mark all read
              </button>
            )}
          </div>
        </div>

        {(filteredNotifications.length !== notifications.length) && (
          <div className="mt-2 text-xs">
            <span className={isDark ? "text-gray-400" : "text-gray-600"}>
              {filteredNotifications.length} of {notifications.length}
            </span>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3 max-w-3xl mx-auto">
          {filteredNotifications.length === 0 ? (
            <div className={`text-center py-12 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>
                {notifications.length === 0 
                  ? "No notifications yet" 
                  : "No matching notifications"}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isDark 
                    ? `bg-[#121212] border-gray-800 hover:border-gray-700 ${!notification.is_read ? "border-l-2 border-l-[#00FB75]" : ""}`
                    : `bg-white border-gray-200 hover:border-gray-300 ${!notification.is_read ? "border-l-2 border-l-[#00FB75]" : ""}`
                }`}
              >
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`font-medium truncate ${
                      !notification.is_read ? (isDark ? "text-white" : "text-gray-900") : (isDark ? "text-gray-400" : "text-gray-600")
                    }`}>
                      {notification.title}
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!notification.is_read && (
                        <span className={`w-2 h-2 rounded-full bg-[#00FB75]`} />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        className={`p-1 rounded transition-colors ${
                          isDark ? "hover:bg-red-500/20 text-red-400" : "hover:bg-red-100 text-red-500"
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className={`text-sm line-clamp-2 mt-0.5 ${
                    isDark ? "text-gray-500" : "text-gray-500"
                  }`}>
                    {notification.content}
                  </p>

                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-xs ${
                      isDark ? "text-gray-600" : "text-gray-400"
                    }`}>
                      {new Date(notification.created_at).toLocaleDateString()}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"
                    }`}>
                      {getNotificationTypeLabel(notification.type)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}