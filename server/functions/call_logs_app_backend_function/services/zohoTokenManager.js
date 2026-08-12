/**
 * services/zohoTokenManager.js
 * Handles Zoho OAuth access-token retrieval + in-memory caching.
 *
 * How it works:
 * - Uses the long-lived refresh token to request a short-lived
 *   (~1 hour) access token from Zoho Accounts.
 * - Caches the access token in module-level memory for the lifetime of
 *   this function instance, refreshing it ~5 minutes before it expires.
 * - Catalyst may spin up multiple function instances under load, each
 *   with its own cache — that's fine, it just means a few extra token
 *   requests under high concurrency, never a correctness issue.
 *
 * Uses Node's built-in `fetch` (available in Catalyst's Node 18+ runtime)
 * so no extra npm dependency is required.
 */
const env = require('../config/env');
const logger = require('../utils/logger');

let cachedToken = null;   // { accessToken, expiresAt } | null
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before actual expiry

function isTokenValid() {
  return cachedToken && Date.now() < cachedToken.expiresAt - REFRESH_BUFFER_MS;
}

async function fetchNewAccessToken() {
  const tokenUrl = `https://accounts.zoho.${env.zohoDc}/oauth/v2/token`;

  const params = new URLSearchParams({
    refresh_token: env.refreshToken,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    grant_type: 'refresh_token',
  });

  const response = await fetch(`${tokenUrl}?${params.toString()}`, {
    method: 'POST',
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    logger.error('[zohoTokenManager] Token refresh failed:', data);
    throw new Error(
      `Zoho token refresh failed: ${data.error || response.statusText}`,
    );
  }

  const expiresInMs = (data.expires_in || 3600) * 1000;
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresInMs,
  };

  logger.info('[zohoTokenManager] Refreshed access token, expires in', data.expires_in, 's');
  return cachedToken.accessToken;
}

/** Returns a valid access token, refreshing it if needed. */
async function getAccessToken() {
  if (isTokenValid()) {
    return cachedToken.accessToken;
  }
  return fetchNewAccessToken();
}

module.exports = { getAccessToken };
