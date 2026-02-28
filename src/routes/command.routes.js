const express = require('express');
const router = express.Router();
const pool = require('../db');
const { v4: uuidv4 } = require('uuid');
const { applyEvent } = require('../domain/bankAccount');

router.post('/accounts', async (req, res) => {
  const { accountId, ownerName, initialBalance, currency } = req.body;

  if (!accountId || !ownerName || initialBalance < 0 || !currency) {
    return res.status(400).json({ message: "Invalid input" });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if account already exists
    const existing = await client.query(
      "SELECT 1 FROM events WHERE aggregate_id = $1",
      [accountId]
    );

    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: "Account already exists" });
    }

    const event = {
      event_id: uuidv4(),
      aggregate_id: accountId,
      event_type: 'AccountCreated',
      event_data: {
        ownerName,
        initialBalance,
        currency
      },
      event_number: 1
    };

    await client.query(`
      INSERT INTO events
      (event_id, aggregate_id, aggregate_type, event_type, event_data, event_number)
      VALUES ($1,$2,$3,$4,$5,$6)
    `, [
      event.event_id,
      event.aggregate_id,
      'BankAccount',
      event.event_type,
      event.event_data,
      event.event_number
    ]);

    await client.query('COMMIT');

    res.status(202).json({ message: "Account created" });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

module.exports = router;