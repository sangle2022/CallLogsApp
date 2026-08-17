import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Visual-only persistence for recording sync status.
 *
 * IMPORTANT:
 * - This does NOT decide whether a recording should be uploaded.
 * - CRM + Recording_Hash remain the authoritative duplicate source.
 * - This only remembers which local recording rows should show SYNCED after
 *   navigating away from/reopening the Recordings screen.
 */
const STORAGE_KEY = '@call_logs/recording_visual_sync_status/v1';
const MAX_STORED_IDS = 5000;

type StoredStatus = Record<string, number>; // recording.id -> acknowledged time

async function readAll(): Promise<StoredStatus> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn(
      '[RecordingSyncStatusService] Failed to read local sync status:',
      error,
    );
    return {};
  }
}

class RecordingSyncStatusServiceClass {
  async markAcknowledged(recordingIds: string[]): Promise<void> {
    const validIds = recordingIds.filter(Boolean);

    if (validIds.length === 0) {
      return;
    }

    const current = await readAll();
    const now = Date.now();

    validIds.forEach(id => {
      current[id] = now;
    });

    const trimmed = Object.entries(current)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_STORED_IDS);

    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Object.fromEntries(trimmed)),
      );
    } catch (error) {
      console.warn(
        '[RecordingSyncStatusService] Failed to save local sync status:',
        error,
      );
    }
  }

  async getAcknowledgedSet(recordingIds: string[]): Promise<Set<string>> {
    const current = await readAll();

    return new Set(
      recordingIds.filter(id => Boolean(id) && Boolean(current[id])),
    );
  }
}

export const RecordingSyncStatusService =
  new RecordingSyncStatusServiceClass();
