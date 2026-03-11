"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/hooks/sideBarProvider";
import { Wifi, WifiOff, Users, ChevronLeft } from "lucide-react";
import toast from "react-hot-toast";
import ConversationList from "@/components/auxiliaries/ConversationList";
import ChatWindow from "@/components/auxiliaries/ChatWindow";
import NewConversationModal from "@/components/auxiliaries/NewConversationModal";
import ProfileSelector from "@/components/auxiliaries/ProfileSelector";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Conversation, Message } from "@/types/message";
import { getProfileDisplayName } from "@/types/message";

function getUserIdFromCookies(): string | null {
  if (typeof document === "undefined") return null;

  const cookieString = document.cookie;
  const cookies = cookieString.split(";");

  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "user_id") {
      return value || null;
    }
  }

  return null;
}

export default function MessagesPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const router = useRouter();
  const { setLoadSession } = useSidebar();
  const [mounted, setMounted] = useState(false);

  const [isNewConversationModalOpen, setIsNewConversationModalOpen] =
    useState(false);
  const [isProfileSelectorOpen, setIsProfileSelectorOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<
    string | null
  >(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // Ref for handleMarkAsRead to avoid circular dependency
  const handleMarkAsReadRef = useRef<(messageId: string) => Promise<void>>();

  // Initialize
  useEffect(() => {
    setMounted(true);
    setLoadSession(() => {});
    return () => setLoadSession(() => {});
  }, [setLoadSession]);

  // Get user ID from cookies and initialize profile
  useEffect(() => {
    const userId = getUserIdFromCookies();
    if (userId) {
      const savedProfileId = localStorage.getItem("currentProfileId");
      if (savedProfileId) {
        setCurrentUserProfileId(savedProfileId);
      } else {
        setIsProfileSelectorOpen(true);
      }
    } else {
      toast.error("Please login again");
      router.push("/auth/login");
    }
  }, [router]);

  // Handle profile selection
  const handleProfileSelect = useCallback((profileId: string) => {
    setCurrentUserProfileId(profileId);
    localStorage.setItem("currentProfileId", profileId);
    setIsProfileSelectorOpen(false);
    toast.success("Profile selected");
    setConversations([]);
    setSelectedConversation(null);
    setMessages([]);
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!currentUserProfileId) return;

    try {
      setConversationsLoading(true);
      const response = await fetch(
        `/api/messages/conversations?profile_id=${currentUserProfileId}`
      );

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Please login again");
          router.push("/auth/login");
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const typedConversations: Conversation[] = data.map((conv: any) => ({
        ...conv,
        profile_image: conv.profile_image || null,
      }));

      setConversations(typedConversations);
    } catch (error) {
      console.error("Fetch conversations error:", error);
      toast.error("Failed to load conversations");
    } finally {
      setConversationsLoading(false);
    }
  }, [currentUserProfileId, router]);

  // Load conversations when profile is available
  useEffect(() => {
    if (currentUserProfileId) {
      fetchConversations();
    }
  }, [currentUserProfileId, fetchConversations]);

  // WebSocket handlers
  const handleNewMessage = useCallback(
    (newMessage: Message) => {
      const isForCurrentConversation =
        selectedConversation &&
        (newMessage.sender_profile_id === selectedConversation ||
          newMessage.receiver_profile_id === selectedConversation);

      if (isForCurrentConversation) {
        setMessages((prev) => {
          if (prev.some((msg) => msg.id === newMessage.id)) {
            return prev;
          }
          return [newMessage, ...prev];
        });

        if (
          newMessage.receiver_profile_id === currentUserProfileId &&
          !newMessage.is_read
        ) {
          handleMarkAsReadRef.current?.(newMessage.id);
        }
      }

      setConversations((prev) => {
        const otherProfileId =
          newMessage.sender_profile_id === currentUserProfileId
            ? newMessage.receiver_profile_id
            : newMessage.sender_profile_id;

        const existingConvIndex = prev.findIndex(
          (conv) => conv.profile_id === otherProfileId
        );

        if (existingConvIndex >= 0) {
          const updated = [...prev];
          const isUnread =
            newMessage.receiver_profile_id === currentUserProfileId &&
            !newMessage.is_read;

          updated[existingConvIndex] = {
            ...updated[existingConvIndex],
            last_message: newMessage,
            last_activity: newMessage.created_at,
            unread_count: isUnread
              ? (updated[existingConvIndex].unread_count || 0) + 1
              : updated[existingConvIndex].unread_count,
          };

          const [movedConv] = updated.splice(existingConvIndex, 1);
          return [movedConv, ...updated];
        } else {
          fetchConversations();
          return prev;
        }
      });
    },
    [selectedConversation, currentUserProfileId, fetchConversations]
  );

  const handleMessageRead = useCallback(
    (data: { message_id: string; reader_profile_id: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.message_id ? { ...msg, is_read: true } : msg
        )
      );
    },
    []
  );

  const handleMessageSent = useCallback((data: any) => {
    if (data.id) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.id ? { ...msg, is_delivered: true } : msg
        )
      );
    }
  }, []);

  const handleTypingIndicator = useCallback(
    (data: { sender_profile_id: string; is_typing: boolean }) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        if (data.is_typing) {
          newSet.add(data.sender_profile_id);
        } else {
          newSet.delete(data.sender_profile_id);
        }
        return newSet;
      });
    },
    []
  );

  const handleNotification = useCallback((data: any) => {
    toast.success(data.content || "New notification");
  }, []);

  const handleWebSocketMessage = useCallback(
    (message: any) => {
      switch (message.type) {
        case "new_message":
          handleNewMessage(message.data);
          break;
        case "message_read":
          handleMessageRead(message.data);
          break;
        case "message_sent":
          handleMessageSent(message.data);
          break;
        case "typing":
          handleTypingIndicator(message.data);
          break;
        case "notification":
          handleNotification(message.data);
          break;
      }
    },
    [
      handleNewMessage,
      handleMessageRead,
      handleMessageSent,
      handleTypingIndicator,
      handleNotification,
    ]
  );

  const { sendMessage: sendWebSocketMessage, isConnected, connectionStatus } =
    useWebSocket(handleWebSocketMessage, [currentUserProfileId]);

  const sendTypingIndicator = useCallback(
    (isTyping: boolean) => {
      if (!selectedConversation || !isConnected) return;

      sendWebSocketMessage({
        type: "typing",
        data: {
          recipient_profile_id: selectedConversation,
          is_typing: isTyping,
        },
      });
    },
    [selectedConversation, isConnected, sendWebSocketMessage]
  );

  // Mark as read
  const handleMarkAsRead = useCallback(
    async (messageId: string) => {
      if (currentUserProfileId) {
        sendWebSocketMessage({
          type: "message_read",
          data: {
            message_id: messageId,
            reader_profile_id: currentUserProfileId,
          },
        });
      }

      await fetch(`/api/messages/${messageId}/read`, { method: "POST" });

      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, is_read: true } : msg))
      );
    },
    [currentUserProfileId, sendWebSocketMessage]
  );

  // Update ref whenever handleMarkAsRead changes
  useEffect(() => {
    handleMarkAsReadRef.current = handleMarkAsRead;
  }, [handleMarkAsRead]);

  // Fetch messages
  const fetchMessages = useCallback(
    async (conversationId: string, offset: number = 0) => {
      if (!currentUserProfileId) return;

      try {
        setMessagesLoading(true);
        const response = await fetch(
          `/api/messages/conversation/${conversationId}?limit=50&offset=${offset}&profile_id=${currentUserProfileId}`
        );

        if (!response.ok) {
          if (response.status === 401) {
            toast.error("Please login again");
            router.push("/auth/login");
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const typedMessages: Message[] = (data.messages || []).map(
          (msg: any) => ({
            ...msg,
            sender_profile_image: msg.sender_profile_image || undefined,
            receiver_profile_image: msg.receiver_profile_image || undefined,
          })
        );

        if (offset === 0) {
          setMessages(typedMessages);
        } else {
          setMessages((prev) => [...prev, ...typedMessages]);
        }

        setHasMoreMessages(data.has_more || false);
        setMessageOffset(offset + typedMessages.length);
      } catch (error) {
        console.error("Fetch messages error:", error);
        toast.error("Failed to load messages");
      } finally {
        setMessagesLoading(false);
      }
    },
    [currentUserProfileId, router]
  );

  // Handle conversation selection
  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      if (!currentUserProfileId) return;

      setSelectedConversation(conversationId);
      setIsMobileChatOpen(true);
      setMessageOffset(0);
      setTypingUsers(new Set());
      fetchMessages(conversationId, 0);

      const conversation = conversations.find(
        (conv) => conv.profile_id === conversationId
      );
      if (conversation && conversation.unread_count > 0) {
        fetch(
          `/api/messages/conversation/${conversationId}/read?profile_id=${currentUserProfileId}`,
          { method: "POST" }
        )
          .then(() => {
            setConversations((prev) =>
              prev.map((conv) =>
                conv.profile_id === conversationId
                  ? { ...conv, unread_count: 0 }
                  : conv
              )
            );
          })
          .catch(console.error);
      }
    },
    [fetchMessages, conversations, currentUserProfileId]
  );

  const handleMobileChatClose = useCallback(() => {
    setIsMobileChatOpen(false);
    setSelectedConversation(null);
  }, []);

  // Start new conversation
  const handleStartNewConversation = useCallback(
    async (profileId: string) => {
      const existingConv = conversations.find(
        (conv) => conv.profile_id === profileId
      );
      if (existingConv) {
        handleSelectConversation(profileId);
        setIsNewConversationModalOpen(false);
        return;
      }

      if (!currentUserProfileId) {
        toast.error("Unable to determine your profile");
        return;
      }

      try {
        const formData = new FormData();
        formData.append("receiver_profile_id", profileId);
        formData.append("content", "Hello! I would like to connect with you.");
        formData.append("message_type", "text");
        formData.append("metadata", JSON.stringify({}));

        const response = await fetch(
          `/api/messages?profile_id=${currentUserProfileId}`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        await fetchConversations();
        setTimeout(() => {
          handleSelectConversation(profileId);
          setIsNewConversationModalOpen(false);
          toast.success("Conversation started!");
        }, 500);
      } catch (error) {
        console.error("Failed to start conversation:", error);
        toast.error("Failed to start conversation");
      }
    },
    [conversations, handleSelectConversation, fetchConversations, currentUserProfileId]
  );

  // Send message
  const handleSendMessage = useCallback(
    async (content: string, files: File[]) => {
      if (!selectedConversation || !currentUserProfileId) {
        toast.error("Cannot send message");
        return;
      }

      try {
        const formData = new FormData();
        formData.append("receiver_profile_id", selectedConversation);
        formData.append("content", content);
        formData.append(
          "message_type",
          files.length > 0 ? "document" : "text"
        );
        formData.append("metadata", JSON.stringify({}));

        files.forEach((file) => {
          formData.append("files", file);
        });

        const tempMessage: Message = {
          id: `temp-${Date.now()}`,
          sender_profile_id: currentUserProfileId,
          receiver_profile_id: selectedConversation,
          content,
          message_type: files.length > 0 ? "document" : "text",
          metadata: {},
          is_read: false,
          is_delivered: false,
          encrypted: false,
          created_at: new Date().toISOString(),
          attachments: files.map((file) => ({
            id: `temp-attach-${Date.now()}`,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            download_url: "",
            thumbnail_url: null,
          })),
        };

        setMessages((prev) => [tempMessage, ...prev]);

        const response = await fetch(
          `/api/messages?profile_id=${currentUserProfileId}`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const newMessage = await response.json();

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempMessage.id ? { ...newMessage, is_delivered: true } : msg
          )
        );

        setConversations((prev) => {
          const updated = prev.map((conv) =>
            conv.profile_id === selectedConversation
              ? {
                  ...conv,
                  last_message: newMessage,
                  last_activity: newMessage.created_at,
                  unread_count: 0,
                }
              : conv
          );

          const currentConv = updated.find(
            (conv) => conv.profile_id === selectedConversation
          );
          if (currentConv) {
            return [
              currentConv,
              ...updated.filter((conv) => conv.profile_id !== selectedConversation),
            ];
          }

          return updated;
        });

        sendTypingIndicator(false);
        toast.success("Message sent");
      } catch (error) {
        console.error("Send message error:", error);
        setMessages((prev) => prev.filter((msg) => !msg.id.startsWith("temp-")));
        toast.error("Failed to send message");
      }
    },
    [selectedConversation, currentUserProfileId, sendTypingIndicator]
  );

  const currentConversation = selectedConversation
    ? conversations.find((conv) => conv.profile_id === selectedConversation) ||
      null
    : null;

  const isUserTyping = Array.from(typingUsers).some(
    (userId) => userId === selectedConversation
  );

  if (!mounted) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? "bg-black" : "bg-gray-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full border-2 border-t-transparent animate-spin ${
              isDark ? "border-white" : "border-gray-900"
            }`}
          />
          <span className={isDark ? "text-gray-400" : "text-gray-600"}>
            Loading...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`h-screen flex flex-col ${
        isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* Connection Status Bar */}
      <div
        className={`px-4 py-1.5 text-xs flex items-center justify-center gap-2 flex-shrink-0 ${
          isConnected
            ? isDark
              ? "bg-gray-900 text-gray-500"
              : "bg-gray-100 text-gray-500"
            : "bg-yellow-500/10 text-yellow-600"
        }`}
      >
        {isConnected ? (
          <>
            <Wifi className="w-3 h-3 text-green-500" />
            <span>Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3" />
            <span>
              {connectionStatus === "connecting"
                ? "Connecting..."
                : "Disconnected - Attempting to reconnect..."}
            </span>
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {!currentUserProfileId ? (
          // Profile Selection
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-8">
              <div
                className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  isDark ? "bg-gray-800" : "bg-white"
                } shadow-lg`}
              >
                <Users
                  className={`w-10 h-10 ${
                    isDark ? "text-gray-500" : "text-gray-400"
                  }`}
                />
              </div>
              <h3 className="text-lg font-semibold mb-2">Select Profile</h3>
              <p className="text-sm opacity-70 mb-6">
                Choose a profile to start messaging
              </p>
              <button
                onClick={() => setIsProfileSelectorOpen(true)}
                className="px-6 py-2.5 rounded-xl font-medium bg-[#00FB75] text-black hover:bg-green-400 transition-colors"
              >
                Choose Profile
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Conversation List - hidden on mobile when chat is open */}
            <div className={`${isMobileChatOpen ? 'hidden md:flex' : 'flex'} w-full sm:w-80 flex-shrink-0`}>
              <ConversationList
                conversations={conversations}
                selectedConversation={selectedConversation}
                onSelectConversation={handleSelectConversation}
                onNewConversation={() => setIsNewConversationModalOpen(true)}
                onMobileClose={handleMobileChatClose}
                loading={conversationsLoading}
              />
            </div>

            {/* Chat Window - visible on mobile when chat is open, always on desktop */}
            <div className={`${isMobileChatOpen ? 'flex' : 'hidden md:flex'} flex-1 min-w-0`}>
              <ChatWindow
                conversation={currentConversation}
                messages={messages}
                loading={messagesLoading}
                onSendMessage={handleSendMessage}
                onMarkAsRead={handleMarkAsRead}
                onTyping={sendTypingIndicator}
                isUserTyping={isUserTyping}
                hasMoreMessages={hasMoreMessages}
              onLoadMore={() =>
                selectedConversation && fetchMessages(selectedConversation, messageOffset)
              }
              currentUserProfileId={currentUserProfileId}
              isConnected={isConnected}
              onMobileBack={handleMobileChatClose}
            />
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <NewConversationModal
        isOpen={isNewConversationModalOpen}
        onClose={() => setIsNewConversationModalOpen(false)}
        onStartConversation={handleStartNewConversation}
        existingConversations={conversations.map((c) => c.profile_id)}
        currentUserId={getUserIdFromCookies()}
      />

      <ProfileSelector
        isOpen={isProfileSelectorOpen}
        onClose={() => setIsProfileSelectorOpen(false)}
        onProfileSelect={handleProfileSelect}
        currentProfileId={currentUserProfileId}
      />
    </div>
  );
}
