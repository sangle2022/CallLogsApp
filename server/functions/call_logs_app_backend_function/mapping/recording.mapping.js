'use strict';

const {toZohoDateTime} = require('../utils/zohoDate');

function safeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

/**
 * Maps one independent local audio file to the NEW CRM recording module.
 *
 * The Name field intentionally stores the device file name exactly as received
 * (trimmed to CRM-safe length). If the OEM file name contains a phone number or
 * contact name, CRM therefore keeps that information without trying to parse it.
 */
function mapRecordingToCrmRecord(recording, file) {
  const fileName = safeText(
    file?.originalname || recording.fileName,
    'Recording',
  );

  const data = {
    Name: fileName.slice(0, 255),
    Recording_Hash: recording.recordingHash,
    File_Size_Bytes: Number(file?.size || recording.fileSize || 0),
    File_Extension: safeText(recording.extension).slice(0, 20),
    MIME_Type: safeText(file?.mimetype, 'application/octet-stream').slice(0, 100),
    Recording_Attached: false,
  };

  if (Number.isFinite(recording.recordingTime) && recording.recordingTime > 0) {
    data.Recording_Time = toZohoDateTime(recording.recordingTime);
  }

  return data;
}

module.exports = {mapRecordingToCrmRecord};
