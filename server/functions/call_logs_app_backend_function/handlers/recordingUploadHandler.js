/**
 * handlers/recordingUploadHandler.js
 * Handles POST /call-recordings/upload
 *
 * Accepts a multipart/form-data request from the mobile app containing:
 *   - text fields: fileName, filePath, fileSize, createdDate, extension
 *   - a file field named "file": the actual audio recording
 *
 * Flow:
 *   1. Parse the multipart upload (metadata fields + audio file).
 *   2. Create the CRM record with the metadata (reuses the same field
 *      mapping as the metadata-only /call-recordings endpoint).
 *   3. Attach the audio file to that newly created record.
 *
 * This does both steps in a single mobile-app request so the app doesn't
 * need to manage a two-step "create record, then remember its ID, then
 * upload file" flow itself.
 */
const env = require('../config/env');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/httpUtils');
const { parseMultipartRequest } = require('../utils/multipartParser');
const { createSingleRecord, uploadAttachment } = require('../services/zohoCrmClient');
const { mapRecordingToCrmRecord } = require('../mapping/fieldMapping');

// Reasonable allow-list for call-recording audio. Adjust if your OEM
// recorder produces a format not listed here.
const ALLOWED_MIME_PREFIXES = ['audio/'];
const ALLOWED_EXTENSIONS = ['mp3', 'm4a', 'amr', 'wav', '3gp', 'aac'];

function isAllowedFile(fileName, mimeType) {
  const extension = (fileName.split('.').pop() || '').toLowerCase();
  const extensionOk = ALLOWED_EXTENSIONS.includes(extension);
  const mimeOk = ALLOWED_MIME_PREFIXES.some(prefix => (mimeType || '').startsWith(prefix));
  // Some Android OEMs report generic mimeType like application/octet-stream
  // for recordings, so we accept if EITHER check passes, not both.
  return extensionOk || mimeOk;
}

async function handleRecordingUpload(req, res) {
  let fields;
  let file;

  try {
    const parsed = await parseMultipartRequest(req);
    fields = parsed.fields;
    file = parsed.file;
  } catch (err) {
    const isTooLarge = /exceeds maximum upload size/i.test(err.message);
    sendError(res, isTooLarge ? 413 : 400, isTooLarge ? 'File too large' : 'Invalid upload request', err.message);
    return;
  }

  if (!file) {
    sendError(res, 400, "Request must include a file under the 'file' field");
    return;
  }

  if (!isAllowedFile(file.fileName, file.mimeType)) {
    sendError(res, 400, `Unsupported file type: ${file.fileName} (${file.mimeType})`);
    return;
  }

  if (!fields.filePath) {
    sendError(res, 400, "Missing required field 'filePath'");
    return;
  }

  // Reuse the existing metadata mapping so field names stay in sync with
  // the metadata-only endpoint - only ONE place (fieldMapping.js) ever
  // needs updating when your CRM module changes.
  const metadataRecord = mapRecordingToCrmRecord({
    fileName: fields.fileName || file.fileName,
    filePath: fields.filePath,
    fileSize: fields.fileSize ? Number(fields.fileSize) : file.buffer.length,
    createdDate: fields.createdDate ? Number(fields.createdDate) : Date.now(),
    extension: fields.extension || (file.fileName.split('.').pop() || ''),
    id: fields.id,
  });

  let recordId;
  try {
    recordId = await createSingleRecord(env.callRecordingsModule, metadataRecord);
    logger.info('[recordingUploadHandler] Created CRM record:', recordId);
  } catch (err) {
    logger.error('[recordingUploadHandler] Failed to create CRM record:', err);
    sendError(res, 502, 'Failed to create recording record in Zoho CRM', err.message);
    return;
  }

  try {
    const attachmentId = await uploadAttachment(
      env.callRecordingsModule,
      recordId,
      file.buffer,
      file.fileName,
      file.mimeType,
    );
    logger.info('[recordingUploadHandler] Uploaded attachment:', attachmentId);

    sendSuccess(res, {
      recordId,
      attachmentId,
      fileName: file.fileName,
      fileSizeBytes: file.buffer.length,
    });
  } catch (err) {
    // The metadata record was created successfully even though the file
    // attach failed - tell the caller exactly that so they can retry the
    // attachment step without creating a duplicate record.
    logger.error('[recordingUploadHandler] Attachment upload failed after record creation:', err);
    sendError(res, 502, 'Recording record was created, but the audio file attachment failed', {
      recordId,
      reason: err.message,
    });
  }
}

module.exports = handleRecordingUpload;
