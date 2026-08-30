# 05 — Event Publisher Design

## 1. Purpose

This document defines how the M1 Simulator converts committed domain changes into validated events and publishes them to Apache Kafka.

The SDD explicitly defines the simulator-to-Kafka-to-stream-processor pipeline:

```text
Simulator → Kafka → Stream Processor
                         ├── PostgreSQL
                         ├── Neo4j Graph
                         └── Redis Feature Store
```

The SDD also states that Kafka decouples the simulator from the Blue Team and provides asynchronous event propagation.

The detailed publisher design below is an engineering design derived from that architecture. The SDD does not prescribe a specific outbox implementation, producer library, retry policy, or serialization library.

---

## 2. Design Goals

The publisher must:

1. Publish every relevant simulator state change as a canonical event.
2. Preserve the event contract defined in `04_event_contract.json`.
3. Prevent domain logic from depending directly on Kafka client APIs.
4. Avoid publishing an event for a transaction that was not successfully committed.
5. Support duplicate-safe downstream consumption.
6. Support retries for temporary Kafka failures.
7. Preserve useful event ordering for a given entity.
8. Carry `simulation_id` and `experiment_id` for controlled experiments.
9. Preserve adversarial provenance without converting it into a fraud decision.
10. Make publishing testable independently of Kafka.

---

## 3. Architecture

### 3.1 Recommended implementation

```text
                    ┌──────────────────────┐
                    │    Domain Service    │
                    │ Transaction / KYC /  │
                    │ Auth / Device / etc. │
                    └──────────┬───────────┘
                               │
                               │ domain change
                               ▼
                    ┌──────────────────────┐
                    │    DB Transaction    │
                    │                      │
                    │ state change +       │
                    │ event record         │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    Event Outbox      │
                    │      Record          │
                    └──────────┬───────────┘
                               │
                               │ polling / relay
                               ▼
                    ┌──────────────────────┐
                    │    Event Publisher   │
                    ├──────────────────────┤
                    │ validate             │
                    │ serialize            │
                    │ select topic         │
                    │ select partition key │
                    │ publish              │
                    │ retry                │
                    └──────────┬───────────┘
                               │
                               ▼
                         ┌───────────┐
                         │   Kafka   │
                         └─────┬─────┘
                               │
                               ▼
                       Stream Processor
```

### 3.2 Why an outbox is recommended

The simulator performs state-changing operations such as transactions, KYC updates, authentication events, beneficiary changes and device changes.

A direct sequence such as:

```text
UPDATE database
      ↓
publish Kafka event
```

can produce an inconsistency:

```text
Database commit succeeds
Kafka publish fails
       ↓
event is missing
```

Conversely:

```text
Kafka publish succeeds
Database commit fails
       ↓
event describes a state that never existed
```

For this reason, the recommended implementation is a transactional outbox:

```text
Database transaction
    ├── update domain state
    └── insert event into outbox
              ↓
          commit once
              ↓
        asynchronous relay
              ↓
            Kafka
```

**Important:** the SDD does not explicitly require an outbox. It is a recommended engineering decision for reliable event publication.

---

## 4. Components

### 4.1 Domain Service

Responsible for business state changes.

Examples:

- `TransactionService`
- `AuthenticationService`
- `KYCService`
- `DeviceService`
- `BeneficiaryService`
- `AccountService`
- `SimulationService`

The domain service must not call Kafka directly.

Example:

```text
TransactionService
        ↓
commit transaction
        ↓
create TRANSACTION_COMPLETED event
```

---

### 4.2 Event Factory

Creates an event conforming to the canonical event envelope.

Interface:

```python
class EventFactory:
    def create(
        event_type,
        entity_type,
        entity_id,
        payload,
        simulation_id,
        experiment_id,
        actor_id=None,
        device_id=None,
        correlation_id=None,
        causation_id=None,
        adversarial_metadata=None
    ):
        ...
```

The factory is responsible for:

- generating `event_id`
- setting `event_version`
- setting `occurred_at`
- attaching simulation context
- attaching correlation/causation identifiers
- constructing the payload
- attaching optional adversarial provenance

---

## 5. Event Validation

Every event must be validated before it enters the publishing pipeline.

```text
EventFactory
     ↓
Event Validator
     ↓
valid? ── No ──→ reject + log
     │
    Yes
     ↓
Outbox / Publisher
```

Validation should verify:

- required envelope fields
- valid `event_type`
- valid `entity_type`
- valid timestamps
- non-empty IDs
- payload shape
- event version
- simulation/experiment identifiers
- valid adversarial metadata when present

The canonical contract is defined in `04_event_contract.json`.

---

## 6. Outbox Record

Recommended database structure:

