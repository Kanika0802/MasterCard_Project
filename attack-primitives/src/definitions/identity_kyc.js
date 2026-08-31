// attack-primitives/src/definitions/identity_kyc.js
"use strict";

const { PrimitiveCategory, AttackFamily, ImpactSeverity, ExecutionType } = require("../domain/constants");
const AttackPrimitive = require("../domain/AttackPrimitive");

const IDENTITY_KYC_PRIMITIVES = [
    new AttackPrimitive({
        primitive_id: "PRIM_TAMPER_KYC_VERIFICATION",
        name: "Tamper KYC Verification Status",
        description: "Directly modify or bypass KYC verification records, injecting falsified verification or liveness status for an unvetted identity.",
        category: PrimitiveCategory.IDENTITY_KYC,
        attack_family: AttackFamily.KYC_TAMPERING,
        execution_type: ExecutionType.CONCRETE,
        simulator_action: "UPDATE_KYC",
        parameters: [
            {
                name: "user_id",
                type: "string",
                description: "User ID whose KYC record is modified"
            },
            {
                name: "verification_status",
                type: "string",
                description: "Target verification status to set",
                enum_values: ["PENDING", "VERIFIED", "REJECTED", "EXPIRED"]
            },
            {
                name: "liveness_status",
                type: "string",
                description: "Target biometric liveness status",
                required: false,
                enum_values: ["PASSED", "FAILED", "SUSPICIOUS"]
            },
            {
                name: "document_reference",
                type: "string",
                description: "Synthetic or altered document ID reference",
                required: false
            }
        ],
        expected_success_events: ["KYC_UPDATED"],
        expected_failure_events: ["VALIDATION_ERROR", "NOT_FOUND"],
        state_transition: {
            preconditions: ["User must exist in simulator."],
            postconditions: ["User KYC record status is updated to target status."],
            state_invariants: ["Financial accounts associated with user remain in current state."],
            entity_impacts: { kyc: "STATUS_TAMPERED" }
        },
        mitre_attack_id: "T1565.001",
        stealth_score: 3,
        detection_risk: 0.50,
        financial_impact_severity: ImpactSeverity.HIGH,
        tags: ["kyc", "identity", "tampering", "compliance-bypass"]
    }),

    new AttackPrimitive({
        primitive_id: "PRIM_SYNTHETIC_ID_CREATION",
        name: "Synthetic Customer Identity Creation",
        description: "Abstract primitive representing the creation of a fictitious identity composed of combined real and fabricated identity metadata to bypass initial onboarding.",
        category: PrimitiveCategory.IDENTITY_KYC,
        attack_family: AttackFamily.SYNTHETIC_IDENTITY,
        execution_type: ExecutionType.ABSTRACT,
        simulator_action: null,
        parameters: [
            {
                name: "target_name",
                type: "string",
                description: "Synthesized full name"
            },
            {
                name: "synthetic_ssn_flag",
                type: "boolean",
                description: "Whether synthetic SSN/National ID was fabricated",
                required: false,
                default_value: true
            }
        ],
        expected_success_events: ["USER_CREATED", "KYC_CREATED"],
        expected_failure_events: ["VALIDATION_ERROR"],
        state_transition: {
            preconditions: [],
            postconditions: ["Synthetic customer entity ready for account opening."],
            state_invariants: [],
            entity_impacts: { user: "SYNTHETIC_PROFILE_ENROLLED" }
        },
        mitre_attack_id: "T1589.001",
        stealth_score: 4,
        detection_risk: 0.40,
        financial_impact_severity: ImpactSeverity.HIGH,
        tags: ["synthetic-identity", "onboarding-fraud", "abstract"]
    })
];

module.exports = IDENTITY_KYC_PRIMITIVES;
