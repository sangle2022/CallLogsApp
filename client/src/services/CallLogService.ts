/**
 * CallLogService.ts
 * FIX: `react-native-call-log` exports itself as plain CommonJS
 * (`module.exports = CallLog`), NOT an ES module with a `.default`.
 * `require('react-native-call-log').default` was therefore `undefined`,
 * causing "Cannot read property 'load' of undefined". This version
 * handles both export shapes safely.
 */
import { Platform } from 'react-native';
import { CallLogEntry, CallType } from '../types/CallLog.types';
import { formatDateTime } from '../utils/formatters';

function mapCallType(rawType: string): CallType {
  switch ((rawType || '').toUpperCase()) {
    case 'INCOMING': return CallType.INCOMING;
    case 'OUTGOING': return CallType.OUTGOING;
    case 'MISSED': return CallType.MISSED;
    case 'REJECTED': return CallType.REJECTED;
    case 'BLOCKED': return CallType.BLOCKED;
    case 'VOICEMAIL': return CallType.VOICEMAIL;
    default: return CallType.UNKNOWN;
  }
}

/**
 * Resolves the native module regardless of whether the package was
 * bundled as `module.exports = X` or `export default X`.
 */
function resolveCallLogModule(): any {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const imported = require('react-native-call-log');
  const resolved = imported?.default ?? imported;

  if (!resolved || typeof resolved.load !== 'function') {
    console.warn(
      '[CallLogService] react-native-call-log module has no `.load` method. ' +
      'Raw import was:', imported,
    );
    return null;
  }
  return resolved;
}

class CallLogServiceClass {
  async fetchCallLogs(): Promise<CallLogEntry[]> {
    if (Platform.OS !== 'android') {
      console.warn('[CallLogService] Call logs are only available on Android.');
      return [];
    }

    try {
      const CallLogs = resolveCallLogModule();
      if (!CallLogs) {
        console.warn(
          '[CallLogService] Native module unavailable. Make sure ' +
          '`react-native-call-log` is installed and the app was rebuilt ' +
          '(not just reloaded) after installing it.',
        );
        return [];
      }

      console.log('[CallLogService] Calling CallLogs.load(-1)...');
      const rawLogs: any[] = await CallLogs.load(-1);
      console.log('[CallLogService] Raw logs returned:', rawLogs?.length ?? 0);

      if (!rawLogs || rawLogs.length === 0) {
        console.warn(
          '[CallLogService] Native module returned an empty array — ' +
          'the device genuinely has no call history for this to read.',
        );
        return [];
      }

      return rawLogs.map((raw, index) => this.mapRawEntry(raw, index));
    } catch (error) {
      console.warn('[CallLogService] Failed to fetch call logs:', error);
      return [];
    }
  }

  private mapRawEntry(raw: any, index: number): CallLogEntry {
    const timestamp = Number(raw.timestamp) || Date.now();
    const duration = Number(raw.duration) || 0;
    return {
      id: raw._id ? String(raw._id) : `call-${index}-${timestamp}`,
      callerName: raw.name && raw.name.trim().length > 0 ? raw.name : 'Unknown',
      phoneNumber: raw.phoneNumber || 'Unknown number',
      callType: mapCallType(raw.type),
      duration,
      timestamp,
      dateTime: formatDateTime(timestamp),
    };
  }
}

export const CallLogService = new CallLogServiceClass();