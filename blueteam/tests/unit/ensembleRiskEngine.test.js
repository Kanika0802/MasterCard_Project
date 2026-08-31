// blueteam/tests/unit/ensembleRiskEngine.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const EnsembleRiskEngine = require("../../src/ensemble/EnsembleRiskEngine");
const { RiskTier } = require("../../src/domain/constants");

describe("M3 Ensemble Risk Engine Unit Tests", () => {

    it("should classify normal benign transaction as LOW risk tier", () => {
        const ensemble = new EnsembleRiskEngine();

        const normalFeatures = {
            amount: 45,
            velocity_count_1m: 1,
            velocity_count_5m: 1,
            velocity_sum_5m: 45,
            failed_auth_count_5m: 0,
            consecutive_failed_logins: 0,
            amount_z_score: 0.1,
            amount_to_avg_ratio: 1.0,
            is_new_device: false,
            device_age_hours: 120,
            geo_speed_kmh: 0,
            is_kyc_verified: true,
            is_kyc_tampered: false,
            cycle_detected: false,
            pass_through_ratio: 0.0,
            min_distance_to_mule: -1
        };

        const riskScore = ensemble.evaluate(normalFeatures, { event_type: "TRANSACTION_INITIATED" });

        assert.ok(riskScore.score < 0.30);
        assert.strictEqual(riskScore.risk_tier, RiskTier.LOW);
        assert.strictEqual(riskScore.isHighRisk(), false);
        assert.strictEqual(riskScore.triggered_rules.length, 0);
    });

    it("should classify critical multi-factor attack as CRITICAL risk tier", () => {
        const ensemble = new EnsembleRiskEngine();

        const attackFeatures = {
            amount: 8000,
            velocity_count_1m: 5,
            velocity_count_5m: 8,
            velocity_sum_5m: 25000,
            failed_auth_count_5m: 5,
            consecutive_failed_logins: 4,
            amount_z_score: 5.2,
            amount_to_avg_ratio: 9.0,
            is_new_device: true,
            device_age_hours: 0.05,
            geo_speed_kmh: 3000,
            is_kyc_verified: false,
            is_kyc_tampered: true,
            cycle_detected: true,
            pass_through_ratio: 0.98,
            min_distance_to_mule: 0
        };

        const riskScore = ensemble.evaluate(attackFeatures, {
            event_type: "TRANSACTION_INITIATED",
            payload: { device_fingerprint: "spoofed_agent" }
        });

        assert.ok(riskScore.score >= 0.85);
        assert.strictEqual(riskScore.risk_tier, RiskTier.CRITICAL);
        assert.strictEqual(riskScore.isHighRisk(), true);
        assert.ok(riskScore.explanations.length > 0);
        assert.ok(riskScore.component_scores.rules > 0);
        assert.ok(riskScore.component_scores.ml_tabular > 0);
    });

    it("should provide detailed risk factor explanations and breakdown", () => {
        const ensemble = new EnsembleRiskEngine();

        const features = {
            amount: 2500,
            velocity_count_1m: 4, // Velocity spike
            velocity_count_5m: 5,
            velocity_sum_5m: 12000,
            is_new_device: true,
            device_age_hours: 0.1, // New device high value
            consecutive_failed_logins: 0,
            is_kyc_verified: true,
            is_kyc_tampered: false,
            geo_speed_kmh: 0,
            cycle_detected: false,
            pass_through_ratio: 0.1
        };

        const riskScore = ensemble.evaluate(features, { event_type: "TRANSACTION_INITIATED" });

        assert.ok(riskScore.isHighRisk());
        assert.ok(riskScore.explanations.some(e => e.includes("velocity") || e.includes("device")));
    });
});
