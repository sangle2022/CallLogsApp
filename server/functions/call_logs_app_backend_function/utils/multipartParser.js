/**
 * utils/multipartParser.js
 * Parses an incoming multipart/form-data request (the mobile app's file
 * upload) into { fields, file }.
 *
 * Catalyst Basic I/O functions give you a raw Node http.IncomingMessage
 * with no body parsing at all - `busboy` is the standard, lightweight
 * library for streaming multipart parsing in Node without loading the
 * whole request into memory before we even know if it's valid.
 *
 * Install:
 *   npm install busboy
 */
const Busboy = require('busboy');
const env = require('../config/env');

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{fields: Record<string,string>, file: {buffer: Buffer, fileName: string, mimeType: string} | null}>}
 */
function parseMultipartRequest(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.startsWith('multipart/form-data')) {
      reject(new Error('Expected multipart/form-data request'));
      return;
    }

    const busboy = Busboy({
      headers: req.headers,
      limits: {
        // +1 so we can detect "over limit" ourselves and return a clean
        // 413 instead of busboy silently truncating the file.
        fileSize: env.maxUploadSizeBytes + 1,
        files: 1,
      },
    });

    const fields = {};
    let file = null;
    let fileTooLarge = false;

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('file', (name, stream, info) => {
      const { filename, mimeType } = info;
      const chunks = [];

      stream.on('data', chunk => chunks.push(chunk));

      stream.on('limit', () => {
        fileTooLarge = true;
        stream.resume(); // drain the stream so 'finish' still fires
      });

      stream.on('close', () => {
        if (!fileTooLarge) {
          file = { buffer: Buffer.concat(chunks), fileName: filename, mimeType };
        }
      });
    });

    busboy.on('error', reject);

    busboy.on('finish', () => {
      if (fileTooLarge) {
        reject(new Error(`File exceeds maximum upload size of ${env.maxUploadSizeBytes} bytes`));
        return;
      }
      resolve({ fields, file });
    });

    req.pipe(busboy);
  });
}

module.exports = { parseMultipartRequest };
