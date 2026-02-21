import { config } from '../../config/index.js';
import { AuthError, findOrCreateOAuthUser, generateTokens, completeLogin } from './auth.service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const SCOPES = ['openid', 'email', 'profile'].join(' ');

// ---------------------------------------------------------------------------
// getGoogleAuthUrl
// ---------------------------------------------------------------------------

export function getGoogleAuthUrl(): string {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
    throw new AuthError(
      'OAUTH_NOT_CONFIGURED',
      'Google OAuth is not configured',
      500,
    );
  }

  const params = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID,
    redirect_uri: config.GOOGLE_CALLBACK_URL ?? '',
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// handleGoogleCallback
// ---------------------------------------------------------------------------

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export async function handleGoogleCallback(
  code: string,
  ip: string,
  userAgent: string,
) {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
    throw new AuthError(
      'OAUTH_NOT_CONFIGURED',
      'Google OAuth is not configured',
      500,
    );
  }

  // Exchange authorization code for tokens
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      redirect_uri: config.GOOGLE_CALLBACK_URL ?? '',
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    console.error('[Google OAuth] Token exchange failed:', errorBody);
    throw new AuthError(
      'OAUTH_TOKEN_EXCHANGE_FAILED',
      'Failed to exchange authorization code for tokens',
      400,
    );
  }

  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

  // Fetch user info
  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userInfoResponse.ok) {
    const errorBody = await userInfoResponse.text();
    console.error('[Google OAuth] User info fetch failed:', errorBody);
    throw new AuthError(
      'OAUTH_USER_INFO_FAILED',
      'Failed to fetch user information from Google',
      400,
    );
  }

  const googleUser = (await userInfoResponse.json()) as GoogleUserInfo;

  if (!googleUser.email) {
    throw new AuthError(
      'OAUTH_NO_EMAIL',
      'No email address associated with this Google account',
      400,
    );
  }

  if (!googleUser.verified_email) {
    throw new AuthError(
      'OAUTH_EMAIL_NOT_VERIFIED',
      'Email address is not verified on Google',
      400,
    );
  }

  // Find or create the user
  const user = await findOrCreateOAuthUser({
    provider: 'google',
    providerId: googleUser.id,
    email: googleUser.email,
    name: googleUser.name || googleUser.email.split('@')[0],
    avatar: googleUser.picture ?? null,
  });

  // Complete login (creates session, audit log, etc.)
  const result = await completeLogin(user, ip, userAgent);

  return result;
}
