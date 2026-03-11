"use client";

import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";
import toast from "react-hot-toast";

interface BookmarkButtonProps {
  entityId: string;
  isAuthenticated: boolean;
  onAuthRequired?: () => void;
  initialBookmarked?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function BookmarkButton({
  entityId,
  isAuthenticated,
  onAuthRequired,
  initialBookmarked = false,
  size = "md",
}: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) return;

    fetch(`/api/bookmarks/status/${entityId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.bookmarked !== undefined) setBookmarked(data.bookmarked);
      })
      .catch(() => {});
  }, [entityId, isAuthenticated]);

  const toggle = async () => {
    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }

    setLoading(true);
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");

    try {
      if (bookmarked) {
        const res = await fetch(`/api/bookmarks/${entityId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setBookmarked(false);
          toast.success("Bookmark removed");
        }
      } else {
        const res = await fetch("/api/bookmarks", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ entity_id: entityId }),
        });
        if (res.ok) {
          setBookmarked(true);
          toast.success("Saved to bookmarks");
        } else if (res.status === 409) {
          setBookmarked(true);
        }
      }
    } catch {
      toast.error("Failed to update bookmark");
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = {
    sm: "p-1",
    md: "p-1.5",
    lg: "p-2",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      disabled={loading}
      className={`${sizeClasses[size]} rounded-md transition-colors ${
        bookmarked
          ? "text-[#00FB75] bg-[#00FB75]/10"
          : "text-gray-400 hover:text-[#00FB75] hover:bg-gray-100 dark:hover:bg-gray-800"
      } ${loading ? "opacity-50" : ""}`}
      title={bookmarked ? "Remove bookmark" : "Bookmark this lab"}
    >
      <Bookmark
        className={iconSizes[size]}
        fill={bookmarked ? "currentColor" : "none"}
      />
    </button>
  );
}
