import {CallLogEntry} from '../types/CallLog.types';
import {
  PreparedRecordingUpload,
} from '../types/Recording.types';
import {
  DateRange,
  RecordingCheckResult,
  RecordingSyncSummary,
  SyncProgress,
  SyncSummary,
} from '../types/Sync.types';
import {
  API_BASE_URL,
  API_KEY,
  RECORDING_SYNC_CHUNK_SIZE,
  REQUEST_TIMEOUT_MS,
  SYNC_CHUNK_SIZE,
  UPLOAD_TIMEOUT_MS,
} from '../config/apiConfig';

const MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  amr: 'audio/amr',
  wav: 'audio/wav',
  '3gp': 'audio/3gpp',
  aac: 'audio/aac',
};

function getMimeType(extension: string): string {
  return MIME_TYPES[extension.toLowerCase()] || 'application/octet-stream';
}

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function emptyCallSummary(): SyncSummary {
  return {
    totalReceived: 0,
    uploaded: 0,
    skippedDuplicates: 0,
    failed: 0,
    attachmentsUploaded: 0,
    attachmentFailed: 0,
    uploadedIds: [],
    duplicateIds: [],
    failedItems: [],
    errors: [],
  };
}

function mergeCallSummary(target: SyncSummary, incoming: SyncSummary): void {
  target.totalReceived += incoming.totalReceived;
  target.uploaded += incoming.uploaded;
  target.skippedDuplicates += incoming.skippedDuplicates;
  target.failed += incoming.failed;
  target.attachmentsUploaded += incoming.attachmentsUploaded || 0;
  target.attachmentFailed += incoming.attachmentFailed || 0;
  target.uploadedIds.push(...(incoming.uploadedIds || []));
  target.duplicateIds.push(...(incoming.duplicateIds || []));
  target.failedItems.push(...(incoming.failedItems || []));
  target.errors.push(...(incoming.errors || []));
}

function emptyRecordingSummary(): RecordingSyncSummary {
  return {
    totalReceived: 0,
    uploaded: 0,
    repaired: 0,
    skippedDuplicates: 0,
    failed: 0,
    uploadedHashes: [],
    repairedHashes: [],
    duplicateHashes: [],
    failedItems: [],
    errors: [],
  };
}

function mergeRecordingSummary(
  target: RecordingSyncSummary,
  incoming: RecordingSyncSummary,
): void {
  target.totalReceived += incoming.totalReceived;
  target.uploaded += incoming.uploaded;
  target.repaired += incoming.repaired;
  target.skippedDuplicates += incoming.skippedDuplicates;
  target.failed += incoming.failed;
  target.uploadedHashes.push(...(incoming.uploadedHashes || []));
  target.repairedHashes.push(...(incoming.repairedHashes || []));
  target.duplicateHashes.push(...(incoming.duplicateHashes || []));
  target.failedItems.push(...(incoming.failedItems || []));
  target.errors.push(...(incoming.errors || []));
}

class ApiServiceClass {
  /**
   * CALL LOG FLOW - UNCHANGED.
   *
   * Call logs continue to be deduplicated by Unique_Call_ID in the existing
   * call-log CRM module. No recording logic is mixed into this request.
   */
  async syncCalls(
    calls: CallLogEntry[],
    range: DateRange,
    onProgress?: (progress: SyncProgress) => void,
  ): Promise<SyncSummary> {
    const result = emptyCallSummary();
    let completed = 0;

    for (const chunk of chunkArray(calls, SYNC_CHUNK_SIZE)) {
      try {
        const chunkResult = await this.syncCallChunk(chunk, range);
        mergeCallSummary(result, chunkResult);
      } catch (error: any) {
        const message =
          error?.name === 'AbortError'
            ? 'A sync request timed out. Retry the same range; CRM deduplication makes retries safe.'
            : error?.message || 'Sync request failed.';

        result.totalReceived += chunk.length;
        result.failed += chunk.length;
        result.errors.push(message);
        result.failedItems.push(
          ...chunk.map(call => ({
            uniqueCallId: call.uniqueCallId,
            reason: message,
          })),
        );
      }

      completed += chunk.length;
      onProgress?.({completed, total: calls.length});
    }

    result.uploadedIds = Array.from(new Set(result.uploadedIds));
    result.duplicateIds = Array.from(new Set(result.duplicateIds));

    return result;
  }

