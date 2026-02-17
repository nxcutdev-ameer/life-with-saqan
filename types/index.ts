export type TransactionType = 'BUY' | 'RENT' | 'STAY';

export type LifestyleType = 'FOREST' | 'BEACH' | 'CITY_LIVING';

export type PropertyType = 'apartment' | 'villa' | 'townhouse' | 'penthouse' | 'studio';

export interface Location {
  city: string;
  area: string;
  latitude: number;
  longitude: number;
}

export interface Agent {
  id: string;
  name: string;
  agency: string;
  /** URL to agent avatar image. Empty string when not provided by backend. */
  photo: string;
  phone: string;
  email: string;
  bio?: string;
  isVerified: boolean;
  rating?: number;
  totalReviews?: number;
  yearsExperience?: number;
  licenseNumber?: string;

  /** Backend agent_id from public videos endpoint (to be used for dedicated agent profile endpoint). */
  agentId?: number;
}

export interface Property {
  id: string;
  propertyReference?: string;
  /** Backend property type returned by APIs (e.g. sale, rent, offplan). */
  type?: string;
  title: string;
  description: string;
  rooms?: { name: string; timestamp: number }[];
  subtitles?: { code: string; label?: string; url?: string | null; filePath?: string | null }[];
  defaultPricing?: string;
  price: number;
  currency: string;
  listingType: TransactionType;
  /** Backend transaction type (e.g. RENT/BUY/SALE/STAY) for strict filtering. */
  transactionType?: string;
  propertyType: PropertyType;
  bedrooms: number;
  bathrooms: number;
  sizeSqft: number;
  location: Location;
  videoUrl: string;
  thumbnailUrl: string;
  images: string[];
  amenities: string[];
  lifestyle: LifestyleType[];
  agent: Agent;
  /** @deprecated Prefer `agent.name`. Kept for backward compatibility with existing components. */
  agentName?: string;
  /** @deprecated Prefer `agent.photo`. Kept for backward compatibility with existing components. */
  agentPhoto?: string;
  likesCount: number;
  savesCount: number;
  sharesCount: number;
  commentsCount: number;
}

export interface LifestyleOption {
  id: LifestyleType;
  name: string;
  tagline: string;
  description: string;
  imageUrl: string;
  color: string;
}

export interface UserPreferences {
  transactionType?: TransactionType;
  location?: string;
  lifestyles: LifestyleType[];
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  propertyIds: string[];
  createdAt: Date;
  isPrivate: boolean;
}

export interface Notification {
  id: string;
  type: 'engagement' | 'activity' | 'marketing' | 'agent' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  propertyId?: string;
  agentId?: string;
  userId?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  propertyId?: string;
  text: string;
  timestamp: Date;
  isRead: boolean;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: Message;
  unreadCount: number;
}
