// attack-primitives/src/definitions/transaction.js
"use strict";

const { PrimitiveCategory, AttackFamily, ImpactSeverity, ExecutionType } = require("../domain/constants");
const AttackPrimitive = require("../domain/AttackPrimitive");

const TRANSACTION_PRIMITIVES = [
    new AttackPrimitive({
        primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
        name: "Execute Fraudulent Fund Transfer",
        description: "Initiate and settle an unauthorized funds transfer from a victim account to an attacker or mule recipient account.",
        category: PrimitiveCategory.TRANSACTION,
        attack_family: AttackFamily.MULE_NETWORK,
        execution_type: ExecutionType.CONCRETE,
        simulator_action: "PERFORM_TRANSACTION",
        parameters: [
            {
                name: "sender_account_id",
                type: "string",
                description: "Source account ID to debit funds from"
            },
            {
                name: "receiver_account_id",
                type: "string",
                description: "Destination mule/attacker account ID to credit"
            },
            {
                name: "initiator_user_id",
                type: "string",
                description: "User ID initiating the transaction"
            },
            {
                name: "amount",
                type: "number",
                description: "Transfer monetary amount",
                min: 0.01
            },
            {
                name: "currency",
                type: "string",
                description: "3-letter ISO currency code",
                required: false,
                default_value: "USD",
                enum_values: ["USD", "EUR", "GBP", "INR"]
            },
            {
                name: "channel",
                type: "string",
                description: "Payment initiation channel",
                required: false,
                default_value: "MOBILE_APP",
                enum_values: ["MOBILE_APP", "WEB_PORTAL", "API", "ATM", "POS_TERMINAL"]
            },
            {
                name: "device_id",
                type: "string",
                description: "Device ID executing the transfer",
                required: false
            }
        ],
        expected_success_events: ["TRANSACTION_INITIATED", "TRANSACTION_COMPLETED"],
        expected_failure_events: ["TRANSACTION_FAILED", "INSUFFICIENT_FUNDS"],
        state_transition: {
            preconditions: [
                "Sender account must exist with status ACTIVE.",
                "Sender account must have balance >= amount.",
                "Receiver account must exist with status ACTIVE."
            ],
            postconditions: [
                "Sender balance debited by amount.",
                "Receiver balance credited by amount.",
                "Two double-entry ledger records created."
            ],
            state_invariants: ["Total ledger balance conserved across sender and receiver accounts."],
            entity_impacts: { sender_account: "DEBITED", receiver_account: "CREDITED" }
        },
        mitre_attack_id: "T1537",
        stealth_score: 3,
        detection_risk: 0.70,
        financial_impact_severity: ImpactSeverity.CRITICAL,
        tags: ["fund-drain", "transfer", "financial-impact", "transaction"]
    }),

    new AttackPrimitive({
        primitive_id: "PRIM_RAPID_SPLIT_PAYMENTS",
        name: "Rapid Velocity Split Transactions",
        description: "Executes a rapid sequence of smaller payments below detection thresholds to siphon funds while evading single-transaction volume limits.",
        category: PrimitiveCategory.TRANSACTION,
        attack_family: AttackFamily.TRANSACTION_SPLITTING,
        execution_type: ExecutionType.CONCRETE,
        simulator_action: "PERFORM_TRANSACTION",
        parameters: [
            {
                name: "sender_account_id",
                type: "string",
                description: "Source account ID"
            },
            {
                name: "receiver_account_id",
                type: "string",
                description: "Destination mule account ID"
            },
            {
                name: "initiator_user_id",
                type: "string",
                description: "Initiating user ID"
            },
            {
                name: "amount",
                type: "number",
                description: "Split micro-amount per transfer",
                min: 0.01
            },
            {
                name: "channel",
                type: "string",
                description: "Channel identifier",
                required: false,
                default_value: "MOBILE_APP"
            }
        ],
        expected_success_events: ["TRANSACTION_INITIATED", "TRANSACTION_COMPLETED"],
        expected_failure_events: ["TRANSACTION_FAILED"],
        state_transition: {
            preconditions: ["Sender account must have sufficient balance."],
            postconditions: ["Sender debited, receiver credited, velocity counter increments."],
            state_invariants: ["Balance arithmetic conserved."],
            entity_impacts: { sender_account: "SPLIT_DEBIT" }
        },
        mitre_attack_id: "T1537",
        stealth_score: 2,
        detection_risk: 0.85,
        financial_impact_severity: ImpactSeverity.HIGH,
        tags: ["velocity", "structuring", "splitting", "smurfing", "transaction"]
    })
];

module.exports = TRANSACTION_PRIMITIVES;
