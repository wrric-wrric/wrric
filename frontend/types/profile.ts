// types/profile.ts
export interface Profile {
  id: string;
  user_id: string;
  is_default: boolean;

  // Personal identity
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null; // "YYYY-MM-DD"
  gender?: string | null;
  phone?: string | null;
  website?: string | null;

  // Role / profile info
  type: string;
  title: string | null;
  organization: string | null;
  bio: string;

  // Structured data
  location: Record<string, any>;
  social_links: Record<string, any>;
  expertise: string[];

  // Media
  profile_image?: string | null;

  // System
  metadata: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  username: string;
  email: string;
  profile_image_url: string | null;
  profiles: Profile[];
  default_profile_id: string | null;
  is_admin?: boolean;
  is_judge?: boolean;
}

export const profileTypes = [
  { value: "lab", label: "Research Lab", icon: "🔬" },
  { value: "participant", label: "Hackathon Participant", icon: "🏆" }, // Assuming "Harkathon" is typo for "Hackathon"
  { value: "entrepreneur", label: "Entrepreneur", icon: "💼" },
  { value: "academic", label: "Academic", icon: "🎓" },
  { value: "funder", label: "Funder", icon: "\u0024" },
  { value: "partner", label: "Partner", icon: "🤝" }, 
];

export const genderOptions = [
  { value: "", label: "Prefer not to say" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non-binary", label: "Non-binary" },
  { value: "other", label: "Other" },
];