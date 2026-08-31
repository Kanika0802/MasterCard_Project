// blueteam/tests/integration/redTeamDefenseE2E.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const DefenseEngine = require("../../src/DefenseEngine");
const { DefenseDecisionType, RiskTier } = require("../../src/domain/constants");

// Import M2 Attack Strategy Library to test defense against realistic red team attacks
const { getDefaultRegistry: getDefaultStrategyRegistry } = require("../../../redteam/src/strategies/registry");
const { AttackComposer } = require("../../../redteam/src/composer/AttackComposer");

describe("M3 Blue Team E2E Defense against M2 Red Team Attack Strategies", () => {
    const defense = new DefenseEngine();
    const strategyRegistry = getDefaultStrategyRegistry();
    const composer = new AttackComposer();

    it("Strategy 1 Defense: ATO via New Device and Fund Drain", async () => {
        const strategy = strategyRegistry.get("STRAT_ATO_NEW_DEVICE_FUND_DRAIN");
        assert.ok(strategy, "Strategy must exist in M2 registry");

        const scenario = composer.compose({
            strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
            context: {
                simulation_id: "sim_e2e_01",
                experiment_id: "exp_e2e_01",
                victim_user_id: "usr_victim_10",
                victim_account_id: "acc_victim_10",
                mule_account_id: "acc_mule_10",
                attacker_ip: "198.51.100.44",
                drain_amount: 8500
            }
        });

        // Execute scenario events sequentially into Blue Team stream
        const stepResults = [];
        for (const step of scenario.steps) {
            let eventType = "TRANSACTION_INITIATED";
            let entityType = "transaction";
            if (step.primitive_id === "PRIM_REGISTER_SPOOFED_DEVICE") {
                eventType = "DEVICE_REGISTERED";
                entityType = "device";
            } else if (step.primitive_id === "PRIM_ACCOUNT_TAKEOVER_LOGIN") {
                eventType = "AUTH_LOGIN_SUCCESS";
                entityType = "user";
            } else if (step.primitive_id === "PRIM_ADD_MULE_BENEFICIARY") {
                eventType = "BENEFICIARY_ADDED";
                entityType = "beneficiary";
            }

            const result = await defense.processEvent({
                event_id: `evt_${step.step_id}`,
                event_type: eventType,
                entity_type: entityType,
                entity_id: step.parameters.user_id || step.parameters.device_id || "tx_e2e_1",
                device_id: step.parameters.device_id || "dev_attacker_10",
                occurred_at: new Date().toISOString(),
                payload: {
                    ...step.parameters,
                    transaction_id: "tx_e2e_1",
                    initiator_user_id: step.parameters.user_id || "usr_victim_10",
                    sender_account_id: step.parameters.sender_account_id || "acc_victim_10",
                    receiver_account_id: step.parameters.receiver_account_id || "acc_mule_10",
                    amount: step.parameters.amount || 0,
                    device_id: "dev_attacker_10"
                }
            });
            stepResults.push(result);
        }

        // Final transaction step MUST be flagged/blocked by Blue Team
        const finalTxStep = stepResults[stepResults.length - 1];
        assert.strictEqual(finalTxStep.is_evaluated, true);
        assert.ok(finalTxStep.risk_score.score >= 0.70, `Expected high risk score, got: ${finalTxStep.risk_score.score}`);
        assert.ok(finalTxStep.decision.action === DefenseDecisionType.BLOCK_TRANSACTION || finalTxStep.decision.action === DefenseDecisionType.FREEZE_ACCOUNT);
    });

    it("Strategy 2 Defense: Velocity Splitting Fund Drain", async () => {
        const strategy = strategyRegistry.get("STRAT_VELOCITY_FUND_DRAIN");
        assert.ok(strategy);

        const scenario = composer.compose({
            strategy_id: "STRAT_VELOCITY_FUND_DRAIN",
            context: {
                simulation_id: "sim_e2e_02",
                experiment_id: "exp_e2e_02",
                victim_user_id: "usr_victim_20",
                victim_account_id: "acc_victim_20",
                mule_account_id: "acc_mule_20",
                split_amount: 1500
            }
        });

        const stepResults = [];
        for (const step of scenario.steps) {
            if (step.primitive_id === "PRIM_ADD_MULE_BENEFICIARY") {
                await defense.processEvent({
                    event_id: `evt_ben_${step.step_id}`,
                    event_type: "BENEFICIARY_ADDED",
                    entity_type: "beneficiary",
                    entity_id: "acc_mule_20",
                    occurred_at: new Date().toISOString(),
                    payload: step.parameters
                });
            } else {
                const res = await defense.processEvent({
                    event_id: `evt_split_${step.step_id}`,
                    event_type: "TRANSACTION_INITIATED",
                    entity_type: "transaction",
                    entity_id: `tx_split_${step.step_id}`,
                    occurred_at: new Date().toISOString(),
                    payload: {
                        transaction_id: `tx_split_${step.step_id}`,
                        initiator_user_id: "usr_victim_20",
                        sender_account_id: "acc_victim_20",
                        receiver_account_id: "acc_mule_20",
                        amount: step.parameters.amount || 1500
                    }
                });
                stepResults.push(res);
            }
        }

        // The repeated rapid transfers trigger the velocity detection
        const highRiskDetected = stepResults.some(r => r.risk_score && r.risk_score.score >= 0.70);
        assert.strictEqual(highRiskDetected, true, "Velocity spike must be detected and flagged");
    });

    it("Normal Baseline Defense: Legitimate user activity should NOT be blocked", async () => {
        const legitimateUser = "usr_legit_1";
        const legitAccount = "acc_legit_1";

        // Step 1: Normal login from known device
        await defense.processEvent({
            event_id: "evt_legit_login",
            event_type: "AUTH_LOGIN_SUCCESS",
            entity_type: "user",
            entity_id: legitimateUser,
            occurred_at: new Date().toISOString(),
            payload: { user_id: legitimateUser, device_id: "dev_legit_phone" }
        });

        // Step 2: Normal coffee payment ($4.50)
        const coffeeTx = await defense.processEvent({
            event_id: "evt_legit_coffee",
            event_type: "TRANSACTION_INITIATED",
            entity_type: "transaction",
            entity_id: "tx_coffee_1",
            device_id: "dev_legit_phone",
            occurred_at: new Date().toISOString(),
            payload: {
                transaction_id: "tx_coffee_1",
                initiator_user_id: legitimateUser,
                sender_account_id: legitAccount,
                receiver_account_id: "acc_starbucks",
                amount: 4.50,
                channel: "MOBILE_APP"
            }
        });

        assert.strictEqual(coffeeTx.decision.action, DefenseDecisionType.ALLOW);
        assert.ok(coffeeTx.risk_score.score < 0.30);
        assert.strictEqual(coffeeTx.risk_score.risk_tier, RiskTier.LOW);
    });
});
