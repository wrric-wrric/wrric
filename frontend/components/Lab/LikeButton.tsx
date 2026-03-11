"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";

interface LikeButtonProps {
  entityId: string;
  initialCount?: number;
  initialLiked?: boolean;
  isAuthenticated: boolean;
  onAuthRequired?: () => void;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
}

export default function LikeButton({
  entityId,
  initialCount = 0,
  initialLiked = false,
  isAuthenticated,
  onAuthRequired,
  size = "md",
  showCount = true,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLiked(initialLiked);
    setCount(initialCount);
  }, [initialLiked, initialCount]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }

    // Optimistic update
    const prevLiked = liked;
    const prevCount = count;
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);
    setLoading(true);

    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`/api/labs/${entityId}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setCount(data.like_count);
      } else {
        // Revert on error
        setLiked(prevLiked);
        setCount(prevCount);
      }
    } catch {
      // Revert on error
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const textClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex items-center gap-1.5 transition-all duration-200 group ${
        loading ? "opacity-60" : ""
      }`}
      aria-label={liked ? "Unlike this lab" : "Like this lab"}
    >
      <Heart
        className={`${sizeClasses[size]} transition-all duration-200 ${
          liked
            ? "fill-red-500 text-red-500 scale-110"
            : "text-muted-foreground group-hover:text-red-400 group-hover:scale-110"
        }`}
      />
      {showCount && (
        <span className={`${textClasses[size]} ${liked ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
          {count}
        </span>
      )}
    </button>
  );
}
