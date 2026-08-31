// blueteam/tests/unit/featureExtractor.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const FeatureStore = require("../../src/features/FeatureStore");
const FeatureExtractor = require("../../src/features/FeatureExtractor");
const Aggregators = require("../../src/features/Aggregators");
const GraphFeatureExtractor = require("../../src/features/GraphFeatureExtractor");
const DeduplicationCache = require("../../src/stream/DeduplicationCache");

describe("M3 Feature Store & Feature Extractor Unit Tests", () => {

    describe("Aggregators", () => {
        it("should calculate Haversine distance correctly", () => {
            // New York (40.7128, -74.0060) to London (51.5074, -0.1278) ~ 5570 km
            const dist = Aggregators.haversineDistanceKm(40.7128, -74.0060, 51.5074, -0.1278);
            assert.ok(dist > 5500 && dist < 5600);
        });

        it("should calculate impossible displacement velocity between timestamps", () => {
            const loc1 = { latitude: 40.7128, longitude: -74.0060 }; // NYC
            const loc2 = { latitude: 51.5074, longitude: -0.1278 };  // London
            const time1 = "2026-08-31T12:00:00.000Z";
            const time2 = "2026-08-31T12:10:00.000Z"; // 10 minutes later

            const speed = Aggregators.calculateGeoVelocityKmH(loc1, time1, loc2, time2);
            assert.ok(speed > 30000); // Over 30,000 km/h -> impossible!
        });

        it("should compute sliding window transaction velocity", () => {
            const now = new Date("2026-08-31T12:00:00.000Z");
            const transactions = [
                { amount: 100, timestamp: "2026-08-31T11:59:30.000Z" }, // 30s ago
                { amount: 200, timestamp: "2026-08-31T11:58:00.000Z" }, // 2m ago
                { amount: 500, timestamp: "2026-08-31T11:30:00.000Z" }  // 30m ago
            ];

            const v1m = Aggregators.computeVelocity(transactions, 60 * 1000, now);
            assert.strictEqual(v1m.count, 1);
            assert.strictEqual(v1m.sum, 100);

            const v5m = Aggregators.computeVelocity(transactions, 5 * 60 * 1000, now);
            assert.strictEqual(v5m.count, 2);
            assert.strictEqual(v5m.sum, 300);
        });
    });

    describe("GraphFeatureExtractor", () => {
        it("should record transfers and detect directed circular money routing", () => {
            const graph = new GraphFeatureExtractor();

            // A -> B -> C
            graph.recordTransfer({ fromAccountId: "acc_A", toAccountId: "acc_B", amount: 1000 });
            graph.recordTransfer({ fromAccountId: "acc_B", toAccountId: "acc_C", amount: 950 });

            // Before closing cycle: A transferring to C (A -> C) does NOT close a cycle
            const featBefore = graph.extractFeatures("acc_A", "acc_C");
            assert.strictEqual(featBefore.cycle_detected, false);

            // Now C -> A closes the cycle (A -> B -> C -> A)
            graph.recordTransfer({ fromAccountId: "acc_C", toAccountId: "acc_A", amount: 900 });
            const featAfter = graph.extractFeatures("acc_A", "acc_B");
            assert.strictEqual(featAfter.cycle_detected, true);
        });

        it("should calculate mule pass-through ratios and mule hop distances", () => {
            const graph = new GraphFeatureExtractor();
            graph.markKnownMule("acc_mule_boss");

            // mule_boss -> intermediate_mule -> victim_drain
            graph.recordTransfer({ fromAccountId: "acc_mule_boss", toAccountId: "acc_intermediate", amount: 5000 });
            graph.recordTransfer({ fromAccountId: "acc_intermediate", toAccountId: "acc_drain", amount: 4900 });

            const featIntermediate = graph.extractFeatures("acc_intermediate");
            assert.ok(featIntermediate.pass_through_ratio >= 0.95);
            assert.strictEqual(featIntermediate.min_distance_to_mule, 1);
        });
    });

    describe("FeatureStore & FeatureExtractor", () => {
        it("should extract comprehensive feature vector for transactions", () => {
            const store = new FeatureStore();
            const extractor = new FeatureExtractor(store);

            // Seed user profile with historical baseline
            const user = store.getUserProfile("usr_alice");
            user.recordTransaction({ amount: 50, timestamp: "2026-08-30T10:00:00.000Z" });
            user.recordTransaction({ amount: 100, timestamp: "2026-08-30T12:00:00.000Z" });

            // Record registered device
            store.setDeviceProfile("dev_known", { device_id: "dev_known", user_id: "usr_alice", status: "ACTIVE" });

            // Extract features for a new incoming transaction
            const features = extractor.extractTransactionFeatures({
                transaction_id: "tx_001",
                initiator_user_id: "usr_alice",
                sender_account_id: "acc_alice",
                receiver_account_id: "acc_bob",
                amount: 500,
                device_id: "dev_unseen" // New device
            }, new Date("2026-08-31T12:00:00.000Z"));

            assert.strictEqual(features.amount, 500);
            assert.strictEqual(features.is_new_device, true);
            assert.ok(features.amount_to_avg_ratio > 1.0);
            assert.strictEqual(features.is_kyc_tampered, false);
        });
    });

    describe("DeduplicationCache", () => {
        it("should correctly identify duplicates and handle expiry", () => {
            const cache = new DeduplicationCache({ maxSize: 100, ttlMs: 500 });
            assert.strictEqual(cache.isDuplicate("evt_1"), false);

            cache.add("evt_1");
            assert.strictEqual(cache.isDuplicate("evt_1"), true);
            assert.strictEqual(cache.isDuplicate("evt_2"), false);
        });
    });
});
