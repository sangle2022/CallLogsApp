/**
 * utils/logger.js
 * Thin logging wrapper. Centralised so log format/verbosity can be
 * changed in one place (e.g. to plug into Catalyst's structured logging
 * or an external log sink later) without touching every file.
 */
function info(...args) {
  console.log('[INFO]', ...args);
}
function warn(...args) {
  console.warn('[WARN]', ...args);
}
function error(...args) {
  console.error('[ERROR]', ...args);
}

module.exports = { info, warn, error };
