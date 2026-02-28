const db = require('../db');

class EventStore {
    async appendEvent(aggregateId, eventType, eventData, expectedVersion = null) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            // Get current version
            const versionResult = await client.query(
                'SELECT MAX(event_number) as max_version FROM events WHERE aggregate_id = $1',
                [aggregateId]
            );

            let currentVersion = versionResult.rows[0].max_version || 0;
            currentVersion = parseInt(currentVersion, 10);

            if (expectedVersion !== null && expectedVersion !== currentVersion) {
                throw new Error('ConcurrencyException: Expected version does not match current version');
            }

            const nextVersion = currentVersion + 1;
            const eventId = require('uuid').v4();

            // Insert event
            await client.query(
                `INSERT INTO events (event_id, aggregate_id, aggregate_type, event_type, event_data, event_number, timestamp, version) 
                 VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
                [eventId, aggregateId, 'BankAccount', eventType, eventData, nextVersion, 1]
            );

            // Handle snapshot creation every 50 events
            if (nextVersion % 50 === 0) {
                const snapshotDataResult = await this.reconstructState(aggregateId, client);
                if (snapshotDataResult) {
                    await client.query(
                        `INSERT INTO snapshots (snapshot_id, aggregate_id, snapshot_data, last_event_number) 
                         VALUES ($1, $2, $3, $4)
                         ON CONFLICT (aggregate_id) DO UPDATE SET 
                         snapshot_data = EXCLUDED.snapshot_data, last_event_number = EXCLUDED.last_event_number`,
                        [require('uuid').v4(), aggregateId, snapshotDataResult, nextVersion]
                    );
                }
            }

            await client.query('COMMIT');

            // Trigger projection synchronously as specified by simple architecture requirement
            await require('../projections/projectionManager').handleEvent({
                event_id: eventId,
                aggregate_id: aggregateId,
                event_type: eventType,
                event_data: eventData,
                event_number: nextVersion
            });

            return { eventId, nextVersion };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async getEventsForAggregate(aggregateId, fromVersion = 0, toVersion = null) {
        let query = 'SELECT * FROM events WHERE aggregate_id = $1 AND event_number > $2';
        const params = [aggregateId, fromVersion];

        if (toVersion !== null) {
            query += ' AND event_number <= $3';
            params.push(toVersion);
        }

        query += ' ORDER BY event_number ASC';

        const result = await db.query(query, params);
        return result.rows;
    }

    async loadSnapshot(aggregateId) {
        const result = await db.query(
            'SELECT * FROM snapshots WHERE aggregate_id = $1 ORDER BY last_event_number DESC LIMIT 1',
            [aggregateId]
        );
        return result.rows[0] || null;
    }

    async reconstructState(aggregateId, providedClient = null) {
        let state = null;
        let fromVersion = 0;

        // Try to load latest snapshot
        const snapshot = await this.loadSnapshot(aggregateId);
        if (snapshot) {
            state = typeof snapshot.snapshot_data === 'string' ? JSON.parse(snapshot.snapshot_data) : snapshot.snapshot_data;
            fromVersion = snapshot.last_event_number;
        }

        // Get remaining events
        const queryClient = providedClient || db;
        const eventsResult = await queryClient.query(
            'SELECT * FROM events WHERE aggregate_id = $1 AND event_number > $2 ORDER BY event_number ASC',
            [aggregateId, fromVersion]
        );

        const events = eventsResult.rows;
        if (!state && events.length === 0) return null;

        if (!state) state = { balance: 0, status: null, ownerName: null, currency: null, processedTransactions: {} };

        // Apply events to state
        for (const event of events) {
            const eventData = typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data;
            this.applyEventToState(state, event.event_type, eventData);
        }

        return state;
    }

    applyEventToState(state, eventType, eventData) {
        switch (eventType) {
            case 'AccountCreated':
                state.ownerName = eventData.ownerName;
                state.balance = parseFloat(eventData.initialBalance) || 0;
                state.currency = eventData.currency || 'USD';
                state.status = 'OPEN';
                break;
            case 'MoneyDeposited':
                state.balance += parseFloat(eventData.amount);
                state.processedTransactions[eventData.transactionId] = true;
                break;
            case 'MoneyWithdrawn':
                state.balance -= parseFloat(eventData.amount);
                state.processedTransactions[eventData.transactionId] = true;
                break;
            case 'AccountClosed':
                state.status = 'CLOSED';
                break;
        }
    }
}

module.exports = new EventStore();
