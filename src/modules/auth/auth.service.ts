import { redisClient } from '../../config/redis';

const TOKEN_CACHE_KEY = 'oauth:access_token';

// Mock OAuth2 token fetch — simulates the Client Credentials grant.
// In production, replace this with a real POST to an OAuth provider (Auth0, Okta, etc.).
async function fetchNewToken(): Promise<{ access_token: string; expires_in: number }> {
  await new Promise((r) => setTimeout(r, 50)); // simulate network latency

  return {
    access_token: 'mock_access_token_' + Date.now(),
    expires_in: 3600, // 1 hour
  };
}

let tokenFetchPromise: Promise<string> | null = null;

export async function getAccessToken(): Promise<string> {
  const cached = await redisClient.get(TOKEN_CACHE_KEY);
  if (cached) {
    console.log('[AUTH] Token served from Redis cache');
    return cached;
  }

  if (tokenFetchPromise) {
    console.log('[AUTH] Waiting on existing token fetch (concurrency-safe)');
    return tokenFetchPromise;
  }

  console.log('[AUTH] Fetching new token from OAuth provider');

  tokenFetchPromise = (async () => {
    try {
      const { access_token, expires_in } = await fetchNewToken();

      // Cache with a 30s buffer before actual expiry
      await redisClient.setEx(TOKEN_CACHE_KEY, expires_in - 30, access_token);

      return access_token;
    } finally {
      tokenFetchPromise = null;
    }
  })();

  return tokenFetchPromise;
}
