"use client";

import { useState, useEffect } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import toast from "react-hot-toast";

interface FollowButtonProps {
  targetType: "user" | "partner" | "lab";
  targetId: string;
  isAuthenticated: boolean;
  onAuthRequired?: () => void;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  initialFollowing?: boolean;
  initialCount?: number;
}

export default function FollowButton({
  targetType,
  targetId,
  isAuthenticated,
  onAuthRequired,
  size = "md",
  showCount = true,
  initialFollowing = false,
  initialCount = 0,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    setFollowing(initialFollowing);
    setCount(initialCount);
  }, [initialFollowing, initialCount]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }

    // Optimistic update
    const prevFollowing = following;
    const prevCount = count;
    setFollowing(!following);
    setCount(following ? count - 1 : count + 1);
    setLoading(true);

    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const method = following ? "DELETE" : "POST";
      const res = await fetch("/api/follow", {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ target_type: targetType, target_id: targetId }),
      });

      if (res.ok) {
        const data = await res.json();
        setFollowing(data.followed);
        setCount(data.follower_count);
        toast.success(data.followed ? "Following!" : "Unfollowed");
      } else {
        setFollowing(prevFollowing);
        setCount(prevCount);
        const err = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setFollowing(true);
        } else {
          toast.error(err.detail || "Failed to update follow");
        }
      }
    } catch {
      setFollowing(prevFollowing);
      setCount(prevCount);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = {
    sm: "text-xs px-3 py-1",
    md: "text-sm px-4 py-1.5",
    lg: "text-base px-5 py-2",
  };

  const iconSize = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-200 border ${
        sizeClasses[size]
      } ${loading ? "opacity-60" : ""} ${
        following
          ? hovering
            ? "bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400"
            : "bg-[#00FB75]/10 border-[#00FB75] text-[#00FB75]"
          : "bg-transparent border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-[#00FB75] hover:text-[#00FB75]"
      }`}
      aria-label={following ? "Unfollow" : "Follow"}
    >
      {following ? (
        <>
          <UserCheck className={iconSize[size]} />
          <span>{hovering ? "Unfollow" : "Following"}</span>
        </>
      ) : (
        <>
          <UserPlus className={iconSize[size]} />
          <span>Follow</span>
        </>
      )}
      {showCount && count > 0 && (
        <span className="ml-1 opacity-70">{count}</span>
      )}
    </button>
  );
}
