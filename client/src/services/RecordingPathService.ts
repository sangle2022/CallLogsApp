/**
 * RecordingPathService.ts
 *
 * Stores the user's preferred call-recording folder locally on the device.
 *
 * Behaviour:
 * - If a custom folder is saved, RecordingService scans that folder only.
 * - If no custom folder is saved, the existing OEM/default folder list is used.
 * - Clearing the custom folder restores the existing automatic/default logic.
 *
 * The Android directory picker returns a Storage Access Framework tree URI.
 * For the app's existing RNFS-based scanner we convert Internal Storage
 * (primary storage) tree URIs to the normal /storage/emulated/0/... path.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import RNFS from 'react-native-fs';
import {
  errorCodes,
  isErrorWithCode,
  pickDirectory,
} from '@react-native-documents/picker';

const STORAGE_KEY = '@call_logs/recording_directory/v1';

type StoredRecordingDirectory = {
  path: string;
  savedAt: number;
};

type ChangeListener = () => void;

class RecordingPathServiceClass {
  private listeners = new Set<ChangeListener>();

  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async getCustomDirectory(): Promise<string | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return null;
      }

      // Backward-compatible in case a plain string was ever stored manually.
      if (!stored.trim().startsWith('{')) {
        return this.normalizePath(stored) || null;
      }

      const parsed = JSON.parse(stored) as Partial<StoredRecordingDirectory>;
      return this.normalizePath(parsed.path || '') || null;
    } catch (error) {
      console.warn(
        '[RecordingPathService] Could not read custom recording directory:',
        error,
      );
      return null;
    }
  }

  async saveCustomDirectory(path: string): Promise<string> {
    const normalized = this.normalizePath(path);

    if (!normalized) {
      throw new Error('Please select or enter a recording folder.');
    }

    const exists = await RNFS.exists(normalized);
    if (!exists) {
      throw new Error(
        'The selected recording folder could not be accessed. Please select a folder from Internal storage that exists and is accessible to the app.',
      );
    }

    const value: StoredRecordingDirectory = {
      path: normalized,
      savedAt: Date.now(),
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    this.notifyListeners();

    return normalized;
  }

  async clearCustomDirectory(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
    this.notifyListeners();
  }

  /**
   * Opens Android's system directory picker.
   *
   * Returns:
   * - selected physical path when a folder is chosen and saved
   * - null when the user cancels the picker
   */
  async chooseCustomDirectory(): Promise<string | null> {
    if (Platform.OS !== 'android') {
      throw new Error('Recording folder selection is currently Android-only.');
    }

    try {
      const result = await pickDirectory();
      const physicalPath = this.androidTreeUriToPhysicalPath(result.uri);

      if (!physicalPath) {
        throw new Error(
          'This folder cannot be converted to a normal Android file path. Please select a folder under Internal storage, or enter the exact path manually.',
        );
      }

      return await this.saveCustomDirectory(physicalPath);
    } catch (error) {
      if (
        isErrorWithCode(error) &&
        error.code === errorCodes.OPERATION_CANCELED
      ) {
        return null;
      }

      throw error;
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        console.warn(
          '[RecordingPathService] Recording path listener failed:',
          error,
        );
      }
    }
  }

  private normalizePath(path: string): string {
    let normalized = String(path || '').trim();

    if (normalized.startsWith('file://')) {
      normalized = normalized.slice('file://'.length);
    }

    // Keep root paths intact while removing accidental trailing slashes.
    while (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  /**
   * Example Android tree URI:
   * content://com.android.externalstorage.documents/tree/primary%3ACall
   *
   * becomes:
   * /storage/emulated/0/Call
   *
   * We intentionally support primary/internal shared storage here. Other
   * providers may expose virtual locations where a normal RNFS path does not
   * exist. Those can still be entered manually if the user knows a real path.
   */
  private androidTreeUriToPhysicalPath(uri: string): string | null {
    let decoded = String(uri || '');

    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      // Keep the original value if decoding fails.
    }

    const treeMarker = '/tree/';
    const treeIndex = decoded.indexOf(treeMarker);

    if (treeIndex < 0) {
      return null;
    }

    let treeId = decoded.slice(treeIndex + treeMarker.length);

    const documentMarkerIndex = treeId.indexOf('/document/');
    if (documentMarkerIndex >= 0) {
      treeId = treeId.slice(0, documentMarkerIndex);
    }

    const queryIndex = treeId.indexOf('?');
    if (queryIndex >= 0) {
      treeId = treeId.slice(0, queryIndex);
    }

    if (treeId === 'primary:' || treeId.startsWith('primary:')) {
      const relativePath = treeId.slice('primary:'.length);
      const basePath = RNFS.ExternalStorageDirectoryPath;

      return this.normalizePath(
        relativePath ? `${basePath}/${relativePath}` : basePath,
      );
    }

    if (treeId.startsWith('raw:')) {
      return this.normalizePath(treeId.slice('raw:'.length));
    }

    return null;
  }
}

export const RecordingPathService = new RecordingPathServiceClass();