```text
event_outbox
────────────────────────────────────────────
id
event_id
event_type
event_version
aggregate_type
aggregate_id
simulation_id
experiment_id
partition_key
payload_json
status
attempt_count
available_at
created_at
published_at
last_error
```

### Status

Recommended states:

```text
PENDING
   ↓
PUBLISHING
   ↓
PUBLISHED

PENDING
   ↓
PUBLISHING
   ↓
FAILED
   ↓
PENDING
```

The database representation is an implementation proposal; the SDD does not define this table.

---

## 7. Kafka Topic Routing

The event contract proposes these topics:

```text
simulator.users.v1
simulator.accounts.v1
simulator.transactions.v1
simulator.devices.v1
simulator.kyc.v1
simulator.beneficiaries.v1
simulator.auth.v1
simulator.simulations.v1
```

Recommended routing:

| Event family | Kafka topic |
|---|---|
| USER_* | `simulator.users.v1` |
| ACCOUNT_* | `simulator.accounts.v1` |
| TRANSACTION_* | `simulator.transactions.v1` |
| DEVICE_* | `simulator.devices.v1` |
| KYC_* | `simulator.kyc.v1` |
| BENEFICIARY_* | `simulator.beneficiaries.v1` |
| AUTH_* | `simulator.auth.v1` |
| SIMULATION_* | `simulator.simulations.v1` |

These topic names are engineering proposals from the event contract, not explicit topic names in the SDD.

---

## 8. Partitioning and Ordering

Recommended partition key:

```text
entity_id
```

Reason:

```text
Account A
   ├── event 1
   ├── event 2
   └── event 3

        ↓

same Kafka partition
        ↓

preserve ordering for Account A
```

Different entities can still be processed in parallel.

For transactions, the implementation should carefully choose the aggregate/entity whose ordering is most important. If sender-account ordering is required by a downstream detector, a transaction-specific partitioning strategy may be preferable.

---

## 9. Delivery Semantics

Recommended initial implementation:

```text
At-least-once delivery
```

This means a consumer may receive the same event more than once.

Therefore:

```text
Kafka
  ↓
Event X
  ↓
consumer processes X
  ↓
ack fails
  ↓
Event X delivered again
```

Consumers must deduplicate using:

```text
event_id
```

or:

```text
idempotency_key
```

The event contract explicitly requires consumers to tolerate duplicate delivery.

---

## 10. Retry Strategy

Kafka publication failures should be classified.

### Temporary failures

Examples:

- broker unavailable
- network timeout
- temporary connection failure

Action:

```text
retry
```

### Permanent validation failures

Examples:

- invalid event schema
- missing event ID
- unsupported event type
- malformed payload

Action:

```text
do not retry indefinitely
↓
mark FAILED
↓
record error
```

Recommended initial retry policy:

```text
Attempt 1
   ↓
short delay
   ↓
Attempt 2
   ↓
longer delay
   ↓
Attempt 3
   ↓
longer delay
   ↓
FAILED
```

The exact backoff values should be configuration, not hard-coded business logic.

---

## 11. Idempotency

### Producer side

Each event receives a unique:

```text
event_id
```

State-changing requests may additionally have:

```text
idempotency_key
```

### Consumer side

Consumers should maintain a processed-event mechanism:

```text
processed_events
────────────────────
event_id
consumer_name
processed_at
```

Before processing:

```text
event_id already processed?
       │
   ┌───┴───┐
  Yes      No
   │        │
ignore    process
            │
            ▼
          record
```

This prevents duplicate Kafka delivery from causing duplicate downstream effects.

---

## 12. Correlation and Causation

The publisher must support:

```text
correlation_id
causation_id
```

Example:

```text
Attack Scenario
      │
      ▼
Attack Step
      │
      ▼
AUTH_OTP_INTERCEPT
      │
      ▼
AUTH_OTP_FAILED
      │
      ▼
TRANSACTION_INITIATED
```

The resulting events can retain the causal relationship.

This becomes especially valuable when the evaluation system asks:

> Which simulator events were caused by a particular Red Team attack?

---

## 13. Red Team Provenance

Controlled adversarial experiments may attach:

```json
{
  "attack_scenario_id": "SCN_001",
  "primitive_id": "DOC_SYNTHETIC_ID_9",
  "attack_family": "synthetic_document",
  "generated_by": "red_team",
  "step_id": "STEP_03"
}
```

This metadata is provenance.

It must **not** be interpreted as:

```text
adversarial_metadata == fraud_label
```

The Blue Team must independently determine whether the behavior is suspicious.

This separation is important for evaluating whether the defense can actually detect the attack rather than simply reading the ground-truth label.

---

## 14. Transaction Publishing Flow

