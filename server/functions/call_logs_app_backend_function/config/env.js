"use strict";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return value;
}

function positiveInt(name, fallback) {
  const raw = process.env[name] || String(fallback);
  const value = Number.parseInt(raw, 10);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`[config] ${name} must be a positive integer`);
  }

  return value;
}

function assertModuleApiName(name, value) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`[config] ${name} contains invalid characters`);
  }
}

const env = {
  zohoDc: process.env.ZOHO_DC || "in",
  clientId: required("ZOHO_CLIENT_ID"),
  clientSecret: required("ZOHO_CLIENT_SECRET"),
  refreshToken: required("ZOHO_REFRESH_TOKEN"),

  /** Existing call-log CRM module. */
  callLogsModule: required("ZOHO_CRM_CALL_LOGS_MODULE"),

  /** NEW independent call-recording CRM module. */
  recordingsModule: required("ZOHO_CRM_RECORDINGS_MODULE"),

  mobileApiKey: required("MOBILE_API_KEY"),
  crmApiVersion: process.env.ZOHO_CRM_API_VERSION || "v8",

  maxSyncRangeDays: positiveInt("MAX_SYNC_RANGE_DAYS", 7),
  maxCallsPerSyncRequest: positiveInt("MAX_CALLS_PER_SYNC_REQUEST", 5),

  /** Upload recordings separately; default is intentionally one file/request. */
  maxRecordingsPerSyncRequest: positiveInt(
    "MAX_RECORDINGS_PER_SYNC_REQUEST",
    1,
  ),

  maxAudioUploadBytes: positiveInt("MAX_AUDIO_UPLOAD_BYTES", 20 * 1024 * 1024),
};

assertModuleApiName("ZOHO_CRM_CALL_LOGS_MODULE", env.callLogsModule);
assertModuleApiName("ZOHO_CRM_RECORDINGS_MODULE", env.recordingsModule);

if (!/^v\d+$/.test(env.crmApiVersion)) {
  throw new Error("[config] ZOHO_CRM_API_VERSION must look like v8");
}

module.exports = env;
