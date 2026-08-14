'use strict';

const multer = require('multer');
const logger = require('../utils/logger');

function notFound(req, res) {
  res.status(404).json({ success: false, error: 'Route not found' });
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ success: false, error: error.message });
  }

  const statusCode = Number(error.statusCode) || 500;
  if (statusCode >= 500) logger.error('[error]', error);
  else logger.warn('[request]', error.message);

  res.status(statusCode).json({
    success: false,
    error: statusCode >= 500 ? 'Internal server error' : error.message,
  });
}

module.exports = { notFound, errorHandler };