Example:

```text
POST /transactions
       ↓
TransactionService
       ↓
validate transaction
       ↓
begin DB transaction
       ├── update account balances
       ├── create transaction record
       └── create TRANSACTION_INITIATED/
           AUTHORIZED/COMPLETED outbox event
       ↓
commit
       ↓
Outbox Relay
       ↓
Event Validator
       ↓
Kafka Producer
       ↓
simulator.transactions.v1
```

The exact transaction state sequence depends on the simulator implementation.

---

## 15. Failure Scenarios

### Scenario A — Database failure

```text
DB transaction fails
       ↓
rollback
       ↓
no outbox event
       ↓
no Kafka event
```

### Scenario B — Kafka temporarily unavailable

```text
DB commit succeeds
       ↓
outbox contains PENDING event
       ↓
Kafka unavailable
       ↓
retry later
       ↓
publish succeeds
```

### Scenario C — Consumer receives duplicate

```text
event_id = EVT_123

first delivery  → process
second delivery → detect duplicate → ignore
```

### Scenario D — Invalid event

```text
Event Factory
     ↓
Validator
     ↓
invalid
     ↓
reject
     ↓
record validation error
```

---

## 16. Publisher Interfaces

Recommended abstraction:

```python
class EventPublisher:
    def publish(self, event: EventEnvelope) -> PublishResult:
        pass
```

Kafka-specific implementation:

```python
class KafkaEventPublisher(EventPublisher):
    def publish(self, event: EventEnvelope) -> PublishResult:
        pass
```

Outbox relay:

```python
class OutboxRelay:
    def publish_pending_events(self) -> None:
        pass
```

This keeps the application testable without requiring Kafka for every unit test.

---

## 17. Suggested Project Structure

```text
simulator/
├── api/
│   └── routes/
├── domain/
│   ├── users/
│   ├── accounts/
│   ├── transactions/
│   ├── devices/
│   ├── kyc/
│   ├── beneficiaries/
│   └── authentication/
├── events/
│   ├── envelope.py
│   ├── event_types.py
│   ├── factory.py
│   ├── validator.py
│   └── publisher.py
├── outbox/
│   ├── model.py
│   ├── repository.py
│   └── relay.py
├── infrastructure/
│   └── kafka/
│       ├── producer.py
│       └── config.py
└── tests/
    ├── events/
    ├── outbox/
    └── integration/
```

---

## 18. Testing Strategy

### Unit tests

Test:

- event creation
- event IDs
- event versioning
- payload validation
- topic routing
- partition-key generation
- adversarial metadata
- correlation/causation IDs

### Integration tests

Test:

```text
Domain Service
      ↓
Database
      ↓
Outbox
      ↓
Relay
      ↓
Kafka
```

### Failure tests

Test:

- Kafka unavailable
- timeout
- duplicate publication
- malformed event
- database rollback
- retry exhaustion

### Contract tests

For every supported event:

```text
create event
     ↓
validate against event contract
     ↓
serialize
     ↓
deserialize
     ↓
validate again
```

---

## 19. M1 Acceptance Criteria

M1 event publishing is complete when:

- [ ] All simulator domain events use the canonical envelope.
- [ ] Event validation is implemented.
- [ ] Domain services do not directly depend on Kafka.
- [ ] Events contain `simulation_id` and `experiment_id`.
- [ ] Event IDs are unique.
- [ ] Transactional changes and their outbox records are committed consistently.
- [ ] Outbox relay can publish pending events.
- [ ] Kafka topic routing is implemented.
- [ ] Partition key is deterministic.
- [ ] Publisher retries temporary failures.
- [ ] Failed events are observable.
- [ ] Duplicate events can be safely handled downstream.
- [ ] Contract tests pass.
- [ ] At least one complete simulator flow can produce an event in Kafka.

---

## 20. Definition of Done

The M1 publisher should not be considered complete merely because:

```text
"Kafka is connected"
```

The actual definition of done is:

```text
Simulator state change
        ↓
validated event
        ↓
durably recorded
        ↓
published to Kafka
        ↓
correct topic
        ↓
correct partition key
        ↓
observable delivery status
        ↓
safe duplicate handling
```

At this point M1 has a stable event boundary that the later Red Team, Blue Team and evaluation modules can consume without coupling themselves to simulator internals.

---

## 21. Next Artifact

The next M1 artifact should be:

```text
06_m1_implementation_plan.md
```

It should convert the design artifacts into an implementation sequence covering:

1. Repository setup
2. Database setup
3. Domain models
4. API implementation
5. Event envelope
6. Outbox
7. Kafka publisher
8. Seed data
9. Tests
10. End-to-end simulator → Kafka verification
