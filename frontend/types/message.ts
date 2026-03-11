export interface MessageAttachment {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  download_url: string;
  thumbnail_url: string | null;
}

export interface Message {
  id: string;
  sender_profile_id: string;
  receiver_profile_id: string;
  content: string | null;
  message_type: 'text' | 'image' | 'document' | 'video';
  metadata: Record<string, any>;
  is_read: boolean;
  is_delivered: boolean;
  encrypted: boolean;
  created_at: string;
  attachments: MessageAttachment[];
}

export interface Conversation {
  profile_id: string;
  profile_name: string;
  profile_type: string;
  profile_image?: string;
  last_message: Message | null;
  unread_count: number;
  last_activity: string | null;
}

export interface ConversationResponse {
  messages: Message[];
  total_count: number;
  has_more: boolean;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  type: string;
  title: string | null;
  organization: string | null;
  bio: string;
  location: Record<string, any>;
  social_links: Record<string, any>;
  expertise: string[];
  profile_image: string | null;
  metadata_: Record<string, any>;
  created_at: string;
}

export interface ProfileWithNames extends Omit<Profile, 'display_name' | 'first_name' | 'last_name'> {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

export interface ProfilesResponse {
  profiles: Profile[];
  total_count: number;
  has_more: boolean;
}

export function getProfileDisplayName(profile: { display_name?: string | null; first_name?: string | null; last_name?: string | null } | null | undefined): string {
  if (!profile) return "Unnamed Profile";
  
  if (profile.display_name) {
    return profile.display_name;
  }
  
  const firstName = profile.first_name?.trim();
  const lastName = profile.last_name?.trim();
  
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  
  if (firstName) {
    return firstName;
  }
  
  if (lastName) {
    return lastName;
  }
  
  return "Unnamed Profile";
}