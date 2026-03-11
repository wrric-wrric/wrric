"use client";

import { useState, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { Event } from '@/types/events';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, Globe } from 'lucide-react';
import Link from 'next/link';

interface EventsCalendarViewProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
}

export default function EventsCalendarView({ events, onEventClick }: EventsCalendarViewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    events.forEach(event => {
      const dateKey = format(new Date(event.event_datetime), 'yyyy-MM-dd');
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, event]);
    });
    return map;
  }, [events]);

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
    }`}>
      {/* Calendar Header */}
      <div className={`flex items-center justify-between p-6 border-b ${
        isDark ? 'border-gray-800' : 'border-gray-200'
      }`}>
        <div className="flex items-center gap-4">
          <CalendarIcon className={`w-6 h-6 ${isDark ? 'text-[#00FB75]' : 'text-green-600'}`} />
          <h2 className="text-2xl font-bold">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDark 
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            Today
          </button>
          <div className="flex gap-1">
            <button
              onClick={goToPreviousMonth}
              className={`p-2 rounded-lg transition-colors ${
                isDark 
                  ? 'hover:bg-gray-800 text-gray-400' 
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToNextMonth}
              className={`p-2 rounded-lg transition-colors ${
                isDark 
                  ? 'hover:bg-gray-800 text-gray-400' 
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Week Days Header */}
      <div className={`grid grid-cols-7 border-b ${
        isDark ? 'border-gray-800' : 'border-gray-200'
      }`}>
        {weekDays.map(day => (
          <div
            key={day}
            className={`py-3 text-center text-sm font-medium ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {days.map((day: Date, index: number) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isDayToday = isToday(day);
          
          return (
            <div
              key={dateKey}
              className={`min-h-[120px] p-2 border-b border-r transition-colors ${
                index % 7 === 6 ? 'border-r-0' : ''
              } ${
                !isCurrentMonth 
                  ? isDark ? 'bg-gray-900/50' : 'bg-gray-50'
                  : ''
              } ${
                isDark ? 'border-gray-800' : 'border-gray-100'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${
                  isDayToday
                    ? 'w-7 h-7 rounded-full bg-[#00FB75] text-black flex items-center justify-center'
                    : isCurrentMonth
                      ? isDark ? 'text-white' : 'text-gray-900'
                      : isDark ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  {format(day, 'd')}
                </span>
                {dayEvents.length > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {dayEvents.length}
                  </span>
                )}
              </div>
              
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <button
                    key={event.id}
                    onClick={() => onEventClick?.(event)}
                    className={`w-full text-left p-1.5 rounded-lg text-xs font-medium truncate transition-all hover:scale-[1.02] ${
                      isDark 
                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' 
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                    }`}
                    title={event.title}
                  >
                    <span className="truncate block">{event.title}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <button
                    className={`w-full text-center text-xs py-1 ${
                      isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    +{dayEvents.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Event Modal */}
      <style jsx>{`
        .events-calendar-view::-webkit-scrollbar {
          width: 4px;
        }
        .events-calendar-view::-webkit-scrollbar-track {
          background: transparent;
        }
        .events-calendar-view::-webkit-scrollbar-thumb {
          background: #00FB75;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}

// Compact Calendar View for List
export function CompactCalendar({ events, selectedDate, onDateSelect }: {
  events: Event[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const hasEvents = (date: Date) => {
    return events.some(e => isSameDay(new Date(e.event_datetime), date));
  };

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
    }`}>
      <div className={`flex items-center justify-between p-4 border-b ${
        isDark ? 'border-gray-800' : 'border-gray-200'
      }`}>
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className={`p-1 rounded-lg transition-colors ${
            isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-medium">
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className={`p-1 rounded-lg transition-colors ${
            isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
          <div
            key={day}
            className={`py-2 text-center text-xs font-medium ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            {day}
          </div>
        ))}
        {days.map((day: Date) => {
          const dayHasEvents = hasEvents(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          
          return (
            <button
              key={day.toString()}
              onClick={() => onDateSelect(day)}
              className={`relative py-2 text-sm transition-colors ${
                isSameMonth(day, currentMonth)
                  ? isDark ? 'text-white' : 'text-gray-900'
                  : isDark ? 'text-gray-600' : 'text-gray-300'
              } ${isSelected ? 'bg-[#00FB75] text-black font-bold' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              {format(day, 'd')}
              {dayHasEvents && !isSelected && (
                <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                  isDark ? 'bg-[#00FB75]' : 'bg-green-500'
                }`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
