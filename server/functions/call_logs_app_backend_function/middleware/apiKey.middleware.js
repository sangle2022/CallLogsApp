'use strict';

const crypto = require('crypto');
const env = require('../config/env');

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = (req, res, next) => {
  const supplied = req.get('X-API-Key');
  if (!safeEqual(supplied, env.mobileApiKey)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};
