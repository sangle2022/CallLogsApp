'use strict';

const recordingSyncService = require('../services/recordingSync.service');

function parseMultipartPayload(req) {
  if (!req.body?.payload) {
    throw Object.assign(
      new Error("multipart field 'payload' is required"),
      {statusCode: 400},
    );
  }

  try {
    return JSON.parse(req.body.payload);
  } catch {
    throw Object.assign(
      new Error("multipart field 'payload' must contain valid JSON"),
      {statusCode: 400},
    );
  }
}

exports.syncRecordings = async (req, res, next) => {
  try {
    const payload = parseMultipartPayload(req);

    const result = await recordingSyncService.syncRecordings(
      payload,
      req.files || [],
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.checkSynced = async (req, res, next) => {
  try {
    const hashes = Array.isArray(req.body?.hashes) ? req.body.hashes : [];
    const result = await recordingSyncService.checkSynced(hashes);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
