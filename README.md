# 🏦 Bank Account Management System

### Event Sourcing + CQRS + Snapshotting

Backend Development – Finance Domain

---

## 📌 Overview

This project implements a Bank Account Management API using:

- Event Sourcing
- Command Query Responsibility Segregation (CQRS)
- Snapshotting Strategy
- PostgreSQL
- Node.js (Express)
- Docker & Docker Compose

The system ensures:

- Full auditability
- Historical reconstruction (time travel queries)
- Immutable event storage
- Scalable read/write separation
- Financial-grade business rule enforcement

---

# 🧠 Architecture Overview

## 🔹 Event Sourcing

Instead of storing only the current account state, the system stores every change as an immutable event.

Event Types:

- AccountCreated
- MoneyDeposited
- MoneyWithdrawn
- AccountClosed

State is reconstructed by replaying events.

---

## 🔹 CQRS

Write Model (Commands):

- Appends events to the event store
- Enforces business rules

Read Model (Queries):

- Reads from projection tables
- Never reads directly from the event store (except auditing/time travel)

---

## 🔹 Snapshotting

To avoid replaying long event streams:

- A snapshot is created after every 50 events.
- State reconstruction loads snapshot first.
- Remaining events are replayed.

---

# 🏗 Project Structure

bank-es-cqrs/
│
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── submission.json
├── README.md
│
├── seeds/
│ └── 01-schema.sql
│
└── src/
├── server.js
├── db.js
│
├── routes/
│ ├── command.routes.js
│ ├── query.routes.js
│ └── projection.routes.js
│
├── domain/
│ └── bankAccount.js
│
├── services/
│ ├── eventStore.js
│ ├── projector.js
│ └── snapshotService.js
│
└── utils/
└── validation.js

---

# 🐳 Running the Application

## Step 1 — Create .env file

Create a file named `.env` in project root:

API_PORT=8088  
DB_USER=postgres  
DB_PASSWORD=postgres  
DB_NAME=bank_db  
DATABASE_URL=postgresql://postgres:postgres@db:5432/bank_db

---

## Step 2 — Start Containers

docker-compose up --build

Wait until both services become healthy.

---

## Step 3 — Health Check

Open:

http://localhost:8088/health

Response:

OK

---

# 🗄 Database Schema

## 1️⃣ Event Store (events)

Columns:

- event_id (UUID, Primary Key)
- aggregate_id
- aggregate_type
- event_type
- event_data (JSONB)
- event_number
- timestamp
- version

Constraints:

- UNIQUE (aggregate_id, event_number)
- Index on aggregate_id

---

## 2️⃣ Snapshots Table

- snapshot_id (UUID, Primary Key)
- aggregate_id (Unique)
- snapshot_data (JSONB)
- last_event_number
- created_at

Index on aggregate_id

---

## 3️⃣ Read Model Tables

### account_summaries

- account_id (Primary Key)
- owner_name
- balance
- currency
- status
- version

### transaction_history

- transaction_id (Primary Key)
- account_id
- type
- amount
- description
- timestamp

---

# 📡 API Endpoints

---

# 🔵 COMMAND SIDE

## 1️⃣ Create Account

POST /api/accounts

Request:
{
"accountId": "acc-1",
"ownerName": "Jane Doe",
"initialBalance": 100,
"currency": "USD"
}

Responses:

- 202 Accepted
- 400 Bad Request
- 409 Conflict

---

## 2️⃣ Deposit Money

POST /api/accounts/{accountId}/deposit

{
"amount": 50,
"description": "Salary",
"transactionId": "txn-123"
}

Responses:

- 202 Accepted
- 404 Not Found
- 409 Conflict
- 400 Bad Request

---

## 3️⃣ Withdraw Money

POST /api/accounts/{accountId}/withdraw

{
"amount": 30,
"description": "ATM Withdrawal",
"transactionId": "txn-124"
}

Business Rules:

- Cannot withdraw more than balance
- Cannot operate on closed account

---

## 4️⃣ Close Account

POST /api/accounts/{accountId}/close

{
"reason": "Customer request"
}

Rule:

- Balance must be zero

---

# 🟢 QUERY SIDE

## 5️⃣ Get Account State

GET /api/accounts/{accountId}

Returns current projected state.

---

## 6️⃣ Get Event Stream

GET /api/accounts/{accountId}/events

Returns full ordered event history.

---

## 7️⃣ Time Travel Query

GET /api/accounts/{accountId}/balance-at/{timestamp}

Returns balance at specified time.

---

## 8️⃣ Paginated Transaction History

GET /api/accounts/{accountId}/transactions?page=2&pageSize=10

Returns:
{
"currentPage": 2,
"pageSize": 10,
"totalPages": 3,
"totalCount": 25,
"items": [...]
}

---

# 🔧 ADMIN ENDPOINTS

## 9️⃣ Rebuild Projections

POST /api/projections/rebuild

Replays entire event store to rebuild projections.

---

## 🔟 Projection Status

GET /api/projections/status

Returns:
{
"totalEventsInStore": 150,
"projections": [
{
"name": "AccountSummaries",
"lastProcessedEventNumberGlobal": 150,
"lag": 0
}
]
}

---

# ⚙️ Snapshot Strategy

Snapshots are created automatically when:

- 50th event is persisted
- 100th event is persisted
- 150th event is persisted

State loading process:

1. Load latest snapshot
2. Replay remaining events

---

# 🔐 Business Rules

- Cannot create duplicate account
- Cannot deposit negative amount
- Cannot withdraw more than balance
- Cannot operate on closed account
- Cannot close account unless balance = 0
- Immutable event storage

---

# 🔄 Event Flow

Command Received  
→ Reconstruct Aggregate  
→ Validate Business Rules  
→ Create Event  
→ Append Event  
→ Update Projections  
→ Return 202

---

# 🧪 Testing

You can test using:

- Postman
- curl
- pgAdmin for DB verification

---

# 🧾 submission.json

{
"testAccountId": "acc-test-12345",
"testAccountOwner": "Jane Doe"
}

Used for automated evaluation.

---

# 🛡 Error Handling

- 400 → Invalid Input
- 404 → Account Not Found
- 409 → Business Rule Violation
- 500 → Internal Server Error

---

# 🚀 Production Improvements

In real-world systems:

- Use Kafka or RabbitMQ for async projections
- Implement optimistic locking
- Add event upcasters
- Add distributed tracing
- Partition event store
- Add monitoring and alerting

---

# 📚 Concepts Demonstrated

- Domain Driven Design
- Event Sourcing
- CQRS
- Snapshotting
- Immutable Audit Logs
- Financial Data Integrity
- Containerized Deployment

---

# 🏁 Final Notes

This project demonstrates real-world financial backend architecture with strict data integrity and full audit capability.

It ensures:

- Complete audit trail
- Historical reconstruction
- Strong business rule enforcement
- Scalable system design
- Dockerized deployment

---

👨‍💻 Backend Event-Driven System Implementation  
Finance Domain Architecture
