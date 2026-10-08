/**
 * Creates (or resets) a super admin.
 *
 *   npm run seed:superadmin -- --email you@example.com --name "Your Name" [--out ADMIN_SECRET.txt]
 *
 * Generates a strong temporary password and an authenticator key, shown ONCE (or written to --out).
 * Change the password after first login (Admin → Settings).
 */
import fs from 'node:fs';
import { authenticator } from 'otplib';
import { emailSchema } from '@bluenova/shared';
import { connectDb, disconnectDb } from '../db';
import { encrypt, randomCode } from '../lib/crypto';
import { UserModel } from '../models/user';
import { hashPassword } from '../modules/auth/auth.service';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = emailSchema.parse(arg('email'));
  const name = (arg('name') ?? 'Super Admin').slice(0, 60);
  await connectDb();
  const existing = await UserModel.findOne({ email });
  if (existing && existing.role && existing.role !== 'admin') {
    throw new Error('This email already belongs to a creator/brand account. Use a different email for the admin.');
  }
  // Readable but strong: 4 groups of 4 from an unambiguous alphabet + a digit.
  const password = `${randomCode('abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ', 4)}-${randomCode('abcdefghjkmnpqrstuvwxyz23456789', 4)}-${randomCode('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4)}-${randomCode('23456789', 4)}`;
  const secret = authenticator.generateSecret(20);
  await UserModel.findOneAndUpdate(
    { email },
    {
      $set: {
        name, role: 'admin', adminRole: 'super_admin', status: 'active', emailVerifiedAt: new Date(),
        passwordHash: await hashPassword(password), passwordChangedAt: new Date(),
        totpSecret: encrypt(secret), totpEnabled: true,
      },
      $inc: { tokenVersion: 1 },
      $unset: { totpLastStep: 1 },
    },
    { upsert: true },
  );
  const text = [
    'Bluenova admin account',
    '======================',
    `Admin panel:  http://localhost:5181`,
    `Email:        ${email}`,
    `Password:     ${password}     (temporary — change it after logging in)`,
    '',
    'Authenticator app (Google Authenticator / Microsoft Authenticator):',
    '  tap +  →  "Enter a setup key"  →  paste this key:',
    `  ${secret}`,
    '',
    'DELETE THIS FILE after you have logged in and added the key to your phone.',
    '',
  ].join('\n');
  const out = arg('out');
  if (out) {
    fs.writeFileSync(out, text, { mode: 0o600 });
    // eslint-disable-next-line no-console
    console.log(`Admin account ready. Login details saved to ${out}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`\n${text}`);
  }
  await disconnectDb();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
