/**
 * Recording.types.ts
 *
 * Recording files are now managed independently from Android call logs.
 * No recording -> call-log matching is performed.
 */

export interface CallRecordingFile {
  /** Local UI identifier. This is NOT the CRM dedupe key. */
  id: string;

  /** File name exactly as it exists on the device. */
  fileName: string;

  /** Absolute local path used to play/upload the file. */
  filePath: string;

  /** File size in bytes from the device file system. */
  fileSize: number;

  /**
   * Best available file timestamp in epoch milliseconds.
   * Android recording folders do not consistently expose ctime, so we use
   * mtime first and ctime only as a fallback.
   */
  recordingTime: number;

  /** Lowercase extension without the leading dot. */
  extension: string;
}

/**
 * A recording prepared for upload.
 * recordingHash is SHA-256 of the actual AUDIO FILE CONTENT.
 * CRM uses it as the authoritative duplicate key.
 */
export interface PreparedRecordingUpload {
  recording: CallRecordingFile;
  recordingHash: string;
}
