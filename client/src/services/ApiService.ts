import { CallLogEntry } from '../types/CallLog.types';
import { CallRecordingFile } from '../types/Recording.types';
import { DateRange, SyncProgress, SyncSummary } from '../types/Sync.types';
import {
  API_BASE_URL,
  API_KEY,
  SYNC_CHUNK_SIZE,
  UPLOAD_TIMEOUT_MS,
} from '../config/apiConfig';
import { RecordingMatcher } from './RecordingMatcher';

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
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
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
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function emptySummary(): SyncSummary {
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

function mergeSummary(target: SyncSummary, incoming: SyncSummary): void {
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

interface PreparedCall {
  call: CallLogEntry;
  recording: CallRecordingFile | null;
}

class ApiServiceClass {
  async syncCalls(
    calls: CallLogEntry[],
    range: DateRange,
    recordings: CallRecordingFile[],
    onProgress?: (progress: SyncProgress) => void,
  ): Promise<SyncSummary> {
    const usedRecordingPaths = new Set<string>();
    const prepared: PreparedCall[] = calls.map(call => {
      const recording = RecordingMatcher.findMatchForCall(
        call,
        recordings,
        usedRecordingPaths,
      );
      if (recording) usedRecordingPaths.add(recording.filePath);
      return { call, recording };
    });

    const result = emptySummary();
    let completed = 0;

    for (const chunk of chunkArray(prepared, SYNC_CHUNK_SIZE)) {
      try {
        const chunkResult = await this.syncChunk(chunk, range);
        mergeSummary(result, chunkResult);
      } catch (error: any) {
        const message =
          error?.name === 'AbortError'
            ? 'A sync request timed out. Retry the same range; CRM deduplication makes retries safe.'
            : error?.message || 'Sync request failed.';

        result.totalReceived += chunk.length;
        result.failed += chunk.length;
        result.errors.push(message);
        result.failedItems.push(
          ...chunk.map(item => ({
            uniqueCallId: item.call.uniqueCallId,
            reason: message,
          })),
        );
      }

      completed += chunk.length;
      onProgress?.({ completed, total: prepared.length });
    }

    result.uploadedIds = Array.from(new Set(result.uploadedIds));
    result.duplicateIds = Array.from(new Set(result.duplicateIds));
    return result;
  }

  private async syncChunk(
    items: PreparedCall[],
    range: DateRange,
  ): Promise<SyncSummary> {
    const formData = new FormData();

    const payloadCalls = items.map(({ call, recording }) => ({
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
      audioField: recording ? `audio_${call.uniqueCallId}` : null,
    }));

    formData.append(
      'payload',
      JSON.stringify({
        startDateKey: range.startDateKey,
        endDateKey: range.endDateKey,
        startTimestamp: range.startTimestamp,
        endTimestamp: range.endTimestamp,
        calls: payloadCalls,
      }),
    );

    items.forEach(({ call, recording }) => {
      if (!recording) return;
      formData.append(
        `audio_${call.uniqueCallId}`,
        {
          uri: toFileUri(recording.filePath),
          name: recording.fileName,
          type: getMimeType(recording.extension),
        } as any,
      );
    });

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/calls/sync`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
          // Do not set Content-Type here. React Native supplies the multipart
          // boundary automatically for FormData.
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
      ...emptySummary(),
      ...(json.data || {}),
      errors: json.data?.errors || [],
    };
  }

  async checkSynced(uniqueCallIds: string[]): Promise<{
    syncedIds: string[];
    missingIds: string[];
  }> {
    if (uniqueCallIds.length === 0) {
      return { syncedIds: [], missingIds: [] };
    }

    const syncedIds: string[] = [];
    const missingIds: string[] = [];
    for (const ids of chunkArray(Array.from(new Set(uniqueCallIds)), 50)) {
      const query = encodeURIComponent(ids.join(','));
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/calls/check-synced?ids=${query}`,
        {
          method: 'GET',
          headers: { 'X-API-Key': API_KEY },
        },
        UPLOAD_TIMEOUT_MS,
      );

      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.success === false) {
        throw new Error(json.error || `Check failed with HTTP ${response.status}`);
      }
      syncedIds.push(...(json.data?.syncedIds || []));
      missingIds.push(...(json.data?.missingIds || []));
    }
    return { syncedIds, missingIds };
  }
}

export const ApiService = new ApiServiceClass();
