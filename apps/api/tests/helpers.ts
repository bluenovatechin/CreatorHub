/**
 * TEST HELPERS: a fresh in-memory database per test file, unique test emails, and shortcuts that walk
 * through real flows (signup → code → role, admin password → authenticator code).
 */
import { authenticator } from 'otplib';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, inject } from 'vitest';
import type { AdminRole } from '@bluenova/shared';
import { createApp } from '../src/app';
import { encrypt } from '../src/lib/crypto';
import { clearUserCache } from '../src/lib/userCache';
import { UserModel } from '../src/models/user';
import { hashPassword } from '../src/modules/auth/auth.service';
import { consoleEmail } from '../src/providers/email';

export const app = createApp();
export const ORIGIN = 'http://localhost:5180';
export const ADMIN_ORIGIN = 'http://localhost:5181';
export const PASSWORD = 'Monsoon-Chai-42';

export function useDatabase(name: string) {
  beforeAll(async () => {
    const base = inject('mongoUri');
    const uri = base.replace(/\/(\?|$)/, `/${name}$1`);
    await mongoose.connect(uri);
    await mongoose.connection.db!.dropDatabase();
    await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
  });
  afterAll(async () => {
    clearUserCache();
    await mongoose.disconnect();
  });
}

let counter = 0;
export const nextEmail = () => `person${++counter}.${Date.now()}@example.com`;
export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Token from the most recent email sent to an address (dev/test email provider). */
export function lastEmailToken(to: string): string {
  const msg = [...consoleEmail.sent].reverse().find((m) => m.to === to && m.link?.includes('#token='));
  if (!msg) throw new Error(`no email link for ${to}`);
  return msg.link!.split('#token=')[1];
}

/** The 6-digit code from the most recent code email sent to an address (dev/test email provider). */
export function lastEmailCode(to: string): string {
  const msg = [...consoleEmail.sent].reverse().find((m) => m.to === to && m.code);
  if (!msg) throw new Error(`no code email for ${to}`);
  return msg.code!;
}

/**
 * The full real-user journey: sign up (name/email/password) → type the emailed 6-digit code → logged in →
 * choose "creator" or "brand" on the next screen.
 */
export async function signup(role: 'creator' | 'brand', name = role === 'creator' ? 'Riya Shah' : 'Asha Patel') {
  const email = nextEmail();
  const agent = request.agent(app);
  const s = await agent.post('/api/v1/auth/signup')
    .send({ name, email, password: PASSWORD, confirmPassword: PASSWORD, acceptTerms: true }).expect(201);
  const res = await agent.post('/api/v1/auth/signup/verify-otp').send({ ticket: s.body.data.ticket, code: lastEmailCode(email) }).expect(200);
  const token = res.body.data.accessToken as string;
  await agent.post('/api/v1/auth/role').set('Authorization', `Bearer ${token}`).send({ role }).expect(200);
  return { agent, token, email };
}

/** Creates an admin with password + TOTP and logs in through both steps. */
export async function loginAdmin(adminRole: AdminRole) {
  const email = nextEmail();
  const secret = authenticator.generateSecret(20);
  await UserModel.create({
    email, name: `Team ${adminRole.replace('_', ' ')}`, role: 'admin', adminRole, emailVerifiedAt: new Date(),
    passwordHash: await hashPassword(PASSWORD), totpSecret: encrypt(secret), totpEnabled: true,
  });
  const agent = request.agent(app);
  const r1 = await agent.post('/api/v1/auth/admin/login').send({ email, password: PASSWORD }).expect(200);
  const r2 = await agent.post('/api/v1/auth/admin/totp/verify')
    .send({ mfaToken: r1.body.data.mfaToken, code: authenticator.generate(secret) }).expect(200);
  return { agent, token: r2.body.data.accessToken as string, secret, email };
}

export const creatorSteps = {
  1: {
    fullName: 'રિયા શાહ', displayName: 'Riya Eats', phone: '98250 41234', igHandle: '@riya.eats', city: 'surat', languages: ['gu', 'en'],
    consents: { creatorAgreement: true },
  },
  2: { categories: ['food', 'travel'] },
  3: { reels: ['https://www.instagram.com/reel/AbCdE12345/', 'https://www.instagram.com/reel/XyZaB67890/'] },
  4: { followers: 45000, avgViews: 20000, engagementRate: 4.5, rateCard: { REEL: 8000 }, acceptsBarter: true },
};

export async function onboardedCreator() {
  const c = await signup('creator');
  for (const step of [1, 2, 3, 4] as const) {
    await request(app).put(`/api/v1/creators/me/onboarding/${step}`).set(bearer(c.token)).send(creatorSteps[step]).expect(200);
  }
  await request(app).post('/api/v1/creators/me/submit').set(bearer(c.token)).expect(200);
  return c;
}

export const brandProfile = {
  companyName: 'Surat Sweets', contactName: 'Asha Patel', phone: '9825077777', industry: 'food', city: 'surat',
  billingAddress: { line1: 'Ring Road', city: 'Surat', stateCode: '24', pincode: '395003' },
  consents: { brandAgreement: true },
};

