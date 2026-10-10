/** Shapes returned by the API (role-specific views built by the server serializers). */
export interface CreatorSelf {
  id: string; slug: string; status: string; onboardingStep: number;
  fullName: string | null; displayName: string | null; phone: string | null; igHandle: string | null; city: string | null;
  languages: string[]; gender: string | null; ageGroup: string | null; bio: string | null; categories: string[];
  areas: string[];
  reels: string[];
  stats: { followers: number | null; avgViews: number | null; engagementRate: number | null; followerBand: string | null };
  rateCardPaise: Record<string, number>; acceptsBarter: boolean; isPartner: boolean; partnerSince: string | null;
  availability?: { open?: boolean }; ratingAvg?: number; completedDeals?: number;
  introReelDealId: string | null; creatorScore: number; referralCode: string;
  review: { reasonCode: string | null; reasonText: string | null } | null; reapplyAfter: string | null;
  statusHistory: { from: string | null; to: string | null; at: string | null }[];
}

export interface CreatorCard {
  id: string; displayName: string | null; city: string | null; languages: string[]; categories: string[];
  igHandle: string | null; reels: string[];
  stats: { followers: number | null; avgViews: number | null; engagementRate: number | null; followerBand: string | null };
  isPartner: boolean; creatorScore: number;
}

export interface Deliverable { type: string; quantity: number }

export interface Opportunity {
  id: string; title: string; goal: string; description: string; companyName: string | null; deliverables: Deliverable[];
  categories: string[]; cities: string[]; collabType: string; product: { name: string; valuePaise: number } | null;
  startDate: string; endDate: string; interested: boolean;
  application: { id: string; status: ApplicationStatus } | null;
}

export type ApplicationStatus = 'SUBMITTED' | 'SHORTLISTED' | 'DECLINED' | 'WITHDRAWN';
/** The creator's own application to a campaign (reviewed by the Bluenova team). */
export interface ApplicationView {
  id: string; campaignId: string; campaignTitle: string | null; status: ApplicationStatus; pitch: string;
  proposedRatePaise: number | null; decisionNote: string | null; createdAt: string;
}

export interface OfferView {
  id: string; status: string; payoutPaise: number; deliverables: Deliverable[];
  deadlines: { draftDue: string; liveDue: string };
  brief: { title: string; description: string; dos: string[]; donts: string[]; referenceUrls: string[]; hashtags: string[]; mentions: string[]; disclosure: string };
  expiresAt: string; companyName: string | null;
  campaign: { id: string; title: string; goal: string; collabType: string; product: { name: string; valuePaise: number } | null; startDate: string; endDate: string } | null;
  createdAt: string;
}

/** One review of a piece of work, by the Bluenova team or the brand. */
export interface WorkReview { by: 'team' | 'brand' | 'system'; decision: 'APPROVE' | 'REVISION' | 'VERIFY' | 'REJECT'; note: string | null; at: string }
/** A draft link or live post link the creator sent, with its reviews (each side sees only what it may). */
export interface WorkSubmission { id: string; kind: 'DRAFT' | 'LIVE'; url: string; note: string | null; submittedAt: string; reviews: WorkReview[] }

export interface DealView {
  id: string; type: 'BRAND' | 'INTRO_REEL'; status: string; campaignId: string | null; deliverables: Deliverable[];
  deadlines: { draftDue: string; liveDue: string } | null; campaignTitle?: string | null; companyName?: string | null;
  creatorPayoutPaise?: number | null; brandPricePaise?: number | null; creator?: CreatorCard | null; createdAt: string;
  submissions: WorkSubmission[]; maxRevisions: number; revisionsLeft: number; completedAt: string | null;
  /** The latest dispute on this deal; `description` is only filled in for the side that wrote it. */
  dispute: {
    id: string; status: 'OPEN' | 'RESOLVED'; reason: string; raisedByMe: boolean; description: string | null; createdAt: string;
    resolution: { outcome: 'CONTINUE' | 'CANCEL'; note: string | null; at: string } | null;
  } | null;
  myRating: { stars: number; comment: string | null } | null;
  /** Brand review: when a waiting draft is approved automatically (null when not waiting for the brand). */
  brandReviewDueAt: string | null;
  /** Recorded changes to the agreed terms (each side only sees its own money fields). */
  amendments: { at: string; reason: string | null; changes: Record<string, { from: unknown; to: unknown }> }[];
}

export interface BrandSelf {
  id: string; status: string; companyName: string | null; contactName: string | null; designation: string | null;
  phone: string | null; email: string | null; gstin: string | null; industry: string | null; city: string | null; website: string | null;
  areas: string[];
  billingAddress: { line1: string; line2?: string; city: string; stateCode: string; pincode: string } | null;
}

export interface CampaignView {
  id: string; title: string | null; goal: string | null; description: string | null;
  filters: { categories: string[]; cities: string[]; languages: string[]; followerBands: string[]; genders: string[]; ageGroups: string[]; minEngagementRate: number | null };
  deliverables: Deliverable[]; creatorsNeeded: number | null; collabType: string | null;
  product: { name: string; valuePaise: number; shippingRequired: boolean } | null;
  startDate: string | null; endDate: string | null;
  guidelines: { dos: string[]; donts: string[]; referenceUrls: string[]; hashtags: string[]; mentions: string[]; disclosure: string };
  maxRevisions: number; status: string; wizardStep: number;
  budget: { suggest?: boolean; minPaise?: number; maxPaise?: number } | null;
  usageRights: { isRequired?: boolean; durationDays?: number } | null;
  createdAt: string;
}

export interface ShortlistItemView { id: string; status: string; brandPricePaise: number; creator: CreatorCard | null }

export interface NotificationView { id: string; type: string; params: Record<string, string>; link: string | null; readAt: string | null; createdAt: string }

export interface PaymentView {
  id: string; status: 'SUBMITTED' | 'VERIFIED' | 'REJECTED'; method: string; reference: string; amountPaidPaise: number; totalPaise: number;
  paidOn: string; payerName: string; note: string | null; rejectReason: string | null; createdAt: string;
}

export interface CheckoutView {
  campaignStatus: string;
  lines: { dealId: string; creator: string; brandPricePaise: number }[];
  subtotalPaise: number;
  gst: { rateBps: number; cgstPaise: number; sgstPaise: number; igstPaise: number };
  totalPaise: number;
  paymentDetails: { accountName: string; bankName: string; accountNumber: string; ifsc: string; upiId: string | null; instructions: string | null } | null;
  pending: boolean;
  payments: PaymentView[];
}
