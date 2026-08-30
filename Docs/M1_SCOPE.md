# M1_SCOPE.md

# M1 — Synthetic Banking Simulator

**Project:** Adversarial GenAI Framework for Proactive Testing of Payment-Fraud Defenses  
**Module:** M1 — Synthetic Banking Simulator  
**Owner:** Person 1  
**Document Version:** 1.0  
**Status:** Draft / Implementation Scope  
**Date:** 2026-08-29

---

# 1. Purpose

M1 is responsible for building the controlled, synthetic banking environment that acts as the execution and telemetry foundation for the rest of the Adversarial GenAI Framework.

The simulator must provide realistic banking entities, state transitions, authentication flows, account operations, beneficiary management, and transaction processing without interacting with real banking infrastructure, real credentials, real PII, or real telecommunications infrastructure.

M1 is an execution environment.

It does NOT determine whether an action is fraudulent.

The simulator executes actions and produces the resulting system state and telemetry.

---

# 2. Problem M1 Solves

The overall framework requires a controlled environment in which AI-generated adversarial strategies can be executed repeatedly and safely.

The simulator therefore provides:

1. Synthetic customers and accounts.
2. Synthetic merchants and beneficiaries.
3. Synthetic devices and KYC records.
4. Authentication and account-management workflows.
5. Transaction processing.
6. Financial state and ledger consistency.
7. Simulation state and time.
8. Structured events and telemetry.
9. Controlled interfaces through which future Red Team components can execute actions.

The overall project is explicitly designed around a simulated ecosystem rather than real banking infrastructure.

---

# 3. M1 Objective

Build a deterministic, API-driven synthetic banking simulator capable of:

- Creating and managing synthetic banking entities.
- Executing normal banking operations.
- Maintaining consistent financial state.
- Simulating authentication workflows.
- Processing transactions atomically.
- Recording meaningful system events.
- Generating synthetic behavioral data.
- Providing stable APIs for future Red Team components.
- Providing structured telemetry for future Blue Team components.

---

# 4. Scope Boundary

## 4.1 In Scope

The following functionality belongs to M1.

### A. User Management

- Create synthetic users.
- Retrieve synthetic users.
- Update synthetic user information.
- Maintain user identifiers.
- Maintain user profile metadata.
- Associate users with accounts and devices.

---

### B. Account Management

- Create synthetic accounts.
- Retrieve account information.
- Update account state.
- Maintain account balance.
- Maintain account status.
- Associate accounts with users.
- Support account lifecycle states.

Example states:

```text
ACTIVE
SUSPENDED
FROZEN
CLOSED