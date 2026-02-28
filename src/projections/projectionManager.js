const db = require('../db');

class ProjectionManager {
    async handleEvent(event) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const eventData = typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data;

            if (event.event_type === 'AccountCreated') {
                await client.query(
                    `INSERT INTO account_summaries (account_id, owner_name, balance, currency, status, version)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (account_id) DO NOTHING`,
                    [event.aggregate_id, eventData.ownerName, eventData.initialBalance, eventData.currency || 'USD', 'OPEN', event.event_number]
                );
            } else if (event.event_type === 'MoneyDeposited') {
                await client.query(
                    `UPDATE account_summaries SET balance = balance + $1, version = $2 WHERE account_id = $3 AND version < $2`,
                    [eventData.amount, event.event_number, event.aggregate_id]
                );
                await client.query(
                    `INSERT INTO transaction_history (transaction_id, account_id, type, amount, description, timestamp)
                     VALUES ($1, $2, $3, $4, $5, NOW())
                     ON CONFLICT (transaction_id) DO NOTHING`,
                    [eventData.transactionId, event.aggregate_id, 'DEPOSIT', eventData.amount, eventData.description || '']
                );
            } else if (event.event_type === 'MoneyWithdrawn') {
                await client.query(
                    `UPDATE account_summaries SET balance = balance - $1, version = $2 WHERE account_id = $3 AND version < $2`,
                    [eventData.amount, event.event_number, event.aggregate_id]
                );
                await client.query(
                    `INSERT INTO transaction_history (transaction_id, account_id, type, amount, description, timestamp)
                     VALUES ($1, $2, $3, $4, $5, NOW())
                     ON CONFLICT (transaction_id) DO NOTHING`,
                    [eventData.transactionId, event.aggregate_id, 'WITHDRAWAL', eventData.amount, eventData.description || '']
                );
            } else if (event.event_type === 'AccountClosed') {
                await client.query(
                    `UPDATE account_summaries SET status = 'CLOSED', version = $1 WHERE account_id = $2 AND version < $1`,
                    [event.event_number, event.aggregate_id]
                );
            }

            // Update projection status based on highest event number (this implementation simplifies global event ordering assumption)
            // Ideally should be separate for AccountSummaries and TransactionHistory but they share events here.
            await client.query(
                `UPDATE projection_status SET last_processed_event_number_global = GREATEST(last_processed_event_number_global, $1) WHERE name = 'AccountSummaries'`,
                [event.event_number]
            );
            await client.query(
                `UPDATE projection_status SET last_processed_event_number_global = GREATEST(last_processed_event_number_global, $1) WHERE name = 'TransactionHistory'`,
                [event.event_number]
            );

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Projection mapping error', error);
        } finally {
            client.release();
        }
    }
}

module.exports = new ProjectionManager();
