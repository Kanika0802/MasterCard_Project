// attack-primitives/src/domain/constants.js
"use strict";

const PrimitiveCategory = Object.freeze({
    AUTHENTICATION: "AUTHENTICATION",
    IDENTITY_KYC: "IDENTITY_KYC",
    DEVICE: "DEVICE",
    TRANSACTION: "TRANSACTION",
    MULE_NETWORK: "MULE_NETWORK",
    ACCOUNT_MANAGEMENT: "ACCOUNT_MANAGEMENT"
});

const AttackFamily = Object.freeze({
    ACCOUNT_TAKEOVER: "ACCOUNT_TAKEOVER",
    CREDENTIAL_STUFFING: "CREDENTIAL_STUFFING",
    OTP_BYPASS: "OTP_BYPASS",
    SYNTHETIC_IDENTITY: "SYNTHETIC_IDENTITY",
    KYC_TAMPERING: "KYC_TAMPERING",
    DEVICE_SPOOFING: "DEVICE_SPOOFING",
    IMPOSSIBLE_TRAVEL: "IMPOSSIBLE_TRAVEL",
    VELOCITY_ABUSE: "VELOCITY_ABUSE",
    TRANSACTION_SPLITTING: "TRANSACTION_SPLITTING",
    MULE_NETWORK: "MULE_NETWORK",
    MONEY_LAUNDERING_LAYER: "MONEY_LAUNDERING_LAYER",
    ACCOUNT_TAMPERING: "ACCOUNT_TAMPERING"
});

const ImpactSeverity = Object.freeze({
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL"
});

const ExecutionType = Object.freeze({
    CONCRETE: "CONCRETE", // Directly executable via M1 Simulator Action API
    ABSTRACT: "ABSTRACT"  // Conceptual / high-level, requires decomposition
});

const ValidSimulatorActions = Object.freeze([
    "ADD_BENEFICIARY",
    "PERFORM_TRANSACTION",
    "SIMULATE_LOGIN",
    "REGISTER_DEVICE",
    "UPDATE_KYC",
    "CHANGE_ACCOUNT_STATUS"
]);

const ParameterType = Object.freeze({
    STRING: "string",
    NUMBER: "number",
    BOOLEAN: "boolean",
    OBJECT: "object",
    ARRAY: "array"
});

module.exports = {
    PrimitiveCategory,
    AttackFamily,
    ImpactSeverity,
    ExecutionType,
    ValidSimulatorActions,
    ParameterType
};
