"use client";

interface StatusBarProps {
  searchStatus: string;
  isDark: boolean;
}

export default function StatusBar({ searchStatus, isDark }: StatusBarProps) {
  if (!searchStatus || searchStatus === "Ready to search") return null;

  return (
    <div className="w-full mx-auto px-4 py-2">
      <div className={`flex items-center gap-2 text-sm ${
        isDark ? "text-gray-400" : "text-gray-600"
      }`}>
        <span className="w-2 h-2 bg-[#00FB75] rounded-full animate-pulse" />
        {searchStatus}
      </div>
    </div>
  );
}