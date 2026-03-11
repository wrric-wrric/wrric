"use client";

import { useState } from 'react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, MapPin, Globe, Clock, ExternalLink, Star } from 'lucide-react';
import { Event } from '@/types/events';
import { format } from 'date-fns';

interface EventCardProps {
  event: Event;
  viewMode?: 'grid' | 'list' | 'calendar';
  compact?: boolean;
}

export default function EventCard({ event, viewMode = 'grid', compact = false }: EventCardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [imageError, setImageError] = useState(false);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return 'Date TBD';
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'h:mm a');
    } catch {
      return '';
    }
  };

  const getLocationIcon = () => {
    switch (event.location_type) {
      case 'virtual':
        return <Globe className="w-4 h-4" />;
      case 'hybrid':
        return <MapPin className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  // Compact Card - for calendar view
  if (compact) {
    return (
      <div className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-lg ${
        isDark
          ? 'bg-gray-800 border-gray-700 hover:border-[#00FB75]'
          : 'bg-white border-gray-200 hover:border-green-400'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 ${
            isDark ? 'bg-gray-700' : 'bg-gray-100'
          }`}>
            {event.featured_image_url && !imageError ? (
              <Image
                src={event.featured_image_url}
                alt={event.title}
                width={48}
                height={48}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Calendar className="w-5 h-5 opacity-40" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{event.title}</h4>
            <div className="flex items-center gap-1 mt-1 text-xs opacity-60">
              <Clock className="w-3 h-3" />
              <span>{formatTime(event.event_datetime)}</span>
            </div>
          </div>
          {event.is_featured && (
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          )}
        </div>
      </div>
    );
  }

  // List View
  if (viewMode === 'list') {
    return (
      <Link href={`/events/${event.slug}`}>
        <div className={`group flex gap-5 p-5 rounded-2xl border transition-all duration-300 hover:shadow-lg hover:border-[#00FB75]/50 ${
          isDark
            ? 'bg-gray-900 border-gray-800'
            : 'bg-white border-gray-200'
        }`}>
          {/* Event Image */}
          <div className="relative w-40 h-28 rounded-xl overflow-hidden flex-shrink-0">
            {event.featured_image_url && !imageError ? (
              <Image
                src={event.featured_image_url}
                alt={event.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${
                isDark ? 'bg-gray-800' : 'bg-gray-100'
              }`}>
                <Calendar className="w-10 h-10 opacity-30" />
              </div>
            )}
            {event.is_featured && (
              <div className="absolute top-2 left-2 bg-yellow-500 text-black px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                <Star className="w-3 h-3" />
                Featured
              </div>
            )}
          </div>

          {/* Event Details */}
          <div className="flex-1 min-w-0 py-1">
            <h3 className="text-xl font-bold mb-2 group-hover:text-[#00FB75] transition-colors">
              {event.title}
            </h3>
            
            <div className="flex items-center gap-4 text-sm opacity-70 mb-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(event.event_datetime)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {getLocationIcon()}
                <span className="capitalize">{event.location_type}</span>
              </div>
            </div>

            <p className="text-sm opacity-80 line-clamp-2 mb-3">
              {event.short_description}
            </p>

            {/* Categories */}
            {event.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {event.categories.slice(0, 3).map(category => (
                  <span
                    key={category.id}
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${category.color_code}20`,
                      color: category.color_code,
                    }}
                  >
                    {category.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action */}
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              isDark ? 'bg-gray-800 group-hover:bg-[#00FB75]' : 'bg-gray-100 group-hover:bg-[#00FB75]'
            }`}>
              <ExternalLink className={`w-5 h-5 ${
                isDark ? 'text-gray-400 group-hover:text-black' : 'text-gray-600 group-hover:text-black'
              }`} />
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Grid View (Default)
  return (
    <Link href={`/events/${event.slug}`}>
      <div className={`group rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-[#00FB75]/50 ${
        isDark
          ? 'bg-gray-900 border-gray-800'
          : 'bg-white border-gray-200'
      }`}>
        {/* Event Image */}
        <div className="relative h-44">
          {event.featured_image_url && !imageError ? (
            <Image
              src={event.featured_image_url}
              alt={event.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${
              isDark ? 'bg-gray-800' : 'bg-gray-100'
            }`}>
              <Calendar className="w-14 h-14 opacity-30" />
            </div>
          )}
          
          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            {event.is_featured && (
              <span className="bg-yellow-500 text-black px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                <Star className="w-3 h-3" />
                Featured
              </span>
            )}
          </div>

          {/* Date Badge */}
          <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-lg text-center ${
            isDark ? 'bg-black/70 text-white' : 'bg-white/90 text-gray-900'
          }`}>
            <div className="text-xs font-medium opacity-70">
              {format(new Date(event.event_datetime), 'MMM')}
            </div>
            <div className="text-lg font-bold leading-none">
              {format(new Date(event.event_datetime), 'd')}
            </div>
          </div>
        </div>

        {/* Event Details */}
        <div className="p-5">
          <h3 className="text-lg font-bold mb-2 line-clamp-2 group-hover:text-[#00FB75] transition-colors">
            {event.title}
          </h3>

          <div className="flex items-center gap-3 text-sm opacity-70 mb-3">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{formatTime(event.event_datetime)}</span>
            </div>
            <div className="flex items-center gap-1">
              {getLocationIcon()}
              <span className="capitalize">{event.location_type}</span>
            </div>
          </div>

          <p className="text-sm opacity-80 line-clamp-2 mb-4">
            {event.short_description}
          </p>

          {/* Categories */}
          {event.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {event.categories.slice(0, 2).map(category => (
                <span
                  key={category.id}
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${category.color_code}20`,
                    color: category.color_code,
                  }}
                >
                  {category.name}
                </span>
              ))}
              {event.categories.length > 2 && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-gray-200 dark:bg-gray-800">
                  +{event.categories.length - 2}
                </span>
              )}
            </div>
          )}

          {/* View Details Link */}
          <div className={`flex items-center gap-2 text-sm font-medium group-hover:text-[#00FB75] transition-colors ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}>
            <span>View Details</span>
            <ExternalLink className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}
