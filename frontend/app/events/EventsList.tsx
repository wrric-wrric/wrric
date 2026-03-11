"use client";

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import EventCard from '@/components/Events/EventCard';
import EventFilters from '@/components/Events/EventFilters';
import EventsCalendarView from '@/components/Events/EventsCalendarView';
import { Event, EventFilters as FiltersType } from '@/types/events';
import { useAuth } from '@/utils/auth-cookies';
import { 
  Calendar, 
  Grid3x3, 
  List, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  MapPin,
  Globe
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

type TabType = 'all' | 'my-registrations';

export default function EventsList() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'calendar'>('grid');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filters, setFilters] = useState<FiltersType>({
    sort_by: 'date',
    sort_order: 'asc',
  });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Determine which endpoint to use based on active tab
      const endpoint = activeTab === 'my-registrations' 
        ? '/api/events/my-registrations' 
        : '/api/events/upcoming';
      
      // Add pagination
      params.append('page', currentPage.toString());
      
      // Use page_size for my-registrations API, limit for upcoming API
      if (activeTab === 'my-registrations') {
        params.append('page_size', viewMode === 'calendar' ? '100' : '12');
      } else {
        params.append('limit', viewMode === 'calendar' ? '100' : '12');
      }
      
      // Add filters (only for "all" tab, my-registrations doesn't support these)
      if (activeTab === 'all') {
        if (filters.search) params.append('search', filters.search);
        if (filters.featured !== undefined) params.append('featured', filters.featured.toString());
        if (filters.location_type) params.append('location_type', filters.location_type);
        if (filters.category_ids?.length) {
          filters.category_ids.forEach(id => params.append('category_ids[]', id));
        }
        if (filters.from_date) params.append('from_date', filters.from_date);
        if (filters.sort_by) params.append('sort_by', filters.sort_by);
        if (filters.sort_order) params.append('sort_order', filters.sort_order);
      }
      
      const response = await fetch(`${endpoint}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setEvents(data.items);
      setTotalPages(data.pages);
    } catch (error) {
      console.error('Failed to fetch events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, activeTab, viewMode]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleFiltersChange = (newFilters: FiltersType) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setCurrentPage(1);
    // Reset filters when switching tabs
    if (tab === 'my-registrations') {
      setFilters({ sort_by: 'date', sort_order: 'asc' });
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEventClick = (event: Event) => {
    router.push(`/events/${event.slug}`);
  };

  // Loading skeleton
  if (loading && events.length === 0) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-black' : 'bg-gray-50'}`}>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-7xl mx-auto">
            {/* Header Skeleton */}
            <div className="mb-8">
              <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-1/3 mb-3 animate-pulse" />
              <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/2 animate-pulse" />
            </div>
            
            {/* Filters Skeleton */}
            <div className="h-16 bg-gray-200 dark:bg-gray-800 rounded-2xl mb-8 animate-pulse" />
            
            {/* Grid Skeleton */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-80 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filter events for selected date
  const selectedDateEvents = selectedDate 
    ? events.filter(e => format(new Date(e.event_datetime), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'))
    : [];

  return (
    <div className={`min-h-screen ${isDark ? 'bg-black text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <div className={`border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Events</h1>
              <p className="text-lg opacity-70 mt-1">
                Discover upcoming events in our community
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm opacity-60">
              <Clock className="w-4 h-4" />
              <span>{events.length} events found</span>
            </div>
          </div>
          
          {/* Tabs Navigation */}
          {!authLoading && (
            <div className="flex items-center gap-6 mt-6 border-b border-gray-200 dark:border-gray-800">
              <button
                onClick={() => handleTabChange('all')}
                className={`relative pb-3 px-1 text-sm font-medium transition-colors ${
                  activeTab === 'all'
                    ? 'text-[#00FB75]'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                All Events
                {activeTab === 'all' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00FB75]" />
                )}
              </button>
              
              {isAuthenticated && (
                <button
                  onClick={() => handleTabChange('my-registrations')}
                  className={`relative pb-3 px-1 text-sm font-medium transition-colors ${
                    activeTab === 'my-registrations'
                      ? 'text-[#00FB75]'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  My Registrations
                  {activeTab === 'my-registrations' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00FB75]" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          {/* Minimal Filters - Hide some filters for "My Registrations" tab */}
          <EventFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            categories={[]}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          {/* Empty State */}
          {events.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                <Calendar className="w-12 h-12 opacity-40" />
              </div>
              <h2 className="text-2xl font-bold mb-3">
                {activeTab === 'my-registrations' ? 'No Registrations Yet' : 'No Events Found'}
              </h2>
              <p className="text-lg opacity-70 mb-6 max-w-md mx-auto">
                {activeTab === 'my-registrations'
                  ? 'You haven\'t registered for any events yet. Browse the "All Events" tab to find events to join.'
                  : 'Try adjusting your filters or check back later for new events.'}
              </p>
              {activeTab === 'my-registrations' ? (
                <button
                  onClick={() => handleTabChange('all')}
                  className="px-6 py-3 rounded-xl font-medium bg-[#00FB75] text-black hover:bg-green-400 transition-colors"
                >
                  Browse All Events
                </button>
              ) : (
                <button
                  onClick={() => {
                    setFilters({ sort_by: 'date', sort_order: 'asc' });
                    setCurrentPage(1);
                  }}
                  className="px-6 py-3 rounded-xl font-medium bg-[#00FB75] text-black hover:bg-green-400 transition-colors"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : viewMode === 'calendar' ? (
            /* Calendar View */
            <div className="space-y-6">
              <EventsCalendarView events={events} onEventClick={handleEventClick} />
              
              {/* Selected Date Events */}
              {selectedDate && (
                <div className={`rounded-2xl border p-6 ${
                  isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">
                      Events on {format(selectedDate, 'MMMM d, yyyy')}
                    </h3>
                    <button
                      onClick={() => setSelectedDate(null)}
                      className="text-sm opacity-60 hover:opacity-100"
                    >
                      Clear selection
                    </button>
                  </div>
                  
                  {selectedDateEvents.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {selectedDateEvents.map(event => (
                        <EventCard key={event.id} event={event} compact />
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 opacity-60">
                      No events on this date
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Grid/List View */
            <>
              <div className={
                viewMode === 'grid' 
                  ? 'grid gap-6 md:grid-cols-2 lg:grid-cols-3' 
                  : 'space-y-4'
              }>
                {events.map(event => (
                  <EventCard 
                    key={event.id} 
                    event={event} 
                    viewMode={viewMode} 
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-lg transition-colors ${
                      currentPage === 1
                        ? 'opacity-30 cursor-not-allowed'
                        : isDark
                        ? 'bg-gray-800 hover:bg-gray-700'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`w-10 h-10 rounded-lg font-medium transition-all ${
                            currentPage === pageNum
                              ? 'bg-[#00FB75] text-black'
                              : isDark
                              ? 'bg-gray-800 hover:bg-gray-700'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-lg transition-colors ${
                      currentPage === totalPages
                        ? 'opacity-30 cursor-not-allowed'
                        : isDark
                        ? 'bg-gray-800 hover:bg-gray-700'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
