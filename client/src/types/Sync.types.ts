export interface DateRange {
  startDateKey: string; // YYYY-MM-DD, device-local calendar day
  endDateKey: string;
  startTimestamp: number; // inclusive
  endTimestamp: number; // inclusive
}

export interface SyncProgress {
  completed: number;
  total: number;
}

export interface SyncFailedItem {
  uniqueCallId?: string;
  recordingHash?: string;
  fileName?: string;
  reason: string;
}

/** Call-log metadata sync result. DO NOT change this flow. */
export interface SyncSummary {
  totalReceived: number;
  uploaded: number;
  skippedDuplicates: number;
  failed: number;
  attachmentsUploaded: number;
  attachmentFailed: number;
  uploadedIds: string[];
  duplicateIds: string[];
  failedItems: SyncFailedItem[];
  errors: string[];
}

/**
 * Independent recording-module sync result.
 * Recordings do not reference or match call logs.
 */
export interface RecordingSyncSummary {
  totalReceived: number;
  uploaded: number;
  repaired: number;
  skippedDuplicates: number;
  failed: number;
  uploadedHashes: string[];
  repairedHashes: string[];
  duplicateHashes: string[];
  failedItems: SyncFailedItem[];
  errors: string[];
}

export interface RecordingCheckResult {
  /** Recording exists in CRM and its audio attachment is present. */
  syncedHashes: string[];

  /** Exists in CRM but the prior attachment upload did not complete. */
  incompleteHashes: string[];

  /** Does not yet have a CRM record. */
  missingHashes: string[];

  /** incompleteHashes + missingHashes */
  pendingHashes: string[];
}
