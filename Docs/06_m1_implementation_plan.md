# 06 — M1 Implementation Plan

**Project:** Adversarial GenAI Framework for Proactive Testing of Payment-Fraud Defenses  
**Module:** M1 — Synthetic Banking Simulator  
**Document:** `06_m1_implementation_plan.md`  
**Version:** 1.0  
**Status:** Implementation Baseline  
**Date:** 2026-08-29  
**Primary Owner:** Person 1

---

## 1. Purpose

This document converts the M1 design artifacts into an executable development plan.

The implementation sequence is based on:

```text
M1_SCOPE.md
      ↓
simulator-domain-model.md
      ↓
02_database_design.md
      ↓
03_api_contract.yaml
      ↓
04_event_contract.json
      ↓
05_event_publisher_design.md
      ↓
THIS DOCUMENT
      ↓
M1 IMPLEMENTATION
```

The goal is to build a working synthetic banking simulator that can:

1. Create and manage synthetic banking entities.
2. Execute valid simulated banking operations.
3. Maintain financially consistent account/ledger state.
4. Produce canonical simulator events.
5. Publish those events through Kafka.
6. Provide a stable API boundary for the future Red Team.
7. Provide telemetry that the future Blue Team can consume.

The SDD defines the simulator as part of a larger architecture in which the Red Team reaches the simulator through Core APIs and simulator events flow through Kafka to downstream processing. fileciteturn15file0L11-L27

---

# 2. M1 Scope

## 2.1 Build

M1 will implement:

```text
Synthetic Users
Synthetic KYC
Synthetic Devices
Synthetic Accounts
Synthetic Merchants
Synthetic Beneficiaries
Authentication Simulation
Transactions
Ledger
Simulation Metadata
Simulation Clock
Domain Events
Event Outbox
Kafka Publisher
Simulator REST APIs
Synthetic Data Generator
Automated Tests
```

## 2.2 Do not build inside M1

Do NOT implement:

```text
GenAI Planner
Attack Composer
Adaptive Agent
Fraud Detection Models
XGBoost
GNN
Autoencoder
Ensemble Risk Engine
Neo4j fraud graph
Redis feature engineering
Blue Team dashboard
Evaluation engine
```

Those belong to later modules.

The SDD places the GenAI Planner, Attack Composer, Attack Orchestrator and Adaptive Agent in the Red Team, while the simulator exposes Core APIs to that layer. fileciteturn15file0L11-L20

---

# 3. Technology Boundary

The current SDD specifies:

```text
Node.js / Express
       |
       +---- PostgreSQL
       |
       +---- MongoDB
       |
       +---- Kafka
```

The SDD specifies PostgreSQL for ACID-compliant ledger transactions, MongoDB for KYC/user-profile metadata, and Kafka for asynchronous event propagation.

Do not introduce additional infrastructure unless it is required by an implementation decision.

---

# 4. Recommended Repository Structure

Start with:

```text
project/
│
├── simulator/
│   ├── src/
│   │   ├── api/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   └── middleware/
│   │   │
│   │   ├── application/
│   │   │   └── services/
│   │   │
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   ├── value-objects/
│   │   │   ├── events/
│   │   │   └── errors/
│   │   │
│   │   ├── infrastructure/
│   │   │   ├── postgres/
│   │   │   │   ├── repositories/
│   │   │   │   └── migrations/
│   │   │   ├── mongodb/
│   │   │   │   └── repositories/
│   │   │   └── kafka/
│   │   │
│   │   ├── events/
│   │   │   ├── envelope/
│   │   │   ├── factory/
│   │   │   ├── validator/
│   │   │   └── publisher/
│   │   │
│   │   ├── outbox/
│   │   │   ├── repository/
│   │   │   └── relay/
│   │   │
│   │   ├── simulation/
│   │   └── config/
│   │
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   │
│   └── docs/
│
├── docs/
│   └── M1/
│
└── docker-compose.yml
```

This structure is a proposed engineering organization, not an explicit requirement of the SDD.

---

# 5. Phase 0 — Repository and Development Environment

## Objective

Create a reproducible local development environment.

## Tasks

### 5.1 Initialize project

Create:

```text
simulator/
package.json
src/
tests/
.env.example
README.md
```

### 5.2 Configure Node.js/Express

Implement:

```text
Express application
JSON middleware
error middleware
health endpoint
API versioning
environment configuration
```

### 5.3 Local infrastructure

Provide development services for:

```text
PostgreSQL
MongoDB
Kafka
```

Prefer Docker Compose for local reproducibility.

### 5.4 Configuration

Create:

```text
.env.example
```

