const { Router } = require('express');
const healthRoutes = require('./healthRoutes');
const demoRoutes = require('./demoRoutes');
const schemeRoutes = require('./schemeRoutes');

// Feature routers (schemes, profile, chat, simulators, cloudtalk, stream) mount here in B-03..B-08.
const router = Router();

router.use('/health', healthRoutes);
router.use('/demo', demoRoutes);
router.use('/schemes', schemeRoutes);

module.exports = router;
