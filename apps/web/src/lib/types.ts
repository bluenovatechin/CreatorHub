/** Shapes returned by the API (role-specific views built by the server serializers). */
export interface CreatorSelf {
  id: string; slug: string; status: string; onboardingStep: number;
  fullName: string | null; displayName: string | null; phone: string | null; igHandle: string | null; city: string | null;
  languages: string[]; gender: string | null; ageGroup: string | null; bio: string | null; categories: string[];
  reels: string[];
  stats: { followers: number | null; avgViews: number | null; engagementRate: number | null; followerBand: string | null };
  rateCardPaise: Record<string, number>; acceptsBarter: boolean; isPartner: boolean; partnerSince: string | null;
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
}

export interface OfferView {
  id: string; status: string; payoutPaise: number; deliverables: Deliverable[];
  deadlines: { draftDue: string; liveDue: string };
  brief: { title: string; description: string; dos: string[]; donts: string[]; referenceUrls: string[]; hashtags: string[]; mentions: string[]; disclosure: string };
  expiresAt: string; companyName: string | null;
  campaign: { id: string; title: string; goal: string; collabType: string; product: { name: string; valuePaise: number } | null; startDate: string; endDate: string } | null;
  createdAt: string;
}

export interface DealView {
  id: string; type: 'BRAND' | 'INTRO_REEL'; status: string; campaignId: string | null; deliverables: Deliverable[];
  deadlines: { draftDue: string; liveDue: string } | null; campaignTitle?: string | null; companyName?: string | null;
  creatorPayoutPaise?: number | null; brandPricePaise?: number | null; creator?: CreatorCard | null; createdAt: string;
}

export interface BrandSelf {
  id: string; status: string; companyName: string | null; contactName: string | null; designation: string | null;
  phone: string | null; email: string | null; gstin: string | null; industry: string | null; city: string | null; website: string | null;
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
