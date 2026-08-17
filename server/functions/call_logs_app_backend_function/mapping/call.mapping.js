'use strict';

const {toZohoDateTime} = require('../utils/zohoDate');

function safeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

/**
 * CRM metadata mapping.
 *
 * remoteNumber is intentionally NOT mapped to a third CRM Phone_Number field.
 * It remains in the internal call model because it is required for the
 * canonical Unique_Call_ID hash.
 */
function mapCallToCrmRecord(call) {
  const callerName = safeText(call.callerName, 'Unknown');
  const receiverName = safeText(call.receiverName, 'Unknown');
  const callerNumber = safeText(call.callerNumber);
  const receiverNumber = safeText(call.receiverNumber);

  const displayName =
    `${call.callType}: ${callerName} -> ${receiverName}`.slice(0, 255);

  return {
    Name: displayName,
    Unique_Call_ID: call.uniqueCallId,
    Device_Call_Id: safeText(call.id),

    Caller_Name: callerName,
    Caller_Number: callerNumber,

    Receiver_Name: receiverName,
    Receiver_Number: receiverNumber,

    Call_Type: call.callType,
    Duration_Seconds: Number(call.duration || 0),
    Call_Timestamp: toZohoDateTime(call.timestamp),

    // Audio is added later from the Recordings screen.
    // Recording_Attached: false,
    // Recording_File_Name: '',
  };
}

module.exports = {
  mapCallToCrmRecord,
};
