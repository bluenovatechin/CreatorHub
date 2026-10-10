/**
 * FIXED LISTS: roles, team roles, statuses for every object, languages, deliverable types, etc.
 */
export const ROLES = ['creator', 'brand', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ADMIN_ROLES = ['super_admin', 'reviewer', 'campaign_manager', 'finance'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const LANGUAGES = ['gu', 'hi', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const UI_LANGUAGES = ['gu', 'en'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

export const GENDERS = ['male', 'female', 'other', 'prefer_not_say'] as const;
export type Gender = (typeof GENDERS)[number];

export const AGE_GROUPS = ['18_24', '25_34', '35_44', '45_plus'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const FOLLOWER_BANDS = ['NANO', 'MICRO', 'MID', 'MACRO', 'MEGA'] as const;
export type FollowerBand = (typeof FOLLOWER_BANDS)[number];

/**
 * What a creator can be booked for (product decision 2026-10-10): Instagram Reels, Stories, and Collab (one post
 * published on BOTH the creator's and the brand's account through Instagram's Collab feature, only when both sides
 * agree in the deal). New campaigns and rate cards can only use these.
 */
export const DELIVERABLE_TYPES = ['REEL', 'STORY', 'COLLAB'] as const;
export type DeliverableType = (typeof DELIVERABLE_TYPES)[number];
/** Older formats no longer offered. Kept only so campaigns/deals saved before the change still load and display. */
export const LEGACY_DELIVERABLE_TYPES = ['POST', 'STORY_WITH_LINK', 'CAROUSEL'] as const;
/** Everything that may exist in the database (models use this; input validation uses DELIVERABLE_TYPES). */
export const STORED_DELIVERABLE_TYPES = [...DELIVERABLE_TYPES, ...LEGACY_DELIVERABLE_TYPES] as const;
export type StoredDeliverableType = (typeof STORED_DELIVERABLE_TYPES)[number];

export const CAMPAIGN_GOALS = ['AWARENESS', 'STORE_VISITS', 'SALES', 'APP_INSTALLS', 'LAUNCH', 'OTHER'] as const;
export type CampaignGoal = (typeof CAMPAIGN_GOALS)[number];

export const COLLAB_TYPES = ['PAID', 'BARTER', 'PAID_PLUS_PRODUCT'] as const;
export type CollabType = (typeof COLLAB_TYPES)[number];

export const CREATOR_STATUSES = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'SUSPENDED',
] as const;
export type CreatorStatus = (typeof CREATOR_STATUSES)[number];

export const BRAND_STATUSES = ['INCOMPLETE', 'ACTIVE', 'SUSPENDED'] as const;
export type BrandStatus = (typeof BRAND_STATUSES)[number];

export const CAMPAIGN_STATUSES = [
  'DRAFT', 'SUBMITTED', 'IN_REVIEW', 'SHORTLIST_SENT', 'CREATORS_SELECTED',
  'PAYMENT_PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const SHORTLIST_STATUSES = ['PROPOSED', 'SELECTED', 'REJECTED_BY_BRAND', 'WITHDRAWN', 'REPLACED'] as const;
export type ShortlistStatus = (typeof SHORTLIST_STATUSES)[number];

export const OFFER_STATUSES = ['SENT', 'ACCEPTED', 'DECLINED', 'COUNTERED', 'EXPIRED', 'WITHDRAWN'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

/** A creator's application to an open campaign. The Bluenova team reviews it (brands never see applications). */
export const APPLICATION_STATUSES = ['SUBMITTED', 'SHORTLISTED', 'DECLINED', 'WITHDRAWN'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** A conversation between ONE creator or brand and the Bluenova team (creators and brands never message each other). */
export const CONVERSATION_STATUSES = ['OPEN', 'CLOSED'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

/** A problem with a running brand deal, raised by the creator or the brand; the team resolves it. */
export const DISPUTE_REASONS = ['QUALITY', 'DEADLINE', 'BRIEF_CHANGED', 'COMMUNICATION', 'PAYMENT', 'OTHER'] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];
export const DISPUTE_STATUSES = ['OPEN', 'RESOLVED'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

/** A report about a campaign (by a creator) or a creator (by a brand); the team reviews it. */
export const REPORT_REASONS = ['FAKE', 'SPAM', 'ABUSE', 'FRAUD', 'INAPPROPRIATE', 'OTHER'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_STATUSES = ['OPEN', 'ACTIONED', 'DISMISSED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const DEAL_TYPES = ['BRAND', 'INTRO_REEL'] as const;
export type DealType = (typeof DEAL_TYPES)[number];

export const DEAL_STATUSES = [
  'AWAITING_PAYMENT', 'IN_PRODUCTION', 'DRAFT_SUBMITTED', 'BRAND_REVIEW', 'REVISION_REQUESTED',
  'APPROVED', 'LIVE_SUBMITTED', 'VERIFIED', 'COMPLETED', 'CANCELLED', 'DISPUTED',
] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const CREATOR_DECISIONS = ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'] as const;
export type CreatorDecision = (typeof CREATOR_DECISIONS)[number];

export const REVIEW_REASON_CODES = [
  'LOW_CONTENT_QUALITY', 'INCONSISTENT_POSTING', 'AUDIENCE_MISMATCH', 'LOW_ENGAGEMENT',
  'INVALID_LINKS', 'INCOMPLETE_PROFILE', 'OTHER',
] as const;
export type ReviewReasonCode = (typeof REVIEW_REASON_CODES)[number];

export const OFFER_DECLINE_REASONS = ['busy', 'budget_low', 'category_mismatch', 'other'] as const;
export type OfferDeclineReason = (typeof OFFER_DECLINE_REASONS)[number];

export const POLICY_VERSION = 'v1';
