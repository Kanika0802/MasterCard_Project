// attack-primitives/src/definitions/mule_network.js
"use strict";

const { PrimitiveCategory, AttackFamily, ImpactSeverity, ExecutionType } = require("../domain/constants");
const AttackPrimitive = require("../domain/AttackPrimitive");

const MULE_NETWORK_PRIMITIVES = [
    new AttackPrimitive({
        primitive_id: "PRIM_ADD_MULE_BENEFICIARY",
        name: "Add Mule Beneficiary Account",
        description: "Register a mule or attacker-controlled bank account as an approved payee on a victim's profile to bypass beneficiary cool-off checks and prepare for fund drainage.",
        category: PrimitiveCategory.MULE_NETWORK,
        attack_family: AttackFamily.MULE_NETWORK,
        execution_type: ExecutionType.CONCRETE,
        simulator_action: "ADD_BENEFICIARY",
        parameters: [
            {
                name: "user_id",
                type: "string",
                description: "Victim user ID whose beneficiary list is modified"
            },
            {
                name: "target_account_id",
                type: "string",
                description: "Mule account ID being registered as a payee"
            },
            {
                name: "nickname",
                type: "string",
                description: "Innocuous nickname for beneficiary",
                required: false,
                default_value: "Friend"
            }
        ],
        expected_success_events: ["BENEFICIARY_ADDED"],
        expected_failure_events: ["VALIDATION_ERROR", "CONFLICT"],
        state_transition: {
            preconditions: [
                "Target user must exist in simulator.",
                "Target mule account must exist in simulator.",
                "No duplicate active beneficiary mapping."
            ],
            postconditions: ["Beneficiary relationship is active for user_id."],
            state_invariants: ["Victim account balance remains unchanged."],
            entity_impacts: { beneficiary: "PAYEE_REGISTERED" }
        },
        mitre_attack_id: "T1078",
        stealth_score: 3,
        detection_risk: 0.60,
        financial_impact_severity: ImpactSeverity.HIGH,
        tags: ["mule", "beneficiary", "fund-siphoning", "mule-network"]
    }),

    new AttackPrimitive({
        primitive_id: "PRIM_CIRCULAR_ROUTING_HOP",
        name: "Circular Layering Transfer Hop",
        description: "Abstract primitive representing the intermediate routing of illicit funds through multi-tier mule rings and return cycles to obfuscate audit trails.",
        category: PrimitiveCategory.MULE_NETWORK,
        attack_family: AttackFamily.MONEY_LAUNDERING_LAYER,
        execution_type: ExecutionType.ABSTRACT,
        simulator_action: null,
        parameters: [
            {
                name: "hop_accounts",
                type: "array",
                description: "Array of intermediate mule account IDs in the layering chain"
            },
            {
                name: "cycle_length",
                type: "number",
                description: "Number of hops in the money laundering ring",
                min: 2
            }
        ],
        expected_success_events: ["TRANSACTION_COMPLETED"],
        expected_failure_events: ["TRANSACTION_FAILED"],
        state_transition: {
            preconditions: ["All hop accounts must exist."],
            postconditions: ["Funds cycled through chain."],
            state_invariants: [],
            entity_impacts: { graph: "CYCLE_TOPOLOGY_CREATED" }
        },
        mitre_attack_id: "T1565",
        stealth_score: 4,
        detection_risk: 0.55,
        financial_impact_severity: ImpactSeverity.HIGH,
        tags: ["mule-ring", "layering", "circular-flow", "abstract"]
    })
];

module.exports = MULE_NETWORK_PRIMITIVES;
