"use client";

import * as React from "react";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useTheme } from "next-themes";

interface AuthPromptProps {
  action: string;
  onClose: () => void;
}

export default function AuthPrompt({ action, onClose }: AuthPromptProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center items-center p-4 ${
        isDark ? "bg-black/80" : "bg-white/80"
      }`}
    >
      <div
        className={`rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 border animate-in fade-in duration-300 ${
          isDark ? "bg-[#181818] border-[#00FB75]" : "bg-white border-gray-200"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className={`text-xl font-bold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Authentication Required
          </h2>
          <button
            onClick={onClose}
            className={`transition-colors ${
              isDark
                ? "text-gray-400 hover:text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p
          className={`text-sm mb-4 ${
            isDark ? "text-gray-300" : "text-gray-600"
          }`}
        >
          Please sign in or register to {action}.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={onClose}
            className={`flex-1 ${
              isDark
                ? "bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
                : "bg-gray-100 hover:bg-gray-200 text-black border border-gray-300"
            }`}
          >
            Cancel
          </Button>
          <Link href="/auth/login">
            <Button
              className={`flex-1 bg-[#00FB75] font-bold hover:bg-green-500 ${
                isDark ? "text-white" : "text-black"
              }`}
            >
              Sign In
            </Button>
          </Link>
          <Link href="/auth/register">
            <Button
              className={`flex-1 bg-[#00FB75] font-bold hover:bg-green-500 ${
                isDark ? "text-white" : "text-black"
              }`}
            >
              Register
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
