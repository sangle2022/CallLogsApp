'use strict';

const env = require('../config/env');
const logger = require('../utils/logger');
const { buildUniqueCallId } = require('../utils/hash');
const { validateSyncRange, isInRange } = require('../utils/dateRange');
const { mapCallToCrmRecord } = require('../mapping/call.mapping');
const crm = require('./zohoCrm.service');

const ALLOWED_CALL_TYPES = new Set([
  'INCOMING', 'OUTGOING', 'MISSED', 'REJECTED', 'BLOCKED', 'VOICEMAIL', 'UNKNOWN',
]);

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function normalizeCall(raw, range) {
  if (!raw || typeof raw !== 'object') throw badRequest('Call item must be an object');

  const callType = String(raw.callType || '').toUpperCase();
  if (!ALLOWED_CALL_TYPES.has(callType)) throw badRequest(`Unsupported callType: ${callType}`);

  const timestamp = Number(raw.timestamp);
  const duration = Number(raw.duration);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw badRequest('Invalid call timestamp');
  if (!Number.isFinite(duration) || duration < 0) throw badRequest('Invalid call duration');
  if (!isInRange(timestamp, range)) throw badRequest('Call timestamp is outside the selected date range');

  const remoteNumber = String(raw.remoteNumber || '').trim() || 'Unknown number';
  const recomputed = buildUniqueCallId({ remoteNumber, timestamp, duration, callType });
  const suppliedHash = String(raw.uniqueCallId || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(suppliedHash) || suppliedHash !== recomputed) {
    throw badRequest('uniqueCallId does not match the canonical call metadata');
  }

  const expectedAudioField = `audio_${suppliedHash}`;
  const audioField = raw.audioField ? String(raw.audioField) : null;
  if (audioField && audioField !== expectedAudioField) {
    throw badRequest('audioField does not match uniqueCallId');
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
    audioField,
  };
}

function emptySummary(totalReceived) {
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

function findFileForCall(call, filesByField) {
  return call.audioField ? filesByField.get(call.audioField) || null : null;
}

async function attachIfNeeded(recordId, call, file, summary) {
  if (!file) return;
  try {
    await crm.uploadAttachment(recordId, file);
    await crm.updateRecord(recordId, {
      Recording_Attached: true,
      Recording_File_Name: file.originalname,
    });
    summary.attachmentsUploaded += 1;
  } catch (error) {
    summary.attachmentFailed += 1;
    summary.errors.push(`Audio attachment failed for ${call.uniqueCallId}: ${error.message}`);
    logger.error('[callSync] attachment failed:', call.uniqueCallId, error);
  }
}

async function syncCalls(payload, files = []) {
  if (!payload || typeof payload !== 'object') throw badRequest('Missing multipart payload JSON');
  const calls = payload.calls;
  if (!Array.isArray(calls) || calls.length === 0) throw badRequest("payload.calls must be a non-empty array");
  if (calls.length > env.maxCallsPerSyncRequest) {
    throw badRequest(`A sync request can contain at most ${env.maxCallsPerSyncRequest} calls`);
  }

  const range = validateSyncRange(
    payload.startTimestamp,
    payload.endTimestamp,
    payload.startDateKey,
    payload.endDateKey,
  );
  const summary = emptySummary(calls.length);
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

  const filesByField = new Map(files.map(file => [file.fieldname, file]));
  const uniqueValidCalls = [];
  const seenInRequest = new Set();

  for (const call of validCalls) {
    if (seenInRequest.has(call.uniqueCallId)) {
      summary.skippedDuplicates += 1;
      summary.duplicateIds.push(call.uniqueCallId);
      continue;
    }
    seenInRequest.add(call.uniqueCallId);
    uniqueValidCalls.push(call);
  }

  const existingById = await crm.findCallsByUniqueIds(uniqueValidCalls.map(call => call.uniqueCallId));
  const missingCalls = [];

  for (const call of uniqueValidCalls) {
    const existing = existingById.get(call.uniqueCallId);
    if (!existing) {
      missingCalls.push(call);
      continue;
    }

    summary.skippedDuplicates += 1;
    summary.duplicateIds.push(call.uniqueCallId);

    // If a previous attempt created metadata but audio attachment failed, CRM
    // remains the source of truth and can tell us to retry the attachment.
    const file = findFileForCall(call, filesByField);
    if (file && !existing.recordingAttached) {
      await attachIfNeeded(existing.id, call, file, summary);
    }
  }

  if (missingCalls.length > 0) {
    const records = missingCalls.map(call =>
      mapCallToCrmRecord(call, findFileForCall(call, filesByField)),
    );
    const createResults = await crm.createRecords(records);

    for (let index = 0; index < missingCalls.length; index += 1) {
      const call = missingCalls[index];
      const result = createResults[index];

      if (result?.status === 'success' && result?.details?.id) {
        const recordId = String(result.details.id);
        summary.uploaded += 1;
        summary.uploadedIds.push(call.uniqueCallId);
        await attachIfNeeded(recordId, call, findFileForCall(call, filesByField), summary);
        continue;
      }

      // Unique field enforcement closes the race between COQL lookup and insert.
      if (result?.code === 'DUPLICATE_DATA') {
        summary.skippedDuplicates += 1;
        summary.duplicateIds.push(call.uniqueCallId);

        // Race-safe audio retry: resolve the newly-existing CRM record by hash.
        const raceRecord = (await crm.findCallsByUniqueIds([call.uniqueCallId])).get(call.uniqueCallId);
        const file = findFileForCall(call, filesByField);
        if (raceRecord && file && !raceRecord.recordingAttached) {
          await attachIfNeeded(raceRecord.id, call, file, summary);
        }
        continue;
      }

      summary.failed += 1;
      summary.failedItems.push({
        uniqueCallId: call.uniqueCallId,
        reason: result?.message || result?.code || 'CRM record creation failed',
      });
    }
  }

  summary.uploadedIds = Array.from(new Set(summary.uploadedIds));
  summary.duplicateIds = Array.from(new Set(summary.duplicateIds));
  return summary;
}

async function checkSynced(uniqueCallIds) {
  const ids = Array.from(new Set(uniqueCallIds.map(id => String(id).toLowerCase())));
  if (ids.length === 0) throw badRequest('Provide at least one unique call id');
  if (ids.length > 100) throw badRequest('check-synced supports at most 100 ids per request');
  if (ids.some(id => !/^[a-f0-9]{64}$/.test(id))) throw badRequest('One or more unique call ids are invalid');

  const existing = await crm.findCallsByUniqueIds(ids);
  return {
    syncedIds: ids.filter(id => existing.has(id)),
    missingIds: ids.filter(id => !existing.has(id)),
  };
}

module.exports = { syncCalls, checkSynced };
