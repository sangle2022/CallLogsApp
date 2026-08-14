import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@call_logs/visual_sync_status/v1';
const MAX_STORED_IDS = 5000;

type StoredStatus = Record<string, number>; // uniqueCallId -> last acknowledged time

async function readAll(): Promise<StoredStatus> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

class SyncStatusServiceClass {
  /**
   * Visual-only state. Never use this to decide whether a call should be sent.
   * Zoho CRM remains the dedupe source of truth.
   */
  async markAcknowledged(uniqueCallIds: string[]): Promise<void> {
    if (uniqueCallIds.length === 0) return;
    const current = await readAll();
    const now = Date.now();
    uniqueCallIds.forEach(id => {
      if (id) current[id] = now;
    });

    const trimmed = Object.entries(current)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_STORED_IDS);

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(trimmed)));
  }

  async getAcknowledgedSet(uniqueCallIds: string[]): Promise<Set<string>> {
    const current = await readAll();
    return new Set(uniqueCallIds.filter(id => Boolean(current[id])));
  }
}

export const SyncStatusService = new SyncStatusServiceClass();
