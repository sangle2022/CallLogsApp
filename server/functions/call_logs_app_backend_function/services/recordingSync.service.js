'use strict';

const crypto = require('crypto');
const path = require('path');
const env = require('../config/env');
const logger = require('../utils/logger');
const {validateSyncRange, isInRange} = require('../utils/dateRange');
const {mapRecordingToCrmRecord} = require('../mapping/recording.mapping');
const crm = require('./zohoRecordingCrm.service');

function badRequest(message) {
  return Object.assign(new Error(message), {statusCode: 400});
}

function normalizeHash(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRecording(raw, range) {
  if (!raw || typeof raw !== 'object') {
    throw badRequest('Recording item must be an object');
  }

  const recordingHash = normalizeHash(raw.recordingHash);

  if (!/^[a-f0-9]{64}$/.test(recordingHash)) {
    throw badRequest('Invalid recordingHash');
  }

  const expectedAudioField = `audio_${recordingHash}`;
  const audioField = String(raw.audioField || '').trim();

  if (audioField !== expectedAudioField) {
    throw badRequest('audioField does not match recordingHash');
  }

  const fileName = String(raw.fileName || '').trim();
  if (!fileName) {
    throw badRequest('fileName is required');
  }

  const fileSize = Number(raw.fileSize);
  if (!Number.isFinite(fileSize) || fileSize < 0) {
    throw badRequest('Invalid fileSize');
  }

  const recordingTime = Number(raw.recordingTime || 0);
  if (!Number.isFinite(recordingTime) || recordingTime <= 0) {
    throw badRequest('Invalid recordingTime');
  }

  if (!isInRange(recordingTime, range)) {
    throw badRequest('Recording time is outside the selected recording date');
  }

  const extension = String(raw.extension || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');

  return {
    clientId: String(raw.clientId || ''),
    recordingHash,
    fileName,
    fileSize: Math.trunc(fileSize),
    recordingTime: Math.trunc(recordingTime),
    extension,
    audioField,
  };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw badRequest('Missing multipart payload JSON');
  }

  if (!Array.isArray(payload.recordings) || payload.recordings.length === 0) {
    throw badRequest('payload.recordings must be a non-empty array');
  }

  if (payload.recordings.length > env.maxRecordingsPerSyncRequest) {
    throw badRequest(
      `A recording sync request can contain at most ${env.maxRecordingsPerSyncRequest} recording(s)`,
    );
  }

  const range = validateSyncRange(
    payload.startTimestamp,
    payload.endTimestamp,
    payload.startDateKey,
    payload.endDateKey,
    env.maxRecordingSyncRangeDays,
  );

  return {recordings: payload.recordings, range};
}

function emptySummary(totalReceived) {
  return {
    totalReceived,
    uploaded: 0,
    repaired: 0,
    skippedDuplicates: 0,
    failed: 0,
    uploadedHashes: [],
    repairedHashes: [],
    duplicateHashes: [],
    failedItems: [],
    errors: [],
  };
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function fileExtension(fileName) {
  return path.extname(String(fileName || '')).replace(/^\./, '').toLowerCase();
}

async function attachAndMark(recordId, recording, file) {
  await crm.uploadAttachment(recordId, file);

  /**
   * Mark attached only AFTER the attachment API succeeds. If the upload fails,
   * the CRM record remains Recording_Attached=false and the next retry repairs
   * that same record instead of creating a duplicate.
   */
  await crm.updateRecord(recordId, {
    Recording_Attached: true,
    File_Size_Bytes: Number(file.size || recording.fileSize || 0),
    File_Extension: fileExtension(file.originalname) || recording.extension,
    MIME_Type: String(file.mimetype || 'application/octet-stream').slice(0, 100),
  });
}

async function resolveRace(recordingHash) {
  const refreshed = await crm.findRecordingsByHashes([recordingHash]);
  return refreshed.get(recordingHash) || null;
}

/**
 * Upload independent recording files.
 *
 * Dedupe rule:
 *   SHA-256(actual audio bytes) -> CRM Recording_Hash unique field
 *
 * This does NOT use:
 *   - phone number
 *   - contact name
 *   - call duration
 *   - call timestamp
 *   - call type
 *   - call-log Unique_Call_ID
 *   - RecordingMatcher
 */
async function syncRecordings(payload, files = []) {
  const {recordings: rawRecordings, range} = validatePayload(payload);
  const summary = emptySummary(rawRecordings.length);

  const filesByField = new Map(
    files.map(file => [String(file.fieldname), file]),
  );

  const normalized = [];
  const seenHashes = new Set();

  for (const raw of rawRecordings) {
    try {
      const recording = normalizeRecording(raw, range);

      if (seenHashes.has(recording.recordingHash)) {
        summary.skippedDuplicates += 1;
        summary.duplicateHashes.push(recording.recordingHash);
        continue;
      }

      seenHashes.add(recording.recordingHash);
      normalized.push(recording);
    } catch (error) {
      summary.failed += 1;
      summary.failedItems.push({
        recordingHash: raw?.recordingHash,
        fileName: raw?.fileName,
        reason: error.message,
      });
    }
  }

  if (normalized.length === 0) {
    return summary;
  }

  const existingByHash = await crm.findRecordingsByHashes(
    normalized.map(item => item.recordingHash),
  );

  for (const recording of normalized) {
    const file = filesByField.get(recording.audioField);

    if (!file) {
      summary.failed += 1;
      summary.failedItems.push({
        recordingHash: recording.recordingHash,
        fileName: recording.fileName,
        reason: `Missing multipart audio field: ${recording.audioField}`,
      });
      continue;
    }

    try {
      /**
       * The backend never trusts the frontend hash. It recomputes SHA-256 over
       * the received binary and rejects mismatches.
       */
      const computedHash = hashBuffer(file.buffer);

      if (computedHash !== recording.recordingHash) {
        throw badRequest(
          `Recording hash mismatch for ${recording.fileName}`,
        );
      }

      const actualSize = Number(file.size || file.buffer?.length || 0);
      recording.fileSize = actualSize;
      recording.fileName = String(file.originalname || recording.fileName);
      recording.extension =
        fileExtension(file.originalname) || recording.extension;

      let existing = existingByHash.get(recording.recordingHash) || null;

      if (existing?.recordingAttached) {
        summary.skippedDuplicates += 1;
        summary.duplicateHashes.push(recording.recordingHash);
        continue;
      }

      if (existing && !existing.recordingAttached) {
        await attachAndMark(existing.id, recording, file);

        summary.repaired += 1;
        summary.repairedHashes.push(recording.recordingHash);
        continue;
      }

      const crmData = mapRecordingToCrmRecord(recording, file);
      const createResult = await crm.createRecord(crmData);

      if (createResult?.status === 'success' && createResult?.details?.id) {
        const recordId = String(createResult.details.id);

        await attachAndMark(recordId, recording, file);

        summary.uploaded += 1;
        summary.uploadedHashes.push(recording.recordingHash);
        continue;
      }

      /**
       * Recording_Hash must be configured as a unique CRM field. If another
       * request created the record between our COQL lookup and insert, Zoho
       * returns DUPLICATE_DATA. Re-read the record and safely continue.
       */
      if (createResult?.code === 'DUPLICATE_DATA') {
        existing = await resolveRace(recording.recordingHash);

        if (!existing) {
          throw new Error(
            'CRM reported duplicate recording but the existing record could not be found',
          );
        }

        if (existing.recordingAttached) {
          summary.skippedDuplicates += 1;
          summary.duplicateHashes.push(recording.recordingHash);
          continue;
        }

        await attachAndMark(existing.id, recording, file);

        summary.repaired += 1;
        summary.repairedHashes.push(recording.recordingHash);
        continue;
      }

      throw new Error(
        createResult?.message ||
          createResult?.code ||
          'CRM recording record creation failed',
      );
    } catch (error) {
      summary.failed += 1;
      summary.failedItems.push({
        recordingHash: recording.recordingHash,
        fileName: recording.fileName,
        reason: error.message || 'Recording upload failed',
      });

      summary.errors.push(
        `${recording.fileName}: ${error.message || 'Recording upload failed'}`,
      );

      logger.error(
        '[recordingSync] recording upload failed:',
        recording.recordingHash,
        error,
      );
    }
  }

  summary.uploadedHashes = Array.from(new Set(summary.uploadedHashes));
  summary.repairedHashes = Array.from(new Set(summary.repairedHashes));
  summary.duplicateHashes = Array.from(new Set(summary.duplicateHashes));

  return summary;
}

async function checkSynced(recordingHashes) {
  const hashes = Array.from(
    new Set(recordingHashes.map(hash => normalizeHash(hash))),
  );

  if (hashes.length === 0) {
    throw badRequest('Provide at least one recording hash');
  }

  if (hashes.length > 100) {
    throw badRequest('Recording check supports at most 100 hashes per request');
  }

  if (hashes.some(hash => !/^[a-f0-9]{64}$/.test(hash))) {
    throw badRequest('One or more recording hashes are invalid');
  }

  const existing = await crm.findRecordingsByHashes(hashes);

  const syncedHashes = [];
  const incompleteHashes = [];
  const missingHashes = [];

  for (const hash of hashes) {
    const record = existing.get(hash);

    if (!record) {
      missingHashes.push(hash);
    } else if (record.recordingAttached) {
      syncedHashes.push(hash);
    } else {
      incompleteHashes.push(hash);
    }
  }

  return {
    syncedHashes,
    incompleteHashes,
    missingHashes,
    pendingHashes: [...incompleteHashes, ...missingHashes],
  };
}

module.exports = {
  syncRecordings,
  checkSynced,
};
