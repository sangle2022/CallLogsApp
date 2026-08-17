'use strict';

const express = require('express');
const apiKeyMiddleware = require('./middleware/apiKey.middleware');
const callRoutes = require('./routes/call.routes');
const recordingRoutes = require('./routes/recording.routes');
const {notFound, errorHandler} = require('./middleware/error.middleware');

const app = express();

app.use(express.json({limit: '1mb'}));
app.use(express.urlencoded({extended: true, limit: '1mb'}));

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Call Logs API is running',
  });
});

/** Existing call-log API - unchanged. */
app.use('/api/calls', apiKeyMiddleware, callRoutes);

/** NEW completely independent recording API. */
app.use('/api/recordings', apiKeyMiddleware, recordingRoutes);

app.use(notFound);
app.use(errorHandler);

// Catalyst Advanced I/O owns the HTTP server/port. Do NOT call app.listen().
module.exports = app;
