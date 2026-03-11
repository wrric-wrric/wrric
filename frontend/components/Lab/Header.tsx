"use client";

import { useState } from "react";
import { FlaskConical, SlidersHorizontal } from "lucide-react";
import SearchBar from "./SearchBar";
import FilterButtons from "./FilterButtons";

interface HeaderProps {
  isDark: boolean;
  searchQuery: string;
  isSearching: boolean;
  filterType: string;
  setFilterType: (value: string) => void;
  handleSearchChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSearchSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  clearSearch: () => void;
  onCancelExternal: () => void;
  onSearchInitiate: () => void;
  handleAddLabClick: () => void;
  selectedType: string;
  setSelectedType: (type: string) => void;
  handleViewLabs: () => void;
  handleLogout: () => void;
  // New filter props
  sortBy: string;
  setSortBy: (value: string) => void;
  countryFilter: string;
  setCountryFilter: (value: string) => void;
  sectorFilter: string;
  setSectorFilter: (value: string) => void;
}

export default function Header({
  isDark,
  searchQuery,
  isSearching,
  filterType,
  setFilterType,
  handleSearchChange,
  handleSearchSubmit,
  clearSearch,
  onCancelExternal,
  onSearchInitiate,
  handleAddLabClick,
  selectedType,
  setSelectedType,
  sortBy,
  setSortBy,
  countryFilter,
  setCountryFilter,
  sectorFilter,
  setSectorFilter,
}: HeaderProps) {
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const hasActiveFilters = countryFilter || sectorFilter || sortBy !== "newest" || filterType !== "all";
  const activeFilterCount = [
    countryFilter ? 1 : 0,
    sectorFilter ? 1 : 0,
    sortBy !== "newest" ? 1 : 0,
    filterType !== "all" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearAllFilters = () => {
    setCountryFilter("");
    setSectorFilter("");
    setSortBy("newest");
    setFilterType("all");
  };

  return (
    <header className={`sticky top-0 z-30 w-full border-b ${
      isDark ? "bg-black border-gray-800" : "bg-gray-50 border-gray-200"
    }`}>
      <div className="w-full mx-auto px-4 py-3">
        {/* Main Row - Always visible */}
        <div className="flex items-center gap-2 md:gap-3 w-full">
          {/* Logo - Hidden on mobile to save space */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <FlaskConical className="w-6 h-6 text-[#00FB75]" />
            <h1 className={`text-xl font-bold ${
              isDark ? "text-white" : "text-gray-900"
            }`}>
              Labs
            </h1>
          </div>

          {/* Mobile: Logo icon only */}
          <div className="flex md:hidden items-center flex-shrink-0">
            <FlaskConical className="w-5 h-5 text-[#00FB75]" />
          </div>

          {/* Search Bar - Takes available space */}
          <div className="flex-1 min-w-0">
            <SearchBar
              searchQuery={searchQuery}
              isSearching={isSearching}
              isDark={isDark}
              handleSearchChange={handleSearchChange}
              handleSearchSubmit={handleSearchSubmit}
              clearSearch={clearSearch}
              onCancelExternal={onCancelExternal}
              onSearchInitiate={onSearchInitiate}
              selectedType={selectedType}
              setSelectedType={setSelectedType}
            />
          </div>

          {/* Mobile: Filter toggle button */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className={`md:hidden flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showMobileFilters || hasActiveFilters
                ? "bg-[#00FB75] text-black"
                : isDark
                ? "bg-[#181818] text-gray-300 border border-gray-700"
                : "bg-white text-gray-700 border border-gray-300"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                showMobileFilters || hasActiveFilters
                  ? "bg-black text-[#00FB75]"
                  : isDark ? "bg-gray-700 text-white" : "bg-gray-200 text-gray-700"
              }`}>
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Desktop: Inline filters */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <FilterButtons filterType={filterType} setFilterType={setFilterType} isDark={isDark} />

            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`text-sm px-2 py-1.5 rounded-lg border cursor-pointer ${
                isDark
                  ? "bg-[#181818] border-gray-700 text-white"
                  : "bg-white border-gray-300 text-gray-700"
              }`}
            >
              <option value="newest">Newest</option>
              <option value="most_liked">Most Liked</option>
              <option value="most_commented">Most Commented</option>
              <option value="most_viewed">Most Viewed</option>
            </select>

            {/* Country filter */}
            <input
              type="text"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              placeholder="Country"
              className={`text-sm px-2 py-1.5 rounded-lg border w-24 lg:w-32 ${
                isDark
                  ? "bg-[#181818] border-gray-700 text-white placeholder-gray-500"
                  : "bg-white border-gray-300 text-gray-700"
              }`}
            />

            {/* Sector filter */}
            <input
              type="text"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              placeholder="Sector"
              className={`text-sm px-2 py-1.5 rounded-lg border w-24 lg:w-32 ${
                isDark
                  ? "bg-[#181818] border-gray-700 text-white placeholder-gray-500"
                  : "bg-white border-gray-300 text-gray-700"
              }`}
            />

            {/* Clear filters button */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-[#00FB75] hover:underline whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>

          {/* Add Lab button */}
          <button
            className="px-3 py-1.5 md:px-4 md:py-2 bg-[#00FB75] text-black font-medium rounded-lg hover:bg-green-400 transition-colors text-sm whitespace-nowrap flex-shrink-0"
            onClick={handleAddLabClick}
          >
            <span className="hidden sm:inline">+ Add Lab</span>
            <span className="sm:hidden">+</span>
          </button>
        </div>

        {/* Mobile: Expandable filter panel */}
        {showMobileFilters && (
          <div className={`md:hidden mt-3 pt-3 border-t ${
            isDark ? "border-gray-800" : "border-gray-200"
          }`}>
            {/* Filter type buttons */}
            <div className="mb-3">
              <FilterButtons filterType={filterType} setFilterType={setFilterType} isDark={isDark} />
            </div>

            {/* Sort and filter inputs */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={`text-sm px-3 py-2 rounded-lg border ${
                  isDark
                    ? "bg-[#181818] border-gray-700 text-white"
                    : "bg-white border-gray-300 text-gray-700"
                }`}
              >
                <option value="newest">Newest</option>
                <option value="most_liked">Most Liked</option>
                <option value="most_commented">Most Commented</option>
                <option value="most_viewed">Most Viewed</option>
              </select>

              <input
                type="text"
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                placeholder="Filter by country..."
                className={`text-sm px-3 py-2 rounded-lg border ${
                  isDark
                    ? "bg-[#181818] border-gray-700 text-white placeholder-gray-500"
                    : "bg-white border-gray-300 text-gray-700"
                }`}
              />

              <input
                type="text"
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                placeholder="Filter by sector..."
                className={`text-sm px-3 py-2 rounded-lg border col-span-2 ${
                  isDark
                    ? "bg-[#181818] border-gray-700 text-white placeholder-gray-500"
                    : "bg-white border-gray-300 text-gray-700"
                }`}
              />
            </div>

            {/* Clear and close buttons */}
            <div className="flex items-center justify-between mt-3">
              {hasActiveFilters ? (
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-[#00FB75] hover:underline"
                >
                  Clear all filters
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={() => setShowMobileFilters(false)}
                className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}