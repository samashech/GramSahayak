const { Router } = require('express');
const { config } = require('../config');
const { sendSuccess } = require('../utils/response');
const dbAdapter = require('../adapters/dbAdapter');
const ragClient = require('../services/ragClient');

const router = Router();

// GET /api/health -> {node:{uptimeSec}, db:{driver,ok}, rag:{ok,vectorCount}, sarvam:{configured}, mockMode}
router.get('/', async (req, res) => {
  const [db, rag] = await Promise.all([dbAdapter.health(), ragClient.health()]);
  sendSuccess(res, {
    node: { uptimeSec: Math.round(process.uptime()) },
    db: { driver: db.driver, ok: db.ok },
    rag: { ok: rag.ok, vectorCount: rag.vectorCount },
    sarvam: { configured: Boolean(config.sarvamApiKey) },
    mockMode: config.useMockAi,
  });
});

module.exports = router;
