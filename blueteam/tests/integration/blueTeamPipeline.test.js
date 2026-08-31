// blueteam/tests/integration/blueTeamPipeline.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const DefenseEngine = require("../../src/DefenseEngine");
const { DefenseDecisionType, RiskTier } = require("../../src/domain/constants");

describe("M3 Blue Team Stream Processing & Detection Pipeline Integration Tests", () => {

    it("should process multi-event stream in sequence and accurately detect ATO + Fund Drain", async () => {
        const engine = new DefenseEngine();

        // 1. Initial baseline login from known device in New York
        const loginEvt = {
            event_id: "evt_001",
            event_type: "AUTH_LOGIN_SUCCESS",
            entity_type: "user",
            entity_id: "usr_victim_1",
            occurred_at: "2026-08-31T10:00:00.000Z",
            device_id: "dev_laptop_1",
            payload: {
                user_id: "usr_victim_1",
                device_id: "dev_laptop_1",
                location: { latitude: 40.7128, longitude: -74.0060 } // NYC
            }
        };
        const r1 = await engine.processEvent(loginEvt);
        assert.strictEqual(r1.status, "PROCESSED");

        // 2. Normal small grocery purchase
        const tx1 = {
            event_id: "evt_002",
            event_type: "TRANSACTION_COMPLETED",
            entity_type: "transaction",
            entity_id: "tx_001",
            occurred_at: "2026-08-31T10:15:00.000Z",
            device_id: "dev_laptop_1",
            payload: {
                transaction_id: "tx_001",
                initiator_user_id: "usr_victim_1",
                sender_account_id: "acc_victim_1",
                receiver_account_id: "acc_grocery",
                amount: 35.50,
                channel: "WEB_PORTAL"
            }
        };
        const r2 = await engine.processEvent(tx1);
        assert.strictEqual(r2.decision.action, DefenseDecisionType.ALLOW);

        // 3. Attack Step 1: Attacker attempts 4 rapid failed logins from untrusted device
        for (let i = 0; i < 4; i++) {
            await engine.processEvent({
                event_id: `evt_brute_${i}`,
                event_type: "AUTH_LOGIN_FAILED",
                entity_type: "user",
                entity_id: "usr_victim_1",
                occurred_at: `2026-08-31T10:30:0${i}.000Z`,
                device_id: "dev_attacker_mobile",
                payload: {
                    user_id: "usr_victim_1",
                    device_id: "dev_attacker_mobile",
                    ip_address: "198.51.100.99"
                }
            });
        }

        // 4. Attack Step 2: Register spoofed attacker device
        await engine.processEvent({
            event_id: "evt_dev_reg",
            event_type: "DEVICE_REGISTERED",
            entity_type: "device",
            entity_id: "dev_attacker_mobile",
            occurred_at: "2026-08-31T10:31:00.000Z",
            payload: {
                device_id: "dev_attacker_mobile",
                user_id: "usr_victim_1",
                device_fingerprint: "spoofed_root_device"
            }
        });

        // 5. Attack Step 3: Massive fund drain attempted from attacker device to unknown mule
        const attackTx = {
            event_id: "evt_drain_001",
            event_type: "TRANSACTION_INITIATED",
            entity_type: "transaction",
            entity_id: "tx_drain_001",
            occurred_at: "2026-08-31T10:32:00.000Z",
            device_id: "dev_attacker_mobile",
            payload: {
                transaction_id: "tx_drain_001",
                initiator_user_id: "usr_victim_1",
                sender_account_id: "acc_victim_1",
                receiver_account_id: "acc_mule_999",
                amount: 9800.00,
                channel: "MOBILE_APP",
                location: { latitude: 51.5074, longitude: -0.1278 } // London -> Impossible Travel
            }
        };

        const drainResult = await engine.processEvent(attackTx);

        // Verification: Blue Team Defense caught the multi-layer attack!
        assert.strictEqual(drainResult.status, "PROCESSED");
        assert.ok(drainResult.risk_score.score >= 0.85);
        assert.ok(drainResult.risk_score.risk_tier === RiskTier.HIGH || drainResult.risk_score.risk_tier === RiskTier.CRITICAL);
        assert.ok(drainResult.decision.action === DefenseDecisionType.BLOCK_TRANSACTION || drainResult.decision.action === DefenseDecisionType.FREEZE_ACCOUNT);
        assert.ok(drainResult.alert !== null);

        // Verify alert is registered and retrievable
        const alerts = engine.listAlerts();
        assert.ok(alerts.total >= 1);
    });

    it("should handle duplicate events idempotently", async () => {
        const engine = new DefenseEngine();

        const evt = {
            event_id: "evt_unique_12345",
            event_type: "TRANSACTION_INITIATED",
            entity_type: "transaction",
            entity_id: "tx_123",
            occurred_at: new Date().toISOString(),
            payload: { amount: 100 }
        };

        const first = await engine.processEvent(evt);
        assert.strictEqual(first.status, "PROCESSED");

        const second = await engine.processEvent(evt);
        assert.strictEqual(second.status, "DUPLICATE_SKIPPED");
    });
});