  private async syncCallChunk(
    calls: CallLogEntry[],
    range: DateRange,
  ): Promise<SyncSummary> {
    const formData = new FormData();

    formData.append(
      'payload',
      JSON.stringify({
        startDateKey: range.startDateKey,
        endDateKey: range.endDateKey,
        startTimestamp: range.startTimestamp,
        endTimestamp: range.endTimestamp,
        calls: calls.map(call => ({
          id: call.id,
          remoteName: call.remoteName,
          remoteNumber: call.remoteNumber,
          callerName: call.callerName,
          callerNumber: call.callerNumber,
          receiverName: call.receiverName,
          receiverNumber: call.receiverNumber,
          callType: call.callType,
          duration: call.duration,
          timestamp: call.timestamp,
          uniqueCallId: call.uniqueCallId,
        })),
      }),
    );

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/calls/sync`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
          // Do not set multipart Content-Type manually.
        },
        body: formData,
      },
      UPLOAD_TIMEOUT_MS,
    );

    const json = await response.json().catch(() => ({}));

    if (!response.ok || json.success === false) {
      throw new Error(json.error || `Sync failed with HTTP ${response.status}`);
    }

    return {
      ...emptyCallSummary(),
      ...(json.data || {}),
      errors: json.data?.errors || [],
    };
  }

  /**
   * Checks the NEW independent recording CRM module before audio upload.
   *
   * The hashes are SHA-256 values of the actual file bytes. This means moving,
   * renaming, or seeing a different OEM file name does not create a duplicate.
   */
  async checkRecordings(recordingHashes: string[]): Promise<RecordingCheckResult> {
    const uniqueHashes = Array.from(
      new Set(recordingHashes.map(hash => String(hash).toLowerCase())),
    );

    if (uniqueHashes.length === 0) {
      return {
        syncedHashes: [],
        incompleteHashes: [],
        missingHashes: [],
        pendingHashes: [],
      };
    }

    const aggregate: RecordingCheckResult = {
      syncedHashes: [],
      incompleteHashes: [],
      missingHashes: [],
      pendingHashes: [],
    };

    for (const hashes of chunkArray(uniqueHashes, 50)) {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/recordings/check-synced`,
        {
          method: 'POST',
          headers: {
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({hashes}),
        },
        REQUEST_TIMEOUT_MS,
      );

      const json = await response.json().catch(() => ({}));

      if (!response.ok || json.success === false) {
        throw new Error(
          json.error || `Recording check failed with HTTP ${response.status}`,
        );
      }

      aggregate.syncedHashes.push(...(json.data?.syncedHashes || []));
      aggregate.incompleteHashes.push(...(json.data?.incompleteHashes || []));
      aggregate.missingHashes.push(...(json.data?.missingHashes || []));
      aggregate.pendingHashes.push(...(json.data?.pendingHashes || []));
    }

    aggregate.syncedHashes = Array.from(new Set(aggregate.syncedHashes));
    aggregate.incompleteHashes = Array.from(
      new Set(aggregate.incompleteHashes),
    );
    aggregate.missingHashes = Array.from(new Set(aggregate.missingHashes));
    aggregate.pendingHashes = Array.from(new Set(aggregate.pendingHashes));

