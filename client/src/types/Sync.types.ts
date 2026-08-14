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
  reason: string;
}

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
