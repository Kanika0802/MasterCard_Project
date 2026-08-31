// blueteam/src/DefenseEngine.js
"use strict";

const crypto = require("crypto");
const StreamProcessor = require("./stream/StreamProcessor");
const FeatureStore = require("./features/FeatureStore");
const FeatureExtractor = require("./features/FeatureExtractor");
const EnsembleRiskEngine = require("./ensemble/EnsembleRiskEngine");
const DecisionEngine = require("./mitigation/DecisionEngine");
const MitigationActionExecutor = require("./mitigation/MitigationActionExecutor");
const AlertManager = require("./alerts/AlertManager");
const BlueTeamKafkaConsumer = require("./stream/KafkaConsumer");

class DefenseEngine {
    constructor(options = {}) {
        this.featureStore = options.featureStore || new FeatureStore();
        this.featureExtractor = options.featureExtractor || new FeatureExtractor(this.featureStore);
        this.riskEngine = options.riskEngine || new EnsembleRiskEngine(options.ensembleOptions || {});
        this.decisionEngine = options.decisionEngine || new DecisionEngine(options.decisionOptions || {});
        this.mitigationExecutor = options.mitigationExecutor || new MitigationActionExecutor(options.mitigationOptions || {});
        this.alertManager = options.alertManager || new AlertManager();

        this.streamProcessor = options.streamProcessor || new StreamProcessor({
            featureStore: this.featureStore,
            featureExtractor: this.featureExtractor,
            riskEngine: this.riskEngine,
            decisionEngine: this.decisionEngine,
            mitigationExecutor: this.mitigationExecutor,
            alertManager: this.alertManager
        });

        this.kafkaConsumer = null;
        this.options = options;
    }

    /**
     * Synchronous evaluation of an incoming transaction request (e.g. at payment gateway / API boundary)
     */
    async evaluateTransaction(transaction, context = {}) {
        const occurredAt = context.occurred_at || new Date().toISOString();
        const eventId = context.event_id || crypto.randomUUID();

        // 1. Extract feature vector
        const features = this.featureExtractor.extractTransactionFeatures(transaction, occurredAt);

        // 2. Wrap as synthetic canonical event for evaluation
        const event = {
            event_id: eventId,
            event_type: "TRANSACTION_INITIATED",
            entity_type: "transaction",
            entity_id: transaction.transaction_id || eventId,
            actor_id: transaction.initiator_user_id || transaction.user_id,
            device_id: transaction.device_id,
            simulation_id: context.simulation_id || null,
            experiment_id: context.experiment_id || null,
            occurred_at: occurredAt,
            payload: transaction
        };

        // 3. Score with Ensemble Risk Engine
        const riskScore = this.riskEngine.evaluate(features, event);

        // 4. Determine Defense Decision
        const decision = this.decisionEngine.evaluateDecision(riskScore, event);

        // 5. If High/Critical Risk, create alert
        let alert = null;
        if (riskScore.isHighRisk()) {
            alert = this.alertManager.createAlertFromRisk({
                riskScore,
                decision,
                event
            });
        }

        // 6. Record transaction into feature store for rolling baseline
        this.featureStore.recordTransaction({
            ...transaction,
            occurred_at: occurredAt
        });

        return {
            decision_id: decision.decision_id,
            action: decision.action,
            risk_score: riskScore.toJSON(),
            decision: decision.toJSON(),
            alert: alert ? alert.toJSON() : null,
            requires_step_up: decision.requires_step_up,
            is_blocked: decision.isBlocked(),
            explanations: riskScore.explanations,
            features
        };
    }

    /**
     * Process an asynchronous simulator event (from Kafka or direct stream)
     */
    async processEvent(event) {
        return await this.streamProcessor.processEvent(event);
    }

    /**
     * Inspect entity profile in feature store
     */
    getProfile(entityType, entityId) {
        if (entityType === "user") {
            const profile = this.featureStore.getUserProfile(entityId);
            return profile ? profile.toJSON() : null;
        } else if (entityType === "account") {
            const profile = this.featureStore.getAccountProfile(entityId);
            return profile ? profile.toJSON() : null;
        } else if (entityType === "device") {
            return this.featureStore.getDeviceProfile(entityId);
        } else if (entityType === "kyc") {
            return this.featureStore.getKycProfile(entityId);
        }
        return null;
    }

    /**
     * Retrieve security alerts
     */
    listAlerts(filter = {}) {
        return this.alertManager.listAlerts(filter);
    }

    getAlert(alertId) {
        const alert = this.alertManager.getAlert(alertId);
        return alert ? alert.toJSON() : null;
    }

    resolveAlert(alertId, reason, author) {
        const alert = this.alertManager.resolveAlert(alertId, reason, author);
        return alert ? alert.toJSON() : null;
    }

    dismissAlert(alertId, reason, author) {
        const alert = this.alertManager.dismissAlert(alertId, reason, author);
        return alert ? alert.toJSON() : null;
    }

    /**
     * Retrieve active rule list
     */
    getRules() {
        return this.riskEngine.ruleEngine.getRules();
    }

    /**
     * Retrieve defense metrics & performance stats
     */
    getMetrics() {
        const streamMetrics = this.streamProcessor.getMetrics();
        const alertMetrics = this.alertManager.getMetrics();

        return {
            stream: streamMetrics,
            alerts: alertMetrics,
            active_rules_count: this.riskEngine.ruleEngine.rules.length,
            models_loaded: [
                "RuleEngine",
                "XGBoostRiskModel",
                "AutoencoderDetector",
                "StatisticalAnomalyDetector",
                "GraphRiskAnalyzer",
                "DeviceFingerprintDetector",
                "DocumentKycDetector"
            ]
        };
    }

    /**
     * Start Kafka event consumer
     */
    async startKafkaStream(options = {}) {
        if (!this.kafkaConsumer) {
            this.kafkaConsumer = new BlueTeamKafkaConsumer(this.streamProcessor, options);
        }
        await this.kafkaConsumer.start();
    }

    async stopKafkaStream() {
        if (this.kafkaConsumer) {
            await this.kafkaConsumer.stop();
        }
    }

    clear() {
        this.streamProcessor.clear();
    }
}

module.exports = DefenseEngine;
