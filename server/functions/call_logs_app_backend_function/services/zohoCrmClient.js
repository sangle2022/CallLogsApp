// /**
//  * services/zohoCrmClient.js
//  * Thin, generic wrapper around the Zoho CRM record + attachment APIs.
//  * Handlers never talk to the CRM API directly - this file owns auth
//  * headers, batching, and error normalisation.
//  */
// const env = require('../config/env');
// const logger = require('../utils/logger');
// const { getAccessToken } = require('./zohoTokenManager');

// const CRM_BASE_URL = () => `https://www.zohoapis.${env.zohoDc}/crm/${env.crmApiVersion}`;
// // https://www.zohoapis.com/crm/v8/Leads
// /** Splits an array into chunks of at most `size` (Zoho's insert limit is 100/call). */
// function chunk(array, size) {
//   const chunks = [];
//   for (let i = 0; i < array.length; i += size) {
//     chunks.push(array.slice(i, i + size));
//   }
//   return chunks;
// }

// /**
//  * Inserts records into a Zoho CRM module, automatically batching and
//  * retrying once on an expired-token error.
//  */
// async function insertRecords(moduleApiName, records, _isRetry = false) {
//   if (!Array.isArray(records) || records.length === 0) {
//     return { insertedCount: 0, failed: [] };
//   }

//   const accessToken = await getAccessToken();
//   const batches = chunk(records, env.crmBatchSize);

//   let insertedCount = 0;
//   const failed = [];

//   for (const batch of batches) {
//     const response = await fetch(`${CRM_BASE_URL()}/${moduleApiName}`, {
//       method: 'POST',
//       headers: {
//         Authorization: `Zoho-oauthtoken ${accessToken}`,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({ data: batch }),
//     });

//     const body = await response.json().catch(() => ({}));

//     if (response.status === 401 && !_isRetry) {
//       logger.warn('[zohoCrmClient] Got 401, forcing one token refresh + retry');
//       return insertRecords(moduleApiName, records, true);
//     }

//     if (!response.ok) {
//       logger.error('[zohoCrmClient] CRM insert failed:', response.status, body);
//       throw new Error(`Zoho CRM insert failed (${response.status}): ${JSON.stringify(body)}`);
//     }

//     (body.data || []).forEach(result => {
//       if (result.status === 'success') {
//         insertedCount += 1;
//       } else {
//         failed.push(result);
//       }
//     });
//   }

//   if (failed.length > 0) {
//     logger.warn('[zohoCrmClient] Some records failed to insert:', failed);
//   }

//   return { insertedCount, failed };
// }

// /**
//  * Inserts exactly ONE record and returns its newly created CRM record ID.
//  * Used by the recording-upload flow, which needs the ID immediately in
//  * order to attach the audio file to that same record.
//  *
//  * @returns {Promise<string>} the created record's CRM id
//  * @throws if the insert failed or Zoho didn't return a success status
//  */
// async function createSingleRecord(moduleApiName, record, _isRetry = false) {
//   const accessToken = await getAccessToken();

//   const response = await fetch(`${CRM_BASE_URL()}/${moduleApiName}`, {
//     method: 'POST',
//     headers: {
//       Authorization: `Zoho-oauthtoken ${accessToken}`,
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify({ data: [record] }),
//   });

//   const body = await response.json().catch(() => ({}));

//   if (response.status === 401 && !_isRetry) {
//     logger.warn('[zohoCrmClient] Got 401 on single insert, retrying once');
//     return createSingleRecord(moduleApiName, record, true);
//   }

//   const result = body?.data?.[0];

//   if (!response.ok || !result || result.status !== 'success') {
//     logger.error('[zohoCrmClient] Single record insert failed:', response.status, body);
//     throw new Error(`Zoho CRM record creation failed: ${JSON.stringify(body)}`);
//   }

//   return result.details.id;
// }

// /**
//  * Uploads a file as an attachment on an existing CRM record.
//  * Uses Zoho CRM's Attachments API:
//  *   POST /crm/{version}/{module}/{record_id}/Attachments
//  * with a multipart/form-data body containing the file under field "file".
//  *
//  * Node 18+'s built-in FormData/Blob/fetch handle building this multipart
//  * request natively - no extra dependency needed for the OUTGOING request
//  * (only the INCOMING upload from the mobile app needs busboy, since Node
//  * has no built-in incoming multipart parser).
//  *
//  * @param {string} moduleApiName
//  * @param {string} recordId
//  * @param {Buffer} fileBuffer
//  * @param {string} fileName
//  * @param {string} [mimeType]
//  */
// async function uploadAttachment(moduleApiName, recordId, fileBuffer, fileName, mimeType, _isRetry = false) {
//   const accessToken = await getAccessToken();

//   const formData = new FormData();
//   const blob = new Blob([fileBuffer], { type: mimeType || 'application/octet-stream' });
//   formData.append('file', blob, fileName);

//   const response = await fetch(
//     `${CRM_BASE_URL()}/${moduleApiName}/${recordId}/Attachments`,
//     {
//       method: 'POST',
//       headers: {
//         Authorization: `Zoho-oauthtoken ${accessToken}`,
//         // NOTE: do NOT set Content-Type manually - fetch sets the
//         // multipart boundary automatically from the FormData instance.
//       },
//       body: formData,
//     },
//   );

