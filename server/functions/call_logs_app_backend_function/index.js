'use strict';

const express = require('express');
const apiKeyMiddleware = require('./middleware/apiKey.middleware');
const callRoutes = require('./routes/call.routes');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const app = express();

// JSON is still useful for health/future APIs. /sync itself is multipart and
// Multer parses that route before the controller.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Call Logs API is running',
  });
});

app.use('/api/calls', apiKeyMiddleware, callRoutes);
app.use(notFound);
app.use(errorHandler);

// Catalyst Advanced I/O owns the HTTP server/port. Do NOT call app.listen().
module.exports = app;
