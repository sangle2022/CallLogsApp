import { DateRange } from '../types/Sync.types';
import { MAX_SYNC_RANGE_DAYS } from '../config/syncConfig';

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateKeyParts(dateKey: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    throw new Error(`Invalid date: ${dateKey}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function calendarDaySpan(startDateKey: string, endDateKey: string): number {
  const [sy, sm, sd] = parseDateKeyParts(startDateKey);
  const [ey, em, ed] = parseDateKeyParts(endDateKey);
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  return Math.floor((endUtc - startUtc) / DAY_MS) + 1;
}

export function buildDateRange(
  startDateKey: string,
  endDateKey: string,
  maxDays = MAX_SYNC_RANGE_DAYS,
): DateRange {
  const span = calendarDaySpan(startDateKey, endDateKey);
  if (span < 1) {
    throw new Error('End date must be on or after start date.');
  }
  if (span > maxDays) {
    throw new Error(`Choose a date range of ${maxDays} days or less.`);
  }

  const [sy, sm, sd] = parseDateKeyParts(startDateKey);
  const [ey, em, ed] = parseDateKeyParts(endDateKey);

  const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
  const end = new Date(ey, em - 1, ed, 23, 59, 59, 999);

  return {
    startDateKey,
    endDateKey,
    startTimestamp: start.getTime(),
    endTimestamp: end.getTime(),
  };
}


export function todayDateKey(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isTimestampInRange(timestamp: number, range: DateRange): boolean {
  return timestamp >= range.startTimestamp && timestamp <= range.endTimestamp;
}