export async function activeBrand() {
  const b = await signup('brand');
  await request(app).put('/api/v1/brands/me').set(bearer(b.token)).send(brandProfile).expect(200);
  return b;
}

const inDays = (n: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + n * 86_400_000));
export const todayStr = () => inDays(0);

export const campaignSteps = {
  1: { title: 'Diwali sweets launch', goal: 'LAUNCH', description: 'Promote our new Diwali sweet boxes across Surat.' },
  2: { categories: ['food'], cities: ['surat'], languages: ['gu'], followerBands: ['MICRO'], genders: [], ageGroups: [] },
  3: { deliverables: [{ type: 'REEL', quantity: 1 }], creatorsNeeded: 2, collabType: 'PAID' },
  4: { startDate: inDays(2), endDate: inDays(20), dos: ['Show the box'], donts: [], referenceUrls: [], hashtags: ['#diwali'], mentions: [], maxRevisions: 2 },
  5: { budgetSuggest: false, budgetMin: 10000, budgetMax: 30000, usageRightsRequired: false },
};

export async function submittedCampaign(token: string) {
  const r = await request(app).post('/api/v1/campaigns').set(bearer(token)).send(campaignSteps[1]).expect(201);
  const id = r.body.data.id as string;
  for (const step of [2, 3, 4, 5] as const) {
    await request(app).put(`/api/v1/campaigns/${id}/wizard/${step}`).set(bearer(token)).send(campaignSteps[step]).expect(200);
  }
  await request(app).post(`/api/v1/campaigns/${id}/submit`).set(bearer(token)).expect(200);
  return id;
}

/** An approved creator (profile id included), reviewed through the real admin routes. */
export async function approvedCreator() {
  const creator = await onboardedCreator();
  const reviewer = await loginAdmin('reviewer');
  const me = (await request(app).get('/api/v1/me').set(bearer(creator.token))).body.data;
  const profileId = me.creator.id as string;
  await request(app).post(`/api/v1/admin/creators/${profileId}/claim`).set(bearer(reviewer.token)).expect(200);
  await request(app).post(`/api/v1/admin/creators/${profileId}/decision`).set(bearer(reviewer.token))
    .send({ decision: 'APPROVED', scores: { quality: 4, consistency: 4, audienceFit: 4, engagement: 4 } }).expect(200);
  return { ...creator, profileId, reviewer };
}

/**
 * Walks the managed flow (payments OFF, the default) up to the chosen point:
 *   'offer'    the brand selected the creator; an offer is waiting for the creator
 *   'accepted' the creator accepted; the deal is AWAITING_PAYMENT
 *   'started'  the team pressed "Start campaign"; the deal is IN_PRODUCTION
 */
export async function campaignWithDeal(stopAt: 'offer' | 'accepted' | 'started' = 'started') {
  const creator = await approvedCreator();
  const brand = await activeBrand();
  const campaignId = await submittedCampaign(brand.token);
  const cm = await loginAdmin('campaign_manager');
  await request(app).post(`/api/v1/admin/campaigns/${campaignId}/claim`).set(bearer(cm.token)).expect(200);
  await request(app).post(`/api/v1/admin/campaigns/${campaignId}/shortlist`).set(bearer(cm.token))
    .send({ items: [{ creatorId: creator.profileId, creatorPayout: 5000 }] }).expect(201);
  await request(app).post(`/api/v1/admin/campaigns/${campaignId}/shortlist/send`).set(bearer(cm.token)).expect(200);
  const sl = await request(app).get(`/api/v1/campaigns/${campaignId}/shortlist`).set(bearer(brand.token)).expect(200);
  await request(app).post(`/api/v1/campaigns/${campaignId}/shortlist/select`).set(bearer(brand.token)).send({ itemIds: [sl.body.data[0].id] }).expect(200);
  const offers = await request(app).get('/api/v1/offers').set(bearer(creator.token)).expect(200);
  const offerId = offers.body.data.find((o: { campaign?: { id?: string } }) => o.campaign?.id === campaignId)?.id ?? offers.body.data[0].id;
  const result = { creator, brand, cm, campaignId, offerId: offerId as string, dealId: '' };
  if (stopAt === 'offer') return result;
  await request(app).post(`/api/v1/offers/${offerId}/accept`).set(bearer(creator.token)).expect(200);
  const deals = await request(app).get('/api/v1/deals').set(bearer(creator.token)).expect(200);
  result.dealId = deals.body.data.find((d: { type: string; campaignId?: string }) => d.type === 'BRAND' && d.campaignId === campaignId)?.id
    ?? deals.body.data.find((d: { type: string }) => d.type === 'BRAND').id;
  if (stopAt === 'accepted') return result;
  await request(app).post(`/api/v1/admin/campaigns/${campaignId}/start`).set(bearer(cm.token)).expect(200);
  return result;
}
