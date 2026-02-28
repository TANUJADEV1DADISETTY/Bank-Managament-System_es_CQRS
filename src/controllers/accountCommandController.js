const eventStore = require('../eventStore/eventStore');
const db = require('../db');

exports.createAccount = async (req, res) => {
    try {
        const { accountId, ownerName, initialBalance, currency } = req.body;

        if (!accountId || !ownerName || initialBalance === undefined || !currency) {
            return res.status(400).json({ error: 'Missing required configuration for account creation.' });
        }

        // Verify uniqueness by attempting to load events
        const existingEvents = await eventStore.getEventsForAggregate(accountId);
        if (existingEvents.length > 0) {
            return res.status(409).json({ error: 'Account already exists.' });
        }

        const initialBalNumber = parseFloat(initialBalance);
        if (isNaN(initialBalNumber) || initialBalNumber < 0) {
            return res.status(400).json({ error: 'Invalid initial balance.' });
        }

        await eventStore.appendEvent(accountId, 'AccountCreated', {
            ownerName,
            initialBalance: initialBalNumber,
            currency
        });

        res.status(202).json({ message: 'Account creation accepted.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.deposit = async (req, res) => {
    try {
        const { accountId } = req.params;
        const { amount, description, transactionId } = req.body;

        if (!amount || amount <= 0 || !transactionId) {
            return res.status(400).json({ error: 'Invalid deposit parameters.' });
        }

        const state = await eventStore.reconstructState(accountId);
        if (!state) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        if (state.status === 'CLOSED') {
            return res.status(409).json({ error: 'Account is closed.' });
        }

        // Idempotency check 
        if (state.processedTransactions && state.processedTransactions[transactionId]) {
            return res.status(202).json({ message: 'Deposit already processed (Idempotency).' });
        }

        await eventStore.appendEvent(accountId, 'MoneyDeposited', {
            amount: parseFloat(amount),
            description,
            transactionId
        });

        res.status(202).json({ message: 'Deposit accepted.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.withdraw = async (req, res) => {
    try {
        const { accountId } = req.params;
        const { amount, description, transactionId } = req.body;

        if (!amount || amount <= 0 || !transactionId) {
            return res.status(400).json({ error: 'Invalid withdrawal parameters.' });
        }

        const state = await eventStore.reconstructState(accountId);
        if (!state) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        if (state.status === 'CLOSED') {
            return res.status(409).json({ error: 'Account is closed.' });
        }

        // Idempotency check 
        if (state.processedTransactions && state.processedTransactions[transactionId]) {
            return res.status(202).json({ message: 'Withdrawal already processed (Idempotency).' });
        }

        const withdrawAmount = parseFloat(amount);
        if (state.balance < withdrawAmount) {
            return res.status(409).json({ error: 'Insufficient funds.' });
        }

        await eventStore.appendEvent(accountId, 'MoneyWithdrawn', {
            amount: withdrawAmount,
            description,
            transactionId
        });

        res.status(202).json({ message: 'Withdrawal accepted.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.closeAccount = async (req, res) => {
    try {
        const { accountId } = req.params;
        const { reason } = req.body;

        const state = await eventStore.reconstructState(accountId);
        if (!state) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        if (state.status === 'CLOSED') {
            return res.status(202).json({ message: 'Account is already closed.' });
        }

        if (state.balance !== 0) {
            return res.status(409).json({ error: 'Account balance must be zero to close.' });
        }

        await eventStore.appendEvent(accountId, 'AccountClosed', { reason });

        res.status(202).json({ message: 'Account close accepted.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
