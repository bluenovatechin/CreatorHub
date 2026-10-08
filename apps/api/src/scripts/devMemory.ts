/**
 * DEVELOPMENT ONLY: run the API against a throwaway in-memory MongoDB (data is lost on restart).
 *
 *   npm run dev:demo   (from the project root: API + web + admin)
 *
 * Creates 8 demo approved creators, a demo admin, and demo bank details for the manual-payment screen.
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('dev:memory is for development only');
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.MONGODB_URI = replSet.getUri('bluenova_memory');

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

  // eslint-disable-next-line no-console
  console.log([
    '',
    '  DEMO MODE: in-memory database, everything resets when you stop the app.',
    `  Admin panel login:  ${adminEmail}  /  ${adminPassword}`,
    `  Authenticator key (add in Google Authenticator):  ${secret}`,
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
