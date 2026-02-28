const db = require('../db');
const projectionManager = require('./projectionManager');

class Rebuilder {
    async rebuild() {
        // Clear tables
        await db.query('TRUNCATE TABLE account_summaries');
        await db.query('TRUNCATE TABLE transaction_history');
        await db.query(`UPDATE projection_status SET last_processed_event_number_global = 0 WHERE name IN ('AccountSummaries', 'TransactionHistory')`);

        // Get all events ordered by time/number
        const eventsResult = await db.query('SELECT * FROM events ORDER BY timestamp ASC, event_number ASC');
        const events = eventsResult.rows;

        for (const event of events) {
            await projectionManager.handleEvent(event);
        }
    }
}

module.exports = new Rebuilder();
