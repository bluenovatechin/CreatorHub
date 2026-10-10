/**
 * TESTS for the shared rules (validators, schemas, money, state machines).
 */
import { describe, expect, it } from 'vitest';
import {
  campaignMachine, canTransition, creatorDecisionSchema, creatorMachine, creatorStep1Schema,
  creatorStep3Schema, dealMachine, followerBand, maskContactDetails, matchScore, safeRedirect,
  suggestBrandPrice, brandProfileSchema, campaignStep4Schema, todayIST, isValidGstinChecksum, pincodeMatchesState,
  isPlausibleMobile, isPlausibleName, passwordProblem, signupSchema, paymentSubmitSchema, creatorStep4Schema,
} from './index';

/** Builds a GSTIN with a correct check digit, for tests. */
function makeGstin(first14: string) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = chars.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return first14 + chars[(36 - (sum % 36)) % 36];
}

describe('safeRedirect', () => {
  it.each([
    ['/creator/deals', '/creator/deals'],
    ['//evil.com', '/home'],
    ['/\\evil.com', '/home'],
    ['https://evil.com', '/home'],
    ['javascript:alert(1)', '/home'],
    ['/javascript:alert(1)', '/home'],
    [undefined, '/home'],
  ])('%s -> %s', (input, expected) => {
    expect(safeRedirect(input as string | undefined, '/home')).toBe(expected);
  });
});

describe('money', () => {
  it('suggests brand price with margin rounded up to ₹100', () => {
    // ₹10,000 payout at 25% margin = ₹13,333.33 -> ₹13,400
    expect(suggestBrandPrice(1_000_000, 2500)).toBe(1_340_000);
    expect(suggestBrandPrice(0, 2500)).toBe(0);
  });
});

describe('followerBand', () => {
  it('maps thresholds', () => {
    expect(followerBand(9_999)).toBe('NANO');
    expect(followerBand(10_000)).toBe('MICRO');
    expect(followerBand(100_000)).toBe('MID');
    expect(followerBand(500_000)).toBe('MACRO');
    expect(followerBand(1_000_000)).toBe('MEGA');
  });
});

describe('state machines', () => {
  it('allows only defined transitions and actors', () => {
    expect(canTransition(creatorMachine, 'DRAFT', 'SUBMITTED', 'creator')).toBe(true);
    expect(canTransition(creatorMachine, 'DRAFT', 'APPROVED', 'creator')).toBe(false);
    expect(canTransition(creatorMachine, 'SUBMITTED', 'APPROVED', 'reviewer')).toBe(false);
    expect(canTransition(creatorMachine, 'UNDER_REVIEW', 'APPROVED', 'brand')).toBe(false);
    expect(canTransition(creatorMachine, 'UNDER_REVIEW', 'APPROVED', 'super_admin')).toBe(true);
    expect(canTransition(campaignMachine, 'ACTIVE', 'CANCELLED', 'brand')).toBe(false);
    expect(canTransition(dealMachine, 'AWAITING_PAYMENT', 'IN_PRODUCTION', 'brand')).toBe(false);
    expect(canTransition(dealMachine, 'AWAITING_PAYMENT', 'IN_PRODUCTION', 'system')).toBe(true);
  });
});