with variables such as:

```text
PORT
POSTGRES_HOST
POSTGRES_PORT
POSTGRES_DATABASE
POSTGRES_USER
POSTGRES_PASSWORD

MONGODB_URI

KAFKA_BROKERS
KAFKA_CLIENT_ID
```

Never commit actual credentials.

## Acceptance criteria

```text
npm install
npm run dev
```

starts the simulator and:

```text
GET /health
```

returns success.

All local infrastructure is reachable.

---

# 6. Phase 1 — Domain Foundation

## Objective

Implement domain types and state definitions before connecting them to HTTP.

Create:

```text
User
KycRecord
Device
Account
Merchant
Beneficiary
Transaction
LedgerEntry
Simulation
AuthEvent
EventEnvelope
```

Implement state enums/constants:

```text
AccountStatus
TransactionStatus
BeneficiaryStatus
DeviceStatus
KycStatus
SimulationStatus
AuthEventType
EventType
```

## Rule

Do not put database calls inside domain entities.

Use:

```text
Entity
  ↓
Domain/Application Service
  ↓
Repository
```

## Acceptance criteria

Unit tests prove:

- valid state transitions work;
- invalid state transitions are rejected;
- invalid financial values are rejected.

---

# 7. Phase 2 — PostgreSQL

## Objective

Implement strongly consistent financial persistence.

Create migrations for:

```text
accounts
merchants
beneficiaries
transactions
ledger_entries
simulations
event_outbox
```

The first five are directly aligned with the M1 domain/database design; `simulations` and `event_outbox` are proposed engineering additions.

## Migration order

```text
001_accounts
002_merchants
003_beneficiaries
004_transactions
005_ledger_entries
006_simulations
007_event_outbox
008_indexes
```

## Verify

```text
Primary keys
Foreign keys
Unique constraints
Check constraints
Indexes
Timestamp fields
```

## Acceptance criteria

A clean database can be created entirely from migrations.

No manual database changes are required.

---

# 8. Phase 3 — MongoDB

## Objective

Implement document-oriented profile persistence.

Create repositories/collections for:

```text
users
kyc_records
devices
```

## Verify

```text
Create user
Read user
Update user
Deactivate user

Create KYC
Read KYC
Update KYC

Register device
Read device
Update device
Retire device
```

## Cross-database consistency

Because user/profile records live in MongoDB while financial records live in PostgreSQL:

```text
Application Service
      |
      +--> validate user in MongoDB
      |
      +--> write account in PostgreSQL
```

No cross-database foreign keys should be assumed.

---

# 9. Phase 4 — User and Account Services

## Objective

Build the first complete banking flow.

### UserService

Implement:

```text
createUser()
getUser()
updateUser()
deactivateUser()
```

### AccountService

Implement:

```text
createAccount()
getAccount()
listAccounts()
changeAccountStatus()
closeAccount()
```

## First integration flow

```text
Create User
     ↓
Create KYC
     ↓
Create Account
     ↓
Read Account
```

## Acceptance criteria

The flow works through both:

```text
service layer
REST API
```

---

# 10. Phase 5 — Device and KYC

## DeviceService

Implement:

```text
registerDevice()
getDevice()
listDevices()
updateDevice()
retireDevice()
```

Generate:

```text
DEVICE_REGISTERED
DEVICE_UPDATED
DEVICE_RETIRED
```

## KYCService

Implement:

```text
createKyc()
getKyc()
listKyc()
updateKyc()
deleteTestKyc()
```

Generate:

```text
KYC_CREATED
KYC_UPDATED
KYC_DELETED
```

## Acceptance criteria

A user can have:

```text
1+ devices
1 KYC record
```

and all changes are observable as events.

---

# 11. Phase 6 — Authentication Simulation

## Objective

Create a deterministic simulated authentication flow.

Implement:

```text
login()
verifyPassword()
requestOtp()
verifyOtp()
createSession()
logout()
expireSession()
```

State sequence:

```text
LOGIN_REQUESTED
       ↓
PASSWORD_VERIFIED
       ↓
OTP_REQUIRED
       ↓
OTP_VERIFIED
       ↓
AUTHENTICATED
```

Failure paths:

```text
PASSWORD_FAILED
OTP_FAILED
```

Events:

```text
AUTH_LOGIN_REQUESTED
AUTH_LOGIN_SUCCESS
AUTH_LOGIN_FAILED
AUTH_OTP_REQUESTED
AUTH_OTP_VERIFIED
AUTH_OTP_FAILED
AUTH_SESSION_CREATED
AUTH_SESSION_EXPIRED
AUTH_LOGOUT
```

