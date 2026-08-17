'use strict';

const path = require('path');
const express = require('express');
const multer = require('multer');
const env = require('../config/env');
const recordingController = require('../controllers/recording.controller');

const router = express.Router();

const ALLOWED_EXTENSIONS = new Set([
  '.mp3',
  '.m4a',
  '.amr',
  '.wav',
  '.3gp',
  '.aac',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxAudioUploadBytes,
    files: env.maxRecordingsPerSyncRequest,
    fields: 5,
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();

    const mimeAllowed =
      String(file.mimetype || '').startsWith('audio/') ||
      file.mimetype === 'application/octet-stream';

    if (!ALLOWED_EXTENSIONS.has(extension) || !mimeAllowed) {
      return callback(
        Object.assign(
          new Error(`Unsupported audio file: ${file.originalname}`),
          {statusCode: 400},
        ),
      );
    }

    callback(null, true);
  },
});

/** Independent recording module endpoints. */
router.post('/sync', upload.any(), recordingController.syncRecordings);
router.post('/check-synced', recordingController.checkSynced);

module.exports = router;
