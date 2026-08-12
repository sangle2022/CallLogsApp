/**
 * ApiService.ts
 * -----------------------------------------------------------------------
 * Single place that talks to the Catalyst backend. Screens/hooks never
 * call fetch() directly - they call methods here. This keeps auth
 * headers, timeouts, error handling, and endpoint paths in one file, so
 * changing the backend contract later never touches UI code.
 * -----------------------------------------------------------------------
 */
import { CallLogEntry } from '../types/CallLog.types';
import { CallRecordingFile } from '../types/Recording.types';
import {
  API_BASE_URL,
  API_KEY,
  REQUEST_TIMEOUT_MS,
  UPLOAD_TIMEOUT_MS,
  CALL_LOGS_CHUNK_SIZE,
} from '../config/apiConfig';

export interface UploadProgress {
  completed: number;
  total: number;
}

export interface UploadOutcome {
  successCount: number;
  failedCount: number;
  errors: string[];
}

// Maps a file extension to a reasonable MIME type for the upload request.
// Falls back to a generic binary type if unrecognised - the backend
// validates by extension too, so this doesn't need to be exhaustive.
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

// Ensures a device file path has the `file://` scheme React Native's
// fetch/FormData implementation expects for local file uploads.
function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/** Wraps fetch with a timeout, since RN's fetch has no built-in timeout. */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

class ApiServiceClass {
  /** POSTs a JSON body and returns the parsed response, throwing on any failure. */
  private async postJson<T>(path: string, body: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
    let response: Response;
    try {
      response = await fetchWithTimeout(
        `${API_BASE_URL}${path}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
          },
          body: JSON.stringify(body),
        },
        timeoutMs,
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Check your connection and try again.');
      }
      throw new Error(`Network error: ${err.message}`);
    }

    const json = await response.json().catch(() => ({}));

    if (!response.ok || json.success === false) {
      throw new Error(json.error || `Request failed with status ${response.status}`);
    }

    return json.data as T;
  }

  /**
   * Uploads call log entries in chunks (so one very large sync doesn't
   * send a single huge request), reporting progress after each chunk.
   */
  async uploadCallLogs(
    logs: CallLogEntry[],
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<UploadOutcome> {
    const chunks = chunkArray(logs, CALL_LOGS_CHUNK_SIZE);
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    let completed = 0;

    for (const chunk of chunks) {
      try {
        const result = await this.postJson<{ inserted: number; skipped: unknown[]; failed: unknown[] }>(
          '/call-logs',
          { logs: chunk },
        );
        successCount += result.inserted;
        failedCount += chunk.length - result.inserted;
      } catch (err: any) {
        failedCount += chunk.length;
        errors.push(err.message);
      }

      completed += chunk.length;
      onProgress?.({ completed, total: logs.length });
    }

    return { successCount, failedCount, errors };
  }

  /**
   * Uploads a single recording's audio file + metadata to the backend,
   * which creates the CRM record AND attaches the audio in one call.
   * Uses RN's native ability to stream a local file by URI reference
   * (no manual base64 read into memory - keeps this fast and light even
   * for larger audio files).
   */
  private async uploadSingleRecording(recording: CallRecordingFile): Promise<void> {
    const formData = new FormData();

    // for local files; this is the standard RN pattern, not a mistake.
    formData.append('file', {
      uri: toFileUri(recording.filePath),
      name: recording.fileName,
      type: getMimeType(recording.extension),
    });
    formData.append('fileName', recording.fileName);
    formData.append('filePath', recording.filePath);
    formData.append('fileSize', String(recording.fileSize));
    formData.append('createdDate', String(recording.createdDate));
    formData.append('extension', recording.extension);

    let response: Response;
    try {
      response = await fetchWithTimeout(
        `${API_BASE_URL}/call-recordings/upload`,
        {
          method: 'POST',
          headers: {
            'X-API-Key': API_KEY,
            // Do NOT set Content-Type manually - RN's fetch sets the
            // multipart boundary automatically from the FormData object.
          },
          body: formData,
        },
        UPLOAD_TIMEOUT_MS,
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Upload timed out for "${recording.fileName}"`);
      }
      throw new Error(`Network error uploading "${recording.fileName}": ${err.message}`);
    }

    const json = await response.json().catch(() => ({}));

    if (!response.ok || json.success === false) {
      throw new Error(json.error || `Upload failed for "${recording.fileName}"`);
    }
  }

  /**
   * Uploads recordings ONE AT A TIME (not in parallel).
   * This is deliberate: parallel multipart uploads of potentially large
   * audio files would spike memory/network usage and could stall the UI
   * thread on lower-end devices. Sequential uploads keep memory flat and
   * let us report clean per-file progress.
   */
  async uploadRecordings(
    recordings: CallRecordingFile[],
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<UploadOutcome> {
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < recordings.length; i += 1) {
      try {
        await this.uploadSingleRecording(recordings[i]);
        successCount += 1;
      } catch (err: any) {
        failedCount += 1;
        errors.push(err.message);
      }
      onProgress?.({ completed: i + 1, total: recordings.length });
    }

    return { successCount, failedCount, errors };
  }
}

export const ApiService = new ApiServiceClass();