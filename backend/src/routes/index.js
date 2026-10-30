const { Router } = require('express');
const healthRoutes = require('./healthRoutes');

// Feature routers (schemes, profile, chat, simulators, cloudtalk, stream) mount here in B-03..B-08.
const router = Router();

router.use('/health', healthRoutes);

module.exports = router;
