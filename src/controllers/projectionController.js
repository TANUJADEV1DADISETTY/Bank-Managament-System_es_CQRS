const rebuilder = require('../projections/rebuilder');
const db = require('../db');

exports.rebuildProjections = async (req, res) => {
    try {
        // Run in background
        rebuilder.rebuild().catch(err => console.error('Rebuild failed', err));

        res.status(202).json({ message: 'Projection rebuild initiated.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getProjectionStatus = async (req, res) => {
    try {
        const totalEventsResult = await db.query("SELECT COUNT(*) FROM events");
        const totalEventsInStore = parseInt(totalEventsResult.rows[0].count);

        const statusResult = await db.query("SELECT * FROM projection_status");

        const projections = statusResult.rows.map(row => {
            const processed = parseInt(row.last_processed_event_number_global) || 0;
            return {
                name: row.name,
                lastProcessedEventNumberGlobal: processed,
                lag: Math.max(0, totalEventsInStore - processed)
            };
        });

        res.status(200).json({
            totalEventsInStore,
            projections
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
