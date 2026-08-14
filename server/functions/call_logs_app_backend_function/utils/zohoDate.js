'use strict';

/** Zoho CRM accepts ISO-8601 DateTime with an explicit numeric offset. */
function toZohoDateTime(timestampMs) {
  const value = Number(timestampMs);
  if (!Number.isFinite(value)) return null;
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

module.exports = { toZohoDateTime };
