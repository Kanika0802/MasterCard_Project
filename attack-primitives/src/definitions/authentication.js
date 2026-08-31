// attack-primitives/src/definitions/authentication.js
"use strict";

const { PrimitiveCategory, AttackFamily, ImpactSeverity, ExecutionType } = require("../domain/constants");
const AttackPrimitive = require("../domain/AttackPrimitive");

const AUTH_PRIMITIVES = [
    new AttackPrimitive({
        primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
        name: "Account Takeover Login",
        description: "Simulate a successful login session established by an attacker using compromised credentials on a target user account.",
        category: PrimitiveCategory.AUTHENTICATION,
        attack_family: AttackFamily.ACCOUNT_TAKEOVER,
        execution_type: ExecutionType.CONCRETE,
        simulator_action: "SIMULATE_LOGIN",
        parameters: [
            {
                name: "user_id",
                type: "string",
                description: "Target user ID whose account is being accessed"
            },
            {
                name: "device_id",
                type: "string",
                description: "Device identifier initiating the login session",
                required: false
            },
            {
                name: "success",
                type: "boolean",
                description: "Outcome of the authentication attempt",
                required: false,
                default_value: true
            },
            {
                name: "ip_address",
                type: "string",
                description: "Network IP address of the attacker",
                required: false
            }
        ],
        expected_success_events: ["AUTH_LOGIN_SUCCESS", "AUTH_SESSION_CREATED"],
        expected_failure_events: ["AUTH_LOGIN_FAILED"],
        state_transition: {
            preconditions: ["Target user must exist in the simulator with ACTIVE status."],
            postconditions: ["Active authentication session created associated with user_id."],
            state_invariants: ["User profile record remains unchanged."],
            entity_impacts: { user: "SESSION_ESTABLISHED" }
        },
        mitre_attack_id: "T1078.002",
        stealth_score: 4,
        detection_risk: 0.35,
        financial_impact_severity: ImpactSeverity.HIGH,
        tags: ["ato", "auth", "login", "credential-access"]
    }),

    new AttackPrimitive({
        primitive_id: "PRIM_BRUTE_FORCE_LOGIN_BURST",
        name: "Brute Force Credential Burst",
        description: "Rapid burst of failed login attempts targeting an account to simulate password guessing or credential stuffing.",
        category: PrimitiveCategory.AUTHENTICATION,
        attack_family: AttackFamily.CREDENTIAL_STUFFING,
        execution_type: ExecutionType.CONCRETE,
        simulator_action: "SIMULATE_LOGIN",
        parameters: [
            {
                name: "user_id",
                type: "string",
                description: "Target user ID being brute-forced"
            },
            {
                name: "success",
                type: "boolean",
                description: "Simulate failed authentication attempt",
                required: false,
                default_value: false
            },
            {
                name: "device_id",
                type: "string",
                description: "Attacker device identifier",
                required: false
            },
            {
                name: "ip_address",
                type: "string",
                description: "Source IP address of attack traffic",
                required: false
            }
        ],
        expected_success_events: ["AUTH_LOGIN_FAILED"],
        expected_failure_events: ["VALIDATION_ERROR"],
        state_transition: {
            preconditions: ["Target user must exist in the simulator."],
            postconditions: ["Failed authentication telemetry logged; user consecutive fail counter incremented."],
            state_invariants: ["Account balance and state remain unmodified."],
            entity_impacts: { user: "AUTH_FAILURE_INCREMENTED" }
        },
        mitre_attack_id: "T1110.001",
        stealth_score: 1,
        detection_risk: 0.90,
        financial_impact_severity: ImpactSeverity.LOW,
        tags: ["brute-force", "credential-stuffing", "noisy", "auth"]
    }),

    new AttackPrimitive({
        primitive_id: "PRIM_OTP_INTERCEPTION_ATTEMPT",
        name: "OTP Interception & Bypass",
        description: "Abstract primitive representing the interception or out-of-band social engineering of a one-time passcode to bypass multi-factor authentication.",
        category: PrimitiveCategory.AUTHENTICATION,
        attack_family: AttackFamily.OTP_BYPASS,
        execution_type: ExecutionType.ABSTRACT,
        simulator_action: null,
        parameters: [
            {
                name: "user_id",
                type: "string",
                description: "Target victim user ID"
            },
            {
                name: "channel",
                type: "string",
                description: "Interception vector (e.g. SMS, EMAIL, SIM_SWAP)",
                required: false,
                default_value: "SMS"
            }
        ],
        expected_success_events: ["AUTH_OTP_VERIFIED"],
        expected_failure_events: ["AUTH_OTP_FAILED"],
        state_transition: {
            preconditions: ["MFA challenge must be active for victim account."],
            postconditions: ["MFA challenge bypassed."],
            state_invariants: [],
            entity_impacts: { user: "MFA_BYPASS" }
        },
        mitre_attack_id: "T1111",
        stealth_score: 3,
        detection_risk: 0.60,
        financial_impact_severity: ImpactSeverity.HIGH,
        tags: ["otp", "mfa-bypass", "social-engineering", "abstract"]
    })
];

module.exports = AUTH_PRIMITIVES;
