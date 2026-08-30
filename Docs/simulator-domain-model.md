# Simulator Domain Model

**Project:** Adversarial GenAI Framework for Proactive Testing of
Payment-Fraud Defenses\
**Module:** M1 --- Synthetic Banking Simulator\
**Document:** `simulator-domain-model.md`\
**Version:** 1.0\
**Status:** Draft --- Design Baseline\
**Date:** 2026-08-29\
**Owner:** Person 1 --- Simulator / Red Team Platform

## 1. Purpose

This document defines the domain model for M1, the Synthetic Banking
Simulator.

The simulator is the controlled environment in which future Red Team
actions are executed and from which future Blue Team components consume
behavioral and transaction telemetry.

The SDD defines a simulated MERN/FastAPI banking environment with
synthetic customers, merchants and mule accounts. It specifies
Node.js/Express for core transactional logic, PostgreSQL for
ACID-compliant ledger transactions, MongoDB for KYC and user-profile
metadata, and Kafka for asynchronous event propagation.

**Core principle:** The simulator executes and records banking behavior.
It does not decide whether that behavior is fraudulent.

## 2. Domain Boundary

### Inside M1

-   User / Customer
-   Account
-   Merchant
-   Device
-   KYC Record
-   Beneficiary
-   Authentication Session / Authentication Event
-   Transaction
-   Ledger Entry
-   Simulator Event
-   Simulation State / Clock

### Outside M1

-   GenAI attack planning
-   Attack strategy selection
-   Fraud detection
-   Risk scoring
-   XGBoost / GNN / Autoencoder inference
-   Deepfake / voice / document detection
-   Evaluation logic
-   Dashboard logic

Those systems consume M1 interfaces and telemetry.

## 3. Design Principles

1.  **Synthetic-only:** all identities, accounts, credentials, devices,
    KYC data and transactions are synthetic.
2.  **Domain-driven operations:** future Red Team components invoke
    simulator actions rather than modify databases directly.
3.  **Financial consistency:** balances and ledger entries remain
    consistent; settlement is atomic.
4.  **Event-first observability:** important state changes produce
    structured events.
5.  **Deterministic simulation:** support reproducible state
    initialization and seeded synthetic data where practical.
6.  **Separation of concerns:** the simulator models banking behavior;
    it does not contain attack or fraud-detection intelligence.

## 4. Entity Inventory

  -------------------------------------------------------------------------------------
  Entity            Responsibility          Primary Store             Owner
  ----------------- ----------------------- ------------------------- -----------------
  User              Synthetic customer      MongoDB                   M1
                    identity/profile                                  

  KYC Record        Synthetic KYC metadata  MongoDB                   M1

  Device            Synthetic               MongoDB                   M1
                    device/network identity                           

  Account           Financial account state PostgreSQL                M1

  Merchant          Synthetic               PostgreSQL                M1
                    merchant/payment                                  
                    participant                                       

  Beneficiary       Recipient associated    PostgreSQL                M1
                    with a user/account                               

  Transaction       Financial operation and PostgreSQL                M1
                    lifecycle                                         

  Ledger Entry      Accounting movement     PostgreSQL                M1

  Authentication    Authentication activity Event persistence /       M1
  Event                                     stream                    

  Simulator Event   Domain telemetry        Kafka / event layer       M1/M2 boundary

  Simulation State  Current                 Application/persistence   M1
                    simulation/experiment                             
                    state                                             
  -------------------------------------------------------------------------------------

**Design note:** The PRD/SDD establish the major entities and storage
responsibilities, but do not fully specify every attribute or
relationship. The detailed fields and constraints below are proposed M1
engineering design decisions and should be reviewed before
implementation.

## 5. Entity Relationships

``` text
User
 ├── KYC Record
 ├── Devices
 ├── Accounts
 │    ├── Beneficiaries
 │    └── Transactions
 ├── Authentication Events
 └── Initiated Transactions

Merchant
 └── Transactions

Transaction
 └── Ledger Entries
```

## 6. User

### Responsibility

Represents a synthetic banking customer.

### Proposed attributes

``` text
user_id
first_name
last_name
email
phone
date_of_birth
address
occupation
profile_status
created_at
updated_at
```

### Relationships

-   One KYC record
-   Many devices
-   Many accounts
-   Many beneficiaries
-   Many authentication events
-   Many transactions

### Invariants

