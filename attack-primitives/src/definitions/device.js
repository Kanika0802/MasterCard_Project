// attack-primitives/src/definitions/device.js
"use strict";

const { PrimitiveCategory, AttackFamily, ImpactSeverity, ExecutionType } = require("../domain/constants");
const AttackPrimitive = require("../domain/AttackPrimitive");

const DEVICE_PRIMITIVES = [
    new AttackPrimitive({
        primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
        name: "Register Spoofed Attacker Device",
        description: "Enroll a new or manipulated device fingerprint onto a victim account, establishing an attacker-controlled endpoint for subsequent transaction execution.",
        category: PrimitiveCategory.DEVICE,
        attack_family: AttackFamily.DEVICE_SPOOFING,
        execution_type: ExecutionType.CONCRETE,
        simulator_action: "REGISTER_DEVICE",
        parameters: [
            {
                name: "user_id",
                type: "string",
                description: "Target victim user ID to attach device to"
            },
            {
                name: "device_type",
                type: "string",
                description: "Hardware device type",
                required: false,
                default_value: "MOBILE",
                enum_values: ["MOBILE", "DESKTOP", "TABLET", "UNKNOWN"]
            },
            {
                name: "operating_system",
                type: "string",
                description: "Operating system signature string",
                required: false,
                default_value: "Android 14"
            },
            {
                name: "browser",
                type: "string",
                description: "Browser / User-Agent signature",
                required: false
            },
            {
                name: "ip_address",
                type: "string",
                description: "Attacker IP address",
                required: false,
                default_value: "198.51.100.99"
            },
            {
                name: "device_fingerprint",
                type: "string",
                description: "Spoofed device fingerprint hash/identifier",
                required: false
            }
        ],
        expected_success_events: ["DEVICE_REGISTERED"],
        expected_failure_events: ["VALIDATION_ERROR", "CONFLICT"],
        state_transition: {
            preconditions: ["Victim user must exist in simulator."],
            postconditions: ["New device entity is registered with status ACTIVE attached to user_id."],
            state_invariants: ["Existing enrolled user devices remain unchanged."],
            entity_impacts: { device: "ENROLLED_NEW_ENDPOINT" }
        },
        mitre_attack_id: "T1036.005",
        stealth_score: 3,
        detection_risk: 0.65,
        financial_impact_severity: ImpactSeverity.MEDIUM,
        tags: ["device-spoofing", "fingerprint", "endpoint-enrollment", "device"]
    }),

    new AttackPrimitive({
        primitive_id: "PRIM_GEO_VELOCITY_HOP",
        name: "Impossible Geo-Velocity Displacement",
        description: "Abstract primitive representing the execution of actions from geographically disparate IP addresses within an impossible physical transit window.",
        category: PrimitiveCategory.DEVICE,
        attack_family: AttackFamily.IMPOSSIBLE_TRAVEL,
        execution_type: ExecutionType.ABSTRACT,
        simulator_action: null,
        parameters: [
            {
                name: "user_id",
                type: "string",
                description: "Target user ID"
            },
            {
                name: "origin_location",
                type: "object",
                description: "Origin coordinates { latitude, longitude }"
            },
            {
                name: "target_location",
                type: "object",
                description: "Destination coordinates { latitude, longitude }"
            },
            {
                name: "elapsed_seconds",
                type: "number",
                description: "Time difference between consecutive locations in seconds",
                min: 1
            }
        ],
        expected_success_events: ["AUTH_LOGIN_SUCCESS"],
        expected_failure_events: ["AUTH_LOGIN_FAILED"],
        state_transition: {
            preconditions: ["User must have logged in from origin_location."],
            postconditions: ["Telemetry logged with target_location causing geo-velocity spike."],
            state_invariants: [],
            entity_impacts: { device: "GEO_ANOMALY_RECORDED" }
        },
        mitre_attack_id: "T1090",
        stealth_score: 1,
        detection_risk: 0.95,
        financial_impact_severity: ImpactSeverity.MEDIUM,
        tags: ["impossible-travel", "geo-velocity", "proxy-hopping", "abstract"]
    })
];

module.exports = DEVICE_PRIMITIVES;
