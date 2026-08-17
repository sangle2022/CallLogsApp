'use strict';

const env = require('../config/env');
const logger = require('../utils/logger');
const {
  getAccessToken,
  invalidateAccessToken,
} = require('./zohoToken.service');

function crmBaseUrl() {
  return `https://www.zohoapis.${env.zohoDc}/crm/${env.crmApiVersion}`;
}

/**
 * Recording CRM client is intentionally separate from zohoCrm.service.js so
 * the existing call-log flow does not need to change.
 *
 * Do not refresh the OAuth token for OAUTH_SCOPE_MISMATCH. Refreshing cannot
 * add a missing OAuth scope and only burns through Zoho token limits.
 */
async function crmFetch(path, options = {}, retry401 = true) {
  const token = await getAccessToken();

  const response = await fetch(`${crmBaseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 401 && retry401) {
    const body = await response.clone().json().catch(() => ({}));

    if (body?.code === 'OAUTH_SCOPE_MISMATCH') {
      return response;
    }

    if (
      body?.code === 'INVALID_OAUTHTOKEN' ||
      body?.code === 'AUTHENTICATION_FAILURE'
    ) {
      invalidateAccessToken();
      return crmFetch(path, options, false);
    }
  }

  return response;
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function assertSuccessfulResponse(response, body, operation) {
  if (!response.ok) {
    logger.error(`[zohoRecordingCrm] ${operation} failed`, response.status, body);

    const error = new Error(`${operation} failed (${response.status})`);
    error.statusCode = 502;
    error.crmBody = body;
    throw error;
  }
}

function chunkArray(items, size) {
  const result = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

async function findRecordingsByHashes(recordingHashes) {
  const hashes = Array.from(new Set(recordingHashes))
    .map(hash => String(hash || '').toLowerCase())
    .filter(hash => /^[a-f0-9]{64}$/.test(hash));

  const found = new Map();

  if (hashes.length === 0) {
    return found;
  }

  for (const batch of chunkArray(hashes, 100)) {
    const quoted = batch.map(hash => `'${hash}'`).join(',');

    const query =
      `select id, Recording_Hash, Recording_Attached ` +
      `from ${env.recordingsModule} ` +
      `where Recording_Hash in (${quoted}) limit 200`;

    const response = await crmFetch('/coql', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({select_query: query}),
    });

    if (response.status === 204) {
      continue;
    }

    const body = await readJson(response);
    assertSuccessfulResponse(response, body, 'Zoho recording COQL lookup');

    for (const row of body.data || []) {
      const hash = String(row.Recording_Hash || '').toLowerCase();

      if (!row.id || !/^[a-f0-9]{64}$/.test(hash)) {
        continue;
      }

      found.set(hash, {
        id: String(row.id),
        recordingAttached: Boolean(row.Recording_Attached),
      });
    }
  }

  return found;
}

async function createRecord(data) {
  const response = await crmFetch(`/${env.recordingsModule}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({data: [data]}),
  });

  const body = await readJson(response);

  if (!response.ok && !Array.isArray(body.data)) {
    assertSuccessfulResponse(response, body, 'Zoho recording insert');
  }

  return body?.data?.[0] || null;
}

async function updateRecord(recordId, data) {
  const response = await crmFetch(`/${env.recordingsModule}/${recordId}`, {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({data: [data]}),
  });

  const body = await readJson(response);
  assertSuccessfulResponse(response, body, 'Zoho recording update');

  const result = body?.data?.[0];

  if (!result || result.status !== 'success') {
    throw Object.assign(
      new Error('Zoho recording update returned a non-success result'),
      {statusCode: 502, crmBody: body},
    );
  }

  return result;
}

async function uploadAttachment(recordId, file) {
  const form = new FormData();

  const blob = new Blob([file.buffer], {
    type: file.mimetype || 'application/octet-stream',
  });

  form.append('file', blob, file.originalname);

  const response = await crmFetch(
    `/${env.recordingsModule}/${recordId}/Attachments`,
    {
      method: 'POST',
      body: form,
    },
  );

  const body = await readJson(response);
  assertSuccessfulResponse(response, body, 'Zoho recording attachment upload');

  const result = body?.data?.[0];

  if (!result || result.status !== 'success') {
    throw Object.assign(
      new Error('Zoho recording attachment upload returned a non-success result'),
      {statusCode: 502, crmBody: body},
    );
  }

  return result;
}

module.exports = {
  findRecordingsByHashes,
  createRecord,
  updateRecord,
  uploadAttachment,
};