-   `user_id` is unique.
-   User data is synthetic.
-   A user must exist before an account is associated with the user.
-   Financial history must not be lost through destructive user
    deletion.

## 7. KYC Record

### Responsibility

Stores synthetic KYC and identity metadata.

### Proposed attributes

``` text
kyc_id
user_id
document_type
document_reference
verification_status
liveness_status
risk_profile
created_at
updated_at
```

### Verification states

``` text
PENDING
VERIFIED
REJECTED
EXPIRED
```

### Invariants

-   Every KYC record belongs to one user.
-   No real identity documents or real PII are used.
-   Verification status is explicit.

## 8. Device

### Responsibility

Represents a synthetic device and network context associated with a
user.

### Proposed attributes

``` text
device_id
user_id
device_type
operating_system
browser
ip_address
geo_location
device_fingerprint
status
first_seen
last_seen
```

### States

``` text
ACTIVE
BLOCKED
RETIRED
```

Device information will later provide signals for ATO and behavioral
detection, but M1 only records it.

## 9. Account

### Responsibility

Represents a synthetic financial account and current financial state.

### Proposed attributes

``` text
account_id
user_id
account_number
account_type
currency
balance
status
created_at
updated_at
```

### States

``` text
ACTIVE
SUSPENDED
FROZEN
CLOSED
```

### Key transitions

``` text
ACTIVE -> SUSPENDED
ACTIVE -> FROZEN
SUSPENDED -> ACTIVE
SUSPENDED -> FROZEN
FROZEN -> ACTIVE
ACTIVE -> CLOSED
SUSPENDED -> CLOSED
FROZEN -> CLOSED
```

### Invariants

-   Account belongs to a valid user.
-   Balance must remain consistent with ledger state.
-   Closed accounts cannot perform normal transactions.
-   Financial history remains queryable.

## 10. Merchant

### Responsibility

Represents a synthetic merchant/payment recipient.

### Proposed attributes

``` text
merchant_id
merchant_name
merchant_category
settlement_account_id
status
created_at
updated_at
```

### States

``` text
ACTIVE
SUSPENDED
CLOSED
```

## 11. Beneficiary

### Responsibility

Represents a recipient registered for transfers.

### Proposed attributes

``` text
beneficiary_id
user_id
target_account_id
nickname
status
created_at
updated_at
```

### States

``` text
PENDING
ACTIVE
DISABLED
```

### Domain rule

Adding a beneficiary is a domain operation and should generate a
`BENEFICIARY_ADDED` event.

## 12. Authentication

Authentication is a simulation of banking authentication behavior, not a
production identity provider.

### Authentication states

``` text
LOGIN_REQUESTED
  -> PASSWORD_VERIFIED
  -> OTP_REQUIRED
  -> OTP_VERIFIED
  -> AUTHENTICATED
  -> SESSION_EXPIRED / LOGGED_OUT
```

Failure states include `PASSWORD_FAILED` and `OTP_FAILED`.

### Authentication event types

``` text
LOGIN_REQUESTED
LOGIN_SUCCESS
LOGIN_FAILED
OTP_REQUESTED
OTP_VERIFIED
OTP_FAILED
PASSWORD_RESET
SESSION_CREATED
SESSION_EXPIRED
LOGOUT
DEVICE_REGISTERED
```

## 13. Transaction

### Responsibility

Represents a synthetic financial transaction.

### Proposed attributes

``` text
transaction_id
transaction_reference
sender_account_id
receiver_account_id
merchant_id
initiator_user_id
amount
currency
transaction_type
channel
device_id
location
status
created_at
authorized_at
completed_at
failure_reason
experiment_id
```

Not every field applies to every transaction type.

### Transaction states

``` text
INITIATED
  -> AUTHORIZED
  -> PROCESSING
  -> COMPLETED
```

Failure/reversal paths:

``` text
INITIATED -> FAILED
AUTHORIZED -> FAILED
PROCESSING -> FAILED
PROCESSING -> REVERSED
COMPLETED -> REVERSED
```

### Core invariant

A transaction cannot be `COMPLETED` unless the corresponding financial
state and ledger entries have been committed successfully.

## 14. Ledger Entry

### Responsibility

Represents the accounting movement caused by a transaction.

A normal account-to-account transfer creates:

``` text
DEBIT  -> sender
CREDIT -> receiver
```

### Proposed attributes

``` text
ledger_entry_id
transaction_id
account_id
entry_type
amount
balance_before
balance_after
created_at
```

