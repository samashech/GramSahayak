const { Router } = require('express');
const { sendSuccess } = require('../utils/response');
const { requireSession } = require('../middlewares/sessionContext');
const sessionService = require('../services/sessionService');

const router = Router();

// GET /api/profile -> {profile, history:[Turn]}  (web + ivr + sms turns in one timeline)
router.get('/', async (req, res) => {
  const key = requireSession(req);
  sendSuccess(res, await sessionService.getProfileWithHistory(key));
});

// POST /api/profile (partial Profile, snake_case) -> {profile}
router.post('/', async (req, res) => {
  const key = requireSession(req);
  const body = req.body && typeof req.body.profile === 'object' ? req.body.profile : req.body || {};
  const profile = await sessionService.updateProfile(key, body, { phone: req.sessionUser.phone });
  sendSuccess(res, { profile });
});

module.exports = router;
