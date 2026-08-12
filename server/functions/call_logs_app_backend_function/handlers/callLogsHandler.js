/**
 * handlers/callLogsHandler.js
 * Handles POST /call-logs
 *
 * Expected request body (from the mobile app):
 *   { "logs": [ { id, callerName, phoneNumber, callType, duration, timestamp, dateTime }, ... ] }
 */
const env = require('../config/env');
const logger = require('../utils/logger');
const { parseJsonBody, sendSuccess, sendError } = require('../utils/httpUtils');
const { insertRecords } = require('../services/zohoCrmClient');
const { mapCallLogToCrmRecord } = require('../mapping/fieldMapping');

async function handleCallLogs(req, res) {
  let body;
  try {
    body = await parseJsonBody(req);
  } catch (err) {
    sendError(res, 400, 'Invalid JSON body', err.message);
    return;
  }

  const logs = body.logs;
  if (!Array.isArray(logs) || logs.length === 0) {
    sendError(res, 400, "Request body must include a non-empty 'logs' array");
    return;
  }

  // Basic per-record validation - skip malformed entries rather than
  // failing the whole batch, but report which ones were skipped.
  const skipped = [];
  const validLogs = logs.filter((entry, index) => {
    const isValid = entry && typeof entry === 'object' && entry.phoneNumber;
    if (!isValid) skipped.push({ index, reason: 'Missing phoneNumber' });
    return isValid;
  });

  if (validLogs.length === 0) {
    sendError(res, 400, 'No valid call log entries in request', { skipped });
    return;
  }

  const crmRecords = validLogs.map(mapCallLogToCrmRecord);

  try {
    const { insertedCount, failed } = await insertRecords(env.callLogsModule, crmRecords);
    logger.info(`[callLogsHandler] Inserted ${insertedCount}/${crmRecords.length} call logs`);

    sendSuccess(res, {
      received: logs.length,
      inserted: insertedCount,
      skipped,
      failed,
    });
  } catch (err) {
    logger.error('[callLogsHandler] CRM insert failed:', err);
    sendError(res, 502, 'Failed to push call logs to Zoho CRM', err.message);
  }
}

module.exports = handleCallLogs;
