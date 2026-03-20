import { z } from "zod";

export const businessProfileSchema = z.object({
  storeName: z.string().min(1, "Company name is required"),
  websiteUrl: z.string().url("Enter a valid URL").or(z.literal("")),
  productCategory: z.string().min(1, "Product category is required"),
  businessSize: z.enum(["Small", "Medium", "Enterprise"]),
  targetMarketLocation: z.string().min(1, "Target market location is required"),
  instagramUrl: z.string().url().or(z.literal("")).optional(),
  storeType: z.enum(["ecommerce", "amazon_seller", "static_website"]),
  brandColors: z.array(z.string()).optional(),
  typographyStyle: z.string().optional(),
  logoPlacement: z.string().optional(),
});

export const audienceSchema = z.object({
  segments: z.array(z.string()).min(1, "Select at least one audience segment"),
  description: z.string().min(10, "Provide a brief audience description"),
  geoTargeting: z.string().min(1, "Geographic targeting is required"),
  ageRange: z.array(z.string()).min(1, "Select at least one age range"),
  genderFocus: z.string(),
  activityLevel: z.string(),
  primarySegment: z.string().min(1, "Select a primary segment"),
  secondarySegment: z.string().optional(),
});

export const goalsSchema = z.object({
  goalType: z.enum([
    "brand_awareness",
    "follower_growth",
    "engagement",
    "traffic",
    "conversion",
    "promotional",
  ]),
  budget: z.number().min(5000).max(200000),
  durationDays: z.number().min(7).max(90),
  startDate: z.string().min(1),
  formats: z.array(z.string()).min(1, "Select at least one content format"),
});

export const creativeSchema = z.object({
  imageStyle: z.string().min(1),
  contentType: z.array(z.enum(["post", "image", "reel"])).min(1, "Select at least one content type"),
  imageSizes: z.array(z.string()).min(1),
  hashtagCount: z.string(),
  hashtagMix: z.string(),
  seedHashtags: z.string(),
  variantCount: z.number().min(3).max(5),
  toneOfVoice: z.string().min(1),
});

export type BusinessProfileForm = z.infer<typeof businessProfileSchema>;
export type AudienceForm = z.infer<typeof audienceSchema>;
export type GoalsForm = z.infer<typeof goalsSchema>;
export type CreativeForm = z.infer<typeof creativeSchema>;
