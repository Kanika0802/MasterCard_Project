// blueteam/src/domain/entities/RiskScore.js
"use strict";

const { RiskTier, DefaultRiskThresholds } = require("../constants");

class RiskScore {
    constructor({
        score = 0.0,
        risk_tier = null,
        component_scores = {},
        triggered_rules = [],
        risk_factors = [],
        explanations = [],
        evaluated_at = new Date().toISOString(),
        metadata = {}
    } = {}) {
        // Clamp score between 0.0 and 1.0
        const numericScore = typeof score === "number" && !isNaN(score) ? score : 0.0;
        this.score = Math.max(0.0, Math.min(1.0, Number(numericScore.toFixed(4))));

        this.risk_tier = risk_tier || RiskScore.calculateTier(this.score);
        this.component_scores = {
            rules: Number((component_scores.rules || 0).toFixed(4)),
            ml_tabular: Number((component_scores.ml_tabular || 0).toFixed(4)),
            autoencoder: Number((component_scores.autoencoder || 0).toFixed(4)),
            graph: Number((component_scores.graph || 0).toFixed(4)),
            identity: Number((component_scores.identity || 0).toFixed(4)),
            ...component_scores
        };

        this.triggered_rules = Array.isArray(triggered_rules) ? [...triggered_rules] : [];
        this.risk_factors = Array.isArray(risk_factors) ? [...risk_factors] : [];
        this.explanations = Array.isArray(explanations) ? [...explanations] : [];
        this.evaluated_at = evaluated_at;
        this.metadata = typeof metadata === "object" && metadata !== null ? { ...metadata } : {};
    }

    static calculateTier(score, thresholds = DefaultRiskThresholds) {
        if (score >= thresholds.CRITICAL_MIN) return RiskTier.CRITICAL;
        if (score > thresholds.MEDIUM_MAX) return RiskTier.HIGH;
        if (score > thresholds.LOW_MAX) return RiskTier.MEDIUM;
        return RiskTier.LOW;
    }

    isHighRisk() {
        return this.risk_tier === RiskTier.HIGH || this.risk_tier === RiskTier.CRITICAL;
    }

    toJSON() {
        return {
            score: this.score,
            risk_tier: this.risk_tier,
            component_scores: this.component_scores,
            triggered_rules: this.triggered_rules,
            risk_factors: this.risk_factors,
            explanations: this.explanations,
            evaluated_at: this.evaluated_at,
            metadata: this.metadata
        };
    }
}

module.exports = RiskScore;
