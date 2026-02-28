async function appendEvent(client, event) {
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
}