//   const body = await response.json().catch(() => ({}));

//   if (response.status === 401 && !_isRetry) {
//     logger.warn('[zohoCrmClient] Got 401 on attachment upload, retrying once');
//     return uploadAttachment(moduleApiName, recordId, fileBuffer, fileName, mimeType, true);
//   }

//   const result = body?.data?.[0];

//   if (!response.ok || !result || result.status !== 'success') {
//     logger.error('[zohoCrmClient] Attachment upload failed:', response.status, body);
//     throw new Error(`Zoho CRM attachment upload failed: ${JSON.stringify(body)}`);
//   }

//   return result.details.id; // attachment id
// }

// module.exports = { insertRecords, createSingleRecord, uploadAttachment };


/**
 * services/zohoCrmClient.js
 * DEBUG CHANGE: logs the exact outgoing URL (and env values that built
 * it) right before every CRM request, so a 404/INVALID_URL_PATTERN can
 * be diagnosed from logs alone instead of guessing.
 */
const env = require('../config/env');
const logger = require('../utils/logger');
const { getAccessToken } = require('./zohoTokenManager');

const CRM_BASE_URL = () => `https://www.zohoapis.${env.zohoDc}/crm/${env.crmApiVersion}`;

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function insertRecords(moduleApiName, records, _isRetry = false) {
  if (!Array.isArray(records) || records.length === 0) {
    return { insertedCount: 0, failed: [] };
  }

  const accessToken = await getAccessToken();
  const batches = chunk(records, env.crmBatchSize);

  let insertedCount = 0;
  const failed = [];

  for (const batch of batches) {
    const url = `${CRM_BASE_URL()}/${moduleApiName}`;

    // --- DEBUG LOGGING -------------------------------------------------
    logger.info('[zohoCrmClient] Config check:', {
      ZOHO_DC: env.zohoDc,
      ZOHO_CRM_API_VERSION: env.crmApiVersion,
      moduleApiName,
      moduleApiNameLength: moduleApiName.length,   // catches invisible trailing chars
      moduleApiNameJson: JSON.stringify(moduleApiName), // shows quotes/whitespace explicitly
    });
    logger.info('[zohoCrmClient] Requesting URL:', url);
    // ---------------------------------------------------------------------

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: batch }),
    });

    const body = await response.json().catch(() => ({}));

    if (response.status === 401 && !_isRetry) {
      logger.warn('[zohoCrmClient] Got 401, forcing one token refresh + retry');
      return insertRecords(moduleApiName, records, true);
    }

    if (!response.ok) {
      logger.error('[zohoCrmClient] CRM insert failed:', response.status, body);
      logger.error('[zohoCrmClient] Failed URL was:', url);
      throw new Error(`Zoho CRM insert failed (${response.status}): ${JSON.stringify(body)}`);
    }

    (body.data || []).forEach(result => {
      if (result.status === 'success') {
        insertedCount += 1;
      } else {
        failed.push(result);
      }
    });
  }

  if (failed.length > 0) {
    logger.warn('[zohoCrmClient] Some records failed to insert:', failed);
  }

  return { insertedCount, failed };
}

async function createSingleRecord(moduleApiName, record, _isRetry = false) {
  const accessToken = await getAccessToken();
  const url = `${CRM_BASE_URL()}/${moduleApiName}`;

  logger.info('[zohoCrmClient] createSingleRecord URL:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: [record] }),
  });

  const body = await response.json().catch(() => ({}));

  if (response.status === 401 && !_isRetry) {
    logger.warn('[zohoCrmClient] Got 401 on single insert, retrying once');
    return createSingleRecord(moduleApiName, record, true);
  }

  const result = body?.data?.[0];

  if (!response.ok || !result || result.status !== 'success') {
    logger.error('[zohoCrmClient] Single record insert failed:', response.status, body);
    logger.error('[zohoCrmClient] Failed URL was:', url);
    throw new Error(`Zoho CRM record creation failed: ${JSON.stringify(body)}`);
  }

  return result.details.id;
}

async function uploadAttachment(moduleApiName, recordId, fileBuffer, fileName, mimeType, _isRetry = false) {
  const accessToken = await getAccessToken();

  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType || 'application/octet-stream' });
  formData.append('file', blob, fileName);

  const url = `${CRM_BASE_URL()}/${moduleApiName}/${recordId}/Attachments`;
  logger.info('[zohoCrmClient] uploadAttachment URL:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
    body: formData,
  });

  const body = await response.json().catch(() => ({}));

  if (response.status === 401 && !_isRetry) {
    logger.warn('[zohoCrmClient] Got 401 on attachment upload, retrying once');
    return uploadAttachment(moduleApiName, recordId, fileBuffer, fileName, mimeType, true);
  }

  const result = body?.data?.[0];

  if (!response.ok || !result || result.status !== 'success') {
    logger.error('[zohoCrmClient] Attachment upload failed:', response.status, body);
    logger.error('[zohoCrmClient] Failed URL was:', url);
    throw new Error(`Zoho CRM attachment upload failed: ${JSON.stringify(body)}`);
  }

  return result.details.id;
}

module.exports = { insertRecords, createSingleRecord, uploadAttachment };