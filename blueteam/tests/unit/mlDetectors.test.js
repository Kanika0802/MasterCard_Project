// blueteam/tests/unit/mlDetectors.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const XGBoostRiskModel = require("../../src/detectors/ml/XGBoostRiskModel");
const AutoencoderDetector = require("../../src/detectors/ml/AutoencoderDetector");
const StatisticalAnomalyDetector = require("../../src/detectors/ml/StatisticalAnomalyDetector");
const GraphRiskAnalyzer = require("../../src/detectors/graph/GraphRiskAnalyzer");
const DeviceFingerprintDetector = require("../../src/detectors/identity/DeviceFingerprintDetector");
const DocumentKycDetector = require("../../src/detectors/identity/DocumentKycDetector");

describe("M3 Machine Learning & Anomaly Detectors Unit Tests", () => {

    describe("XGBoostRiskModel", () => {
        const model = new XGBoostRiskModel();

        it("should return low risk for benign transaction profile", () => {
            const res = model.evaluate({
                amount: 50,
                velocity_count_5m: 1,
                is_new_device: false,
                consecutive_failed_logins: 0,
                amount_z_score: 0.1,
                amount_to_avg_ratio: 1.0,
                geo_speed_kmh: 0,
                is_kyc_tampered: false,
                cycle_detected: false,
                pass_through_ratio: 0.0
            });

            assert.strictEqual(res.model, "XGBOOST_TABULAR_RISK");
            assert.ok(res.score < 0.20);
            assert.strictEqual(res.is_fraud_predicted, false);
        });

        it("should return high risk for anomalous attack feature vector", () => {
            const res = model.evaluate({
                amount: 8500,
                velocity_count_5m: 6,
                is_new_device: true,
                consecutive_failed_logins: 3,
                amount_z_score: 4.5,
                amount_to_avg_ratio: 8.0,
                geo_speed_kmh: 1200,
                is_kyc_tampered: true,
                cycle_detected: true,
                pass_through_ratio: 0.95
            });

            assert.ok(res.score >= 0.85);
            assert.strictEqual(res.is_fraud_predicted, true);
            assert.ok(res.factors.length > 0);
        });
    });

    describe("AutoencoderDetector", () => {
        const ae = new AutoencoderDetector();

        it("should produce low reconstruction error on typical normal features", () => {
            const res = ae.evaluate({
                amount: 100,
                velocity_count_5m: 1,
                velocity_sum_5m: 100,
                failed_auth_count_5m: 0,
                amount_z_score: 0.2,
                is_new_device: false,
                geo_speed_kmh: 10,
                pass_through_ratio: 0.1
            });

            assert.strictEqual(res.model, "AUTOENCODER");
            assert.ok(res.score < 0.40);
        });

        it("should produce high reconstruction error on extreme anomalous features", () => {
            const res = ae.evaluate({
                amount: 95000,
                velocity_count_5m: 15,
                velocity_sum_5m: 95000,
                failed_auth_count_5m: 8,
                amount_z_score: 10.0,
                is_new_device: true,
                geo_speed_kmh: 5000,
                pass_through_ratio: 0.99
            });

            assert.ok(res.score >= 0.70);
            assert.strictEqual(res.is_anomaly, true);
        });
    });

    describe("StatisticalAnomalyDetector", () => {
        const stat = new StatisticalAnomalyDetector();

        it("should flag severe Z-score and baseline deviations", () => {
            const res = stat.evaluate({
                amount_z_score: 4.2,
                amount_to_avg_ratio: 6.5,
                velocity_sum_1h: 5000,
                velocity_sum_24h: 5000,
                velocity_count_1h: 3
            });

            assert.ok(res.score >= 0.70);
            assert.strictEqual(res.is_anomaly, true);
            assert.ok(res.factors.some(f => f.includes("standard deviations above baseline")));
        });
    });

    describe("GraphRiskAnalyzer", () => {
        const graphAnalyzer = new GraphRiskAnalyzer();

        it("should identify high graph risk when adjacent to known mule", () => {
            const res = graphAnalyzer.evaluate({
                cycle_detected: true,
                min_distance_to_mule: 0, // Is mule
                pass_through_ratio: 0.92,
                fan_in_fan_out_ratio: 6.0
            });

            assert.ok(res.score >= 0.80);
            assert.strictEqual(res.is_high_graph_risk, true);
        });
    });

    describe("Identity & Device Detectors", () => {
        it("should detect suspicious device fingerprint", () => {
            const devDetector = new DeviceFingerprintDetector();
            const res = devDetector.evaluate({ is_new_device: true, device_age_hours: 0.1, amount: 2000 }, {
                payload: { device_fingerprint: "spoofed_mobile_agent_v1" }
            });
            assert.ok(res.score >= 0.70);
            assert.strictEqual(res.is_device_risk, true);
        });

        it("should detect document tampering and liveness failure", () => {
            const docDetector = new DocumentKycDetector();
            const res = docDetector.evaluate({ is_kyc_tampered: true, is_kyc_verified: false }, {
                payload: { verification_status: "REJECTED", liveness_status: "FAILED" }
            });
            assert.ok(res.score >= 0.85);
            assert.strictEqual(res.is_identity_risk, true);
        });
    });
});
