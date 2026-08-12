/**
 * Recording.types.ts
 * Type definitions for call recording files discovered on device storage.
 */

export interface CallRecordingFile {
  id: string;          // Generated unique id (hash of path)
  fileName: string;
  filePath: string;
  fileSize: number;     // Size in bytes
  createdDate: number;  // Epoch millis
  extension: string;    // e.g. mp3, m4a, amr, wav
}
