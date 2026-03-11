"use client";

interface ResultsHeaderProps {
  searchResults: any[];
  searchQuery: string;
  isDark: boolean;
  clearSearch: () => void;
}

export default function ResultsHeader({
  searchResults,
  searchQuery,
  isDark,
  clearSearch,
}: ResultsHeaderProps) {
  if (searchResults.length === 0) return null;

  return (
    <div className="w-full mx-auto px-4 py-3 flex items-center justify-between border-b">
      <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
        Found <span className="font-medium text-white">{searchResults.length}</span> result{searchResults.length !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
      </p>
      <button
        onClick={clearSearch}
        className={`text-sm hover:text-[#00FB75] transition-colors ${isDark ? "text-gray-500" : "text-gray-400"}`}
      >
        Clear
      </button>
    </div>
  );
}