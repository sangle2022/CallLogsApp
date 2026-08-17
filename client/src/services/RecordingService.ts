/**
 * RecordingService.ts
 *
 * Discovers audio files from the selected recording folder OR from the
 * existing known OEM recording folders.
 *
 * IMPORTANT:
 * - This service does NOT try to match recordings with Android call logs.
 * - The CRM duplicate key is SHA-256 of the actual audio file content.
 * - If the user has selected a custom recording folder in Settings, only that
 *   folder is scanned.
 * - The selected/default folder is scanned RECURSIVELY, so recordings stored
 *   inside one or more child folders are also discovered.
 * - If no custom folder is configured, the existing default/OEM folder scan
 *   continues unchanged.
 */
import {Platform} from 'react-native';
import RNFS, {ReadDirItem} from 'react-native-fs';
import {CallRecordingFile} from '../types/Recording.types';
import {
  AUDIO_EXTENSIONS,
  CALL_RECORDING_DIRECTORIES,
} from '../utils/constants';
import {getFileExtension} from '../utils/formatters';
import {RecordingPathService} from './RecordingPathService';

/**
 * Prevents an accidentally selected very broad folder from causing an
 * effectively unlimited directory walk.
 *
 * ACR/OEM layouts normally need only a few levels, so 12 is intentionally
 * generous while still protecting the app from pathological folder trees.
 */
const MAX_SCAN_DEPTH = 12;
const MAX_DIRECTORIES_PER_ROOT = 5000;

type DirectoryQueueItem = {
  path: string;
  depth: number;
};

class RecordingServiceClass {
  private runtimeDirectories = new Set<string>();

  async scanCallRecordings(): Promise<CallRecordingFile[]> {
    if (Platform.OS !== 'android') {
      console.warn(
        '[RecordingService] Recording folder scan is only available on Android.',
      );
      return [];
    }

    const customDirectory = await RecordingPathService.getCustomDirectory();

    const directories = customDirectory
      ? [customDirectory]
      : Array.from(
          new Set([
            ...CALL_RECORDING_DIRECTORIES,
            ...Array.from(this.runtimeDirectories),
          ]),
        );

    console.log(
      `[RecordingService] Scan mode: ${
        customDirectory ? 'custom folder' : 'automatic/default folders'
      }`,
    );
    console.log(
      '[RecordingService] Recursively scanning',
      directories.length,
      'root folder(s)',
    );

    const results: CallRecordingFile[] = [];

    for (const directory of directories) {
      const rootResults = await this.scanDirectoryRecursively(directory);
      results.push(...rootResults);
    }

    /**
     * The same file can occasionally be reachable through overlapping root
     * folders. Keep only one entry per physical file path.
     */
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
   * Walks the selected/root folder and all readable child folders.
   *
   * Example ACR structure:
   *
   * /ACRPhone/
   *   ├── Call_1/
   *   │     └── recording_1.m4a
   *   ├── Call_2/
   *   │     └── recording_2.m4a
   *   └── Call_3/
   *         └── nested/
   *               └── recording_3.m4a
   *
   * The recording screen still receives ONLY audio files. Folder entries are
   * used only for traversal and are not shown as recording rows.
   */
  private async scanDirectoryRecursively(
    rootDirectory: string,
  ): Promise<CallRecordingFile[]> {
    const results: CallRecordingFile[] = [];
    const visited = new Set<string>();
    const queue: DirectoryQueueItem[] = [
      {
        path: this.normalizeDirectoryPath(rootDirectory),
        depth: 0,
      },
    ];

    let visitedDirectoryCount = 0;

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }

      const currentPath = this.normalizeDirectoryPath(current.path);

      if (!currentPath || visited.has(currentPath)) {
        continue;
      }

      if (current.depth > MAX_SCAN_DEPTH) {
        console.warn(
          `[RecordingService] Maximum scan depth reached at ${currentPath}`,
        );
        continue;
      }

      if (visitedDirectoryCount >= MAX_DIRECTORIES_PER_ROOT) {
        console.warn(
          `[RecordingService] Directory scan limit reached under ${rootDirectory}`,
        );
        break;
      }

      visited.add(currentPath);
      visitedDirectoryCount += 1;

      try {
        const exists = await RNFS.exists(currentPath);

        if (!exists) {
          if (current.depth === 0) {
            console.log(`[RecordingService] missing -> ${currentPath}`);
          }
          continue;
        }

        if (current.depth === 0) {
          console.log(`[RecordingService] FOUND -> ${currentPath}`);
        }

        const entries = await RNFS.readDir(currentPath);

        console.log(
          `[RecordingService] ${entries.length} entries -> ${currentPath}`,
        );

        for (const entry of entries) {
          if (entry.isDirectory()) {
            queue.push({
              path: entry.path,
              depth: current.depth + 1,
            });
            continue;
          }

          if (!entry.isFile()) {
            continue;
          }

          const recording = this.mapAudioFile(entry);
          if (recording) {
            results.push(recording);
          }
        }
      } catch (error) {
        /**
         * One protected/unreadable child folder must not stop discovery in
         * the rest of the tree.
         */
        console.warn(
          `[RecordingService] Could not read "${currentPath}":`,
          error,
        );
      }
    }

    return results;
  }

  private mapAudioFile(file: ReadDirItem): CallRecordingFile | null {
    const extension = getFileExtension(file.name);

    if (!AUDIO_EXTENSIONS.includes(extension)) {
      return null;
    }

    /**
     * ctime is frequently null/unreliable on Android shared storage.
     * mtime is the most consistently available timestamp, so it is the
     * timestamp stored in our independent CRM recording record.
     */
    const recordingTime =
      file.mtime?.getTime?.() || file.ctime?.getTime?.() || 0;

    return {
      id: this.buildId(file.path),
      fileName: file.name,
      filePath: file.path,
      fileSize: Number(file.size) || 0,
      recordingTime,
      extension,
    };
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

  /**
   * Kept for backward compatibility with any existing code that may add a
   * temporary scan directory at runtime. Persisted user selection should use
   * RecordingPathService instead.
   */
  addCustomDirectory(path: string): void {
    const normalized = String(path || '').trim();
    if (normalized) {
      this.runtimeDirectories.add(normalized);
    }
  }

  private normalizeDirectoryPath(path: string): string {
    let normalized = String(path || '').trim();

    while (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
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
