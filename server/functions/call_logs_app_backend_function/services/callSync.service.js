'use strict';

const env = require('../config/env');
const {buildUniqueCallId} = require('../utils/hash');
const {validateSyncRange, isInRange} = require('../utils/dateRange');
const {mapCallToCrmRecord} = require('../mapping/call.mapping');
const crm = require('./zohoCrm.service');

const ALLOWED_CALL_TYPES = new Set([
  'INCOMING',
  'OUTGOING',
  'MISSED',
  'REJECTED',
  'BLOCKED',
  'VOICEMAIL',
  'UNKNOWN',
]);

function badRequest(message) {
  return Object.assign(new Error(message), {statusCode: 400});
}

function normalizeCall(raw, range) {
  if (!raw || typeof raw !== 'object') {
    throw badRequest('Call item must be an object');
  }

  const callType = String(raw.callType || '').toUpperCase();

  if (!ALLOWED_CALL_TYPES.has(callType)) {
    throw badRequest(`Unsupported callType: ${callType}`);
  }

  const timestamp = Number(raw.timestamp);
  const duration = Number(raw.duration);

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw badRequest('Invalid call timestamp');
  }

  if (!Number.isFinite(duration) || duration < 0) {
    throw badRequest('Invalid call duration');
  }

  if (!isInRange(timestamp, range)) {
    throw badRequest('Call timestamp is outside the selected date range');
  }

  /** remoteNumber remains part of the canonical call-log dedupe hash. */
  const remoteNumber = String(raw.remoteNumber || '').trim() || 'Unknown number';

  const recomputed = buildUniqueCallId({
    remoteNumber,
    timestamp,
    duration,
    callType,
  });

  const suppliedHash = String(raw.uniqueCallId || '').toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(suppliedHash) || suppliedHash !== recomputed) {
    throw badRequest('uniqueCallId does not match the canonical call metadata');
  }

  return {
    id: String(raw.id || ''),
    remoteName: String(raw.remoteName || 'Unknown').trim() || 'Unknown',
    remoteNumber,
    callerName: String(raw.callerName || 'Unknown').trim() || 'Unknown',
    callerNumber: String(raw.callerNumber || '').trim(),
    receiverName: String(raw.receiverName || 'Unknown').trim() || 'Unknown',
    receiverNumber: String(raw.receiverNumber || '').trim(),
    callType,
    duration: Math.trunc(duration),
    timestamp: Math.trunc(timestamp),
    uniqueCallId: suppliedHash,
  };
}

function validatePayloadAndRange(payload) {
  if (!payload || typeof payload !== 'object') {
    throw badRequest('Missing multipart payload JSON');
  }

  const calls = payload.calls;

  if (!Array.isArray(calls) || calls.length === 0) {
    throw badRequest('payload.calls must be a non-empty array');
  }

  if (calls.length > env.maxCallsPerSyncRequest) {
    throw badRequest(
      `A sync request can contain at most ${env.maxCallsPerSyncRequest} calls`,
    );
  }

  const range = validateSyncRange(
    payload.startTimestamp,
    payload.endTimestamp,
    payload.startDateKey,
    payload.endDateKey,
  );

  return {calls, range};
}

function emptyCallSummary(totalReceived) {
  return {
    totalReceived,
    uploaded: 0,
    skippedDuplicates: 0,
    failed: 0,
    attachmentsUploaded: 0,
    attachmentFailed: 0,
    uploadedIds: [],
    duplicateIds: [],
    failedItems: [],
    errors: [],
  };
}

function normalizeValidCalls(calls, range, summary) {
  const validCalls = [];

  calls.forEach(raw => {
    try {
      validCalls.push(normalizeCall(raw, range));
    } catch (error) {
      summary.failed += 1;
      summary.failedItems.push({
        uniqueCallId: raw?.uniqueCallId,
        reason: error.message,
      });
    }
  });

  return validCalls;
}

function uniqueCallsByHash(calls, onDuplicate) {
  const result = [];
  const seen = new Set();

  for (const call of calls) {
    if (seen.has(call.uniqueCallId)) {
      onDuplicate(call);
      continue;
    }

    seen.add(call.uniqueCallId);
    result.push(call);
  }

  return result;
}

/**
 * EXISTING CALL LOG FLOW.
 *
 * Recordings are no longer accepted here. This function only creates call-log
 * metadata records in the existing call-log CRM module.
 */
async function syncCalls(payload) {
  const {calls, range} = validatePayloadAndRange(payload);
  const summary = emptyCallSummary(calls.length);

  const validCalls = normalizeValidCalls(calls, range, summary);

  const uniqueValidCalls = uniqueCallsByHash(validCalls, call => {
    summary.skippedDuplicates += 1;
    summary.duplicateIds.push(call.uniqueCallId);
  });

  if (uniqueValidCalls.length === 0) {
    return summary;
  }

  const existingById = await crm.findCallsByUniqueIds(
    uniqueValidCalls.map(call => call.uniqueCallId),
  );

  const missingCalls = [];

  for (const call of uniqueValidCalls) {
    if (existingById.has(call.uniqueCallId)) {
      summary.skippedDuplicates += 1;
      summary.duplicateIds.push(call.uniqueCallId);
      continue;
    }

    missingCalls.push(call);
  }

  if (missingCalls.length > 0) {
    const records = missingCalls.map(call => mapCallToCrmRecord(call));
    const createResults = await crm.createRecords(records);

    for (let index = 0; index < missingCalls.length; index += 1) {
      const call = missingCalls[index];
      const result = createResults[index];

      if (result?.status === 'success' && result?.details?.id) {
        summary.uploaded += 1;
        summary.uploadedIds.push(call.uniqueCallId);
        continue;
      }

      if (result?.code === 'DUPLICATE_DATA') {
        summary.skippedDuplicates += 1;
        summary.duplicateIds.push(call.uniqueCallId);
        continue;
      }

      summary.failed += 1;
      summary.failedItems.push({
        uniqueCallId: call.uniqueCallId,
        reason:
          result?.message || result?.code || 'CRM record creation failed',
      });
    }
  }

  summary.uploadedIds = Array.from(new Set(summary.uploadedIds));
  summary.duplicateIds = Array.from(new Set(summary.duplicateIds));

  return summary;
}

async function checkSynced(uniqueCallIds) {
  const ids = Array.from(
    new Set(uniqueCallIds.map(id => String(id).toLowerCase())),
  );

  if (ids.length === 0) {
    throw badRequest('Provide at least one unique call id');
  }

  if (ids.length > 100) {
    throw badRequest('check-synced supports at most 100 ids per request');
  }

  if (ids.some(id => !/^[a-f0-9]{64}$/.test(id))) {
    throw badRequest('One or more unique call ids are invalid');
  }

  const existing = await crm.findCallsByUniqueIds(ids);

  return {
    syncedIds: ids.filter(id => existing.has(id)),
    missingIds: ids.filter(id => !existing.has(id)),
  };
}

module.exports = {
  syncCalls,
  checkSynced,
};
