'use strict';

const crypto = require('crypto');

function normalizeRemoteNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || 'unknown';
}

function buildUniqueCallId({ remoteNumber, timestamp, duration, callType }) {
  const canonical = [
    normalizeRemoteNumber(remoteNumber),
    Math.trunc(Number(timestamp) || 0),
    Math.max(0, Math.trunc(Number(duration) || 0)),
    String(callType || 'UNKNOWN').toUpperCase(),
  ].join('|');

  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

module.exports = { normalizeRemoteNumber, buildUniqueCallId };
