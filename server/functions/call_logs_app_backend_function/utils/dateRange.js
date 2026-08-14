'use strict';

const env = require('../config/env');

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateKey(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function calendarDaySpan(startDateKey, endDateKey) {
  const start = parseDateKey(startDateKey);
  const end = parseDateKey(endDateKey);
  if (!start || !end) return null;
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  return Math.floor((endUtc - startUtc) / DAY_MS) + 1;
}

function validateSyncRange(startTimestamp, endTimestamp, startDateKey, endDateKey) {
  const start = Number(startTimestamp);
  const end = Number(endTimestamp);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw Object.assign(new Error('startTimestamp and endTimestamp are required'), { statusCode: 400 });
  }
  if (end < start) {
    throw Object.assign(new Error('endTimestamp must be on or after startTimestamp'), { statusCode: 400 });
  }

  const span = calendarDaySpan(startDateKey, endDateKey);
  if (span === null) {
    throw Object.assign(new Error('startDateKey and endDateKey must use YYYY-MM-DD'), { statusCode: 400 });
  }
  if (span < 1 || span > env.maxSyncRangeDays) {
    throw Object.assign(
      new Error(`Date range cannot exceed ${env.maxSyncRangeDays} calendar days`),
      { statusCode: 400 },
    );
  }

  // Sanity check against forged/mistyped timestamp bounds while leaving room
  // for DST transitions and timezone-offset differences.
  if (end - start > env.maxSyncRangeDays * DAY_MS + 3 * 60 * 60 * 1000) {
    throw Object.assign(new Error('Timestamp range is inconsistent with the selected dates'), { statusCode: 400 });
  }

  return { start, end };
}

function isInRange(timestamp, range) {
  const value = Number(timestamp);
  return Number.isFinite(value) && value >= range.start && value <= range.end;
}

module.exports = { validateSyncRange, isInRange };
