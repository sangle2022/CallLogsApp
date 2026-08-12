/**
 * dateFilters.ts
 * Pure, framework-agnostic helpers for filtering records by date range.
 * Used by the upload flow to implement "Today" / "All" / "Custom (last N
 * days)" without any extra network calls - filtering happens on data
 * already loaded on-device.
 */

export type UploadRange = 'TODAY' | 'ALL' | 'CUSTOM';

/** Returns true if `timestamp` (epoch ms) falls within the given range. */
export function isWithinRange(
  timestamp: number,
  range: UploadRange,
  customDays?: number,
): boolean {
  if (range === 'ALL') return true;

  if (range === 'TODAY') {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return timestamp >= startOfToday.getTime();
  }

  if (range === 'CUSTOM') {
    const days = customDays && customDays > 0 ? customDays : 1;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return timestamp >= cutoff;
  }

  return true;
}

/**
 * Filters a list of items by date range using a caller-supplied timestamp
 * accessor, so this works for both CallLogEntry (timestamp) and
 * CallRecordingFile (createdDate) without duplicating logic.
 */
export function filterByRange<T>(
  items: T[],
  getTimestamp: (item: T) => number,
  range: UploadRange,
  customDays?: number,
): T[] {
  return items.filter(item => isWithinRange(getTimestamp(item), range, customDays));
}