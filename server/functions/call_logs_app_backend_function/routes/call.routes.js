"use strict";

const express = require("express");
const multer = require("multer");
const callController = require("../controllers/call.controller");

const router = express.Router();

/**
 * CALL LOGS ARE METADATA ONLY.
 * The recording upload route has been removed from /api/calls entirely.
 */
const metadataOnly = multer({
  storage: multer.memoryStorage(),
  limits: {
    fields: 5,
  },
});

router.post("/sync", metadataOnly.none(), callController.syncCalls);
router.get("/check-synced", callController.checkSynced);

module.exports = router;
