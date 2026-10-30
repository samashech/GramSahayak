const { Router } = require('express');
const { config } = require('../config');
const { sendSuccess, AppError } = require('../utils/response');
const seedService = require('../services/seedService');

const router = Router();

// POST /api/demo/reset -> {reset:true, users:[..]} (only when DEMO_MODE=true)
// Restores the 5 persona sessions/profiles; other sessions are left alone.
router.post('/reset', async (req, res) => {
  if (!config.demoMode) throw new AppError('ERR_NOT_FOUND', 'Demo reset is disabled (DEMO_MODE=false)');
  seedService.loadPersonas();
  await seedService.seedDemoUsers({ wipe: true });
  sendSuccess(res, { reset: true, users: seedService.listPersonas() });
});

module.exports = router;
