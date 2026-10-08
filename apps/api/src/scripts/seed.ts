/**
 * Seeds settings defaults, and in development, sample approved creators for trying the matching flow.
 *   npm run seed            -> settings only
 *   npm run seed -- --demo  -> settings + 12 demo creators (development databases only)
 */
import { CATEGORY_KEYS, CITY_KEYS, followerBand } from '@bluenova/shared';
import { env } from '../config/env';
import { connectDb, disconnectDb } from '../db';
import { randomCode } from '../lib/crypto';
import { CreatorProfileModel } from '../models/creatorProfile';
import { getSettings } from '../models/system';
import { UserModel } from '../models/user';

async function main() {
  await connectDb();
  await getSettings();
  // eslint-disable-next-line no-console
  console.log('Settings ready.');
  if (process.argv.includes('--demo')) {
    if (env.NODE_ENV === 'production') throw new Error('Demo data is not allowed in production');
    const names = ['Riya', 'Karan', 'Meera', 'Aarav', 'Diya', 'Kabir', 'Isha', 'Dev', 'Nisha', 'Yash', 'Pooja', 'Harsh'];
    for (let i = 0; i < names.length; i++) {
      const email = `demo.creator${i}@bluenova.dev`;
      const user = await UserModel.findOneAndUpdate({ email }, { $setOnInsert: { email, name: `${names[i]} Demo`, role: 'creator', emailVerifiedAt: new Date() } }, { upsert: true, new: true });
      const followers = [8_000, 25_000, 60_000, 150_000, 420_000, 900_000][i % 6];
      await CreatorProfileModel.findOneAndUpdate({ userId: user._id }, {
        $setOnInsert: {
          userId: user._id, slug: `demo-${i}`, referralCode: randomCode('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8),
          fullName: `${names[i]} Demo`, displayName: `${names[i]} (demo)`, city: CITY_KEYS[i % 6], languages: ['gu', 'en'],
          categories: [CATEGORY_KEYS[i % 16], CATEGORY_KEYS[(i + 5) % 16]],
          instagram: { handle: `${names[i].toLowerCase()}.demo`, followers, avgViews: Math.round(followers * 0.4), engagementBps: 300 + i * 25, followerBand: followerBand(followers), statsSource: 'manual' },
          reels: [{ url: 'https://www.instagram.com/reel/DEMO000001/' }, { url: 'https://www.instagram.com/reel/DEMO000002/' }],
          rateCardPaise: { REEL: (2_000 + i * 1_000) * 100 }, status: 'APPROVED', isPartner: true, partnerSince: new Date(),
        },
      }, { upsert: true });
    }
    // eslint-disable-next-line no-console
    console.log(`Demo creators ready (${names.length}).`);
  }
  await disconnectDb();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
