/**
 * "CONTINUE WITH GOOGLE": checks the signed ID token the Google button gave the browser
 * (signature, expiry, and that it was made for OUR GOOGLE_CLIENT_ID). Used by POST /auth/google.
 */
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

export interface GoogleIdentity {
  sub: string; // Google's permanent account id
  email: string;
  emailVerified: boolean;
  name: string;
}

type Verifier = (credential: string) => Promise<GoogleIdentity>;

const client = new OAuth2Client();

/**
 * Verifies a Google ID token (signature, issuer, expiry and that it was issued for OUR client ID).
 * Never trust the email from the browser — only from a verified token.
 */
const googleVerifier: Verifier = async (credential) => {
  if (!env.GOOGLE_CLIENT_ID) throw new AppError('FORBIDDEN', 'errors.googleNotConfigured');
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) throw new Error('missing claims');
    return { sub: p.sub, email: p.email.toLowerCase(), emailVerified: p.email_verified === true, name: p.name ?? p.email.split('@')[0] };
  } catch {
    throw new AppError('UNAUTHENTICATED', 'errors.googleFailed');
  }
};

let verifier: Verifier = googleVerifier;

export const verifyGoogleCredential = (credential: string) => verifier(credential);

/** Tests only: replace Google's verification with a fake. */
export function setGoogleVerifierForTests(fake: Verifier | null) {
  if (env.NODE_ENV !== 'test') throw new Error('test only');
  verifier = fake ?? googleVerifier;
}
