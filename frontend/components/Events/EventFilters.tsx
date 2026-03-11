"use client";

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { Search, SlidersHorizontal, X, Calendar, MapPin, Grid3x3, List, Calendar as CalendarIcon } from 'lucide-react';
import { EventFilters as FiltersType, EventCategory } from '@/types/events';
import { Dispatch, SetStateAction } from 'react';

interface EventFiltersProps {
  filters: FiltersType;
  onFiltersChange: (newFilters: FiltersType) => void;
  categories: EventCategory[];
  viewMode: 'grid' | 'list' | 'calendar';
  onViewModeChange: Dispatch<SetStateAction<'grid' | 'list' | 'calendar'>>;
}

export default function EventFilters({
  filters,
  onFiltersChange,
  categories,
  viewMode,
  onViewModeChange,
}: EventFiltersProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [search, setSearch] = useState(filters.search || '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    onFiltersChange({ ...filters, search: value });
  };

  const handleLocationTypeChange = (locationType: 'physical' | 'virtual' | 'hybrid' | 'all') => {
    onFiltersChange({
      ...filters,
      location_type: filters.location_type === locationType ? undefined : locationType,
    });
  };

  const handleSortChange = (value: string) => {
    onFiltersChange({
      ...filters,
      sort_by: value as 'date' | 'priority' | 'created',
    });
  };

  const clearFilters = () => {
    setSearch('');
    onFiltersChange({ sort_by: 'date', sort_order: 'asc' });
  };

  const hasActiveFilters = search || filters.location_type || (filters.category_ids && filters.category_ids.length > 0);

  const locationTypes = [
    { value: 'all', label: 'All', icon: MapPin },
    { value: 'physical', label: 'In-Person', icon: MapPin },
    { value: 'virtual', label: 'Virtual', icon: Calendar },
  ];

  const sortOptions = [
    { value: 'date', label: 'Date' },
    { value: 'priority', label: 'Featured' },
    { value: 'created', label: 'Recently Added' },
  ];

  return (
    <div className={`mb-6 ${isDark ? 'bg-gray-900' : 'bg-white'} rounded-2xl border ${
      isDark ? 'border-gray-800' : 'border-gray-200'
    } p-4`}>
      {/* Main Filter Bar */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
            isDark ? 'text-gray-500' : 'text-gray-400'
          }`} />
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={handleSearchChange}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all ${
              isDark
                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-[#00FB75] focus:ring-1 focus:ring-[#00FB75]/50'
                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#00FB75] focus:ring-1 focus:ring-[#00FB75]/50'
            } border focus:outline-none`}
          />
        </div>

        {/* Quick Location Filter */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
          {locationTypes.map(type => {
            const Icon = type.icon;
            const isActive = type.value === 'all' 
              ? !filters.location_type || filters.location_type === 'all'
              : filters.location_type === type.value;
            
            return (
              <button
                key={type.value}
                onClick={() => handleLocationTypeChange(type.value as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#00FB75] text-black'
                    : isDark
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{type.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sort Dropdown */}
        <select
          value={filters.sort_by || 'date'}
          onChange={(e) => handleSortChange(e.target.value)}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
            isDark
              ? 'bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]'
              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#00FB75]'
          } focus:outline-none focus:ring-1 focus:ring-[#00FB75]/50`}
        >
          {sortOptions.map(option => (
            <option key={option.value} value={option.value}>
              Sort by: {option.label}
            </option>
          ))}
        </select>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
            showAdvanced || hasActiveFilters
              ? 'bg-[#00FB75] text-black border-[#00FB75]'
              : isDark
              ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
              : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {hasActiveFilters && !showAdvanced && (
            <span className="w-2 h-2 rounded-full bg-black dark:bg-white" />
          )}
        </button>

        {/* View Mode Toggle */}
        <div className={`flex items-center p-1 rounded-xl ${
          isDark ? 'bg-gray-800' : 'bg-gray-100'
        }`}>
          {[
            { mode: 'grid' as const, icon: Grid3x3 },
            { mode: 'list' as const, icon: List },
            { mode: 'calendar' as const, icon: CalendarIcon },
          ].map(({ mode, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={`p-2 rounded-lg transition-all ${
                viewMode === mode
                  ? 'bg-[#00FB75] text-black'
                  : isDark
                  ? 'text-gray-400 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} View`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isDark
                ? 'text-gray-400 hover:text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className={`mt-4 pt-4 border-t ${
          isDark ? 'border-gray-800' : 'border-gray-200'
        }`}>
          <div className="flex flex-wrap items-center gap-4">
            {/* Categories */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Categories:
                </span>
                <div className="flex flex-wrap gap-2">
                  {categories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => {
                        const currentIds = filters.category_ids || [];
                        const newIds = currentIds.includes(category.id)
                          ? currentIds.filter(id => id !== category.id)
                          : [...currentIds, category.id];
                        onFiltersChange({ ...filters, category_ids: newIds });
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        filters.category_ids?.includes(category.id)
                          ? 'text-black'
                          : isDark
                          ? 'bg-gray-800 text-gray-300'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                      style={{
                        backgroundColor: filters.category_ids?.includes(category.id)
                          ? category.color_code
                          : undefined,
                      }}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                From:
              </span>
              <input
                type="date"
                value={filters.from_date || ''}
                onChange={(e) => onFiltersChange({ ...filters, from_date: e.target.value || undefined })}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-200 text-gray-900'
                } focus:outline-none focus:border-[#00FB75]`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
