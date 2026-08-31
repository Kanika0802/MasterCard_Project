// attack-primitives/src/definitions/account.js
"use strict";

const { PrimitiveCategory, AttackFamily, ImpactSeverity, ExecutionType } = require("../domain/constants");
const AttackPrimitive = require("../domain/AttackPrimitive");

const ACCOUNT_PRIMITIVES = [
    new AttackPrimitive({
        primitive_id: "PRIM_MANIPULATE_ACCOUNT_STATUS",
        name: "Manipulate Account Status / Unfreeze",
        description: "Directly manipulate the operational lifecycle state of an account, such as reactivating a frozen/suspended account to enable illicit transactions.",
        category: PrimitiveCategory.ACCOUNT_MANAGEMENT,
        attack_family: AttackFamily.ACCOUNT_TAMPERING,
        execution_type: ExecutionType.CONCRETE,
        simulator_action: "CHANGE_ACCOUNT_STATUS",
        parameters: [
            {
                name: "account_id",
                type: "string",
                description: "Target account ID whose status is being changed"
            },
            {
                name: "status",
                type: "string",
                description: "New account operational status to assign",
                enum_values: ["ACTIVE", "SUSPENDED", "FROZEN", "CLOSED"]
            },
            {
                name: "reason",
                type: "string",
                description: "Administrative justification string for audit log",
                required: false,
                default_value: "Adversarial status modification"
            }
        ],
        expected_success_events: ["ACCOUNT_STATUS_CHANGED"],
        expected_failure_events: ["VALIDATION_ERROR", "NOT_FOUND"],
        state_transition: {
            preconditions: ["Target account must exist in simulator."],
            postconditions: ["Account status transitioned to requested status."],
            state_invariants: ["Account balance remains unchanged."],
            entity_impacts: { account: "STATUS_TRANSITIONED" }
        },
        mitre_attack_id: "T1565.002",
        stealth_score: 2,
        detection_risk: 0.80,
        financial_impact_severity: ImpactSeverity.HIGH,
        tags: ["account-tampering", "unfreeze", "lifecycle-override", "account"]
    })
];

module.exports = ACCOUNT_PRIMITIVES;
