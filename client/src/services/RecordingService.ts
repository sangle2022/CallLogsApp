/**
 * RecordingService.ts
 * CHANGE: added console.log diagnostics so you can see in Metro/logcat
 * exactly which folders were checked, which exist, and how many audio
 * files were found in each — this tells you immediately whether the
 * issue is "folder doesn't exist on this device/emulator" vs
 * "permission blocked" vs "no audio files in the folder".
 */
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { CallRecordingFile } from '../types/Recording.types';
import { AUDIO_EXTENSIONS, CALL_RECORDING_DIRECTORIES } from '../utils/constants';
import { getFileExtension } from '../utils/formatters';

class RecordingServiceClass {
  async scanCallRecordings(): Promise<CallRecordingFile[]> {
    if (Platform.OS !== 'android') {
      console.warn('[RecordingService] Recording scan is only available on Android.');
      return [];
    }

    console.log('[RecordingService] Scanning', CALL_RECORDING_DIRECTORIES.length, 'directories...');
    const results: CallRecordingFile[] = [];

    for (const directory of CALL_RECORDING_DIRECTORIES) {
      try {
        const exists = await RNFS.exists(directory);
        console.log(`[RecordingService] ${exists ? 'FOUND' : 'missing'} -> ${directory}`);
        if (!exists) continue;

        const files = await RNFS.readDir(directory);
        console.log(`[RecordingService]   ${files.length} entries in ${directory}`);

        for (const file of files) {
          if (!file.isFile()) continue;
          const extension = getFileExtension(file.name);
          if (!AUDIO_EXTENSIONS.includes(extension)) continue;

          results.push({
            id: this.buildId(file.path),
            fileName: file.name,
            filePath: file.path,
            fileSize: Number(file.size) || 0,
            createdDate: file.mtime ? file.mtime.getTime() : Date.now(),
            extension,
          });
        }
      } catch (error) {
        console.warn(`[RecordingService] Error reading "${directory}":`, error);
      }
    }

    console.log('[RecordingService] Total audio files found:', results.length);

    const uniqueByPath = Array.from(new Map(results.map(item => [item.filePath, item])).values());
    uniqueByPath.sort((a, b) => b.createdDate - a.createdDate);
    return uniqueByPath;
  }

  addCustomDirectory(path: string): void {
    if (!CALL_RECORDING_DIRECTORIES.includes(path)) {
      CALL_RECORDING_DIRECTORIES.push(path);
    }
  }

  private buildId(path: string): string {
    let hash = 0;
    for (let i = 0; i < path.length; i += 1) {
      hash = (hash << 5) - hash + path.charCodeAt(i);
      hash |= 0;
    }
    return `rec-${Math.abs(hash)}`;
  }
}

export const RecordingService = new RecordingServiceClass();