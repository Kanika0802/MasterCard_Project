// blueteam/src/domain/constants.js
"use strict";

const RiskTier = Object.freeze({
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL"
});

const DefenseDecisionType = Object.freeze({
    ALLOW: "ALLOW",
    CHALLENGE_OTP: "CHALLENGE_OTP",
    STEP_UP_AUTH: "STEP_UP_AUTH",
    MANUAL_REVIEW: "MANUAL_REVIEW",
    BLOCK_TRANSACTION: "BLOCK_TRANSACTION",
    FREEZE_ACCOUNT: "FREEZE_ACCOUNT",
    SUSPEND_DEVICE: "SUSPEND_DEVICE"
});

const AlertSeverity = Object.freeze({
    INFO: "INFO",
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL"
});

const AlertStatus = Object.freeze({
    NEW: "NEW",
    IN_TRIAGE: "IN_TRIAGE",
    ESCALATED: "ESCALATED",
    RESOLVED: "RESOLVED",
    DISMISSED: "DISMISSED"
});

const DetectionCategory = Object.freeze({
    VELOCITY: "VELOCITY",
    GEOLOCATION: "GEOLOCATION",
    DEVICE_INTEGRITY: "DEVICE_INTEGRITY",
    AUTH_CREDENTIAL: "AUTH_CREDENTIAL",
    MULE_NETWORK: "MULE_NETWORK",
    BEHAVIORAL_ANOMALY: "BEHAVIORAL_ANOMALY",
    KYC_SYNTHETIC: "KYC_SYNTHETIC",
    ACCOUNT_TAMPERING: "ACCOUNT_TAMPERING"
});

const ModelType = Object.freeze({
    RULE_ENGINE: "RULE_ENGINE",
    XGBOOST_TABULAR: "XGBOOST_TABULAR",
    AUTOENCODER: "AUTOENCODER",
    STATISTICAL_ZSCORE: "STATISTICAL_ZSCORE",
    GRAPH_ANALYZER: "GRAPH_ANALYZER",
    IDENTITY_VERIFIER: "IDENTITY_VERIFIER",
    ENSEMBLE: "ENSEMBLE"
});

const DefaultRiskThresholds = Object.freeze({
    LOW_MAX: 0.29,
    MEDIUM_MAX: 0.64,
    HIGH_MAX: 0.84,
    CRITICAL_MIN: 0.85
});

const DefaultEnsembleWeights = Object.freeze({
    rules: 0.35,
    ml_tabular: 0.25,
    autoencoder: 0.15,
    graph: 0.15,
    identity: 0.10
});

const KafkaTopics = Object.freeze({
    USERS: "simulator.users.v1",
    ACCOUNTS: "simulator.accounts.v1",
    TRANSACTIONS: "simulator.transactions.v1",
    DEVICES: "simulator.devices.v1",
    KYC: "simulator.kyc.v1",
    BENEFICIARIES: "simulator.beneficiaries.v1",
    AUTH: "simulator.auth.v1",
    SIMULATIONS: "simulator.simulations.v1"
});

module.exports = {
    RiskTier,
    DefenseDecisionType,
    AlertSeverity,
    AlertStatus,
    DetectionCategory,
    ModelType,
    DefaultRiskThresholds,
    DefaultEnsembleWeights,
    KafkaTopics
};