### Entry types

``` text
DEBIT
CREDIT
```

### Financial invariant

A successful transfer must produce matching debit/credit effects and
must be committed atomically.

## 15. Simulator Event

A Simulator Event is the canonical representation of an observable state
change.

### Proposed structure

``` json
{
  "event_id": "EVT_001",
  "event_type": "TRANSACTION_COMPLETED",
  "event_version": 1,
  "timestamp": "2026-08-29T22:01:04Z",
  "simulation_time": "2026-08-29T22:01:04Z",
  "experiment_id": "EXP_001",
  "entity_type": "transaction",
  "entity_id": "TXN_001",
  "actor_id": "USR_001",
  "device_id": "DEV_001",
  "source": "bank_simulator",
  "payload": {}
}
```

### Required properties

-   Unique event ID
-   Event type
-   Event version
-   Timestamp
-   Simulation time
-   Experiment ID where applicable
-   Entity type
-   Entity ID
-   Source
-   Relevant actor/device references
-   Event payload

## 16. Initial Event Types

``` text
USER_CREATED
USER_UPDATED

ACCOUNT_CREATED
ACCOUNT_STATUS_CHANGED

DEVICE_REGISTERED
DEVICE_UPDATED

KYC_CREATED
KYC_UPDATED
KYC_STATUS_CHANGED

LOGIN_REQUESTED
LOGIN_SUCCESS
LOGIN_FAILED
OTP_REQUESTED
OTP_VERIFIED
OTP_FAILED
PASSWORD_RESET
SESSION_CREATED
SESSION_EXPIRED
LOGOUT

BENEFICIARY_ADDED
BENEFICIARY_UPDATED
BENEFICIARY_DISABLED

TRANSACTION_CREATED
TRANSACTION_AUTHORIZED
TRANSACTION_PROCESSING
TRANSACTION_COMPLETED
TRANSACTION_FAILED
TRANSACTION_REVERSED

LEDGER_ENTRY_CREATED
```

## 17. Simulation State

A simulation has an identifiable state so experiments can be reproduced.

### Proposed attributes

``` text
simulation_id
experiment_id
status
seed
simulation_time
started_at
ended_at
configuration
```

### States

``` text
CREATED
  -> INITIALIZING
  -> READY
  -> RUNNING
  -> PAUSED
  -> COMPLETED

Failure path:
INITIALIZING -> FAILED
RUNNING -> FAILED
```

## 18. Domain Services

### UserService

Create, retrieve, update and deactivate users.

### AccountService

Create accounts, retrieve accounts, change account status and validate
account eligibility.

### AuthenticationService

Authenticate users, simulate OTP, verify OTP, create sessions and record
authentication events.

### DeviceService

Register/update devices, associate devices with users and record device
events.

### KYCService

Create KYC records and update KYC status.

### BeneficiaryService

Add, activate, disable and validate beneficiaries.

### TransactionService

Validate, authorize, process, complete/reverse transactions and
coordinate ledger/event operations.

### LedgerService

Create debit/credit entries, validate accounting consistency and
preserve ledger history.

### SimulationService

Create/reset simulations, manage simulation state/clock and initialize
synthetic data.

## 19. Transaction Domain Flow

``` text
Client / Red Team Action
        |
        v
TransactionService
        |
        +--> Validate sender
        +--> Validate receiver/merchant
        +--> Validate account state
        +--> Validate amount
        +--> Validate balance
        |
        v
Authorization
        |
        v
Processing
        |
        v
PostgreSQL Transaction
        |
        +--> Debit sender
        +--> Credit receiver
        +--> Create transaction record
        +--> Create ledger entries
        |
        v
Commit
        |
        v
TRANSACTION_COMPLETED
        |
        v
Simulator Event
```

On failure:

``` text
Failure
  -> ROLLBACK
  -> TRANSACTION_FAILED
  -> Simulator Event
```

## 20. Domain Invariants

### User

-   IDs are unique.
-   Data is synthetic.

### Account

-   Account belongs to a valid user.
-   Closed accounts cannot perform normal transactions.
-   Balance is consistent with ledger state.

### Beneficiary

-   Beneficiary belongs to a valid user.
-   Target must satisfy the simulator's destination rules.

### Transaction

-   Amount must be positive.
-   Sender must be valid and eligible.
-   Receiver/merchant must be valid.
-   Completed transactions have corresponding ledger entries.
-   Failed transactions cannot cause partial balance changes.

