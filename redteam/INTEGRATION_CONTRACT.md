# M2 ↔ Person 1 Integration Contract

**Document:** `INTEGRATION_CONTRACT.md`  
**Module:** M2 Red Team Attack Intelligence  
**Version:** 1.1.0  
**Date:** 2026-08-31  
**Status:** ACTIVE — Binding contract between Person 2 (M2) and Person 1 (Attack Orchestrator)

---

## 1. Purpose

Defines the data contract and code interface at the boundary between:

- **Person 2 (M2)** — produces a validated `AttackScenario`
- **Person 1 (Attack Orchestrator)** — consumes it and executes steps via the M1 Simulator Action Interface

---

## 2. Person 1 Minimal Import

Person 1 only needs one import:

```javascript
const { ScenarioHandler } = require("./redteam/src/index");
const handler = new ScenarioHandler();
```

The `ScenarioHandler` facade provides everything needed for safe consumption:

| Method | Purpose |
|---|---|
| `handler.assertConsumable(scenario)` | Verify scenario is VALIDATED and all primitives are executable |
| `handler.toActionRequest(scenario, step)` | Build the exact body for `POST /api/v1/simulator/actions` |
| `handler.resolveSimulatorAction(primitiveId)` | Get the M1 action string for a given primitive |
| `handler.getSortedSteps(scenario)` | Get steps sorted by `step_index` for sequential execution |

---

## 3. The Handoff Object: `AttackScenario`

Person 2 produces a JSON object with the following shape.  
Person 1 receives this and **must not modify it**.

```json
{
  "scenario_id": "<UUID>",
  "name": "Account Takeover via New Device and Fund Drain",
  "description": "Multi-step attack narrative ...",
  "attack_family": "ACCOUNT_TAKEOVER",
  "severity": "HIGH",
  "strategy_id": "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
  "simulation_id": "sim_001",
  "experiment_id": "exp_001",
  "target_entities": {
    "user_ids": ["usr_victim_001"],
    "account_ids": ["acc_victim_001", "acc_mule_001"],
    "device_ids": null,
    "merchant_ids": null
  },
  "steps": [
    {
      "step_id": "step_000",
      "step_index": 0,
      "primitive_id": "PRIM_REGISTER_SPOOFED_DEVICE",
      "parameters": {
        "user_id": "usr_victim_001",
        "device_type": "MOBILE",
        "ip_address": "198.51.100.99"
      },
      "delay_ms": null,
      "depends_on": null,
      "on_failure": "ABORT",
      "max_retries": 0,
      "description": "Register attacker device on victim account",
      "expected_outcome": null
    },
    {
      "step_id": "step_001",
      "step_index": 1,
      "primitive_id": "PRIM_ACCOUNT_TAKEOVER_LOGIN",
      "parameters": {
        "user_id": "usr_victim_001",
        "success": true
      },
      "delay_ms": 500,
      "depends_on": ["step_000"],
      "on_failure": "ABORT",
      "max_retries": 0,
      "description": "Simulate successful ATO login",
      "expected_outcome": null
    }
  ],
  "max_duration_ms": null,
  "requires_seeded_data": true,
  "generated_by": "STRATEGY_LIBRARY",
  "planner_model": null,
  "generation_timestamp": "2026-08-30T18:00:00.000Z",
  "status": "VALIDATED",
  "validation_errors": null,
  "version": "1.0.0",
  "tags": ["ato", "device-spoofing"]
}
```

---

## 4. Precondition: status Must Be "VALIDATED"

Person 1 **MUST call `handler.assertConsumable(scenario)` before executing any steps.**

- `"DRAFT"` — produced by Composer, not yet validated
- `"VALIDATED"` — validated by ScenarioValidator (**safe to execute**)
- `"REJECTED"` — failed validation; check `validation_errors`

---

## 5. How Person 1 Executes Each Step

```javascript
const { ScenarioHandler } = require("./redteam/src/index");
const handler = new ScenarioHandler();

// 1. Verify the scenario is safe to execute
handler.assertConsumable(scenario);

// 2. Execute steps in order, respecting depends_on
const steps = handler.getSortedSteps(scenario);
for (const step of steps) {
    // 3. Build the exact M1 action request body
    const requestBody = handler.toActionRequest(scenario, step);
    /*
      requestBody = {
        action: "REGISTER_DEVICE",
        simulation_id: "sim_001",
        experiment_id: "exp_001",
        adversarial_metadata: {
          attack_scenario_id: "<scenario.scenario_id>",
          primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
          step_id: "step_000",
          attack_family: "ACCOUNT_TAKEOVER",
          generated_by: "STRATEGY_LIBRARY"
        },
        parameters: { user_id: "usr_victim_001", device_type: "MOBILE", ip_address: "..." }
      }
    */

    // 4. Call M1
    const response = await fetch("http://localhost:3000/api/v1/simulator/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
    });

    // 5. Apply the step's on_failure policy
    if (!response.ok && step.on_failure === "ABORT") break;
}
```

---

## 6. Primitive → M1 Action Mapping

`toActionRequest()` handles this automatically. For reference:

| `primitive_id` | `simulator_action` | M1 Service |
|---|---|---|
| `PRIM_ADD_MULE_BENEFICIARY` | `ADD_BENEFICIARY` | BeneficiaryService.addBeneficiary |
| `PRIM_EXECUTE_FRAUDULENT_TRANSFER` | `PERFORM_TRANSACTION` | TransactionService.createAndProcessTransaction |
| `PRIM_ACCOUNT_TAKEOVER_LOGIN` | `SIMULATE_LOGIN` | AuthenticationService.simulateLogin |
| `PRIM_REGISTER_SPOOFED_DEVICE` | `REGISTER_DEVICE` | DeviceService.registerDevice |
| `PRIM_TAMPER_KYC_VERIFICATION` | `UPDATE_KYC` | KycService.updateKyc |
| `PRIM_MANIPULATE_ACCOUNT_STATUS` | `CHANGE_ACCOUNT_STATUS` | AccountService.changeAccountStatus |

---

## 7. Boundaries

| Concern | Person 2 (M2) | Person 1 (Orchestration) |
|---|---|---|
| Attack planning | ✅ Owns | ❌ Does not plan |
| Primitive definitions | ✅ Owns | ❌ Read-only via `ScenarioHandler` |
| Strategy definitions | ✅ Owns | ❌ Read-only |
| Scenario validation | ✅ Owns | ❌ Calls `assertConsumable()` only |
| `toActionRequest()` construction | ✅ Owns | ❌ Calls `toActionRequest()` only |
| Scenario execution | ❌ Does NOT execute | ✅ Owns |
| M1 API calls | ❌ Does NOT call | ✅ Owns |
| Execution report | ❌ Does NOT produce | ✅ Owns |
| Database access | ❌ Never | ✅ Via M1 services only |

---

## 8. Schema Version

`AttackScenario.version = "1.0.0"` (current).  
`handler.assertConsumable()` will throw if a future unsupported version is passed.  
If Person 2 makes a breaking schema change, the version MUST be incremented and `SUPPORTED_SCENARIO_VERSION` in `ScenarioHandler.js` updated.

---

## 9. What Person 1 Must NOT Do

- Do NOT import `PrimitiveRegistry`, `ScenarioValidator`, or other M2 internals directly
- Do NOT modify `scenario.steps`, `scenario.status`, or any other scenario field
- Do NOT execute steps when `assertConsumable()` throws
- Do NOT skip `adversarial_metadata` (`toActionRequest()` includes it automatically)
- Do NOT execute abstract primitives (they have `is_abstract: true`; `assertConsumable()` blocks them)
