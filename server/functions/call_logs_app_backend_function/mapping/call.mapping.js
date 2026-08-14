'use strict';

const {toZohoDateTime} = require('../utils/zohoDate');

function safeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

/**
 * Maps a normalized mobile call into Mobile_Call_Records.
 *
 * Caller / Receiver are the authoritative CRM fields.
 *
 * OUTGOING:
 *   Caller   = local user
 *   Receiver = remote contact
 *
 * INCOMING / MISSED:
 *   Caller   = remote contact
 *   Receiver = local user
 */
function mapCallToCrmRecord(call, recordingFile) {
  const callerName = safeText(
    call.callerName,
    'Unknown',
  );

  const receiverName = safeText(
    call.receiverName,
    'Unknown',
  );

  const callerNumber = safeText(
    call.callerNumber,
  );

  const receiverNumber = safeText(
    call.receiverNumber,
  );

  const displayName =
    `${call.callType}: ${callerName} -> ${receiverName}`
      .slice(0, 255);

  return {
    Name: displayName,

    Unique_Call_ID: call.uniqueCallId,

    Device_Call_Id: safeText(call.id),

    Caller_Name: callerName,
    Caller_Number: callerNumber,

    Receiver_Name: receiverName,
    Receiver_Number: receiverNumber,

    Call_Type: call.callType,

    Duration_Seconds: Number(
      call.duration || 0,
    ),

    Call_Timestamp: toZohoDateTime(
      call.timestamp,
    ),

    Recording_Attached: Boolean(
      recordingFile,
    ),

    Recording_File_Name:
      recordingFile?.originalname || '',
  };
}

module.exports = {
  mapCallToCrmRecord,
};