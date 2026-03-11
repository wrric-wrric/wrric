// types/api.ts
export interface User {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  type: 'lab' | 'entrepreneur' | 'academic' | 'funder';
  title: string;
  organization: string;
  bio: string;
  profile_image: string | null;
  location: Record<string, any>;
  social_links: Record<string, any>;
  expertise: string[];
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string;
  short_description: string;
  event_datetime: string;
  timezone: string;
  location_type: 'PHYSICAL' | 'VIRTUAL' | 'HYBRID';
  physical_location: string | null;
  virtual_link: string | null;
  featured_image_url: string | null;
  banner_image_url: string | null;
  is_published: boolean;
  is_featured: boolean;
  categories: EventCategory[];
  created_at: string;
  updated_at: string;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  profile_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  position: string | null;
  organization: string | null;
  participation_type: 'attendee' | 'jury' | 'speaker' | 'idea_holder';
  attendance_type: 'on_site' | 'remote' | 'hybrid';
  ticket_type: string | null;
  wants_profile_visible: boolean;
  profile_visibility_types: string[];
  special_requirements: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted';
  registration_date: string;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Entity {
  id: number;
  university: string;
  url: string;
  research_abstract: string;
  location: Record<string, any>;
  point_of_contact: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface LoginCredentials {
  username?: string;
  email?: string;
  password: string;
  recaptchaResponse: string;
}

export interface SignupCredentials {
  username: string;
  email: string;
  password: string;
  recaptchaResponse: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
}

export interface SignupResponse {
  access_token: string;
  token_type: string;
  user_id: string;
}

export interface OAuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  existing_user: boolean;
  profile_id?: string;
  message: string;
}

export interface ForgotPasswordResponse {
  message: string;
  email_sent: boolean;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
  recaptchaResponse: string;
}

export interface PasswordResetValidation {
  valid: boolean;
  message: string;
  email?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface EventCategory {
  id: string;
  name: string;
  slug: string;
  color_code: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}