## Important

This is a simulation.

Do not build real OTP interception, real telecom forwarding, real session theft, or real identity compromise.

The simulator should represent the resulting observable event/state needed for controlled experiments.

---

# 12. Phase 7 — Beneficiary Service

Implement:

```text
addBeneficiary()
getBeneficiary()
listBeneficiaries()
updateBeneficiary()
disableBeneficiary()
```

State:

```text
PENDING
ACTIVE
DISABLED
```

Event:

```text
BENEFICIARY_ADDED
```

The service must validate:

```text
user exists
target account exists
beneficiary ownership
duplicate beneficiary rules
```

---

# 13. Phase 8 — Transaction and Ledger

This is the most critical M1 implementation phase.

## 13.1 TransactionService

Implement:

```text
createTransaction()
authorizeTransaction()
processTransaction()
completeTransaction()
failTransaction()
reverseTransaction()
```

## 13.2 LedgerService

Implement:

```text
createDebit()
createCredit()
validateLedger()
```

## 13.3 Atomic flow

```text
BEGIN
   ↓
lock sender
   ↓
validate balance
   ↓
validate destination
   ↓
create transaction
   ↓
debit sender
   ↓
credit receiver
   ↓
create debit ledger
   ↓
create credit ledger
   ↓
create outbox event
   ↓
COMMIT
```

If anything fails:

```text
ROLLBACK
```

## 13.4 Concurrency test

Run two transactions simultaneously against the same account.

Verify:

```text
initial balance = 10,000
transaction A = 7,000
transaction B = 7,000

Expected:
only one can succeed
```

The exact isolation/locking implementation should be selected and tested rather than assumed.

## 13.5 Idempotency test

Send:

```text
Idempotency-Key: ABC123
```

twice.

Expected:

```text
one financial transaction
not two
```

---

# 14. Phase 9 — Event System

## Objective

Implement the event contract independently from Kafka.

Create:

```text
EventEnvelope
EventFactory
EventValidator
EventPublisher
```

## Event creation

```text
Domain Service
      ↓
EventFactory
      ↓
EventEnvelope
      ↓
Validator
```

## Required envelope

```text
event_id
event_type
event_version
occurred_at
simulation_time
simulation_id
experiment_id
source
entity_type
entity_id
actor_id
device_id
correlation_id
causation_id
idempotency_key
payload
adversarial_metadata
```

## Acceptance criteria

Every supported event validates against:

```text
04_event_contract.json
```

---

# 15. Phase 10 — Transactional Outbox

## Objective

Ensure database state and publishable event state remain consistent.

Create:

```text
event_outbox
```

When changing domain state:

```text
BEGIN
   |
   +--> domain state change
   |
   +--> insert outbox event
   |
COMMIT
```

Then:

```text
Outbox Relay
      ↓
find PENDING events
      ↓
validate
      ↓
publish
      ↓
mark PUBLISHED
```

## Failure behavior

Kafka unavailable:

```text
event remains pending
      ↓
retry later
```

Invalid event:

```text
mark failed
record error
```

---

# 16. Phase 11 — Kafka Publisher

## Objective

Connect the event system to Kafka.

Implement:

```text
KafkaEventPublisher
Kafka configuration
topic routing
partition-key generation
retry logic
publisher health
```

Topic mapping:

```text
USER_*          → simulator.users.v1
ACCOUNT_*       → simulator.accounts.v1
TRANSACTION_*   → simulator.transactions.v1
DEVICE_*        → simulator.devices.v1
KYC_*           → simulator.kyc.v1
BENEFICIARY_*   → simulator.beneficiaries.v1
AUTH_*          → simulator.auth.v1
SIMULATION_*    → simulator.simulations.v1
```

These topic names are proposed in the event contract.

## Verify

Produce:

```text
TRANSACTION_COMPLETED
```

and consume it from Kafka.

---

# 17. Phase 12 — Simulation Engine

## Objective

Add experiment-aware simulator state.

Implement:

```text
createSimulation()
startSimulation()
pauseSimulation()
resumeSimulation()
completeSimulation()
failSimulation()
resetSimulation()
```

Simulation metadata:

```text
simulation_id
experiment_id
seed
status
simulation_time
configuration
```

## Simulation clock

Implement:

```text
currentTime()
advance()
pause()
reset()
```

The first version can use a simple controlled logical clock.

Do not over-engineer time virtualization in M1.

---

# 18. Phase 13 — Simulator Action Interface

This is the most important boundary for future Red Team integration.

## Architecture

