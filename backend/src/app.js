const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { config } = require('./config');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const SESSION_HEADERS = ['Content-Type', 'x-session-id', 'x-demo-user', 'Authorization'];

// FRONTEND_ORIGIN is a comma-separated list (contract section 10).
// Requests without an Origin header (curl, CloudTalk server-to-server) are allowed.
const frontendCors = cors({
  origin(origin, cb) {
    if (!origin || config.frontendOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  allowedHeaders: SESSION_HEADERS,
});

// CloudTalk webhooks come from CloudTalk servers, not the browser.
const webhookCors = cors({ origin: '*' });

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true); // behind the cloudflared tunnel

  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  app.use('/api/cloudtalk', webhookCors);
  app.use(frontendCors);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.use('/api', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
