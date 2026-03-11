"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import {
  Send,
  Image as ImageIcon,
  Paperclip,
  X,
  MoreVertical,
  Check,
  CheckCheck,
  Loader2,
  Smile,
  Phone,
  Video,
  ArrowLeft,
  FileText,
  File,
  Download,
  Eye,
  ExternalLink,
  Play,
} from "lucide-react";
import { Conversation, Message, MessageAttachment } from "@/types/message";
import AttachmentPreviewModal from "./AttachmentPreviewModal";
import EmojiPickerComponent from "./EmojiPicker";

interface ChatWindowProps {
  conversation: {
    profile_id: string;
    profile_name: string;
    profile_type: string;
    profile_image?: string;
  } | null;
  messages: Message[];
  loading: boolean;
  onSendMessage: (content: string, files: File[]) => void;
  onMarkAsRead: (messageId: string) => void;
  onTyping: (isTyping: boolean) => void;
  isUserTyping: boolean;
  hasMoreMessages?: boolean;
  onLoadMore?: () => void;
  currentUserProfileId?: string | null;
  isConnected?: boolean;
  onMobileBack?: () => void;
}

const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face";

export default function ChatWindow({
  conversation,
  messages,
  loading,
  onSendMessage,
  onMarkAsRead,
  onTyping,
  isUserTyping,
  hasMoreMessages = false,
  onLoadMore,
  currentUserProfileId,
  isConnected = true,
  onMobileBack,
}: ChatWindowProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [newMessage, setNewMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<MessageAttachment | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [newMessage]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (messages.length > 0 && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 200;
      if (isNearBottom) {
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
    }
  }, [messages, conversation?.profile_id, scrollToBottom]);

  useEffect(() => {
    if (messages.length > 0 && !loading) {
      setTimeout(() => {
        scrollToBottom();
      }, 300);
    }
  }, [loading, messages.length, scrollToBottom]);

  useEffect(() => {
    processedMessagesRef.current.clear();
  }, [conversation?.profile_id]);

  const handleTypingStart = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      onTyping(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onTyping(false);
    }, 2000);
  }, [isTyping, onTyping]);

  const handleTypingStop = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTyping) {
      setIsTyping(false);
      onTyping(false);
    }
  }, [isTyping, onTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) {
      handleTypingStart();
    } else {
      handleTypingStop();
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!conversation || !currentUserProfileId) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute("data-message-id");
            const isOwnMessage = entry.target.getAttribute("data-own-message") === "true";

            if (
              messageId &&
              !isOwnMessage &&
              !processedMessagesRef.current.has(messageId)
            ) {
              const message = messages.find((m) => m.id === messageId);
              if (message && !message.is_read) {
                processedMessagesRef.current.add(messageId);
                onMarkAsRead(messageId);
              }
            }
          }
        });
      },
      { threshold: 0.5, rootMargin: "0px 0px -100px 0px" }
    );

    const messageElements = messagesContainerRef.current?.querySelectorAll(
      "[data-message-id]"
    );
    messageElements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [messages, conversation, onMarkAsRead, currentUserProfileId]);

  const handleSendMessage = () => {
    if ((!newMessage.trim() && attachments.length === 0) || !isConnected) {
      if (!isConnected) {
        // toast.error("Cannot send message - connection lost");
      }
      return;
    }

    handleTypingStop();
    onSendMessage(newMessage, attachments);
    setNewMessage("");
    setAttachments([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    const validFiles = files.filter((file) => {
      const maxSize = 100 * 1024 * 1024;
      if (file.size > maxSize) {
        // toast.error(`File ${file.name} is too large (max 100MB)`);
        return false;
      }
      return true;
    });

    setAttachments((prev) => [...prev, ...validFiles]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDownload = async (attachment: MessageAttachment) => {
    setDownloading(attachment.id);
    try {
      const response = await fetch(attachment.download_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setDownloading(null);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const formatMessageTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "Yesterday";
    if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
    if (diffDays >= 7)
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return "Today";
  };

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const groupedMessages = sortedMessages.reduce((groups, message) => {
    const date = formatMessageDate(message.created_at);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

  const handleLoadMore = useCallback(async () => {
    if (!isLoadingMore && hasMoreMessages && onLoadMore) {
      setIsLoadingMore(true);
      try {
        await onLoadMore();
      } finally {
        setIsLoadingMore(false);
      }
    }
  }, [isLoadingMore, hasMoreMessages, onLoadMore]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !hasMoreMessages || isLoadingMore) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      if (scrollTop < 100) {
        handleLoadMore();
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [hasMoreMessages, isLoadingMore, handleLoadMore]);

  const getProfileImage = () =>
    conversation?.profile_image || DEFAULT_AVATAR;

  const getAttachmentPreview = (message: Message) => {
    if (!message.attachments?.length) return null;

    const attachment = message.attachments[0];
    const isImage = attachment.mime_type.startsWith("image/");
    const isVideo = attachment.mime_type.startsWith("video/");

    if (isImage) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden">
          <button
            onClick={() => setPreviewAttachment(attachment)}
            className="relative group cursor-zoom-in"
          >
            <img
              src={attachment.download_url}
              alt={attachment.file_name}
              className="w-full max-w-[200px] h-auto object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        </div>
      );
    }

    if (isVideo) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden bg-black/20">
          <button
            onClick={() => setPreviewAttachment(attachment)}
            className="relative group cursor-zoom-in w-full"
          >
            <video
              src={attachment.download_url}
              className="w-full max-w-[200px] h-auto"
              preload="metadata"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <Play className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        </div>
      );
    }

    return (
      <div
        className={`mt-2 p-3 rounded-lg flex items-center gap-2 ${
          isDark ? "bg-gray-800" : "bg-gray-100"
        }`}
      >
        <Paperclip className="w-4 h-4" />
        <span className="text-sm truncate max-w-[120px]">
          {attachment.file_name}
        </span>
        <button
          onClick={() => handleDownload(attachment)}
          disabled={downloading === attachment.id}
          className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            isDark ? "text-gray-400" : "text-gray-500"
          } disabled:opacity-50`}
          title="Download"
        >
          {downloading === attachment.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={() => setPreviewAttachment(attachment)}
          className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            isDark ? "text-gray-400" : "text-gray-500"
          }`}
          title="Preview"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
    );
  };

  if (!conversation) {
    return (
      <div
        className={`flex-1 flex flex-col ${
          isDark ? "bg-black" : "bg-gray-100"
        } h-full`}
      >
        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-8">
            <div
              className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
                isDark ? "bg-gray-800" : "bg-white"
              } shadow-lg`}
            >
              <Send
                className={`w-8 h-8 ${
                  isDark ? "text-gray-500" : "text-gray-400"
                }`}
              />
            </div>
            <h3
              className={`text-lg font-semibold mb-2 ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Your messages
            </h3>
            <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-500"}`}>
              Select a conversation to start messaging
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex-1 flex flex-col ${
        isDark ? "bg-black" : "bg-gray-100"
      } h-full overflow-hidden`}
    >
      {/* Chat Header */}
      <div
        className={`px-4 py-3 flex items-center justify-between flex-shrink-0 border-b ${
          isDark
            ? "bg-gray-900 border-gray-800"
            : "bg-white border-gray-200"
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Back button - mobile only */}
          <button
            onClick={onMobileBack}
            className={`md:hidden p-2 rounded-full transition-colors ${
              isDark
                ? "hover:bg-gray-800 text-gray-400"
                : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="relative">
            <div
              className={`w-10 h-10 rounded-full overflow-hidden ${
                isDark ? "bg-gray-800" : "bg-gray-200"
              }`}
            >
              <img
                src={getProfileImage()}
                alt={conversation.profile_name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_AVATAR;
                }}
              />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-transparent" />
          </div>

          <div>
            <h3
              className={`font-semibold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {conversation.profile_name}
            </h3>
            <p className="text-xs flex items-center gap-1">
              <span
                className={`${
                  isDark ? "text-gray-500" : "text-gray-500"
                } capitalize`}
              >
                {conversation.profile_type}
              </span>
              {isUserTyping && (
                <>
                  <span className="text-green-500">·</span>
                  <span className="text-green-500">typing...</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            className={`p-2 rounded-full transition-colors ${
              isDark
                ? "hover:bg-gray-800 text-gray-400"
                : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            className={`p-2 rounded-full transition-colors ${
              isDark
                ? "hover:bg-gray-800 text-gray-400"
                : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            <Video className="w-5 h-5" />
          </button>
          <button
            className={`p-2 rounded-full transition-colors ${
              isDark
                ? "hover:bg-gray-800 text-gray-400"
                : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className={`flex-1 overflow-y-auto min-h-0 p-4 space-y-6 ${
          isDark ? "bg-black" : "bg-gray-100"
        }`}
      >
        {/* Load More */}
        {hasMoreMessages && (
          <div className="flex justify-center">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                isDark
                  ? "bg-gray-800 hover:bg-gray-700 text-white"
                  : "bg-white hover:bg-gray-50 text-gray-900 shadow-sm"
              }`}
            >
              {isLoadingMore ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </span>
              ) : (
                "Load earlier messages"
              )}
            </button>
          </div>
        )}

        {loading && messages.length === 0 ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className={`flex gap-3 ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`w-8 h-8 rounded-full animate-pulse ${
                    isDark ? "bg-gray-800" : "bg-gray-300"
                  }`}
                />
                <div
                  className={`max-w-xs p-3 rounded-2xl animate-pulse ${
                    isDark ? "bg-gray-800" : "bg-gray-300"
                  }`}
                />
              </div>
            ))}
          </div>
        ) : sortedMessages.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <div
                className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  isDark ? "bg-gray-800" : "bg-white"
                }`}
              >
                <Smile
                  className={`w-8 h-8 ${
                    isDark ? "text-gray-500" : "text-gray-400"
                  }`}
                />
              </div>
              <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                No messages yet. Say hello!
              </p>
            </div>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date}>
              {/* Date Separator */}
              <div className="flex justify-center mb-6">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    isDark
                      ? "bg-gray-800 text-gray-400"
                      : "bg-white text-gray-500 shadow-sm"
                  }`}
                >
                  {date}
                </span>
              </div>

              {/* Messages */}
              {dateMessages.map((message) => {
                const isOwnMessage = message.sender_profile_id === currentUserProfileId;

                return (
                  <div
                    key={message.id}
                    data-message-id={message.id}
                    data-own-message={isOwnMessage}
                    className={`flex gap-2 mb-3 ${
                      isOwnMessage ? "justify-end" : "justify-start"
                    }`}
                  >
                    {/* Avatar for received messages */}
                    {!isOwnMessage && (
                      <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                        <img
                          src={getProfileImage()}
                          alt={conversation.profile_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_AVATAR;
                          }}
                        />
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[75%] flex flex-col ${
                        isOwnMessage ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                          isOwnMessage
                            ? isDark
                              ? "bg-[#00FB75] text-black rounded-tr-md"
                              : "bg-[#00FB75] text-black rounded-tr-md"
                            : isDark
                            ? "bg-gray-800 text-white rounded-tl-md"
                            : "bg-white text-gray-900 rounded-tl-md shadow-sm border border-gray-100"
                        }`}
                      >
                        {/* Message Content */}
                        {message.content && (
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {message.content}
                          </p>
                        )}

                        {/* Attachments */}
                        {getAttachmentPreview(message)}

                        {/* Time & Status */}
                        <div
                          className={`flex items-center gap-1 mt-1 text-xs ${
                            isOwnMessage
                              ? "text-black/60 justify-end"
                              : "text-gray-500"
                          }`}
                        >
                          <span>{formatMessageTime(message.created_at)}</span>
                          {isOwnMessage && (
                            <>
                              {message.is_read ? (
                                <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                              ) : message.is_delivered ? (
                                <CheckCheck className="w-3.5 h-3.5 text-gray-400" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-gray-400" />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div
          className={`px-4 py-3 border-t flex-shrink-0 ${
            isDark
              ? "bg-gray-900 border-gray-800"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  isDark ? "bg-gray-800" : "bg-gray-100"
                }`}
              >
                <Paperclip className="w-4 h-4" />
                <span className="truncate max-w-[100px]">{file.name}</span>
                <button
                  onClick={() => removeAttachment(index)}
                  className={`p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message Input */}
      <div
        className={`px-4 py-3 border-t flex-shrink-0 ${
          isDark
            ? "bg-gray-900 border-gray-800"
            : "bg-white border-gray-200"
        }`}
      >
        <div className="flex items-end gap-2">
          {/* Attachment Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!isConnected}
            className={`p-2 rounded-full transition-colors flex-shrink-0 ${
              isConnected
                ? isDark
                  ? "hover:bg-gray-800 text-gray-400"
                  : "hover:bg-gray-100 text-gray-600"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            className="hidden"
            disabled={!isConnected}
          />

          {/* Message Input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              onBlur={handleTypingStop}
              placeholder={
                isConnected ? "Type a message..." : "Reconnecting..."
              }
              rows={1}
              disabled={!isConnected}
              className={`w-full px-4 py-2.5 pr-12 rounded-2xl resize-none transition-all ${
                isDark
                  ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-[#00FB75] focus:ring-1 focus:ring-[#00FB75]/50"
                  : "bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#00FB75] focus:ring-1 focus:ring-[#00FB75]/50"
              } border focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
              style={{ minHeight: "44px", maxHeight: "120px" }}
            />

            {/* Emoji Button */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-1 rounded-lg transition-colors ${
                  showEmojiPicker
                    ? "bg-[#00FB75] text-black"
                    : isDark
                    ? "hover:bg-gray-700 text-gray-400"
                    : "hover:bg-gray-200 text-gray-500"
                }`}
              >
                <Smile className="w-5 h-5" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full right-0 mb-2 z-50">
                  <EmojiPickerComponent
                    onEmojiSelect={handleEmojiSelect}
                    onClose={() => setShowEmojiPicker(false)}
                    isOpen={showEmojiPicker}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={
              (!newMessage.trim() && attachments.length === 0) || !isConnected
            }
            className={`p-2.5 rounded-full transition-all duration-200 flex-shrink-0 ${
              newMessage.trim() || attachments.length > 0
                ? "bg-[#00FB75] text-black hover:bg-green-400 shadow-lg shadow-green-500/25"
                : isDark
                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  );
}
