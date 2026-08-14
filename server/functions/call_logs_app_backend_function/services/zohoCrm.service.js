'use strict';

const env = require('../config/env');
const logger = require('../utils/logger');
const { getAccessToken, invalidateAccessToken } = require('./zohoToken.service');

function crmBaseUrl() {
  return `https://www.zohoapis.${env.zohoDc}/crm/${env.crmApiVersion}`;
}

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
    invalidateAccessToken();
    return crmFetch(path, options, false);
  }
  return response;
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function assertSuccessfulResponse(response, body, operation) {
  if (!response.ok) {
    logger.error(`[zohoCrm] ${operation} failed`, response.status, body);
    const error = new Error(`${operation} failed (${response.status})`);
    error.statusCode = 502;
    error.crmBody = body;
    throw error;
  }
}

function chunkArray(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

async function findCallsByUniqueIds(uniqueCallIds) {
  const uniqueIds = Array.from(new Set(uniqueCallIds)).filter(id => /^[a-f0-9]{64}$/.test(id));
  const found = new Map();
  if (uniqueIds.length === 0) return found;

  // COQL `in` accepts up to 100 values. Keep lookup batches at that limit.
  for (const ids of chunkArray(uniqueIds, 100)) {
    const quotedIds = ids.map(id => `'${id}'`).join(',');
    const query =
      `select id, Unique_Call_ID, Recording_Attached, Recording_File_Name ` +
      `from ${env.callLogsModule} where Unique_Call_ID in (${quotedIds}) limit 200`;

    const response = await crmFetch('/coql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ select_query: query }),
    });
    const body = await readJson(response);

    // COQL may return 204 when no records match.
    if (response.status === 204) continue;
    assertSuccessfulResponse(response, body, 'Zoho COQL lookup');

    for (const row of body.data || []) {
      if (!row.Unique_Call_ID || !row.id) continue;
      found.set(String(row.Unique_Call_ID).toLowerCase(), {
        id: String(row.id),
        recordingAttached: Boolean(row.Recording_Attached),
        recordingFileName: row.Recording_File_Name || '',
      });
    }
  }

  return found;
}

async function createRecords(records) {
  if (records.length === 0) return [];
  if (records.length > 100) throw new Error('createRecords supports at most 100 records');

  const response = await crmFetch(`/${env.callLogsModule}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: records }),
  });
  const body = await readJson(response);

  // Multi-record inserts may use 207 for mixed success; that is still 2xx.
  if (!response.ok && !Array.isArray(body.data)) {
    assertSuccessfulResponse(response, body, 'Zoho CRM insert');
  }
  return Array.isArray(body.data) ? body.data : [];
}

async function updateRecord(recordId, data) {
  const response = await crmFetch(`/${env.callLogsModule}/${recordId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [data] }),
  });
  const body = await readJson(response);
  assertSuccessfulResponse(response, body, 'Zoho CRM update');

  const result = body?.data?.[0];
  if (!result || result.status !== 'success') {
    throw Object.assign(new Error('Zoho CRM update returned a non-success result'), { statusCode: 502 });
  }
  return result;
}

async function uploadAttachment(recordId, file) {
  const form = new FormData();
  const blob = new Blob([file.buffer], {
    type: file.mimetype || 'application/octet-stream',
  });
  form.append('file', blob, file.originalname);

  const response = await crmFetch(`/${env.callLogsModule}/${recordId}/Attachments`, {
    method: 'POST',
    body: form,
  });
  const body = await readJson(response);
  assertSuccessfulResponse(response, body, 'Zoho CRM attachment upload');

  const result = body?.data?.[0];
  if (!result || result.status !== 'success') {
    throw Object.assign(new Error('Zoho CRM attachment upload returned a non-success result'), { statusCode: 502 });
  }
  return result;
}

module.exports = {
  findCallsByUniqueIds,
  createRecords,
  updateRecord,
  uploadAttachment,
};
