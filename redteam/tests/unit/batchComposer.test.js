// redteam/tests/unit/batchComposer.test.js
//
// Unit tests for BatchComposer (parameter sweeps and family batch generation).

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { BatchComposer } = require("../../src/composer/BatchComposer");
const { ValidationError } = require("../../../simulator/src/domain/errors");

const VALID_ATO_CONTEXT = {
    victim_user_id: "usr_v_01",
    victim_account_id: "acc_v_01",
    mule_account_id: "acc_m_01",
    attacker_ip: "192.0.2.1",
    drain_amount: 1000,
    simulation_id: "sim_sweep_01",
    experiment_id: "exp_sweep_01"
};

describe("BatchComposer", () => {
    it("composes a parameter sweep across multiple values", () => {
        const batchComposer = new BatchComposer();
        const amounts = [100, 500, 2500, 10000];

        const scenarios = batchComposer.composeParameterSweep({
            strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
            baseContext: VALID_ATO_CONTEXT,
            sweepParam: "drain_amount",
            sweepValues: amounts
        });

        assert.equal(scenarios.length, 4);

        for (let i = 0; i < scenarios.length; i++) {
            const scenario = scenarios[i];
            const transferStep = scenario.steps.find(s => s.primitive_id === "PRIM_EXECUTE_FRAUDULENT_TRANSFER");
            assert.ok(transferStep);
            assert.equal(transferStep.parameters.amount, amounts[i]);
            assert.equal(scenario.status, "DRAFT");
            assert.ok(scenario.name.includes(`drain_amount=${amounts[i]}`));
        }
    });

    it("composeParameterSweep() throws if required options are missing", () => {
        const batchComposer = new BatchComposer();

        assert.throws(
            () => batchComposer.composeParameterSweep({}),
            ValidationError
        );

        assert.throws(
            () => batchComposer.composeParameterSweep({ strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN" }),
            ValidationError
        );

        assert.throws(
            () => batchComposer.composeParameterSweep({
                strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
                baseContext: VALID_ATO_CONTEXT,
                sweepParam: "drain_amount",
                sweepValues: []
            }),
            ValidationError
        );
    });

    it("composes a family batch for an attack family", () => {
        const batchComposer = new BatchComposer();

        const scenarios = batchComposer.composeFamilyBatch({
            attack_family: "ACCOUNT_TAKEOVER",
            context: {
                ...VALID_ATO_CONTEXT,
                dormant_account_id: "acc_v_01",
                cash_amount: 500
            }
        });

        assert.ok(scenarios.length >= 2, `Expected >= 2 scenarios for ACCOUNT_TAKEOVER, got ${scenarios.length}`);
        for (const s of scenarios) {
            assert.equal(s.attack_family, "ACCOUNT_TAKEOVER");
        }
    });

    it("composeFamilyBatch() throws on non-existent family with no strategies", () => {
        const batchComposer = new BatchComposer();

        assert.throws(
            () => batchComposer.composeFamilyBatch({
                attack_family: "NONEXISTENT_FAMILY",
                context: VALID_ATO_CONTEXT
            }),
            ValidationError
        );
    });
});
