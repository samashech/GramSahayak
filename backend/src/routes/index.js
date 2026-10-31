const { Router } = require('express');
const healthRoutes = require('./healthRoutes');
const demoRoutes = require('./demoRoutes');
const schemeRoutes = require('./schemeRoutes');
const profileRoutes = require('./profileRoutes');
const eligibilityRoutes = require('./eligibilityRoutes');
const chatRoutes = require('./chatRoutes');
const cloudtalkRoutes = require('./cloudtalkRoutes');
const simulateRoutes = require('./simulateRoutes');
const streamRoutes = require('./streamRoutes');
const docsRoutes = require('./docsRoutes');
const agentRoutes = require('./agentRoutes');
const { sessionContext } = require('../middlewares/sessionContext');

// Feature routers (schemes, profile, chat, simulators, cloudtalk, stream) mount here in B-03..B-08.
const router = Router();

router.use('/health', healthRoutes);
router.use('/stream', streamRoutes); // SSE: no session needed
router.use('/docs', docsRoutes); // Swagger / OpenAPI
router.use('/agent', agentRoutes); // Sarvam voice agent tool (bearer token)
router.use(sessionContext);
router.use('/demo', demoRoutes);
router.use('/schemes', schemeRoutes);
router.use('/profile', profileRoutes);
router.use('/eligibility', eligibilityRoutes);
router.use('/', chatRoutes); // /chat, /voice-chat
router.use('/cloudtalk', cloudtalkRoutes);
router.use('/', simulateRoutes); // /ivr-simulate, /sms-simulate

module.exports = router;
