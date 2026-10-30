const { Router } = require('express');
const { sendSuccess } = require('../utils/response');
const { languageCodeOr } = require('../utils/validate');
const sessionService = require('../services/sessionService');
const eligibilityEngine = require('../services/eligibilityEngine');

const router = Router();

// POST /api/eligibility {profile (partial ok), languageCode}
//   -> {eligibleSchemes, ineligibleSchemes:[{scheme, reason}], totalMatched, recommendedAction}
// Without a profile in the body, the session's stored profile is used.
router.post('/', async (req, res) => {
  const body = req.body || {};
  const stored = req.sessionUser?.profile || {};
  const profile = body.profile ? sessionService.sanitizeProfile(body.profile) : stored;
  const languageCode = languageCodeOr(body.languageCode, req.sessionUser?.language || 'hi-IN');
  sendSuccess(res, await eligibilityEngine.checkEligibility(profile, languageCode));
});

module.exports = router;
