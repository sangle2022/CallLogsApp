import { Platform } from 'react-native';
import { CallLogEntry, CallType, LocalIdentity } from '../types/CallLog.types';
import { formatDateTime } from '../utils/formatters';
import { buildUniqueCallId } from '../utils/callHash';

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

function resolveCallLogModule(): any {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const imported = require('react-native-call-log');
  const resolved = imported?.default ?? imported;
  return resolved && typeof resolved.load === 'function' ? resolved : null;
}

function cleanRemoteName(value: unknown): string {
  const name = String(value || '').trim();
  return name || 'Unknown';
}

function cleanRemoteNumber(value: unknown): string {
  const number = String(value || '').trim();
  return number || 'Unknown number';
}

class CallLogServiceClass {
  async fetchCallLogs(
    localIdentity: LocalIdentity,
  ): Promise<CallLogEntry[]> {
    if (Platform.OS !== 'android') {
      return [];
    }

    const CallLogs = resolveCallLogModule();

    if (!CallLogs) {
      console.warn(
        '[CallLogService] react-native-call-log native module unavailable.',
      );

      return [];
    }

    try {
      const rawLogs = await CallLogs.load(-1);

      return (rawLogs || []).map(
        (raw: any, index: number) =>
          this.mapRawEntry(
            raw,
            index,
            localIdentity,
          ),
      );
    } catch (error) {
      console.warn(
        '[CallLogService] Failed to fetch call logs:',
        error,
      );

      return [];
    }
  }

  private mapRawEntry(
    raw: any,
    index: number,
    localIdentity: LocalIdentity,
  ): CallLogEntry {
    const timestamp = Number(raw.timestamp) || Date.now();
    const duration = Math.max(0, Number(raw.duration) || 0);
    const callType = mapCallType(raw.type);
    const remoteName = cleanRemoteName(raw.name);
    const remoteNumber = cleanRemoteNumber(raw.phoneNumber);

    // OUTGOING: local user placed the call.
    // Everything else is treated as remote -> local. This correctly handles
    // INCOMING/MISSED/REJECTED/BLOCKED; UNKNOWN can be refined if your source
    // library exposes a more specific native call direction.
    const isOutgoing = callType === CallType.OUTGOING;
    const callerName = isOutgoing ? localIdentity.name : remoteName;
    const callerNumber = isOutgoing ? localIdentity.phoneNumber : remoteNumber;
    const receiverName = isOutgoing ? remoteName : localIdentity.name;
    const receiverNumber = isOutgoing ? remoteNumber : localIdentity.phoneNumber;

    const uniqueCallId = buildUniqueCallId({
      remoteNumber,
      timestamp,
      duration,
      callType,
    });

    return {
      id: raw._id ? String(raw._id) : `call-${index}-${timestamp}`,
      remoteName,
      remoteNumber,
      callerName,
      callerNumber,
      receiverName,
      receiverNumber,
      callType,
      duration,
      timestamp,
      dateTime: formatDateTime(timestamp),
      uniqueCallId,
    };
  }
}

export const CallLogService = new CallLogServiceClass();
