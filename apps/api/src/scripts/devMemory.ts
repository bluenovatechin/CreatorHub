/**
 * DEVELOPMENT ONLY: run the API against a throwaway in-memory MongoDB (data is lost on restart).
 *
 *   npm run dev:demo   (from the project root: API + web + admin)
 *
 * Creates a demo admin, 8 demo approved creators, demo bank details, and two accounts you can log in with:
 *   creator@bluenova.dev (approved creator) and brand@bluenova.dev (active brand), with an open campaign
 *   (apply / shortlist), a started collaboration (send a draft) and a message to the team.
 * Emails are only printed in the terminal (EMAIL_PROVIDER is forced to console): demo addresses are fake.
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('dev:memory is for development only');
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.MONGODB_URI = replSet.getUri('bluenova_memory');
  // Demo addresses are fake: never really send email from demo mode (overrides apps/api/.env).
  process.env.EMAIL_PROVIDER = 'console';

  const { authenticator } = await import('otplib');
  const { connectDb, disconnectDb } = await import('../db');
  const { encrypt } = await import('../lib/crypto');
  const { UserModel } = await import('../models/user');
  const { SettingsModel } = await import('../models/system');
  const { CreatorProfileModel } = await import('../models/creatorProfile');
  const { hashPassword } = await import('../modules/auth/auth.service');
  const { CATEGORY_KEYS, CITY_KEYS, followerBand } = await import('@bluenova/shared');
  await connectDb();

  const adminEmail = 'admin@bluenova.dev';
  const adminPassword = 'Demo-Admin-2026';
  const secret = authenticator.generateSecret(20);
  await UserModel.create({
    email: adminEmail, name: 'Demo Admin', role: 'admin', adminRole: 'super_admin', emailVerifiedAt: new Date(),
    passwordHash: await hashPassword(adminPassword), totpSecret: encrypt(secret), totpEnabled: true,
  });

  await SettingsModel.updateOne({ _id: 'global' }, {
    $set: {
      paymentDetails: {
        accountName: 'Bluenova Tech (DEMO)', bankName: 'Demo Bank', accountNumber: '000111222333', ifsc: 'DEMO0001234',
        upiId: 'bluenova.demo@upi', instructions: 'DEMO DETAILS ONLY: do not send real money.',
      },
    },
  }, { upsert: true });

  const names = ['Riya', 'Karan', 'Meera', 'Aarav', 'Diya', 'Kabir', 'Isha', 'Dev'];
  for (let i = 0; i < names.length; i++) {
    const user = await UserModel.create({ email: `demo.creator${i}@bluenova.dev`, name: `${names[i]} Demo`, role: 'creator', emailVerifiedAt: new Date() });
    const followers = [8_000, 25_000, 60_000, 150_000][i % 4];
    await CreatorProfileModel.create({
      userId: user._id, slug: `demo-${i}`, referralCode: `DEMO${String(i).padStart(4, '0')}`,
      fullName: `${names[i]} Demo`, displayName: `${names[i]} (demo)`, city: CITY_KEYS[i % 4], languages: ['gu', 'en'],
      categories: [...new Set([CATEGORY_KEYS[i % 16], CATEGORY_KEYS[(i + 5) % 16], 'food'])],
      instagram: { handle: `${names[i].toLowerCase()}.demo`, followers, avgViews: Math.round(followers * 0.4), engagementBps: 350 + i * 20, followerBand: followerBand(followers), statsSource: 'manual' },
      reels: [{ url: 'https://www.instagram.com/reel/DEMO000001/' }, { url: 'https://www.instagram.com/reel/DEMO000002/' }],
      rateCardPaise: { REEL: (3_000 + i * 1_000) * 100 }, status: 'APPROVED', isPartner: true, partnerSince: new Date(),
    });
  }

  // Two accounts to try the website with, plus a campaign, a running collaboration and a conversation.
  const { BrandProfileModel } = await import('../models/brandProfile');
  const { CampaignModel } = await import('../models/campaign');
  const { DealModel } = await import('../models/deal');
  const { ConversationModel, MessageModel } = await import('../models/conversation');
  const userPassword = 'Demo-User-2026';
  const days = (n: number) => new Date(Date.now() + n * 86_400_000);
  const creatorUser = await UserModel.create({
    email: 'creator@bluenova.dev', name: 'Riya Shah', role: 'creator', emailVerifiedAt: new Date(),
    passwordHash: await hashPassword(userPassword), preferredLanguage: 'en',
  });
  const creator = await CreatorProfileModel.create({
    userId: creatorUser._id, slug: 'demo-riya', referralCode: 'DEMORIYA', fullName: 'Riya Shah', displayName: 'Riya Eats (demo)', phone: '9825041234',
    city: 'surat', areas: ['navsari', 'bardoli', 'vapi'], languages: ['gu', 'en'], categories: ['food', 'travel'], bio: 'Surat food reels every week.',
    instagram: { handle: 'riya.eats.demo', followers: 45_000, avgViews: 20_000, engagementBps: 450, followerBand: followerBand(45_000), statsSource: 'manual' },
    reels: [{ url: 'https://www.instagram.com/reel/DEMO000001/' }, { url: 'https://www.instagram.com/reel/DEMO000002/' }],
    rateCardPaise: { REEL: 800_000, STORY: 300_000 }, status: 'APPROVED', isPartner: true, partnerSince: new Date(),
  });
  const brandUser = await UserModel.create({
    email: 'brand@bluenova.dev', name: 'Asha Patel', role: 'brand', emailVerifiedAt: new Date(),
    passwordHash: await hashPassword(userPassword), preferredLanguage: 'en',
  });
  const brand = await BrandProfileModel.create({
    userId: brandUser._id, status: 'ACTIVE', companyName: 'Surat Sweets (demo)', contactName: 'Asha Patel', phone: '9825077777', industry: 'food',
    city: 'surat', areas: ['surat', 'navsari'], billingAddress: { line1: 'Ring Road', city: 'Surat', stateCode: '24', pincode: '395003' },
  });
  const brief = {
    brandId: brand._id, goal: 'LAUNCH', description: 'Promote our new sweet boxes across Surat with short reels.',
    filters: { categories: ['food'], cities: ['surat', 'navsari'], languages: ['gu'], followerBands: ['MICRO'] },
    deliverables: [{ type: 'REEL', quantity: 1 }], creatorsNeeded: 2, collabType: 'PAID',
    guidelines: { dos: ['Show the box'], donts: [], referenceUrls: [], hashtags: ['#sweets'], mentions: [], disclosure: '#ad' },
    budget: { suggest: false, minPaise: 1_000_000, maxPaise: 3_000_000 }, maxRevisions: 2, wizardStep: 6, submittedAt: new Date(),
  };
  await CampaignModel.create({ ...brief, title: 'Diwali sweets launch (demo, open)', status: 'IN_REVIEW', startDate: days(3), endDate: days(25),
    statusHistory: [{ to: 'IN_REVIEW', at: new Date() }] });
  const running = await CampaignModel.create({ ...brief, title: 'Monsoon snacks (demo, running)', status: 'ACTIVE', startDate: days(-2), endDate: days(14),
    statusHistory: [{ to: 'ACTIVE', at: new Date() }] });
  await DealModel.create({
    type: 'BRAND', campaignId: running._id, brandId: brand._id, creatorId: creator._id, brandPricePaise: 1_000_000, creatorPayoutPaise: 800_000,
    marginPaise: 200_000, deliverables: [{ type: 'REEL', quantity: 1 }], deadlines: { draftDue: days(4), liveDue: days(14) }, maxRevisions: 2,
    status: 'IN_PRODUCTION', statusHistory: [{ to: 'IN_PRODUCTION', at: new Date() }],
  });
  const conv = await ConversationModel.create({
    ownerUserId: creatorUser._id, ownerRole: 'creator', subject: 'Question about the monsoon campaign', lastMessageAt: new Date(), unreadByTeam: 1,
    statusHistory: [{ to: 'OPEN', at: new Date() }],
  });
  await MessageModel.create({ conversationId: conv._id, from: 'user', senderId: creatorUser._id, body: 'Hi team! Can I use a trending Instagram song in the reel?' });

  // eslint-disable-next-line no-console
  console.log([
    '',
    '  DEMO MODE: in-memory database, everything resets when you stop the app. Emails are only printed here.',
    `  Admin panel login:  ${adminEmail}  /  ${adminPassword}`,
    `  Authenticator key (add in Google Authenticator):  ${secret}`,
    `  Website logins:     creator@bluenova.dev  /  ${userPassword}     brand@bluenova.dev  /  ${userPassword}`,
  ].join('\n'));

  await disconnectDb();
  await import('../server'); // reconnects using MONGODB_URI set above
  const stop = async () => {
    await replSet.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
