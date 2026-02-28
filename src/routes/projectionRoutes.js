const express = require('express');
const router = express.Router();
const projectionController = require('../controllers/projectionController');

// Projection Routes
router.post('/rebuild', projectionController.rebuildProjections);
router.get('/status', projectionController.getProjectionStatus);

module.exports = router;
