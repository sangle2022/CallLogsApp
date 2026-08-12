'use strict';

const { IncomingMessage, ServerResponse } = require("http");
const { sendError, getPathname } = require('./utils/httpUtils');
const logger = require('./utils/logger');
const env = require('./config/env'); // validated at cold-start: fails fast if misconfigured

const handleCallLogs = require('./handlers/callLogsHandler');
const handleCallRecordings = require('./handlers/callRecordingsHandler');
const handleRecordingUpload = require('./handlers/recordingUploadHandler');

/**
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 */
module.exports = async (req, res) => {
  const url = getPathname(req);

  try {
    // --- Simple shared-secret auth for the mobile app ---------------
    const apiKey = req.headers['x-api-key'];
    if (url !== '/' && apiKey !== env.mobileApiKey) {
      sendError(res, 401, 'Unauthorized: missing or invalid X-API-Key header');
      return;
    }

    switch (url) {
      case '/':
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write('<h1>Hello from index.js</h1>');
        res.end();
        return;

      case '/call-logs':
        if (req.method !== 'POST') {
          sendError(res, 405, 'Method not allowed. Use POST.');
          return;
        }
        await handleCallLogs(req, res);
        return;

      case '/call-recordings':
        if (req.method !== 'POST') {
          sendError(res, 405, 'Method not allowed. Use POST.');
          return;
        }
        await handleCallRecordings(req, res);
        return;

      case '/call-recordings/upload':
        if (req.method !== 'POST') {
          sendError(res, 405, 'Method not allowed. Use POST.');
          return;
        }
        await handleRecordingUpload(req, res);
        return;

      default:
        sendError(res, 404, `You might find the page you are looking for at "/", "/call-logs", "/call-recordings", or "/call-recordings/upload"`);
        return;
    }
  } catch (err) {
    logger.error('[index] Unhandled error:', err);
    sendError(res, 500, 'Internal server error');
  }
};
