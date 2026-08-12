// /**
//  * mapping/fieldMapping.js
//  * -----------------------------------------------------------------------
//  * SINGLE SOURCE OF TRUTH for how mobile-app JSON fields map to your
//  * Zoho CRM custom module's field API names.
//  *
//  * Once you create the custom modules in CRM, update ONLY the values on
//  * the right-hand side below to match the field API names CRM generates
//  * (visible under Setup -> Modules -> <Module> -> Fields). No other file
//  * needs to change.
//  * -----------------------------------------------------------------------
//  */

// // Mobile app sends CallLogEntry-shaped objects:
// //   { id, callerName, phoneNumber, callType, duration, timestamp, dateTime }
// function mapCallLogToCrmRecord(entry) {
//   return {
//     // Left = CRM field API name (EDIT THESE to match your module).
//     // Right = value from the mobile payload.
//     Name: entry.callerName || 'Unknown',              // CRM modules require a "Name"/primary field
//     Caller_Name: entry.callerName,
//     Phone_Number: entry.phoneNumber,
//     Call_Type: entry.callType,                         // INCOMING | OUTGOING | MISSED | ...
//     Duration_Seconds: entry.duration,
//     Call_Timestamp: entry.timestamp
//       ? new Date(entry.timestamp).toISOString()
//       : null,
//     Device_Call_Id: entry.id,                           // useful as a de-dupe/unique key later
//   };
// }

// // Mobile app sends CallRecordingFile-shaped objects:
// //   { id, fileName, filePath, fileSize, createdDate, extension }
// function mapRecordingToCrmRecord(entry) {
//   return {
//     Name: entry.fileName || 'Recording',
//     File_Name: entry.fileName,
//     File_Path: entry.filePath,
//     File_Size_Bytes: entry.fileSize,
//     File_Extension: entry.extension,
//     Recorded_At: entry.createdDate
//       ? new Date(entry.createdDate).toISOString()
//       : null,
//     Device_File_Id: entry.id,
//     // NOTE: this only stores metadata. Uploading the actual audio file as
//     // a CRM attachment is a separate call (CRM "Upload Attachment" API,
//     // multipart/form-data) - add that as a follow-up once metadata sync
//     // is confirmed working, since it changes the request shape.
//   };
// }

// module.exports = { mapCallLogToCrmRecord, mapRecordingToCrmRecord };

/**
 * mapping/fieldMapping.js
 * -----------------------------------------------------------------------
 * SINGLE SOURCE OF TRUTH for how mobile-app JSON fields map to your
 * Zoho CRM custom module's field API names.
 *
 * FIX: Zoho CRM's "datetime" field type rejects JS's native
 * `.toISOString()` output (e.g. "2026-08-10T16:23:07.123Z") because it
 * requires a numeric timezone offset (+05:30) instead of the "Z" (UTC)
 * suffix, and no milliseconds. `toZohoDateTime()` below converts to the
 * exact format Zoho expects.
 * -----------------------------------------------------------------------
 */

/**
 * Converts an epoch-ms timestamp to Zoho CRM's required datetime format:
 *   yyyy-MM-ddTHH:mm:ss+HH:mm
 * (no milliseconds, explicit numeric offset instead of "Z").
 *
 * Uses the SERVER's local timezone offset. If your Catalyst function's
 * runtime timezone differs from what you want stored in CRM, hardcode
 * the desired offset instead (see the commented example below).
 */
function toZohoDateTime(timestampMs) {
  if (!timestampMs) return null;

  const date = new Date(timestampMs);

  const pad = (num) => String(num).padStart(2, '0');

  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());

  // Timezone offset: JS's getTimezoneOffset() returns MINUTES BEHIND UTC
  // (positive for west of UTC), which is the opposite sign convention
  // from what we need to display - hence the negation below.
  const offsetMinutesTotal = -date.getTimezoneOffset();
  const offsetSign = offsetMinutesTotal >= 0 ? '+' : '-';
  const offsetHours = pad(Math.floor(Math.abs(offsetMinutesTotal) / 60));
  const offsetMinutes = pad(Math.abs(offsetMinutesTotal) % 60);

  return `${yyyy}-${MM}-${dd}T${HH}:${mm}:${ss}${offsetSign}${offsetHours}:${offsetMinutes}`;

  // --- Alternative: force a FIXED offset regardless of server TZ -------
  // Uncomment if Catalyst's runtime timezone isn't what you want stored
  // (e.g. always store in IST +05:30 no matter where the function runs):
  //
  // const istDate = new Date(timestampMs + 5.5 * 60 * 60 * 1000); // shift to IST
  // return `${istDate.getUTCFullYear()}-${pad(istDate.getUTCMonth() + 1)}-${pad(istDate.getUTCDate())}` +
  //   `T${pad(istDate.getUTCHours())}:${pad(istDate.getUTCMinutes())}:${pad(istDate.getUTCSeconds())}+05:30`;
}

// Mobile app sends CallLogEntry-shaped objects:
//   { id, callerName, phoneNumber, callType, duration, timestamp, dateTime }
function mapCallLogToCrmRecord(entry) {
  return {
    Name: entry.callerName || 'Unknown',
    Caller_Name: entry.callerName,
    Phone_Number: entry.phoneNumber,
    Call_Type: entry.callType,
    Duration_Seconds: entry.duration,
    Call_Timestamp: toZohoDateTime(entry.timestamp), // FIXED: was .toISOString()
    Device_Call_Id: entry.id,
  };
}

// Mobile app sends CallRecordingFile-shaped objects:
//   { id, fileName, filePath, fileSize, createdDate, extension }
function mapRecordingToCrmRecord(entry) {
  return {
    Name: entry.fileName || 'Recording',
    File_Name: entry.fileName,
    File_Path: entry.filePath,
    File_Size_Bytes: entry.fileSize,
    File_Extension: entry.extension,
    Recorded_At: toZohoDateTime(entry.createdDate), // FIXED: was .toISOString()
    Device_File_Id: entry.id,
  };
}

module.exports = { mapCallLogToCrmRecord, mapRecordingToCrmRecord };