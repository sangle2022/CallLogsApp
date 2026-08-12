/**
 * apiConfig.ts
 * -----------------------------------------------------------------------
 * EDIT THESE TWO VALUES once your Catalyst backend is deployed.
 * Keeping them in one file means nothing else in the app needs to change
 * when the backend URL or key changes.
 * -----------------------------------------------------------------------
 */

// Your deployed Catalyst function base URL, e.g.:
// "https://your-project-12345.development.catalystserverless.com/server/call_logs_app_backend_function"
// export const API_BASE_URL = 'https://calllogsappbackend-60079340748.development.catalystserverless.in/server/call_logs_app_backend_function/';
export const API_BASE_URL = 'http://localhost:3000/server/call_logs_app_backend_function'

// Must match the MOBILE_API_KEY environment variable set in Catalyst Console.
export const API_KEY = 'K8vP4xN7qL2mR9tY6wC3sF5hJ1dZ0aB8';

// Network tuning - adjust if your backend/network is slower.
export const REQUEST_TIMEOUT_MS = 30000; // 30s for JSON requests
export const UPLOAD_TIMEOUT_MS = 120000; // 2 min for file uploads (audio can be large)
export const CALL_LOGS_CHUNK_SIZE = 200; // records per HTTP request when bulk-uploading logs