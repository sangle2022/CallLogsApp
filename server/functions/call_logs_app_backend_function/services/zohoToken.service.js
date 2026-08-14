'use strict';

const env = require('../config/env');
const logger = require('../utils/logger');

let cachedToken = null;
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

function isTokenValid() {
  return cachedToken && Date.now() < cachedToken.expiresAt - REFRESH_BUFFER_MS;
}

function invalidateAccessToken() {
  cachedToken = null;
}

async function fetchNewAccessToken() {
  const tokenUrl = `https://accounts.zoho.${env.zohoDc}/oauth/v2/token`;
  const params = new URLSearchParams({
    refresh_token: env.refreshToken,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    grant_type: 'refresh_token',
  });

  const response = await fetch(`${tokenUrl}?${params.toString()}`, { method: 'POST' });
  const body = await response.json().catch(() => ({}));

  if (!response.ok || !body.access_token) {
    logger.error('[zohoToken] token refresh failed:', response.status, body?.error || 'unknown');
    throw new Error(`Zoho OAuth refresh failed (${response.status})`);
  }

  cachedToken = {
    accessToken: body.access_token,
    expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000,
  };
  return cachedToken.accessToken;
}

async function getAccessToken() {
  return isTokenValid() ? cachedToken.accessToken : fetchNewAccessToken();
}

module.exports = { getAccessToken, invalidateAccessToken };
