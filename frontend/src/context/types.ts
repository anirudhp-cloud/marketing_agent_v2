/* ── Shared types for the Retail Marketing Agent frontend ── */

export type BusinessSize = "Small" | "Medium" | "Enterprise";

export interface BusinessProfile {
  storeName: string;
  websiteUrl: string;
  productCategory: string;
  businessSize: BusinessSize;
  targetMarketLocation: string;
  instagramUrl: string;
  isEcommerce: boolean;
  storeType: "ecommerce" | "amazon_seller" | "static_website";
  brandColors: string[];
  typographyStyle: string;
  logoPlacement: string;
  brandBookUploaded: boolean;
}

export interface AudienceConfig {
  segments: string[];
  description: string;
  geoTargeting: string;
  ageRange: string[];
  genderFocus: string;
  activityLevel: string;
  primarySegment: string;
  secondarySegment: string;
}

export type GoalType =
  | "brand_awareness"
  | "follower_growth"
  | "engagement"
  | "traffic"
  | "conversion"
  | "promotional";

export interface CampaignGoals {
  goalType: GoalType;
  budget: number;
  durationDays: number;
  startDate: string;
  formats: string[];
}

export type ContentType = "post" | "image" | "reel";

export interface CreativeConfig {
  imageStyle: string;
  contentType: ContentType[];
  imageSizes: string[];
  hashtagCount: string;
  hashtagMix: string;
  seedHashtags: string;
  variantCount: number;
  toneOfVoice: string;
}

export interface CampaignVariant {
  id: number;
  angle: string;
  headline: string;
  copy: string;
  cta: string;
  targetSegment: string;
  imageryStyle: string;
  imageUrl?: string;
  score?: number;
  recommended?: boolean;
}

export interface CalendarPost {
  id: string;
  date: string;
  type: "post" | "reel" | "story" | "carousel";
  caption: string;
  hashtags: string[];
  bestTime: string;
  imageUrl?: string;
}

export interface EngagementComment {
  id: string;
  author: string;
  avatar: string;
  comment: string;
  timeAgo: string;
  postRef: string;
  sentiment: "positive" | "neutral" | "negative";
  needsEscalation: boolean;
  replySuggestions: string[];
}

export interface AgentState {
  businessProfile: BusinessProfile;
  audience: AudienceConfig;
  goals: CampaignGoals;
  creative: CreativeConfig;
  compliancePassed: boolean;
  humanApproved: boolean;
  variants: CampaignVariant[];
  selectedVariant: number | null;
  calendarPosts: CalendarPost[];
  executionResults: Record<string, unknown>;
  pendingReplies: EngagementComment[];
  currentStep: number;
  error: string | null;
}
