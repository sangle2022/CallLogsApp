// /**
//  * CloudUploadService.ts
//  * -----------------------------------------------------------------------
//  * FUTURE-READY STUB.
//  * This service intentionally has no real network calls yet. It defines the
//  * shape upload features (cloud storage, Zoho CRM, etc.) will use, so that:
//  *   - Screens/hooks can be wired up to "Upload" buttons today.
//  *   - The actual integration can be dropped in later without touching UI.
//  *
//  * When ready, implement `uploadCallLogs` / `uploadRecording` to call your
//  * backend, a cloud storage SDK, or the Zoho CRM REST API
//  * (e.g. POST to Zoho's /crm/v3/<module> endpoints with OAuth2 tokens).
//  * -----------------------------------------------------------------------
//  */
// import { CallLogEntry } from '../types/CallLog.types';
// import { CallRecordingFile } from '../types/Recording.types';

// export interface UploadResult {
//   success: boolean;
//   message: string;
// }

// class CloudUploadServiceClass {
//   /** Placeholder for bulk call-log sync to a CRM (e.g. Zoho). */
//   async uploadCallLogs(_entries: CallLogEntry[]): Promise<UploadResult> {
//     // TODO: integrate with Zoho CRM API or your backend.
//     console.warn('[CloudUploadService] uploadCallLogs not yet implemented.');
//     return { success: false, message: 'Upload not implemented yet.' };
//   }

//   /** Placeholder for uploading a single recording file to cloud storage. */
//   async uploadRecording(_recording: CallRecordingFile): Promise<UploadResult> {
//     // TODO: integrate with S3/GCS/Zoho WorkDrive, using RNFS.readFile
//     // (base64) or a multipart upload from `recording.filePath`.
//     console.warn('[CloudUploadService] uploadRecording not yet implemented.');
//     return { success: false, message: 'Upload not implemented yet.' };
//   }
// }

// export const CloudUploadService = new CloudUploadServiceClass();