```text
Future Red Team
      ↓
Simulator Action Interface
      ↓
Application Service
      ↓
Domain Logic
      ↓
Database
      ↓
Event
```

Example:

```json
{
  "action": "ADD_BENEFICIARY",
  "simulation_id": "SIM_001",
  "experiment_id": "EXP_001",
  "parameters": {
    "user_id": "USR_001",
    "target_account_id": "ACC_002"
  }
}
```

Return:

```json
{
  "success": true,
  "action_id": "ACT_001",
  "state_changes": [],
  "events": []
}
```

## Critical rule

The Red Team must never need:

```text
direct PostgreSQL writes
direct MongoDB writes
direct Kafka manipulation
```

The simulator is the controlled environment.

---

# 19. Phase 14 — REST API Implementation

Implement according to `03_api_contract.yaml`.

## Resources

```text
/users
/accounts
/transactions
/devices
/kycs
/beneficiaries
/auth_events
```

Namespace:

```text
/api/v1/simulator
```

## Layering

```text
HTTP Request
     ↓
Controller
     ↓
Application Service
     ↓
Domain
     ↓
Repository
     ↓
Database
```

Never:

```text
HTTP Controller
     ↓
raw SQL
```

---

# 20. Phase 15 — Synthetic Data Generator

## Objective

Generate coherent synthetic banking data.

Do not generate completely independent random rows.

Generate relationships:

```text
User
 ├── KYC
 ├── Devices
 └── Accounts
       ├── Beneficiaries
       └── Transactions
```

Generate normal behavioral sequences:

```text
registration
→ KYC
→ device registration
→ account creation
→ login
→ beneficiary
→ transaction
```

## Seed support

Allow:

```text
seed = 12345
```

to reproduce the same initial dataset.

This is important for comparing:

```text
Blue Team run A
vs
Blue Team run B
```

under controlled conditions.

---

# 21. Phase 16 — Automated Testing

## Unit tests

Test:

```text
state machines
validation
domain rules
ledger calculations
event factory
event validation
topic routing
```

## Integration tests

Test:

```text
MongoDB repositories
PostgreSQL repositories
Kafka publisher
Outbox relay
```

## E2E test

The minimum full flow should be:

```text
Create User
      ↓
Create KYC
      ↓
Register Device
      ↓
Create Account
      ↓
Authenticate
      ↓
Add Beneficiary
      ↓
Create Transaction
      ↓
Complete Transaction
      ↓
Verify Balance
      ↓
Verify Ledger
      ↓
Verify Outbox
      ↓
Verify Kafka Event
```

---

# 22. Phase 17 — Observability

Implement basic structured logging.

Every important operation should include:

```text
request_id
simulation_id
experiment_id
entity_id
event_id
action_id
```

Example:

```json
{
  "level": "info",
  "message": "transaction completed",
  "transaction_id": "TXN_001",
  "simulation_id": "SIM_001",
  "experiment_id": "EXP_001",
  "event_id": "EVT_001"
}
```

Do not add a large observability stack to M1 unless required.

Structured logs are sufficient for the MVP.

---

# 23. Phase 18 — Security Boundaries

Even though this is a simulator, implement basic controls.

### API

- input validation
- request-size limits
- centralized error handling
- no secrets in logs
- no production credentials
- synthetic data only

### Database

- separate development credentials
- least-privilege application user where practical
- migrations instead of manual production-style changes

### Red Team

The future Red Team should have controlled simulator access.

Do not give it arbitrary database credentials.

---

# 24. Phase 19 — M1 Integration Test Environment

The complete local environment should become:

```text
┌─────────────────────────┐
│     Simulator API       │
│       Node/Express      │
└────────────┬────────────┘
             │
      ┌──────┴───────┐
      ↓              ↓
 PostgreSQL       MongoDB
      │              │
      └──────┬───────┘
             ↓
        Event Outbox
             ↓
        Kafka Publisher
             ↓
           Kafka
             ↓
    Future Stream Processor
```

This matches the broader SDD architecture where simulator events flow through Kafka to downstream processing. fileciteturn15file0L21-L27

---

# 25. Development Sequence

Do not implement everything simultaneously.

Use this order:

```text
STEP 1
Repository + Docker + configuration
        ↓
STEP 2
Domain entities + state machines
        ↓
STEP 3
PostgreSQL + migrations
        ↓
STEP 4
MongoDB repositories
        ↓
STEP 5
User + Account
        ↓
STEP 6
KYC + Device
        ↓
STEP 7
Authentication
        ↓
STEP 8
Beneficiary
        ↓
STEP 9
Transaction + Ledger
        ↓
STEP 10
Event envelope + validator
        ↓
STEP 11
Transactional Outbox
        ↓
STEP 12
Kafka publisher
        ↓
STEP 13
Simulation engine
        ↓
STEP 14
REST API completion
        ↓
STEP 15
Synthetic data generator
        ↓
STEP 16
Action interface
        ↓
STEP 17
Integration/E2E tests
        ↓
STEP 18
M1 acceptance test
```

