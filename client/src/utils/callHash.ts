import { sha256 } from 'js-sha256';
import { CallType } from '../types/CallLog.types';

export function normalizeRemoteNumber(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || 'unknown';
}

export function buildUniqueCallId(input: {
  remoteNumber: string;
  timestamp: number;
  duration: number;
  callType: CallType | string;
}): string {
  const canonical = [
    normalizeRemoteNumber(input.remoteNumber),
    Math.trunc(Number(input.timestamp) || 0),
    Math.max(0, Math.trunc(Number(input.duration) || 0)),
    String(input.callType || CallType.UNKNOWN).toUpperCase(),
  ].join('|');

  return sha256(canonical);
}
