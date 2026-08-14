/** Call log domain types after explicit caller/receiver role mapping. */
export enum CallType {
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING',
  MISSED = 'MISSED',
  REJECTED = 'REJECTED',
  BLOCKED = 'BLOCKED',
  VOICEMAIL = 'VOICEMAIL',
  UNKNOWN = 'UNKNOWN',
}

export interface LocalIdentity {
  name: string;
  phoneNumber: string;
}

export interface CallLogEntry {
  id: string; // device/provider call-row id; not the dedupe key
  remoteName: string;
  remoteNumber: string;

  callerName: string;
  callerNumber: string;
  receiverName: string;
  receiverNumber: string;

  callType: CallType;
  duration: number; // seconds
  timestamp: number; // epoch millis at call start
  dateTime: string; // display-only
  uniqueCallId: string; // SHA-256 canonical CRM dedupe key
}