### Ledger

-   Successful transfers have matching debit/credit effects.
-   Ledger history is not destructively overwritten.

### Authentication

-   OTP verification requires valid simulated OTP/session context.
-   Authentication activity is observable through events.

## 21. Red Team Action Boundary

Future Red Team primitives must interact through a controlled simulator
action interface.

``` text
Attack Orchestrator
        |
        v
Simulator Action Interface
        |
        v
Domain Service
        |
        v
Validation
        |
        v
State Transition
        |
        v
Event Generation
        |
        v
Action Result
```

Example:

``` json
{
  "action": "ADD_BENEFICIARY",
  "target_user_id": "USR_001",
  "parameters": {
    "target_account_id": "ACC_100"
  }
}
```

The Red Team must not receive direct database write access.

## 22. Action Result Contract

``` json
{
  "success": true,
  "action_id": "ACT_001",
  "action_type": "ADD_BENEFICIARY",
  "simulation_id": "SIM_001",
  "state_changes": [
    {
      "entity_type": "beneficiary",
      "entity_id": "BEN_001",
      "change": "CREATED"
    }
  ],
  "events": [
    {
      "event_id": "EVT_001",
      "event_type": "BENEFICIARY_ADDED"
    }
  ],
  "error": null
}
```

## 23. Persistence Boundary

### MongoDB

-   User profile
-   KYC metadata
-   Device metadata
-   Other document-oriented profile metadata

### PostgreSQL

-   Account
-   Transaction
-   Beneficiary
-   Ledger Entry
-   Merchant
-   Other strongly consistent financial state

### Kafka

Asynchronous event boundary between simulator and downstream systems.

``` text
Simulator
   |
   v
Event Publisher
   |
   v
Kafka
   |
   +--> Blue Team
   +--> Evaluation
   +--> Telemetry
```

## 24. API Boundary

The SDD defines the simulator namespace:

``` text
/api/v1/simulator
```

Core resources:

``` text
/users
/accounts
/transactions
/devices
/kycs
/beneficiaries
/auth_events
```

The complete HTTP contract will be defined separately in
`03_api_contract.yaml`.

## 25. API Response vs Domain Event

These must remain separate.

**API response:** answers what happened to the request.

**Domain event:** answers what happened inside the simulator that
downstream systems need to observe.

Example:

``` text
POST /transactions
        |
        +--> API Response
        |    transaction_id + status
        |
        +--> Domain Events
             TRANSACTION_CREATED
             TRANSACTION_AUTHORIZED
             TRANSACTION_PROCESSING
             TRANSACTION_COMPLETED
             LEDGER_ENTRY_CREATED
```

## 26. Simulation Clock

The simulator should expose a logical simulation clock.

``` text
SimulationClock
    |
    +--> current simulation time
    +--> advance()
    +--> pause()
    +--> reset()
```

The exact implementation is an M1 engineering decision and should be
finalized during database/API design.

## 27. Synthetic Data Model

Generated data should maintain valid relationships among:

-   User profile
-   Account profile
-   Transaction history
-   Device history
-   Authentication history
-   Beneficiary history
-   Geographic context
-   Merchant interaction

The goal is not merely random rows; relationships and histories must be
coherent enough for downstream behavioral and transaction analysis.

## 28. Normal User Scenario

``` text
USER_CREATED
      ↓
KYC_CREATED
      ↓
KYC_STATUS_CHANGED -> VERIFIED
      ↓
DEVICE_REGISTERED
      ↓
ACCOUNT_CREATED
      ↓
LOGIN_REQUESTED
      ↓
PASSWORD_VERIFIED
      ↓
OTP_REQUESTED
      ↓
OTP_VERIFIED
      ↓
SESSION_CREATED
      ↓
BENEFICIARY_ADDED
      ↓
TRANSACTION_CREATED
      ↓
TRANSACTION_AUTHORIZED
      ↓
TRANSACTION_PROCESSING
      ↓
TRANSACTION_COMPLETED
      ↓
LEDGER_ENTRY_CREATED
```

## 29. Adversarial-Compatible Scenario

M1 does not classify the behavior as fraud. It only represents the
resulting behavior.

``` text
Existing User
      ↓
New Device
      ↓
Authentication Event
      ↓
Beneficiary Added
      ↓
Multiple Transactions
      ↓
Transaction Events
```

