/**
 * RecordingService.ts
 *
 * Discovers audio files from known OEM recording folders.
 *
 * IMPORTANT:
 * - This service does NOT try to match recordings with Android call logs.
 * - The CRM duplicate key is SHA-256 of the actual audio file content.
 */
import {Platform} from 'react-native';
import RNFS from 'react-native-fs';
import {CallRecordingFile} from '../types/Recording.types';
import {
  AUDIO_EXTENSIONS,
  CALL_RECORDING_DIRECTORIES,
} from '../utils/constants';
import {getFileExtension} from '../utils/formatters';

class RecordingServiceClass {
  async scanCallRecordings(): Promise<CallRecordingFile[]> {
    if (Platform.OS !== 'android') {
      console.warn(
        '[RecordingService] Recording folder scan is only available on Android.',
      );
      return [];
    }

    console.log(
      '[RecordingService] Scanning',
      CALL_RECORDING_DIRECTORIES.length,
      'directories...',
    );

    const results: CallRecordingFile[] = [];

    for (const directory of CALL_RECORDING_DIRECTORIES) {
      try {
        const exists = await RNFS.exists(directory);
        console.log(
          `[RecordingService] ${exists ? 'FOUND' : 'missing'} -> ${directory}`,
        );

        if (!exists) {
          continue;
        }

        const files = await RNFS.readDir(directory);
        console.log(
          `[RecordingService]   ${files.length} entries in ${directory}`,
        );

        for (const file of files) {
          if (!file.isFile()) {
            continue;
          }

          const extension = getFileExtension(file.name);
          if (!AUDIO_EXTENSIONS.includes(extension)) {
            continue;
          }

          /**
           * ctime is frequently null/unreliable on Android shared storage.
           * mtime is the most consistently available timestamp, so it is the
           * timestamp stored in our independent CRM recording record.
           */
          const recordingTime =
            file.mtime?.getTime?.() || file.ctime?.getTime?.() || 0;

          results.push({
            id: this.buildId(file.path),
            fileName: file.name,
            filePath: file.path,
            fileSize: Number(file.size) || 0,
            recordingTime,
            extension,
          });
        }
      } catch (error) {
        console.warn(
          `[RecordingService] Error reading "${directory}":`,
          error,
        );
      }
    }

    const uniqueByPath = Array.from(
      new Map(results.map(item => [item.filePath, item])).values(),
    );

    uniqueByPath.sort((a, b) => b.recordingTime - a.recordingTime);

    console.log(
      '[RecordingService] Total audio files found:',
      uniqueByPath.length,
    );

    return uniqueByPath;
  }

  /**
   * Native SHA-256 calculation over the actual file bytes.
   *
   * This is intentionally NOT based on file name/path/time/size. Two files
   * with identical audio bytes therefore resolve to the same CRM duplicate ID
   * even if the user moves or renames the file.
   */
  async hashRecording(recording: CallRecordingFile): Promise<string> {
    const hash = await RNFS.hash(recording.filePath, 'sha256');
    const normalized = String(hash || '').toLowerCase();

    if (!/^[a-f0-9]{64}$/.test(normalized)) {
      throw new Error(`Could not calculate SHA-256 for ${recording.fileName}`);
    }

    return normalized;
  }

  addCustomDirectory(path: string): void {
    const normalized = String(path || '').trim();
    if (normalized && !CALL_RECORDING_DIRECTORIES.includes(normalized)) {
      CALL_RECORDING_DIRECTORIES.push(normalized);
    }
  }

  private buildId(path: string): string {
    let hash = 0;

    for (let index = 0; index < path.length; index += 1) {
      hash = (hash << 5) - hash + path.charCodeAt(index);
      hash |= 0;
    }

    return `rec-${Math.abs(hash)}`;
  }
}

export const RecordingService = new RecordingServiceClass();
