// blueteam/src/domain/entities/DefenseDecision.js
"use strict";

const crypto = require("crypto");
const { DefenseDecisionType } = require("../constants");
const RiskScore = require("./RiskScore");

class DefenseDecision {
    constructor({
        decision_id = crypto.randomUUID(),
        action = DefenseDecisionType.ALLOW,
        risk_score = null,
        reasons = [],
        mitigation_actions = [],
        requires_step_up = false,
        step_up_type = null,
        target_entity_type = null,
        target_entity_id = null,
        simulation_id = null,
        experiment_id = null,
        decided_at = new Date().toISOString(),
        metadata = {}
    } = {}) {
        this.decision_id = decision_id;
        this.action = action;
        this.risk_score = risk_score instanceof RiskScore ? risk_score : (risk_score ? new RiskScore(risk_score) : new RiskScore());
        this.reasons = Array.isArray(reasons) ? [...reasons] : [];
        this.mitigation_actions = Array.isArray(mitigation_actions) ? [...mitigation_actions] : [];
        this.requires_step_up = Boolean(requires_step_up);
        this.step_up_type = step_up_type;
        this.target_entity_type = target_entity_type;
        this.target_entity_id = target_entity_id;
        this.simulation_id = simulation_id;
        this.experiment_id = experiment_id;
        this.decided_at = decided_at;
        this.metadata = typeof metadata === "object" && metadata !== null ? { ...metadata } : {};
    }

    isBlocked() {
        return this.action === DefenseDecisionType.BLOCK_TRANSACTION ||
               this.action === DefenseDecisionType.FREEZE_ACCOUNT ||
               this.action === DefenseDecisionType.SUSPEND_DEVICE;
    }

    toJSON() {
        return {
            decision_id: this.decision_id,
            action: this.action,
            risk_score: this.risk_score.toJSON(),
            reasons: this.reasons,
            mitigation_actions: this.mitigation_actions,
            requires_step_up: this.requires_step_up,
            step_up_type: this.step_up_type,
            target_entity_type: this.target_entity_type,
            target_entity_id: this.target_entity_id,
            simulation_id: this.simulation_id,
            experiment_id: this.experiment_id,
            decided_at: this.decided_at,
            metadata: this.metadata
        };
    }
}

module.exports = DefenseDecision;
