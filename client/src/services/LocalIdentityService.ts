import AsyncStorage from '@react-native-async-storage/async-storage';

import { LocalIdentity } from '../types/CallLog.types';
import {
  isIdentityValid,
  normalizePhoneNumber,
} from '../utils/localIdentityValidation';

const STORAGE_KEY = '@call_logs/local_identity/v2';

function sanitizeIdentity(identity: LocalIdentity): LocalIdentity {
  return {
    name: String(identity.name || '').trim(),
    phoneNumber: normalizePhoneNumber(identity.phoneNumber),
  };
}

class LocalIdentityServiceClass {
  async getLocalIdentity(): Promise<LocalIdentity | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);

      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored) as LocalIdentity;
      const identity = sanitizeIdentity(parsed);

      // If old/corrupted data exists, don't use it.
      if (!isIdentityValid(identity)) {
        await AsyncStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return identity;
    } catch (error) {
      console.warn(
        '[LocalIdentityService] Failed to read identity:',
        error,
      );

      return null;
    }
  }

  async setLocalIdentity(identity: LocalIdentity): Promise<LocalIdentity> {
    const sanitized = sanitizeIdentity(identity);

    if (!isIdentityValid(sanitized)) {
      throw new Error('Invalid local identity.');
    }

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(sanitized),
    );

    return sanitized;
  }

  async clearLocalIdentity(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

export const LocalIdentityService =
  new LocalIdentityServiceClass();