---

# 26. Senior Developer Working Rule

For every feature, follow:

```text
Requirement
   ↓
Domain behavior
   ↓
Persistence
   ↓
Service
   ↓
API
   ↓
Event
   ↓
Test
```

Example:

```text
Beneficiary creation
   ↓
Define state transition
   ↓
PostgreSQL table
   ↓
BeneficiaryService
   ↓
POST /beneficiaries
   ↓
BENEFICIARY_ADDED
   ↓
unit + integration + API test
```

Do not jump directly from requirement to controller code.

---

# 27. Git Strategy

Use small, focused commits.

Example:

```text
feat(m1): initialize simulator project
feat(m1): add account domain model
feat(m1): add postgres account migration
feat(m1): implement account service
feat(m1): add account API
feat(m1): add event envelope
feat(m1): add transaction outbox
feat(m1): add kafka publisher
test(m1): add transaction atomicity tests
test(m1): add simulator e2e flow
```

Avoid commits such as:

```text
"completed simulator"
```

containing hundreds of unrelated changes.

---

# 28. Definition of M1 Complete

M1 is complete when a developer can execute:

```text
docker compose up
npm install
npm run migrate
npm run seed
npm run dev
npm test
```

and successfully perform:

```text
1. Create synthetic user
2. Create/verify synthetic KYC
3. Register device
4. Create account
5. Authenticate
6. Add beneficiary
7. Create transaction
8. Complete transaction
9. Verify balances
10. Verify ledger
11. Verify event outbox
12. Verify Kafka event
13. Reset/reproduce simulation
```

---

# 29. Final M1 Acceptance Scenario

The strongest first milestone is not:

> "The API returns 200."

It is:

```text
Synthetic banking scenario
          ↓
Simulator executes valid state changes
          ↓
PostgreSQL/MongoDB remain consistent
          ↓
Ledger remains financially correct
          ↓
Canonical events are generated
          ↓
Outbox guarantees event durability
          ↓
Kafka receives events
          ↓
Future Blue Team can consume them
```

At this point M1 has become a usable experimental environment rather than merely a CRUD backend.

---

# 30. M1 Deliverables

Final M1 repository should contain:

```text
docs/
├── M1_SCOPE.md
├── simulator-domain-model.md
├── 02_database_design.md
├── 03_api_contract.yaml
├── 04_event_contract.json
├── 05_event_publisher_design.md
└── 06_m1_implementation_plan.md

simulator/
├── src/
├── tests/
├── migrations/
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

# 31. What Comes After M1

Once M1 passes acceptance testing, development can move to the next project module.

The broader SDD architecture has:

```text
Red Team
    ↓
Simulator Core APIs
    ↓
Kafka
    ↓
Stream Processor
    ↓
PostgreSQL / Neo4j / Redis
    ↓
Blue Team ML
```

The SDD's Blue Team architecture subsequently uses feature engineering with XGBoost, GNN and Autoencoder models feeding an ensemble risk engine. fileciteturn15file0L28-L35

M1 therefore must prioritize **clean contracts and reliable telemetry** over sophisticated fraud logic.

---

# 32. Immediate Coding Task

Do not start by implementing every entity.

Start with:

```text
TASK 1
Create simulator repository
        ↓
TASK 2
Configure Node.js + Express
        ↓
TASK 3
Create Docker Compose
        ↓
TASK 4
Connect PostgreSQL
        ↓
TASK 5
Connect MongoDB
        ↓
TASK 6
Create health checks
        ↓
TASK 7
Create first migration
        ↓
TASK 8
Implement User
        ↓
TASK 9
Implement Account
        ↓
TASK 10
Write first integration test
```

After this foundation works, proceed feature-by-feature.

---

# 33. Engineering Principle for This Project

The simulator should be treated as a **controlled experimental platform**, not merely as a banking CRUD application.

Its most important property is:

```text
Same scenario
     ↓
same initial state
     ↓
same simulator behavior
     ↓
same observable events
```

That reproducibility is what will eventually allow the project to answer its actual research question:

> Can adaptive/adversarial AI discover weaknesses in fraud defenses that are not apparent from previously observed attack patterns?

M1 does not answer that question itself.

M1 creates the reliable environment in which the rest of the system can answer it.
