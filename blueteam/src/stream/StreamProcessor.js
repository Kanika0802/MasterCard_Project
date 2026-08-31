// blueteam/src/stream/StreamProcessor.js
"use strict";

const EventEmitter = require("events");
const DeduplicationCache = require("./DeduplicationCache");
const FeatureStore = require("../features/FeatureStore");
const FeatureExtractor = require("../features/FeatureExtractor");
const EnsembleRiskEngine = require("../ensemble/EnsembleRiskEngine");
const DecisionEngine = require("../mitigation/DecisionEngine");
const MitigationActionExecutor = require("../mitigation/MitigationActionExecutor");
const AlertManager = require("../alerts/AlertManager");
const { InvalidEventError } = require("../domain/errors");

class StreamProcessor extends EventEmitter {
    constructor(options = {}) {
        super();
        this.featureStore = options.featureStore || new FeatureStore();
        this.featureExtractor = options.featureExtractor || new FeatureExtractor(this.featureStore);
        this.riskEngine = options.riskEngine || new EnsembleRiskEngine(options.ensembleOptions || {});
        this.decisionEngine = options.decisionEngine || new DecisionEngine(options.decisionOptions || {});
        this.mitigationExecutor = options.mitigationExecutor || new MitigationActionExecutor(options.mitigationOptions || {});
        this.alertManager = options.alertManager || new AlertManager();
        this.dedupCache = options.dedupCache || new DeduplicationCache();

        this.processedCount = 0;
        this.duplicateCount = 0;
        this.threatCount = 0;
    }

    async processEvent(event) {
        if (!event || typeof event !== "object") {
            throw new InvalidEventError("Event must be a non-null object");
        }

        const eventId = event.event_id || event.idempotency_key;
        if (eventId && this.dedupCache.isDuplicate(eventId)) {
            this.duplicateCount += 1;
            return {
                status: "DUPLICATE_SKIPPED",
                event_id: eventId
            };
        }

        if (eventId) {
            this.dedupCache.add(eventId);
        }

        const eventType = event.event_type;
        const payload = event.payload || {};
        const occurredAt = event.occurred_at || new Date().toISOString();

        // 1. Update State in FeatureStore
        this._updateFeatureStore(event);

        // 2. Extract Features
        let features = {};
        let isEvaluated = false;
        let riskScore = null;
        let decision = null;
        let alert = null;

        if (eventType && (eventType.startsWith("TRANSACTION_") || eventType.startsWith("AUTH_") || eventType.startsWith("DEVICE_") || eventType.startsWith("KYC_") || eventType.startsWith("ACCOUNT_"))) {
            isEvaluated = true;

            if (eventType.startsWith("TRANSACTION_")) {
                features = this.featureExtractor.extractTransactionFeatures(payload, occurredAt);
            } else {
                // For non-transaction events, build contextual feature set
                const userId = payload.user_id || event.actor_id || (event.entity_type === "user" ? event.entity_id : null);
                features = this.featureExtractor.extractTransactionFeatures({
                    amount: payload.amount || 0,
                    initiator_user_id: userId,
                    user_id: userId,
                    sender_account_id: payload.account_id || (event.entity_type === "account" ? event.entity_id : null),
                    receiver_account_id: payload.receiver_account_id,
                    device_id: event.device_id || payload.device_id,
                    location: payload.location || payload.geo_location
                }, occurredAt);
            }

            // 3. Evaluate Risk through Ensemble
            riskScore = this.riskEngine.evaluate(features, event);

            // 4. Determine Defense Decision
            decision = this.decisionEngine.evaluateDecision(riskScore, event);

            // 5. Execute Automated Mitigation if required
            if (decision.isBlocked()) {
                this.threatCount += 1;
                await this.mitigationExecutor.executeMitigation(decision, event);
            }

            // 6. Raise Alert if High/Critical Risk
            if (riskScore.isHighRisk()) {
                alert = this.alertManager.createAlertFromRisk({
                    riskScore,
                    decision,
                    event
                });
            }
        }

        this.processedCount += 1;

        const result = {
            status: "PROCESSED",
            event_id: eventId,
            event_type: eventType,
            is_evaluated: isEvaluated,
            risk_score: riskScore ? riskScore.toJSON() : null,
            decision: decision ? decision.toJSON() : null,
            alert: alert ? alert.toJSON() : null,
            features: features
        };

        this.emit("eventProcessed", result);
        if (alert) {
            this.emit("alertGenerated", alert);
        }

        return result;
    }

    _updateFeatureStore(event) {
        const eventType = event.event_type;
        const payload = event.payload || {};

        if (eventType && eventType.startsWith("TRANSACTION_")) {
            this.featureStore.recordTransaction({
                ...payload,
                occurred_at: event.occurred_at
            });
        } else if (eventType && eventType.startsWith("AUTH_")) {
            this.featureStore.recordAuthEvent({
                ...payload,
                event_id: event.event_id,
                event_type: eventType,
                timestamp: event.occurred_at
            });
        } else if (eventType === "DEVICE_REGISTERED" || eventType === "DEVICE_UPDATED") {
            const deviceId = payload.device_id || event.entity_id;
            this.featureStore.setDeviceProfile(deviceId, {
                ...payload,
                registeredAt: event.occurred_at
            });
        } else if (eventType === "KYC_CREATED" || eventType === "KYC_UPDATED") {
            const userId = payload.user_id || event.entity_id;
            this.featureStore.setKycProfile(userId, {
                ...payload,
                status: payload.verification_status,
                isTampered: payload.verification_status === "REJECTED" || payload.liveness_status === "FAILED"
            });
        } else if (eventType === "BENEFICIARY_ADDED") {
            const userId = payload.user_id || event.actor_id;
            const userProfile = this.featureStore.getUserProfile(userId);
            if (userProfile && payload.beneficiary_account_id) {
                userProfile.known_beneficiaries.add(payload.beneficiary_account_id);
            }
        }
    }

    getMetrics() {
        return {
            processed_count: this.processedCount,
            duplicate_count: this.duplicateCount,
            threat_count: this.threatCount,
            dedup_cache_size: this.dedupCache.size(),
            alerts: this.alertManager.getMetrics()
        };
    }

    clear() {
        this.featureStore.clear();
        this.alertManager.clear();
        this.dedupCache.clear();
        this.mitigationExecutor.clear();
        this.processedCount = 0;
        this.duplicateCount = 0;
        this.threatCount = 0;
    }
}

module.exports = StreamProcessor;
