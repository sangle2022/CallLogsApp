/**
 * API configuration for the Catalyst Advanced I/O function.
 *
 * IMPORTANT:
 * - Android emulator cannot reach your computer through `localhost`.
 *   For local Catalyst testing, use the host address that your emulator/device
 *   can reach (for the standard Android emulator this is commonly 10.0.2.2).
 * - A static API key inside a mobile bundle is extractable. Keep this only as
 *   a transitional guard and replace it with your real user/session auth for
 *   production.
 */
export const API_BASE_URL =
  'http://localhost:3000/server/call_logs_app_backend_function';

export const API_KEY = 'K8vP4xN7qL2mR9tY6wC3sF5hJ1dZ0aB8';

// Catalyst Advanced I/O has a short execution window, so the client keeps
// requests small and uses a timeout below the server-side ceiling.
export const REQUEST_TIMEOUT_MS = 25_000;
export const UPLOAD_TIMEOUT_MS = 25_000;

// Keep each request intentionally small because it can contain audio files and
// multiple outbound Zoho CRM operations. The backend enforces the same limit.
export const SYNC_CHUNK_SIZE = 50;
