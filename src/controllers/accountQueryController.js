const db = require('../db');
const eventStore = require('../eventStore/eventStore');

exports.getAccountDetails = async (req, res) => {
    try {
        const { accountId } = req.params;
        const result = await db.query('SELECT account_id as "accountId", owner_name as "ownerName", balance, currency, status FROM account_summaries WHERE account_id = $1', [accountId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Account projection not found' });
        }

        const account = result.rows[0];
        account.balance = parseFloat(account.balance);
        res.status(200).json(account);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getAccountEvents = async (req, res) => {
    try {
        const { accountId } = req.params;
        const events = await eventStore.getEventsForAggregate(accountId);

        res.status(200).json(events.map(e => ({
            eventId: e.event_id,
            eventType: e.event_type,
            eventNumber: e.event_number,
            data: typeof e.event_data === 'string' ? JSON.parse(e.event_data) : e.event_data,
            timestamp: e.timestamp
        })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getBalanceAtTimestamp = async (req, res) => {
    try {
        const { accountId, timestamp } = req.params;
        const targetTime = new Date(timestamp);

        // Load all events up to the specific time
        const result = await db.query(
            'SELECT * FROM events WHERE aggregate_id = $1 AND timestamp <= $2 ORDER BY event_number ASC',
            [accountId, targetTime]
        );

        let balance = 0;

        for (const event of result.rows) {
            const eventData = typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data;
            if (event.event_type === 'AccountCreated') balance = parseFloat(eventData.initialBalance) || 0;
            else if (event.event_type === 'MoneyDeposited') balance += parseFloat(eventData.amount);
            else if (event.event_type === 'MoneyWithdrawn') balance -= parseFloat(eventData.amount);
        }

        res.status(200).json({
            accountId,
            balanceAt: balance,
            timestamp: targetTime.toISOString()
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getAccountTransactions = async (req, res) => {
    try {
        const { accountId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        // Get total count
        const countResult = await db.query('SELECT COUNT(*) FROM transaction_history WHERE account_id = $1', [accountId]);
        const totalCount = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalCount / pageSize);

        // Get transactions
        const result = await db.query(
            'SELECT transaction_id as "transactionId", type, amount, description, timestamp FROM transaction_history WHERE account_id = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3',
            [accountId, pageSize, offset]
        );

        res.status(200).json({
            currentPage: page,
            pageSize,
            totalPages,
            totalCount,
            items: result.rows.map(row => ({
                ...row,
                amount: parseFloat(row.amount)
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
