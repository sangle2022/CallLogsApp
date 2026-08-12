/**
 * handlers/callRecordingsHandler.js
 * Handles POST /call-recordings
 *
 * Expected request body (from the mobile app):
 *   { "recordings": [ { id, fileName, filePath, fileSize, createdDate, extension }, ... ] }
 *
 * NOTE: this pushes recording METADATA only. Uploading the actual audio
 * file as a CRM attachment is a separate concern (multipart upload) -
 * see the comment in mapping/fieldMapping.js.
 */
const env = require('../config/env');
const logger = require('../utils/logger');
const { parseJsonBody, sendSuccess, sendError } = require('../utils/httpUtils');
const { insertRecords } = require('../services/zohoCrmClient');
const { mapRecordingToCrmRecord } = require('../mapping/fieldMapping');

async function handleCallRecordings(req, res) {
  let body;
  try {
    body = await parseJsonBody(req);
  } catch (err) {
    sendError(res, 400, 'Invalid JSON body', err.message);
    return;
  }

  const recordings = body.recordings;
  if (!Array.isArray(recordings) || recordings.length === 0) {
    sendError(res, 400, "Request body must include a non-empty 'recordings' array");
    return;
  }

  const skipped = [];
  const validRecordings = recordings.filter((entry, index) => {
    const isValid = entry && typeof entry === 'object' && entry.filePath;
    if (!isValid) skipped.push({ index, reason: 'Missing filePath' });
    return isValid;
  });

  if (validRecordings.length === 0) {
    sendError(res, 400, 'No valid recording entries in request', { skipped });
    return;
  }

  const crmRecords = validRecordings.map(mapRecordingToCrmRecord);

  try {
    const { insertedCount, failed } = await insertRecords(env.callRecordingsModule, crmRecords);
    logger.info(`[callRecordingsHandler] Inserted ${insertedCount}/${crmRecords.length} recordings`);

    sendSuccess(res, {
      received: recordings.length,
      inserted: insertedCount,
      skipped,
      failed,
    });
  } catch (err) {
    logger.error('[callRecordingsHandler] CRM insert failed:', err);
    sendError(res, 502, 'Failed to push recordings to Zoho CRM', err.message);
  }
}

module.exports = handleCallRecordings;
