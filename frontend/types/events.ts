export interface EventCategory {
  id: string;
  name: string;
  slug: string;
  color_code: string;
  description?: string;
  event_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string;
  short_description: string;
  event_datetime: string;
  timezone: string;
  location_type: 'physical' | 'virtual' | 'hybrid';
  physical_location?: string;
  virtual_link?: string;
  registration_url?: string;
  featured_image_url?: string;
  banner_image_url?: string;
  is_published: boolean;
  is_featured: boolean;
  priority: number;
  created_at: string;
  updated_at?: string;
  published_at?: string;
  created_by?: string;
  categories: EventCategory[];
  is_active?: boolean;
}

export interface EventBanner {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  event_datetime: string;
  location_type: 'physical' | 'virtual' | 'hybrid';
  banner_image_url?: string;
  registration_url?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface EventStats {
  total_events: number;
  published_events: number;
  upcoming_events: number;
  featured_events: number;
  recent_events: number;
}

export interface EventFilters {
  featured?: boolean;
  location_type?: 'physical' | 'virtual' | 'hybrid' | 'all';
  category_ids?: string[];
  from_date?: string;
  to_date?: string;
  search?: string;
  sort_by?: 'date' | 'priority' | 'created';
  sort_order?: 'asc' | 'desc';
}

export interface BannerItem {
  id: string;
  type: 'event' | 'announcement' | 'countdown';
  title: string;
  content: string;
  image_url?: string;
  link?: string;
  priority: number;
  start_date?: string;
  end_date?: string;
  dismissible: boolean;
}