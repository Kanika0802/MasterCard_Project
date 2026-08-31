// blueteam/src/index.js
//
// Module 3: Blue Team Defense & Fraud Detection Engine — Public API
//
"use strict";

const DefenseEngine = require("./DefenseEngine");
const StreamProcessor = require("./stream/StreamProcessor");
const BlueTeamKafkaConsumer = require("./stream/KafkaConsumer");
const DeduplicationCache = require("./stream/DeduplicationCache");

const FeatureStore = require("./features/FeatureStore");
const FeatureExtractor = require("./features/FeatureExtractor");
const Aggregators = require("./features/Aggregators");
const GraphFeatureExtractor = require("./features/GraphFeatureExtractor");

const RuleEngine = require("./detectors/rules/RuleEngine");
const VelocityRule = require("./detectors/rules/VelocityRule");
const ImpossibleTravelRule = require("./detectors/rules/ImpossibleTravelRule");
const NewDeviceHighValueRule = require("./detectors/rules/NewDeviceHighValueRule");
const AuthBruteForceRule = require("./detectors/rules/AuthBruteForceRule");
const MulePassThroughRule = require("./detectors/rules/MulePassThroughRule");
const KycTamperingRule = require("./detectors/rules/KycTamperingRule");
const AccountFreezeRule = require("./detectors/rules/AccountFreezeRule");

const XGBoostRiskModel = require("./detectors/ml/XGBoostRiskModel");
const AutoencoderDetector = require("./detectors/ml/AutoencoderDetector");
const StatisticalAnomalyDetector = require("./detectors/ml/StatisticalAnomalyDetector");
const GraphRiskAnalyzer = require("./detectors/graph/GraphRiskAnalyzer");
const DeviceFingerprintDetector = require("./detectors/identity/DeviceFingerprintDetector");
const DocumentKycDetector = require("./detectors/identity/DocumentKycDetector");

const EnsembleRiskEngine = require("./ensemble/EnsembleRiskEngine");
const DecisionEngine = require("./mitigation/DecisionEngine");
const MitigationActionExecutor = require("./mitigation/MitigationActionExecutor");
const AlertManager = require("./alerts/AlertManager");
const AlertRepository = require("./alerts/AlertRepository");

const RiskScore = require("./domain/entities/RiskScore");
const DefenseDecision = require("./domain/entities/DefenseDecision");
const SecurityAlert = require("./domain/entities/SecurityAlert");
const EntityProfile = require("./domain/entities/EntityProfile");

const {
    RiskTier,
    DefenseDecisionType,
    AlertSeverity,
    AlertStatus,
    DetectionCategory,
    ModelType,
    DefaultRiskThresholds,
    DefaultEnsembleWeights,
    KafkaTopics
} = require("./domain/constants");

const {
    BlueTeamError,
    InvalidEventError,
    FeatureExtractionError,
    DetectionError,
    RuleExecutionError,
    PolicyDecisionError,
    AlertError
} = require("./domain/errors");

const { createBlueTeamApp } = require("./api/app");

module.exports = {
    // ── PRIMARY M3 FACADES ───────────────────────────────────────
    DefenseEngine,
    BlueTeamFacade: DefenseEngine, // Alias
    StreamProcessor,
    BlueTeamKafkaConsumer,
    createBlueTeamApp,

    // ── STATE & FEATURES ─────────────────────────────────────────
    FeatureStore,
    FeatureExtractor,
    Aggregators,
    GraphFeatureExtractor,
    DeduplicationCache,

    // ── DETECTION ENGINES ────────────────────────────────────────
    RuleEngine,
    VelocityRule,
    ImpossibleTravelRule,
    NewDeviceHighValueRule,
    AuthBruteForceRule,
    MulePassThroughRule,
    KycTamperingRule,
    AccountFreezeRule,

    XGBoostRiskModel,
    AutoencoderDetector,
    StatisticalAnomalyDetector,
    GraphRiskAnalyzer,
    DeviceFingerprintDetector,
    DocumentKycDetector,

    // ── ENSEMBLE & MITIGATION ────────────────────────────────────
    EnsembleRiskEngine,
    DecisionEngine,
    MitigationActionExecutor,
    AlertManager,
    AlertRepository,

    // ── DOMAIN ENTITIES ──────────────────────────────────────────
    RiskScore,
    DefenseDecision,
    SecurityAlert,
    EntityProfile,

    // ── CONSTANTS & ERRORS ───────────────────────────────────────
    RiskTier,
    DefenseDecisionType,
    AlertSeverity,
    AlertStatus,
    DetectionCategory,
    ModelType,
    DefaultRiskThresholds,
    DefaultEnsembleWeights,
    KafkaTopics,
    BlueTeamError,
    InvalidEventError,
    FeatureExtractionError,
    DetectionError,
    RuleExecutionError,
    PolicyDecisionError,
    AlertError
};