describe('schemas', () => {
  const step1 = {
    fullName: 'વ્યોમ પટેલ', displayName: 'Vyom', phone: '98250 12345', igHandle: '@vyom.creates', city: 'ahmedabad',
    languages: ['gu', 'en'], consents: { creatorAgreement: true },
  };
  it('accepts Gujarati names and strips @ from handles', () => {
    const r = creatorStep1Schema.parse(step1);
    expect(r.igHandle).toBe('vyom.creates');
  });
  it('rejects missing consent and bad handles', () => {
    expect(creatorStep1Schema.safeParse({ ...step1, consents: { creatorAgreement: false } }).success).toBe(false);
    expect(creatorStep1Schema.safeParse({ ...step1, igHandle: 'a..b' }).success).toBe(false);
  });
  it('strips unknown fields (no mass assignment)', () => {
    const r = creatorStep1Schema.parse({ ...step1, status: 'APPROVED', role: 'admin' }) as Record<string, unknown>;
    expect(r.status).toBeUndefined();
    expect(r.role).toBeUndefined();
  });
  it('only accepts instagram reel URLs', () => {
    expect(creatorStep3Schema.safeParse({ reels: ['https://www.instagram.com/reel/AbCdE12345/?igsh=x', 'https://instagram.com/p/XyZ12345/'] }).success).toBe(true);
    expect(creatorStep3Schema.safeParse({ reels: ['https://evil.com/reel/AbCdE12345/', 'https://instagram.com/p/XyZ12345/'] }).success).toBe(false);
    expect(creatorStep3Schema.safeParse({ reels: ['http://instagram.com/reel/AbCdE12345/', 'https://instagram.com/p/XyZ12345/'] }).success).toBe(false);
  });
  it('validates GSTIN checksum, GSTIN state and PIN code state', () => {
    const base = {
      companyName: 'Acme Sweets', contactName: 'Asha Shah', phone: '9825012345', industry: 'food', city: 'surat',
      billingAddress: { line1: 'Ring Road', city: 'Surat', stateCode: '24', pincode: '395003' },
    };
    const good = makeGstin('24AAACB1234C1Z');
    expect(brandProfileSchema.safeParse({ ...base, gstin: good }).success).toBe(true);
    const wrongCheck = good.slice(0, 14) + (good[14] === 'A' ? 'B' : 'A');
    expect(brandProfileSchema.safeParse({ ...base, gstin: wrongCheck }).success).toBe(false);
    expect(brandProfileSchema.safeParse({ ...base, gstin: makeGstin('27AAACB1234C1Z') }).success).toBe(false); // Maharashtra GSTIN, Gujarat address
    expect(brandProfileSchema.safeParse({ ...base, billingAddress: { ...base.billingAddress, pincode: '400001' } }).success).toBe(false); // Mumbai PIN
    expect(brandProfileSchema.safeParse({ ...base, website: 'http://insecure.in' }).success).toBe(false);
    expect(brandProfileSchema.safeParse({ ...base, phone: '9999999999' }).success).toBe(false);
    expect(brandProfileSchema.safeParse({ ...base, companyName: 'test' }).success).toBe(false);
  });
  it('rejects campaigns starting in the past', () => {
    const r = campaignStep4Schema.safeParse({
      startDate: '2000-01-01', endDate: '2000-01-10', dos: [], donts: [], referenceUrls: [], hashtags: [], mentions: [], maxRevisions: 2,
    });
    expect(r.success).toBe(false);
    const ok = campaignStep4Schema.safeParse({
      startDate: todayIST(), endDate: '2999-01-01', dos: [], donts: [], referenceUrls: [], hashtags: ['#ad'], mentions: [], maxRevisions: 2,
    });
    expect(ok.success).toBe(false); // > 180 days
  });
  it('requires reasons when not approving', () => {
    expect(creatorDecisionSchema.safeParse({ decision: 'REJECTED', scores: { quality: 1, consistency: 1, audienceFit: 1, engagement: 1 } }).success).toBe(false);
  });
});