A future Red Team can construct this sequence through simulator actions.

## 30. Module Dependency

``` text
Future Red Team
      |
      v
Simulator Action Interface
      |
      +--> User Service
      +--> Account Service
      +--> Authentication Service
      +--> Device Service
      +--> KYC Service
      +--> Beneficiary Service
      +--> Transaction Service
                  |
                  v
             Ledger Service
                  |
                  v
             Event Publisher
                  |
                  v
                Kafka
              /                    v         v
       Future Blue   Future Evaluation
```

## 31. M1 Ownership

Person 1 owns:

-   User domain
-   Account domain
-   Merchant domain
-   Device domain
-   KYC domain
-   Beneficiary domain
-   Authentication simulation
-   Transaction domain
-   Ledger
-   Simulation state/clock
-   Synthetic data generation
-   Simulator APIs
-   Simulator action boundary
-   Event generation hooks

Person 2 consumes the contracts and should not depend on M1's internal
implementation.

## 32. Implementation Order

``` text
1. Project skeleton
2. Domain types/entities
3. PostgreSQL schema
4. MongoDB schemas
5. User + Account
6. Merchant
7. Device + KYC
8. Authentication
9. Beneficiary
10. Transaction
11. Ledger
12. Simulation state/clock
13. Event model
14. Event publisher abstraction
15. Simulator action interface
16. Synthetic data generator
17. Integration tests
18. Kafka integration
```

## 33. What Must Be Frozen Before Database Design

The team should agree on:

-   Entity names
-   Entity ownership
-   Primary identifiers
-   Core relationships
-   Account states
-   Transaction states
-   Authentication states
-   Beneficiary states
-   Financial invariants
-   Required event types
-   Event envelope structure
-   MongoDB/PostgreSQL responsibility
-   Red Team action boundary

The following remain database-design concerns:

-   SQL indexes
-   MongoDB indexes
-   Partitioning
-   Kafka partition strategy
-   Retention policies
-   Connection pooling
-   ORM/ODM details
-   Query optimization

## 34. Open Questions

1.  Should a user be allowed to own multiple accounts in the MVP?
2.  Should beneficiaries support internal and external synthetic
    accounts?
3.  Should merchants have dedicated settlement accounts?
4.  Which authentication/session fields must persist?
5.  Where should authentication events be archived?
6.  What transaction types are required for the first simulator release?
7.  Should overdraft be supported?
8.  How should transaction reversals affect the ledger?
9.  What simulation-clock controls are required?
10. Which simulator actions must be exposed to the Red Team?
11. Which events must be guaranteed before a transaction API returns
    success?
12. What event retention period is required?

## 35. Definition of Ready for Database Design

The domain model is ready to move to `02_database_design.md` when:

-   [ ] All M1 entities are defined.
-   [ ] Entity responsibilities are clear.
-   [ ] Relationships are documented.
-   [ ] Lifecycle states are documented.
-   [ ] State transitions are documented.
-   [ ] Financial invariants are documented.
-   [ ] Event concepts are documented.
-   [ ] Simulator action boundary is defined.
-   [ ] Database ownership is defined.
-   [ ] Red Team does not require direct database access.
-   [ ] Blue Team can consume simulator telemetry through a stable
    boundary.
-   [ ] Open design decisions are explicitly identified.

## 36. Source Alignment

This domain model is grounded in the project's PRD/SDD.

The SDD specifies:

-   A simulated MERN/FastAPI banking environment.
-   Node.js/Express for core transactional logic.
-   PostgreSQL for ACID-compliant ledger transactions.
-   MongoDB for KYC/user-profile metadata.
-   Kafka for asynchronous event propagation.
-   Simulator APIs for users, accounts, transactions, devices, KYC,
    beneficiaries and authentication events.
-   A future Red Team interface through simulator Core APIs.

The detailed fields, state machines, invariants, service decomposition
and action-result contract in this document are proposed engineering
design decisions derived from those requirements, not claims that every
field was explicitly specified in the source documents.

## 37. Next Document

``` text
M1/
├── M1_SCOPE.md
├── simulator-domain-model.md    <- CURRENT
├── 02_database_design.md         <- NEXT
├── 03_api_contract.yaml
├── 04_event_contract.json
└── README.md
```

The next step is to convert this domain model into the actual
PostgreSQL/MongoDB database design, including tables, collections,
primary keys, foreign keys, indexes, constraints and transaction
boundaries.
