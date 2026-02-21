import { config } from '../../config/index.js';
import { AuthError, findOrCreateOAuthUser, completeLogin } from './auth.service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_USER_EMAILS_URL = 'https://api.github.com/user/emails';

const SCOPES = 'read:user user:email';

// ---------------------------------------------------------------------------
// getGithubAuthUrl
// ---------------------------------------------------------------------------

export function getGithubAuthUrl(): string {
  if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET) {
    throw new AuthError(
      'OAUTH_NOT_CONFIGURED',
      'GitHub OAuth is not configured',
      500,
    );
  }

  const params = new URLSearchParams({
    client_id: config.GITHUB_CLIENT_ID,
    redirect_uri: config.GITHUB_CALLBACK_URL ?? '',
    scope: SCOPES,
  });

  return `${GITHUB_AUTH_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// handleGithubCallback
// ---------------------------------------------------------------------------

interface GithubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface GithubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GithubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

export async function handleGithubCallback(
  code: string,
  ip: string,
  userAgent: string,
) {
  if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET) {
    throw new AuthError(
      'OAUTH_NOT_CONFIGURED',
      'GitHub OAuth is not configured',
      500,
    );
  }

  // Exchange authorization code for access token
  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.GITHUB_CLIENT_ID,
      client_secret: config.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: config.GITHUB_CALLBACK_URL ?? '',
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    console.error('[GitHub OAuth] Token exchange failed:', errorBody);
    throw new AuthError(
      'OAUTH_TOKEN_EXCHANGE_FAILED',
      'Failed to exchange authorization code for tokens',
      400,
    );
  }

  const tokenData = (await tokenResponse.json()) as GithubTokenResponse;

  if (!tokenData.access_token) {
    throw new AuthError(
      'OAUTH_TOKEN_EXCHANGE_FAILED',
      'GitHub did not return an access token',
      400,
    );
  }

  // Fetch user profile
  const userResponse = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!userResponse.ok) {
    const errorBody = await userResponse.text();
    console.error('[GitHub OAuth] User fetch failed:', errorBody);
    throw new AuthError(
      'OAUTH_USER_INFO_FAILED',
      'Failed to fetch user information from GitHub',
      400,
    );
  }

  const githubUser = (await userResponse.json()) as GithubUser;

  // Fetch user emails (may be private)
  let primaryEmail = githubUser.email;

  if (!primaryEmail) {
    const emailsResponse = await fetch(GITHUB_USER_EMAILS_URL, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (emailsResponse.ok) {
      const emails = (await emailsResponse.json()) as GithubEmail[];

      // Prefer primary + verified email
      const primary = emails.find((e) => e.primary && e.verified);
      const verified = emails.find((e) => e.verified);
      const any = emails[0];

      const chosen = primary ?? verified ?? any;
      if (chosen) {
        primaryEmail = chosen.email;
      }
    }
  }

  if (!primaryEmail) {
    throw new AuthError(
      'OAUTH_NO_EMAIL',
      'No email address associated with this GitHub account. Please set a public email on GitHub or grant the user:email scope.',
      400,
    );
  }

  // Find or create user
  const user = await findOrCreateOAuthUser({
    provider: 'github',
    providerId: String(githubUser.id),
    email: primaryEmail,
    name: githubUser.name ?? githubUser.login,
    avatar: githubUser.avatar_url ?? null,
  });

  // Complete login
  const result = await completeLogin(user, ip, userAgent);

  return result;
}
