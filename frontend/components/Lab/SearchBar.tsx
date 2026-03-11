"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, X, Search, Zap, Globe, Book } from "lucide-react";

interface SearchBarProps {
  searchQuery: string;
  isSearching: boolean;
  isDark: boolean;
  handleSearchChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSearchSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  clearSearch: () => void;
  onCancelExternal?: () => void;
  onSearchInitiate?: () => void;
  selectedType: string;
  setSelectedType: (type: string) => void;
}

export default function SearchBar({
  searchQuery,
  isSearching,
  isDark,
  handleSearchChange,
  handleSearchSubmit,
  clearSearch,
  onCancelExternal,
  onSearchInitiate,
  selectedType,
  setSelectedType,
}: SearchBarProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const maxHeight = 100;
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        setShowTypeMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.key === "Enter" && (e.ctrlKey || e.metaKey)) && formRef.current) {
      e.preventDefault();
      formRef.current.requestSubmit();
    }
  };

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    setShowTypeMenu(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "general": return <Zap className="w-4 h-4" />;
      case "publications": return <Book className="w-4 h-4" />;
      case "websites": return <Globe className="w-4 h-4" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "general": return "General";
      case "publications": return "Publications";
      case "websites": return "Websites";
      default: return "All";
    }
  };

  const typeOptions = [
    { id: "general", label: "AI Search", icon: <Zap className="w-4 h-4" /> },
    { id: "publications", label: "Publications", icon: <Book className="w-4 h-4" /> },
    { id: "websites", label: "Websites", icon: <Globe className="w-4 h-4" /> },
  ];

  return (
    <form
      ref={formRef}
      onSubmit={handleSearchSubmit}
      className="flex-1 relative min-w-0"
      aria-label="Search form"
    >
      <div className={`relative flex items-center rounded-lg border transition-all ${
        isDark
          ? "bg-[#121212] border-gray-700 focus-within:border-[#00FB75]"
          : "bg-white border-gray-300 focus-within:border-[#00FB75]"
      }`}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTypeMenu(!showTypeMenu)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-l-lg transition-colors ${
              isDark
                ? "bg-[#1A1A1A] text-gray-300 hover:bg-gray-800"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {getTypeIcon(selectedType)}
            <span className="hidden sm:inline">{getTypeLabel(selectedType)}</span>
          </button>

          {showTypeMenu && (
            <div className={`absolute top-full left-0 mt-1 w-40 rounded-lg border shadow-lg py-1 z-50 ${
              isDark ? "bg-[#1A1A1A] border-gray-700" : "bg-white border-gray-200"
            }`}>
              {typeOptions.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleTypeSelect(type.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    selectedType === type.id
                      ? isDark ? "bg-[#00FB75] bg-opacity-10 text-[#00FB75]" : "bg-[#00FB75] bg-opacity-10 text-green-600"
                      : isDark ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {type.icon}
                  {type.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={searchQuery}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          placeholder="Search labs..."
          rows={1}
          className={`flex-1 px-3 py-2 bg-transparent focus:outline-none resize-none overflow-hidden text-sm ${
            isDark ? "text-white placeholder-gray-500" : "text-gray-900 placeholder-gray-400"
          }`}
          aria-label="Search labs"
          onFocus={() => setShowTypeMenu(false)}
        />

        <div className="flex items-center pr-2">
          {searchQuery && !isSearching && (
            <button
              type="button"
              onClick={clearSearch}
              className={`p-1.5 rounded transition-colors ${
                isDark ? "text-gray-500 hover:text-white" : "text-gray-400 hover:text-gray-700"
              }`}
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {isSearching ? (
            <button
              type="button"
              onClick={onCancelExternal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
            >
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!searchQuery.trim()}
              className={`flex items-center gap-1 px-3 py-1.5 rounded font-medium text-sm transition-all ${
                searchQuery.trim()
                  ? "bg-[#00FB75] text-black hover:bg-green-400"
                  : isDark ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </button>
          )}
        </div>
      </div>
    </form>
  );
}