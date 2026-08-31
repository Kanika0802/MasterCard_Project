// blueteam/src/mitigation/DecisionEngine.js
"use strict";

const crypto = require("crypto");
const DefenseDecision = require("../domain/entities/DefenseDecision");
const { DefenseDecisionType, RiskTier } = require("../domain/constants");

class DecisionEngine {
    constructor(options = {}) {
        this.policy = options.policy || {
            [RiskTier.LOW]: {
                action: DefenseDecisionType.ALLOW,
                requires_step_up: false
            },
            [RiskTier.MEDIUM]: {
                action: DefenseDecisionType.CHALLENGE_OTP,
                requires_step_up: true,
                step_up_type: "SMS_OTP"
            },
            [RiskTier.HIGH]: {
                action: DefenseDecisionType.BLOCK_TRANSACTION,
                requires_step_up: false,
                mitigation_actions: ["BLOCK_PAYMENT", "FLAG_SUSPICIOUS"]
            },
            [RiskTier.CRITICAL]: {
                action: DefenseDecisionType.FREEZE_ACCOUNT,
                requires_step_up: false,
                mitigation_actions: ["BLOCK_PAYMENT", "FREEZE_ACCOUNT", "REVOKE_SESSION", "ALERT_FRAUD_DESK"]
            }
        };
    }

    evaluateDecision(riskScore, event = {}) {
        const tier = riskScore.risk_tier || RiskTier.LOW;
        const config = this.policy[tier] || this.policy[RiskTier.LOW];

        const payload = event.payload || {};
        const entityId = event.entity_id || payload.transaction_id || payload.account_id || payload.user_id;

        return new DefenseDecision({
            decision_id: crypto.randomUUID(),
            action: config.action,
            risk_score: riskScore,
            reasons: riskScore.explanations,
            mitigation_actions: config.mitigation_actions || [],
            requires_step_up: config.requires_step_up || false,
            step_up_type: config.step_up_type || null,
            target_entity_type: event.entity_type || "transaction",
            target_entity_id: entityId,
            simulation_id: event.simulation_id || null,
            experiment_id: event.experiment_id || null,
            decided_at: new Date().toISOString(),
            metadata: {
                event_type: event.event_type
            }
        });
    }
}

module.exports = DecisionEngine;
