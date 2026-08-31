// blueteam/tests/integration/m3AttackPrimitiveDefenseE2E.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const DefenseEngine = require("../../src/DefenseEngine");
const { DefenseDecisionType, RiskTier } = require("../../src/domain/constants");

// Import M3 Attack Primitive Library components directly
const { getDefaultRegistry } = require("../../../attack-primitives/src/registry/PrimitiveRegistry");
const SimulatorActionAdapter = require("../../../attack-primitives/src/execution/SimulatorActionAdapter");

describe("M5 Blue Team E2E Defense against M3 Attack Primitive Actions", () => {
    const defense = new DefenseEngine();
    const primitiveRegistry = getDefaultRegistry();
    const actionAdapter = new SimulatorActionAdapter(primitiveRegistry);

    it("should detect and block ATO + Large Fraudulent Transfer generated from M3 primitives", async () => {
        const victimUserId = "usr_victim_m3_defense";
        const victimAccountId = "acc_victim_m3_defense";
        const muleAccountId = "acc_mule_m3_defense";
        const spoofedDeviceId = "dev_m3_spoofed_1";

        // Step 1: Register Spoofed Device using M3 primitive
        const regDeviceAction = actionAdapter.toActionRequest("PRIM_REGISTER_SPOOFED_DEVICE", {
            user_id: victimUserId,
            device_id: spoofedDeviceId,
            device_type: "MOBILE",
            operating_system: "Android 14",
            ip_address: "198.51.100.77"
        }, { simulation_id: "sim_m3_01", experiment_id: "exp_m3_01" });

        await defense.processEvent({
            event_id: "evt_m3_dev_reg",
            event_type: "DEVICE_REGISTERED",
            entity_type: "device",
            entity_id: spoofedDeviceId,
            occurred_at: new Date().toISOString(),
            payload: regDeviceAction.parameters
        });

        // Step 2: ATO Login using M3 primitive
        const loginAction = actionAdapter.toActionRequest("PRIM_ACCOUNT_TAKEOVER_LOGIN", {
            user_id: victimUserId,
            device_id: spoofedDeviceId,
            success: true,
            ip_address: "198.51.100.77"
        });

        await defense.processEvent({
            event_id: "evt_m3_login",
            event_type: "AUTH_LOGIN_SUCCESS",
            entity_type: "user",
            entity_id: victimUserId,
            device_id: spoofedDeviceId,
            occurred_at: new Date().toISOString(),
            payload: loginAction.parameters
        });

        // Step 3: Add Mule Beneficiary using M3 primitive
        const addBenAction = actionAdapter.toActionRequest("PRIM_ADD_MULE_BENEFICIARY", {
            user_id: victimUserId,
            target_account_id: muleAccountId,
            nickname: "Mule Payee"
        });

        await defense.processEvent({
            event_id: "evt_m3_ben",
            event_type: "BENEFICIARY_ADDED",
            entity_type: "beneficiary",
            entity_id: muleAccountId,
            occurred_at: new Date().toISOString(),
            payload: addBenAction.parameters
        });

        // Step 4: Execute Large Fraudulent Transfer using M3 primitive
        const transferAction = actionAdapter.toActionRequest("PRIM_EXECUTE_FRAUDULENT_TRANSFER", {
            sender_account_id: victimAccountId,
            receiver_account_id: muleAccountId,
            initiator_user_id: victimUserId,
            amount: 15000.00,
            channel: "MOBILE_APP",
            device_id: spoofedDeviceId
        });

        const txResult = await defense.processEvent({
            event_id: "evt_m3_transfer",
            event_type: "TRANSACTION_INITIATED",
            entity_type: "transaction",
            entity_id: "tx_m3_fraud_001",
            device_id: spoofedDeviceId,
            occurred_at: new Date().toISOString(),
            payload: {
                transaction_id: "tx_m3_fraud_001",
                ...transferAction.parameters
            }
        });

        // Verify M5 Blue Team flags as High/Critical and blocks
        assert.strictEqual(txResult.is_evaluated, true);
        assert.ok(txResult.risk_score.score >= 0.70, `Expected risk score >= 0.70, got ${txResult.risk_score.score}`);
        assert.ok(
            txResult.decision.action === DefenseDecisionType.BLOCK_TRANSACTION ||
            txResult.decision.action === DefenseDecisionType.FREEZE_ACCOUNT
        );
        assert.ok(txResult.alert, "A security alert must be generated");
    });
});
