/**
 * config/env.js
 * Centralised, validated access to environment variables.
 *
 * Set these in Catalyst Console:
 *   Functions -> call_logs_app_backend_function -> Environment Variables
 * (or in `.env` for local `catalyst run` testing).
 *
 * Required:
 *   ZOHO_DC                 - Data center: "com" | "in" | "eu" | "com.au" | "jp"
 *   ZOHO_CLIENT_ID          - From Zoho API Console (Server-based app)
 *   ZOHO_CLIENT_SECRET
 *   ZOHO_REFRESH_TOKEN      - Generated once via OAuth consent, never expires
 *   ZOHO_CRM_CALL_LOGS_MODULE       - API name of your custom module for call logs
 *   ZOHO_CRM_CALL_RECORDINGS_MODULE - API name of your custom module for recordings
 *   MOBILE_API_KEY          - Shared secret the mobile app sends in X-API-Key header
 *
 * Optional:
 *   ZOHO_CRM_API_VERSION    - Defaults to "v6"
 *   CRM_BATCH_SIZE          - Defaults to 100 (Zoho's max per insert call)
 *   MAX_UPLOAD_SIZE_BYTES   - Defaults to 26214400 (25 MB, Zoho CRM's own attachment cap)
 */

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  zohoDc: process.env.ZOHO_DC || 'com',
  clientId: required('ZOHO_CLIENT_ID'),
  clientSecret: required('ZOHO_CLIENT_SECRET'),
  refreshToken: required('ZOHO_REFRESH_TOKEN'),
  callLogsModule: required('ZOHO_CRM_CALL_LOGS_MODULE'),
  callRecordingsModule: required('ZOHO_CRM_CALL_RECORDINGS_MODULE'),
  mobileApiKey: required('MOBILE_API_KEY'),
  crmApiVersion: process.env.ZOHO_CRM_API_VERSION || 'v6',
  crmBatchSize: parseInt(process.env.CRM_BATCH_SIZE || '100', 10),
  // Zoho CRM itself rejects attachments over 25 MB - fail fast on our
  // side with a clear error instead of letting the CRM call error out.
  maxUploadSizeBytes: parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || String(25 * 1024 * 1024), 10),
};

module.exports = env;
