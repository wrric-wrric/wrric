"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Send, Reply, Edit3, Trash2, Flag, X, Check, ChevronDown, User2 } from "lucide-react";
import toast from "react-hot-toast";

interface Comment {
  id: string;
  entity_id: string;
  user_id: string;
  username: string;
  profile_image_url: string | null;
  parent_id: string | null;
  content: string;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string | null;
  replies: Comment[];
}

interface CommentSectionProps {
  entityId: string;
  isAuthenticated: boolean;
  currentUserId?: string | null;
  onAuthRequired?: () => void;
}

export default function CommentSection({
  entityId,
  isAuthenticated,
  currentUserId,
  onAuthRequired,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchComments = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({ limit: "20" });
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`/api/labs/${entityId}/comments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (cursor) {
          setComments((prev) => [...prev, ...(data.items || [])]);
        } else {
          setComments(data.items || []);
        }
        setNextCursor(data.next_cursor || null);
      }
    } catch {
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/labs/${entityId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => [comment, ...prev]);
        setNewComment("");
        setCommentCount((c) => c + 1);
        toast.success("Comment posted");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to post comment");
      }
    } catch {
      toast.error("Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const totalCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold flex items-center gap-2 mb-6">
        <MessageSquare className="w-5 h-5 text-[#00FB75]" />
        Comments ({totalCount})
      </h3>

      {/* Comment Input */}
      <div className="mb-6">
        {isAuthenticated ? (
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-[#00FB75]/20 flex items-center justify-center flex-shrink-0">
              <User2 className="w-4 h-4 text-[#00FB75]" />
            </div>
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
                className="w-full px-4 py-3 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit();
                }}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-muted-foreground">Ctrl+Enter to submit</span>
                <button
                  onClick={handleSubmit}
                  disabled={!newComment.trim() || submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-[#00FB75] text-black rounded-lg font-medium hover:bg-[#00e065] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? "Posting..." : "Post"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 border rounded-lg text-muted-foreground">
            <button onClick={onAuthRequired} className="text-[#00FB75] hover:underline font-medium">
              Log in
            </button>{" "}
            to join the discussion
          </div>
        )}
      </div>

      {/* Comments List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-9 h-9 rounded-full bg-muted" />
              <div className="flex-1">
                <div className="h-3 bg-muted rounded w-24 mb-2" />
                <div className="h-3 bg-muted rounded w-full mb-1" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No comments yet. Be the first to comment!
        </div>
      ) : (
        <div className="space-y-1">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              entityId={entityId}
              isAuthenticated={isAuthenticated}
              currentUserId={currentUserId}
              onAuthRequired={onAuthRequired}
              onCommentUpdated={(updated) => {
                setComments((prev) =>
                  prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
                );
              }}
              onCommentDeleted={(id) => {
                setComments((prev) =>
                  prev.map((c) =>
                    c.id === id ? { ...c, content: "[Comment deleted]", is_deleted: true } : c
                  )
                );
              }}
              onReplyAdded={(parentId, reply) => {
                setComments((prev) =>
                  prev.map((c) =>
                    c.id === parentId ? { ...c, replies: [...(c.replies || []), reply] } : c
                  )
                );
                setCommentCount((ct) => ct + 1);
              }}
              getAuthHeaders={getAuthHeaders}
            />
          ))}
        </div>
      )}

      {/* Load More */}
      {nextCursor && (
        <div className="text-center mt-6">
          <button
            onClick={() => fetchComments(nextCursor)}
            disabled={loadingMore}
            className="flex items-center gap-2 mx-auto px-4 py-2 border rounded-lg hover:bg-accent transition-colors disabled:opacity-40"
          >
            <ChevronDown className="w-4 h-4" />
            {loadingMore ? "Loading..." : "Load more comments"}
          </button>
        </div>
      )}
    </div>
  );
}

// --- CommentItem ---

function CommentItem({
  comment,
  entityId,
  isAuthenticated,
  currentUserId,
  onAuthRequired,
  onCommentUpdated,
  onCommentDeleted,
  onReplyAdded,
  getAuthHeaders,
  isReply = false,
}: {
  comment: Comment;
  entityId: string;
  isAuthenticated: boolean;
  currentUserId?: string | null;
  onAuthRequired?: () => void;
  onCommentUpdated: (c: Partial<Comment> & { id: string }) => void;
  onCommentDeleted: (id: string) => void;
  onReplyAdded: (parentId: string, reply: Comment) => void;
  getAuthHeaders: () => Record<string, string>;
  isReply?: boolean;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const isOwner = currentUserId && comment.user_id === currentUserId;
  const timeAgo = formatTimeAgo(comment.created_at);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await fetch(`/api/labs/${entityId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ content: replyText.trim(), parent_id: comment.id }),
      });
      if (res.ok) {
        const reply = await res.json();
        onReplyAdded(comment.id, reply);
        setReplyText("");
        setShowReply(false);
        toast.success("Reply posted");
      }
    } catch {
      toast.error("Failed to post reply");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleEdit = async () => {
    if (!editText.trim()) return;
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ content: editText.trim() }),
      });
      if (res.ok) {
        onCommentUpdated({ id: comment.id, content: editText.trim(), is_edited: true });
        setEditing(false);
        toast.success("Comment updated");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to edit");
      }
    } catch {
      toast.error("Failed to edit comment");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this comment?")) return;
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        onCommentDeleted(comment.id);
        toast.success("Comment deleted");
      }
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    try {
      const res = await fetch(`/api/comments/${comment.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ reason: reportReason }),
      });
      if (res.ok) {
        toast.success("Comment reported");
        setShowReport(false);
        setReportReason("");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to report");
      }
    } catch {
      toast.error("Failed to report");
    }
  };

  return (
    <div className={`${isReply ? "ml-12 border-l-2 border-[#00FB75]/20 pl-4" : ""}`}>
      <div className="flex gap-3 py-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
          {comment.profile_image_url ? (
            <img src={comment.profile_image_url} alt={comment.username} className="w-full h-full object-cover" />
          ) : (
            <User2 className="w-4 h-4 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{comment.username || "User"}</span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
            {comment.is_edited && <span className="text-xs text-muted-foreground">(edited)</span>}
          </div>

          {/* Content */}
          {editing ? (
            <div className="mt-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none resize-none text-sm"
              />
              <div className="flex gap-2 mt-1">
                <button onClick={handleEdit} className="text-xs text-[#00FB75] hover:underline flex items-center gap-1">
                  <Check className="w-3 h-3" /> Save
                </button>
                <button onClick={() => { setEditing(false); setEditText(comment.content); }} className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className={`text-sm mt-1 whitespace-pre-wrap ${comment.is_deleted ? "italic text-muted-foreground" : ""}`}>
              {comment.content}
            </p>
          )}

          {/* Actions */}
          {!comment.is_deleted && !editing && (
            <div className="flex items-center gap-3 mt-2">
              {isAuthenticated && !isReply && (
                <button
                  onClick={() => setShowReply(!showReply)}
                  className="text-xs text-muted-foreground hover:text-[#00FB75] flex items-center gap-1 transition-colors"
                >
                  <Reply className="w-3 h-3" /> Reply
                </button>
              )}
              {isOwner && (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-xs text-muted-foreground hover:text-[#00FB75] flex items-center gap-1 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="text-xs text-muted-foreground hover:text-red-400 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </>
              )}
              {isAuthenticated && !isOwner && (
                <button
                  onClick={() => setShowReport(!showReport)}
                  className="text-xs text-muted-foreground hover:text-red-400 flex items-center gap-1 transition-colors"
                >
                  <Flag className="w-3 h-3" /> Report
                </button>
              )}
            </div>
          )}

          {/* Report Form */}
          {showReport && (
            <div className="mt-2 p-3 border rounded-lg bg-card">
              <p className="text-sm font-medium mb-2">Report this comment</p>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm mb-2"
              >
                <option value="">Select a reason...</option>
                <option value="spam">Spam</option>
                <option value="harassment">Harassment</option>
                <option value="misinformation">Misinformation</option>
                <option value="other">Other</option>
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleReport}
                  disabled={!reportReason}
                  className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg disabled:opacity-40"
                >
                  Submit Report
                </button>
                <button onClick={() => setShowReport(false)} className="text-xs px-3 py-1.5 border rounded-lg">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Reply Input */}
          {showReply && (
            <div className="mt-3 flex gap-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 px-3 py-2 border rounded-lg bg-background text-sm focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
              />
              <button
                onClick={handleReply}
                disabled={!replyText.trim() || submittingReply}
                className="px-3 py-2 bg-[#00FB75] text-black rounded-lg text-sm font-medium disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              entityId={entityId}
              isAuthenticated={isAuthenticated}
              currentUserId={currentUserId}
              onAuthRequired={onAuthRequired}
              onCommentUpdated={onCommentUpdated}
              onCommentDeleted={onCommentDeleted}
              onReplyAdded={onReplyAdded}
              getAuthHeaders={getAuthHeaders}
              isReply={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  } catch {
    return "";
  }
}
