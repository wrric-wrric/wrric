import { Calendar, MapPin, Globe, Clock, ExternalLink, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';

interface BannerItemProps {
  item: {
    id: string;
    type: 'event' | 'announcement';
    title: string;
    content: string;
    image_url?: string;
    link?: string;
    cta_text?: string;
    cta_link?: string;
    style?: 'info' | 'warning' | 'success';
    metadata?: {
      datetime?: string;
      location_type?: string;
    };
  };
  isDark: boolean;
}

export default function BannerItem({ item, isDark }: BannerItemProps) {
  const getIcon = () => {
    switch (item.type) {
      case 'event':
        return <Calendar className="w-6 h-6" />;
      case 'announcement':
        return <AlertCircle className="w-6 h-6" />;
      default:
        return null;
    }
  };

  const getStyleClasses = () => {
    if (item.type === 'announcement') {
      switch (item.style) {
        case 'warning':
          return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400';
        case 'success':
          return 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400';
        default:
          return 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400';
      }
    }
    return '';
  };

  return (
    <Link
      href={item.link || '#'}
      className="relative h-full flex items-center block"
    >
      {/* Background Image */}
      {item.image_url && (
        <div className="absolute inset-0 z-0 w-full h-full">
          <Image
            src={item.image_url}
            alt={item.title}
            fill
            className="object-cover opacity-20"
            priority
          />
          <div className={`absolute inset-0 ${
            isDark ? 'bg-black/60' : 'bg-white/80'
          }`} />
        </div>
      )}

      {/* Content - Horizontal Layout */}
      <div className="relative z-10 w-full flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 px-3 py-2 md:px-6 md:py-3">
        {/* Badge & Text Section */}
        <div className="flex-1 min-w-0">
          <div className={`inline-flex items-center gap-1 md:gap-2 px-2 md:px-3 py-0.5 rounded-full mb-0.5 text-[10px] md:text-xs ${getStyleClasses()}`}>
            {getIcon()}
            <span className="font-semibold uppercase tracking-wide whitespace-nowrap">
              {item.type === 'event' ? 'Event' : 'Alert'}
            </span>
          </div>

          <h3 className="text-sm md:text-base font-bold mb-0.5 line-clamp-1">
            {item.link ? (
              <span className="hover:text-[#00FB75] transition-colors cursor-pointer">
                {item.title}
              </span>
            ) : (
              item.title
            )}
          </h3>

          <p className="text-[10px] md:text-xs opacity-80 mb-0.5 line-clamp-1">
            {item.content}
          </p>

          {/* Event Metadata */}
          {item.type === 'event' && item.metadata && (
            <div className="flex flex-wrap items-center gap-1 md:gap-2 text-[10px] md:text-xs">
              {item.metadata.datetime && (
                <div className="flex items-center gap-0.5 whitespace-nowrap">
                  <Clock className="w-3 h-3 opacity-60 flex-shrink-0" />
                  <span className="hidden sm:inline">
                    {format(new Date(item.metadata.datetime), 'MMM d · h:mm a')}
                  </span>
                  <span className="sm:hidden">
                    {format(new Date(item.metadata.datetime), 'MMM d')}
                  </span>
                </div>
              )}
              {item.metadata.location_type && (
                <div className="flex items-center gap-0.5 whitespace-nowrap">
                  {item.metadata.location_type === 'virtual' ? (
                    <Globe className="w-3 h-3 opacity-60 flex-shrink-0" />
                  ) : (
                    <MapPin className="w-3 h-3 opacity-60 flex-shrink-0" />
                  )}
                  <span className="capitalize hidden sm:inline">
                    {item.metadata.location_type}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Call to Action - Right aligned */}
        {/* Temporarily commented out to use "View Details" link in title instead */}
        {(item.cta_link || item.link) && false && (
          <div className="flex-shrink-0 w-full md:w-auto">
            <a
              href={item.cta_link || item.link}
              target={item.cta_link ? '_blank' : '_self'}
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all hover:scale-105 whitespace-nowrap ${
                isDark
                  ? 'bg-[#00FB75] text-black hover:bg-green-400'
                  : 'bg-[#00FB75] text-black hover:bg-green-400'
              }`}
            >
              {item.cta_text || (item.type === 'event' ? 'View Details' : 'Learn More')}
              <ExternalLink className="w-3 h-3 md:w-4 md:h-4" />
            </a>
          </div>
        )}
      </div>
    </Link>
  );
}