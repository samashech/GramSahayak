const { Router } = require('express');
const healthRoutes = require('./healthRoutes');
const demoRoutes = require('./demoRoutes');
const schemeRoutes = require('./schemeRoutes');
const profileRoutes = require('./profileRoutes');
const eligibilityRoutes = require('./eligibilityRoutes');
const chatRoutes = require('./chatRoutes');
const { sessionContext } = require('../middlewares/sessionContext');

// Feature routers (schemes, profile, chat, simulators, cloudtalk, stream) mount here in B-03..B-08.
const router = Router();

router.use('/health', healthRoutes);
router.use(sessionContext);
router.use('/demo', demoRoutes);
router.use('/schemes', schemeRoutes);
router.use('/profile', profileRoutes);
router.use('/eligibility', eligibilityRoutes);
router.use('/', chatRoutes); // /chat, /voice-chat

module.exports = router;
