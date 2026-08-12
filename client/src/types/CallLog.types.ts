/**
 * CallLog.types.ts
 * Type definitions for call log records.
 * Kept separate from UI/services so both can evolve independently.
 */

// Mirrors the call types exposed by Android's CallLog.Calls content provider.
export enum CallType {
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING',
  MISSED = 'MISSED',
  REJECTED = 'REJECTED',
  BLOCKED = 'BLOCKED',
  VOICEMAIL = 'VOICEMAIL',
  UNKNOWN = 'UNKNOWN',
}

export interface CallLogEntry {
  id: string;            // Unique id (from provider or generated)
  callerName: string;    // Resolved contact name, or 'Unknown'
  phoneNumber: string;
  callType: CallType;
  duration: number;      // Duration in seconds
  timestamp: number;     // Epoch millis of the call
  dateTime: string;      // Human readable date/time (derived)
}
