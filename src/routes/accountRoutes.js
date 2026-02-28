const express = require('express');
const router = express.Router();
const accountCommandController = require('../controllers/accountCommandController');
const accountQueryController = require('../controllers/accountQueryController');

// Command Routes
router.post('/', accountCommandController.createAccount);
router.post('/:accountId/deposit', accountCommandController.deposit);
router.post('/:accountId/withdraw', accountCommandController.withdraw);
router.post('/:accountId/close', accountCommandController.closeAccount);

// Query Routes
router.get('/:accountId', accountQueryController.getAccountDetails);
router.get('/:accountId/events', accountQueryController.getAccountEvents);
router.get('/:accountId/balance-at/:timestamp', accountQueryController.getBalanceAtTimestamp);
router.get('/:accountId/transactions', accountQueryController.getAccountTransactions);

module.exports = router;
