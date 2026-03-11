import type { ReactNode } from "react"

export interface LabProfile {
  university_favicon: string | null;
  source_favicon: string | null;
  display_name: string | null;
  url: string;
  source: string | null;
  edurank: {
    score: string;
    url: string | null;
  };
  website: string;
  department: {
    name: string;
    focus: string;
    teams: {
      urls: (string | null)[];
      members: [];
    };
    url: string;
  };
  university: string;
  lab_equipment: {
    list: string[];
    overview: string;
  };
  location: {
    country: string;
    city: string;
    longitude: number;
    latitude: number;
    state: string;
    display_name: string;
  };
  publications_meta: {
    google_scholar_url: string;
    other_url: string | null;
    contents: [];
  };
  related: string | null;
  scopes: (string | null)[];
  climate_tech_focus: string[];
  point_of_contact: {
    bio_url: string | null;
    linked_in: string | null;
    name: string | null;
    contact: string | null;
    title: string | null;
    google_scholar_url: string | null;
    email: string | null;
  };
  id: number;
  research_abstract: string;
  images: {
    id: string;
    url: string;
    caption: string;
    is_primary: boolean;
  }[];
  timestamp?: string;
  last_updated?: string;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
}

export interface Payload {
  sessionId: string | null;
  userId: string | null;
  query: string;
  type: string;
  title: string;
  recaptchaResponse: string | null;
}

export interface Section {
  id: string
  title: string
  subtitle?: ReactNode
  content?: string
  showButton?: boolean
  buttonText?: string
  buttonLink?: string
}

export interface SectionProps extends Section {
  isActive: boolean
}

export interface Partner {
  id: string;
  name: string;
  slug: string;
  description: string;
  website: string | null;
  logo_url: string | null;
  banner_url: string | null;
  contact_email: string | null;
  sector_focus: string[];
  country: string | null;
  region: string | null;
  social_links: Record<string, string>;
  status: "pending" | "approved" | "rejected" | "suspended";
  is_verified: boolean;
  is_featured: boolean;
  organization_type: string | null;
  member_count: number;
  lab_count: number;
  created_at: string;
  owner?: { id: string; username: string };
}

export interface PaginatedPartners {
  items: Partner[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PartnerMember {
  id: string;
  user_id: string;
  username: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  joined_at: string;
}