    return aggregate;
  }

  /**
   * INDEPENDENT RECORDING FLOW.
   *
   * Each recording becomes a record in the new recording CRM module and the
   * actual audio file is attached to that recording record.
   *
   * There is intentionally NO CallLogEntry and NO RecordingMatcher here.
   */
  async syncRecordings(
    items: PreparedRecordingUpload[],
    onProgress?: (progress: SyncProgress) => void,
  ): Promise<RecordingSyncSummary> {
    const result = emptyRecordingSummary();
    let completed = 0;

    for (const chunk of chunkArray(items, RECORDING_SYNC_CHUNK_SIZE)) {
      try {
        const chunkResult = await this.syncRecordingChunk(chunk);
        mergeRecordingSummary(result, chunkResult);
      } catch (error: any) {
        const message =
          error?.name === 'AbortError'
            ? 'A recording upload request timed out. You can safely retry; CRM content-hash deduplication prevents duplicate records.'
            : error?.message || 'Recording upload failed.';

        result.totalReceived += chunk.length;
        result.failed += chunk.length;
        result.errors.push(message);
        result.failedItems.push(
          ...chunk.map(item => ({
            recordingHash: item.recordingHash,
            fileName: item.recording.fileName,
            reason: message,
          })),
        );
      }

      completed += chunk.length;
      onProgress?.({completed, total: items.length});
    }

    result.uploadedHashes = Array.from(new Set(result.uploadedHashes));
    result.repairedHashes = Array.from(new Set(result.repairedHashes));
    result.duplicateHashes = Array.from(new Set(result.duplicateHashes));

    return result;
  }

  private async syncRecordingChunk(
    items: PreparedRecordingUpload[],
  ): Promise<RecordingSyncSummary> {
    const formData = new FormData();

    const payloadRecordings = items.map(({recording, recordingHash}) => {
      const audioField = `audio_${recordingHash}`;

      return {
        clientId: recording.id,
        recordingHash,
        fileName: recording.fileName,
        fileSize: recording.fileSize,
        recordingTime: recording.recordingTime,
        extension: recording.extension,
        audioField,
      };
    });

    formData.append(
      'payload',
      JSON.stringify({recordings: payloadRecordings}),
    );

    items.forEach(({recording, recordingHash}) => {
      formData.append(
        `audio_${recordingHash}`,
        {
          uri: toFileUri(recording.filePath),
          name: recording.fileName,
          type: getMimeType(recording.extension),
        } as any,
      );
    });

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/recordings/sync`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
          // React Native adds the multipart boundary.
        },
        body: formData,
      },
      UPLOAD_TIMEOUT_MS,
    );

    const json = await response.json().catch(() => ({}));

    if (!response.ok || json.success === false) {
      throw new Error(
        json.error || `Recording sync failed with HTTP ${response.status}`,
      );
    }

    return {
      ...emptyRecordingSummary(),
      ...(json.data || {}),
      errors: json.data?.errors || [],
    };
  }

  /**
   * Existing CALL LOG visual status endpoint - unchanged.
   */
  async checkSynced(uniqueCallIds: string[]): Promise<{
    syncedIds: string[];
    missingIds: string[];
  }> {
    if (uniqueCallIds.length === 0) {
      return {syncedIds: [], missingIds: []};
    }

    const syncedIds: string[] = [];
    const missingIds: string[] = [];

    for (const ids of chunkArray(Array.from(new Set(uniqueCallIds)), 50)) {
      const query = encodeURIComponent(ids.join(','));
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/calls/check-synced?ids=${query}`,
        {
          method: 'GET',
          headers: {'X-API-Key': API_KEY},
        },
        REQUEST_TIMEOUT_MS,
      );

      const json = await response.json().catch(() => ({}));

      if (!response.ok || json.success === false) {
        throw new Error(json.error || `Check failed with HTTP ${response.status}`);
      }

      syncedIds.push(...(json.data?.syncedIds || []));
      missingIds.push(...(json.data?.missingIds || []));
    }

    return {syncedIds, missingIds};
  }
}

export const ApiService = new ApiServiceClass();
