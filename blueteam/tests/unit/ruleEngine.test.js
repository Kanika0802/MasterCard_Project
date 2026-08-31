// blueteam/tests/unit/ruleEngine.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const RuleEngine = require("../../src/detectors/rules/RuleEngine");
const VelocityRule = require("../../src/detectors/rules/VelocityRule");
const ImpossibleTravelRule = require("../../src/detectors/rules/ImpossibleTravelRule");
const NewDeviceHighValueRule = require("../../src/detectors/rules/NewDeviceHighValueRule");
const AuthBruteForceRule = require("../../src/detectors/rules/AuthBruteForceRule");
const MulePassThroughRule = require("../../src/detectors/rules/MulePassThroughRule");
const KycTamperingRule = require("../../src/detectors/rules/KycTamperingRule");
const AccountFreezeRule = require("../../src/detectors/rules/AccountFreezeRule");
const { DetectionCategory } = require("../../src/domain/constants");

describe("M3 Rule Engine & Detection Rules Unit Tests", () => {

    describe("VelocityRule", () => {
        const rule = new VelocityRule({ maxCount1m: 3, maxCount5m: 5, maxSum5m: 10000 });

        it("should not trigger on normal velocity", () => {
            const res = rule.evaluate({ velocity_count_1m: 1, velocity_count_5m: 2, velocity_sum_5m: 500 });
            assert.strictEqual(res.triggered, false);
            assert.strictEqual(res.score, 0.0);
        });

        it("should trigger on 1-minute velocity spike", () => {
            const res = rule.evaluate({ velocity_count_1m: 4, velocity_count_5m: 4, velocity_sum_5m: 2000 });
            assert.strictEqual(res.triggered, true);
            assert.strictEqual(res.category, DetectionCategory.VELOCITY);
            assert.ok(res.reasons.some(r => r.includes("High 1-minute velocity")));
        });

        it("should trigger on 5-minute aggregate sum spike", () => {
            const res = rule.evaluate({ velocity_count_1m: 1, velocity_count_5m: 3, velocity_sum_5m: 15000 });
            assert.strictEqual(res.triggered, true);
            assert.ok(res.reasons.some(r => r.includes("High 5-minute aggregate outflow")));
        });
    });

    describe("ImpossibleTravelRule", () => {
        const rule = new ImpossibleTravelRule({ maxSpeedKmH: 800 });

        it("should not trigger on normal physical speed (e.g. driving/walking)", () => {
            const res = rule.evaluate({ geo_speed_kmh: 80 });
            assert.strictEqual(res.triggered, false);
        });

        it("should trigger when speed exceeds physical airliner speed", () => {
            const res = rule.evaluate({ geo_speed_kmh: 2500 });
            assert.strictEqual(res.triggered, true);
            assert.strictEqual(res.category, DetectionCategory.GEOLOCATION);
            assert.ok(res.reasons.some(r => r.includes("Impossible physical displacement speed")));
        });
    });

    describe("NewDeviceHighValueRule", () => {
        const rule = new NewDeviceHighValueRule({ highValueThreshold: 1000, newDeviceAgeHours: 2 });

        it("should not trigger on known established device", () => {
            const res = rule.evaluate({ is_new_device: false, device_age_hours: 48, amount: 5000 });
            assert.strictEqual(res.triggered, false);
        });

        it("should trigger on high-value transfer from newly enrolled device", () => {
            const res = rule.evaluate({ is_new_device: true, device_age_hours: 0.2, amount: 3500 });
            assert.strictEqual(res.triggered, true);
            assert.strictEqual(res.category, DetectionCategory.DEVICE_INTEGRITY);
            assert.ok(res.reasons.some(r => r.includes("newly enrolled/unrecognized device")));
        });
    });

    describe("AuthBruteForceRule", () => {
        const rule = new AuthBruteForceRule({ maxConsecutiveFailures: 3, maxWindowFailures: 4 });

        it("should not trigger on 1 normal failed login", () => {
            const res = rule.evaluate({ consecutive_failed_logins: 1, failed_auth_count_5m: 1 });
            assert.strictEqual(res.triggered, false);
        });

        it("should trigger on repeated consecutive authentication failures", () => {
            const res = rule.evaluate({ consecutive_failed_logins: 4, failed_auth_count_5m: 4 });
            assert.strictEqual(res.triggered, true);
            assert.strictEqual(res.category, DetectionCategory.AUTH_CREDENTIAL);
            assert.ok(res.reasons.some(r => r.includes("consecutive failed authentication attempts")));
        });
    });

    describe("MulePassThroughRule", () => {
        const rule = new MulePassThroughRule({ minPassThroughRatio: 0.80 });

        it("should not trigger on normal non-mule balance retention", () => {
            const res = rule.evaluate({ pass_through_ratio: 0.2, total_inflow: 5000, total_outflow: 1000, cycle_detected: false, min_distance_to_mule: -1 });
            assert.strictEqual(res.triggered, false);
        });

        it("should trigger on rapid pass-through funds drain", () => {
            const res = rule.evaluate({ pass_through_ratio: 0.95, total_inflow: 5000, total_outflow: 4800, cycle_detected: false, min_distance_to_mule: -1 });
            assert.strictEqual(res.triggered, true);
            assert.ok(res.reasons.some(r => r.includes("High pass-through flow")));
        });

        it("should trigger on circular transaction graph topology", () => {
            const res = rule.evaluate({ pass_through_ratio: 0.1, total_inflow: 500, total_outflow: 500, cycle_detected: true, min_distance_to_mule: -1 });
            assert.strictEqual(res.triggered, true);
            assert.ok(res.reasons.some(r => r.includes("Circular transaction flow")));
        });
    });

    describe("KycTamperingRule", () => {
        const rule = new KycTamperingRule();

        it("should trigger when KYC status is flagged as tampered or rejected", () => {
            const res = rule.evaluate({ is_kyc_tampered: true, is_kyc_verified: false, amount: 500 });
            assert.strictEqual(res.triggered, true);
            assert.strictEqual(res.category, DetectionCategory.KYC_SYNTHETIC);
        });

        it("should trigger when unverified KYC attempts large transfer", () => {
            const res = rule.evaluate({ is_kyc_tampered: false, is_kyc_verified: false, amount: 8000 });
            assert.strictEqual(res.triggered, true);
        });
    });

    describe("AccountFreezeRule", () => {
        const rule = new AccountFreezeRule();

        it("should trigger on transactions attempted on FROZEN accounts", () => {
            const res = rule.evaluate({ account_status: "FROZEN" }, { payload: { status: "FROZEN" } });
            assert.strictEqual(res.triggered, true);
        });

        it("should trigger on sudden reactivation event of frozen account", () => {
            const res = rule.evaluate({}, {
                event_type: "ACCOUNT_STATUS_CHANGED",
                payload: { status: "ACTIVE", previous_status: "FROZEN" }
            });
            assert.strictEqual(res.triggered, true);
        });
    });

    describe("RuleEngine Composite Evaluation", () => {
        const engine = new RuleEngine();

        it("should return 0 score when no rules trigger", () => {
            const res = engine.evaluate({
                velocity_count_1m: 1,
                velocity_count_5m: 1,
                velocity_sum_5m: 100,
                geo_speed_kmh: 0,
                is_new_device: false,
                consecutive_failed_logins: 0,
                is_kyc_verified: true,
                is_kyc_tampered: false
            });
            assert.strictEqual(res.score, 0.0);
            assert.strictEqual(res.count, 0);
        });

        it("should evaluate and combine multiple triggered rules into composite score", () => {
            const res = engine.evaluate({
                velocity_count_1m: 5, // Triggers VelocityRule
                is_new_device: true,
                device_age_hours: 0.1,
                amount: 5000,         // Triggers NewDeviceHighValueRule
                consecutive_failed_logins: 4 // Triggers AuthBruteForceRule
            });
            assert.ok(res.score >= 0.85);
            assert.ok(res.count >= 3);
            assert.ok(res.triggered_rules.length >= 3);
        });
    });
});
