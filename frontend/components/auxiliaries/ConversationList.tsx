"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Search, Plus, MessageCircle } from "lucide-react";
import { getProfileDisplayName } from "@/types/message";

interface Conversation {
  profile_id: string;
  profile_name: string;
  profile_type: string;
  profile_image?: string;
  last_message: any;
  unread_count: number;
  last_activity: string | null;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onMobileClose?: () => void;
  loading: boolean;
}

const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face";

export default function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  onNewConversation,
  onMobileClose,
  loading,
}: ConversationListProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [searchTerm, setSearchTerm] = useState("");

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.profile_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.last_message?.content?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return "Now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getLastMessagePreview = (conversation: Conversation) => {
    if (!conversation.last_message) return "No messages yet";

    if (conversation.last_message.attachments?.length > 0) {
      const attachment = conversation.last_message.attachments[0];
      if (attachment.mime_type.startsWith("image/")) return "📷 Photo";
      if (attachment.mime_type.startsWith("video/")) return "📹 Video";
      return "📎 Attachment";
    }

    return (
      conversation.last_message.content?.slice(0, 50) +
      (conversation.last_message.content?.length > 50 ? "..." : "") || "Message"
    );
  };

  const getProfileImage = (conversation: Conversation) =>
    conversation.profile_image || DEFAULT_AVATAR;

  if (loading) {
    return (
      <div
        className={`h-full flex flex-col ${
          isDark ? "bg-black" : "bg-gray-50"
        } w-full sm:w-80 flex-shrink-0`}
      >
        {/* Search Skeleton */}
        <div className={`p-4 border-b ${isDark ? "border-gray-800" : "border-gray-200"}`}>
          <div className="relative">
            <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
          </div>
        </div>
        {/* List Skeleton */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col ${
        isDark ? "bg-black" : "bg-gray-50"
      } w-full sm:w-80 flex-shrink-0 border-r overflow-hidden ${
        isDark ? "border-gray-800" : "border-gray-200"
      } h-full`}
    >
      {/* Header */}
      <div
        className={`p-4 border-b flex-shrink-0 ${
          isDark ? "border-gray-800" : "border-gray-200"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className={`text-xl font-bold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Messages
          </h2>
          <button
            onClick={onNewConversation}
            className={`p-2 rounded-xl transition-all ${
              isDark
                ? "bg-gray-800 hover:bg-gray-700 text-white"
                : "bg-gray-200 hover:bg-gray-300 text-gray-900"
            }`}
            title="New conversation"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
              isDark ? "text-gray-500" : "text-gray-400"
            }`}
          />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all ${
              isDark
                ? "bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-[#00FB75] focus:ring-1 focus:ring-[#00FB75]/50"
                : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#00FB75] focus:ring-1 focus:ring-[#00FB75]/50"
            } border focus:outline-none`}
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredConversations.length === 0 ? (
          <div
            className={`flex flex-col items-center justify-center h-full text-center p-6 ${
              isDark ? "text-gray-400" : "text-gray-500"
            }`}
          >
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                isDark ? "bg-gray-800" : "bg-gray-200"
              }`}
            >
              <MessageCircle className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="font-semibold mb-2">
              {searchTerm ? "No results found" : "No conversations"}
            </h3>
            <p className="text-sm opacity-70">
              {searchTerm
                ? "Try a different search term"
                : "Start a new conversation to begin messaging"}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.profile_id}
                onClick={() => {
                  onSelectConversation(conversation.profile_id);
                  if (window.innerWidth < 768) {
                    onMobileClose?.();
                  }
                }}
                className={`w-full p-3 rounded-2xl transition-all duration-200 flex items-start gap-3 ${
                  selectedConversation === conversation.profile_id
                    ? isDark
                      ? "bg-gray-900"
                      : "bg-white"
                    : isDark
                    ? "hover:bg-gray-900"
                    : "hover:bg-white"
                } ${
                  selectedConversation === conversation.profile_id
                    ? isDark
                      ? "ring-1 ring-gray-800"
                      : "shadow-sm"
                    : ""
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div
                    className={`w-12 h-12 rounded-full overflow-hidden ${
                      isDark ? "bg-gray-800" : "bg-gray-200"
                    }`}
                  >
                    <img
                      src={getProfileImage(conversation)}
                      alt={conversation.profile_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />
                  </div>
                  {/* Online Indicator */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-transparent" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <h3
                      className={`font-semibold truncate ${
                        conversation.unread_count > 0
                          ? isDark
                            ? "text-white"
                            : "text-gray-900"
                          : isDark
                          ? "text-gray-300"
                          : "text-gray-700"
                      }`}
                    >
                      {getProfileDisplayName({
                        display_name: conversation.profile_name,
                      })}
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {conversation.last_activity && (
                        <span
                          className={`text-xs ${
                            conversation.unread_count > 0
                              ? isDark
                                ? "text-[#00FB75]"
                                : "text-green-600 font-semibold"
                              : isDark
                              ? "text-gray-500"
                              : "text-gray-400"
                          }`}
                        >
                          {formatTime(conversation.last_activity)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-sm truncate flex-1 ${
                        conversation.unread_count > 0
                          ? isDark
                            ? "text-gray-300 font-medium"
                            : "text-gray-700 font-medium"
                          : isDark
                          ? "text-gray-500"
                          : "text-gray-500"
                      }`}
                    >
                      {getLastMessagePreview(conversation)}
                    </p>
                    {conversation.unread_count > 0 && (
                      <span
                        className={`flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                          isDark
                            ? "bg-[#00FB75] text-black"
                            : "bg-green-500 text-white"
                        }`}
                      >
                        {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                      </span>
                    )}
                  </div>

                  {/* Profile Type Badge */}
                  <div className="mt-1.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                        isDark
                          ? "bg-gray-800 text-gray-400"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {conversation.profile_type}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