describe('real-world validators', () => {
  it('checks GSTIN check digits', () => {
    expect(isValidGstinChecksum('27AAPFU0939F1ZV')).toBe(true);
    expect(isValidGstinChecksum('27AAPFU0939F1ZW')).toBe(false);
  });
  it('matches PIN codes to states', () => {
    expect(pincodeMatchesState('380009', '24')).toBe(true); // Ahmedabad
    expect(pincodeMatchesState('560001', '24')).toBe(false); // Bengaluru PIN, Gujarat
    expect(pincodeMatchesState('560001', '29')).toBe(true); // Karnataka
  });
  it('rejects dummy phones and names', () => {
    expect(isPlausibleMobile('9825012345')).toBe(true);
    expect(isPlausibleMobile('9999999999')).toBe(false);
    expect(isPlausibleMobile('9876543210')).toBe(false);
    expect(isPlausibleName('Riya Shah')).toBe(true);
    expect(isPlausibleName('test')).toBe(false);
    expect(isPlausibleName('aaaa')).toBe(false);
  });
  it('enforces password rules', () => {
    expect(passwordProblem('short1')).toBe('errors.passwordShort');
    expect(passwordProblem('onlyletters')).toBe('errors.passwordMix');
    expect(passwordProblem('password123')).toBe('errors.passwordCommon');
    expect(passwordProblem('riyashah2024', { email: 'riyashah@gmail.com' })).toBe('errors.passwordPersonal');
    expect(passwordProblem('Monsoon-Chai-42')).toBeNull();
  });
  it('validates signup', () => {
    const base = { name: 'Riya Shah', email: 'riya@gmail.com', password: 'Monsoon-Chai-42', confirmPassword: 'Monsoon-Chai-42', acceptTerms: true };
    expect(signupSchema.safeParse(base).success).toBe(true);
    expect(signupSchema.safeParse({ ...base, confirmPassword: 'other-pass-42' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, email: 'x@mailinator.com' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
  });
  it('validates manual payment references per method', () => {
    const base = { amountPaid: 9440, paidOn: todayIST(), payerName: 'Surat Sweets' };
    expect(paymentSubmitSchema.safeParse({ ...base, method: 'UPI', reference: '412345678901' }).success).toBe(true);
    expect(paymentSubmitSchema.safeParse({ ...base, method: 'UPI', reference: 'ABC123' }).success).toBe(false);
    expect(paymentSubmitSchema.safeParse({ ...base, method: 'NEFT', reference: 'HDFCN52024100812' }).success).toBe(true);
    expect(paymentSubmitSchema.safeParse({ ...base, method: 'UPI', reference: '412345678901', paidOn: '2999-01-01' }).success).toBe(false);
  });
  it('flags unrealistic creator stats', () => {
    const base = { followers: 1000, avgViews: 400, engagementRate: 4, rateCard: { REEL: 2000 }, acceptsBarter: false };
    expect(creatorStep4Schema.safeParse(base).success).toBe(true);
    expect(creatorStep4Schema.safeParse({ ...base, avgViews: 10_000_000 }).success).toBe(false);
    expect(creatorStep4Schema.safeParse({ ...base, engagementRate: 90 }).success).toBe(false);
    expect(creatorStep4Schema.safeParse({ ...base, rateCard: {}, acceptsBarter: false }).success).toBe(false);
  });
});

describe('maskContactDetails', () => {
  it('hides phones, emails, upi and handles', () => {
    const { text, masked } = maskContactDetails('Call 98765 43210 or +91-9876543210, mail me@x.com, upi vyom@okhdfc, dm @vyom.creates');
    expect(masked).toBe(true);
    expect(text).not.toMatch(/98765|9876543210|me@x\.com|okhdfc|vyom\.creates/);
  });
  it('leaves normal text alone', () => {
    expect(maskContactDetails('Reel will be ready by Monday').masked).toBe(false);
  });
});

describe('matchScore', () => {
  it('scores a perfect match at 100', () => {
    const r = matchScore(
      { categories: ['food'], city: 'surat', languages: ['gu'], followerBand: 'MICRO', rateCardPaise: { REEL: 500000 }, creatorScore: 100 },
      { categories: ['food'], cities: ['surat'], languages: ['gu'], followerBands: ['MICRO'], mainDeliverable: 'REEL', budgetPerCreatorPaise: 600000 },
    );
    expect(r.total).toBe(100);
  });
});

describe('formats, cities and areas (2026-10-10)', () => {
  it('only Reel, Story and Collab can be booked; older formats are no longer accepted', async () => {
    const { DELIVERABLE_TYPES, STORED_DELIVERABLE_TYPES, campaignStep3Schema, rateCardSchema } = await import('./index');
    expect([...DELIVERABLE_TYPES]).toEqual(['REEL', 'STORY', 'COLLAB']);
    expect(STORED_DELIVERABLE_TYPES).toContain('POST'); // old saved data still loads
    const base = { creatorsNeeded: 1, collabType: 'PAID' };
    expect(campaignStep3Schema.safeParse({ ...base, deliverables: [{ type: 'COLLAB', quantity: 1 }] }).success).toBe(true);
    for (const old of ['POST', 'CAROUSEL', 'STORY_WITH_LINK']) {
      expect(campaignStep3Schema.safeParse({ ...base, deliverables: [{ type: old, quantity: 1 }] }).success).toBe(false);
    }
    expect(rateCardSchema.parse({ REEL: 5000, POST: 3000, COLLAB: 9000 })).toEqual({ REEL: 5000, COLLAB: 9000 });
  });

  it('lists every Gujarat district headquarters once, with Gujarati names', async () => {
    const { CITIES, CITY_KEYS } = await import('./index');
    const hq = ['ahmedabad', 'amreli', 'anand', 'modasa', 'palanpur', 'bharuch', 'bhavnagar', 'botad', 'chhota_udaipur', 'dahod', 'ahwa',
      'khambhalia', 'gandhinagar', 'veraval', 'jamnagar', 'junagadh', 'bhuj', 'nadiad', 'lunawada', 'mehsana', 'morbi', 'rajpipla',
      'navsari', 'godhra', 'patan', 'porbandar', 'rajkot', 'himmatnagar', 'surat', 'surendranagar', 'vyara', 'vadodara', 'valsad', 'tharad'];
    for (const k of hq) expect(CITY_KEYS).toContain(k);
    expect(new Set(CITY_KEYS).size).toBe(CITY_KEYS.length);
    for (const c of CITIES) expect(c.gu.length).toBeGreaterThan(1);
  });

  it('a creator\'s areas count like their home city when matching', () => {
    const creator = { categories: ['food'], city: 'surat', languages: ['gu'], followerBand: 'MICRO' as const, rateCardPaise: {}, creatorScore: 60 };
    const campaign = { categories: ['food'], cities: ['rajkot'], languages: ['gu'], followerBands: [] };
    expect(matchScore(creator, campaign).city).toBe(0);
    expect(matchScore({ ...creator, areas: ['rajkot', 'gondal'] }, campaign).city).toBe(20);
  });

  it('accepts several areas for creators and brands', () => {
    const areas = creatorStep1Schema.shape.areas;
    expect(areas.parse(['surat', 'vapi'])).toEqual(['surat', 'vapi']);
    expect(areas.parse(undefined)).toEqual([]);
    expect(areas.safeParse(['surat', 'surat']).success).toBe(false);
    expect(areas.safeParse(['atlantis']).success).toBe(false);
  });
});
