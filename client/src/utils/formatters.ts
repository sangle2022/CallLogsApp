/**
 * formatters.ts
 * Small, pure formatting helpers used across screens/components.
 * Kept framework-agnostic so they're easy to unit test.
 */

/** Formats a duration given in seconds as "Hh Mm Ss" / "Mm Ss" / "Ss". */
export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0s';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);

  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/** Formats an epoch-millis timestamp as a locale-aware date + time string. */
export function formatDateTime(timestampMs: number): string {
  if (!timestampMs) return '-';
  const date = new Date(timestampMs);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Formats a byte count as a human-readable size (KB/MB/GB). */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/** Extracts the file extension (lowercase, no dot) from a file name/path. */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}
