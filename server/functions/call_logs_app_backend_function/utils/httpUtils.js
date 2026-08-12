/**
 * utils/httpUtils.js
 * Helpers for Catalyst Basic I/O functions, which expose a raw Node.js
 * `http.IncomingMessage` / `http.ServerResponse` pair (no body-parser,
 * no router) — same shape as your existing index.js.
 */

/**
 * Reads and JSON-parses the request body. Basic I/O functions don't parse
 * the body for you, so this must be done manually via the 'data'/'end'
 * stream events.
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      // Basic safety cap to avoid unbounded memory use from a malformed
      // or malicious request (10 MB is generous for JSON metadata).
      if (raw.length > 10 * 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/** Sends a JSON response with the given status code. */
function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.write(body);
  res.end();
}

/** Standard success envelope. */
function sendSuccess(res, data, statusCode = 200) {
  sendJson(res, statusCode, { success: true, data });
}

/** Standard error envelope. Never leaks internal error details to the client. */
function sendError(res, statusCode, message, details) {
  sendJson(res, statusCode, {
    success: false,
    error: message,
    ...(details ? { details } : {}),
  });
}

/** Extracts the pathname portion of req.url, ignoring query params. */
function getPathname(req) {
  return (req.url || '').split('?')[0];
}

module.exports = { parseJsonBody, sendJson, sendSuccess, sendError, getPathname };
