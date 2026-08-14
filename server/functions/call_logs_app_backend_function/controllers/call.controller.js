'use strict';

const callSyncService = require('../services/callSync.service');

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

exports.syncCalls = async (req, res, next) => {
  try {
    const payload = parseMultipartPayload(req);
    const result = await callSyncService.syncCalls(payload);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.syncRecordings = async (req, res, next) => {
  try {
    const payload = parseMultipartPayload(req);
    const result = await callSyncService.syncRecordings(
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
    const ids = String(req.query.ids || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);

    const result = await callSyncService.checkSynced(ids);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
