// redteam/tests/unit/composer.test.js
//
// Unit tests for the AttackComposer.

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { AttackComposer } = require("../../src/composer/AttackComposer");
const { PrimitiveRegistry } = require("../../src/primitives/registry");
const { StrategyRegistry } = require("../../src/strategies/registry");
const PRIMITIVES = require("../../src/primitives/primitives");
const STRATEGIES = require("../../src/strategies/strategies");
const { ValidationError } = require("../../../simulator/src/domain/errors");

function makeComposer() {
    return new AttackComposer(
        new PrimitiveRegistry(PRIMITIVES),
        new StrategyRegistry(STRATEGIES)
    );
}

const ATO_CONTEXT = {
    victim_user_id: "usr_victim_001",
    victim_account_id: "acc_victim_001",
    mule_account_id: "acc_mule_001",
    attacker_ip: "198.51.100.1",
    drain_amount: 4500,
    simulation_id: "sim_001",
    experiment_id: "exp_001"
};

describe("AttackComposer", () => {
    it("composes a valid scenario from ATO strategy", () => {
        const composer = makeComposer();
        const scenario = composer.compose({
            strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
            context: ATO_CONTEXT
        });

        assert.ok(scenario);
        assert.equal(scenario.strategy_id, "STRAT_ATO_NEW_DEVICE_FUND_DRAIN");
        assert.equal(scenario.attack_family, "ACCOUNT_TAKEOVER");
        assert.equal(scenario.status, "DRAFT");
        assert.equal(scenario.generated_by, "STRATEGY_LIBRARY");
        assert.ok(scenario.scenario_id); // UUID assigned
        assert.ok(scenario.steps.length > 0);
    });

    it("produces steps with contiguous step_indexes starting at 0", () => {
        const composer = makeComposer();
        const scenario = composer.compose({
            strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
            context: ATO_CONTEXT
        });

        const indexes = scenario.steps.map(s => s.step_index).sort((a, b) => a - b);
        for (let i = 0; i < indexes.length; i++) {
            assert.equal(indexes[i], i);
        }
    });

    it("resolves placeholder $victim_user_id from context", () => {
        const composer = makeComposer();
        const scenario = composer.compose({
            strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
            context: ATO_CONTEXT
        });
        // First step uses PRIM_REGISTER_SPOOFED_DEVICE which needs user_id
        const step0 = scenario.steps[0];
        assert.equal(step0.parameters.user_id, "usr_victim_001");
    });

    it("resolves placeholder $attacker_ip from context", () => {
        const composer = makeComposer();
        const scenario = composer.compose({
            strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
            context: ATO_CONTEXT
        });
        const step0 = scenario.steps[0];
        assert.equal(step0.parameters.ip_address, "198.51.100.1");
    });

    it("resolves $drain_amount to numeric value in the transfer step", () => {
        const composer = makeComposer();
        const scenario = composer.compose({
            strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
            context: ATO_CONTEXT
        });
        // Last step should be the transfer
        const lastStep = scenario.steps[scenario.steps.length - 1];
        assert.equal(lastStep.parameters.amount, 4500);
    });

    it("includes victim_user_id in target_entities.user_ids", () => {
        const composer = makeComposer();
        const scenario = composer.compose({
            strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
            context: ATO_CONTEXT
        });
        assert.ok(scenario.target_entities.user_ids.includes("usr_victim_001"));
    });

    it("throws if strategy_id is unknown", () => {
        const composer = makeComposer();
        assert.throws(
            () => composer.compose({ strategy_id: "STRAT_NONEXISTENT", context: ATO_CONTEXT }),
            ValidationError
        );
    });

    it("throws if required context variable is missing", () => {
        const composer = makeComposer();
        const { drain_amount, ...incomplete } = ATO_CONTEXT; // remove drain_amount
        assert.throws(
            () => composer.compose({ strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN", context: incomplete }),
            ValidationError
        );
    });

    it("throws if simulation_id is missing", () => {
        const composer = makeComposer();
        const { simulation_id, ...incomplete } = ATO_CONTEXT;
        assert.throws(
            () => composer.compose({ strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN", context: incomplete }),
            ValidationError
        );
    });

    it("throws if context placeholder references unknown variable", () => {
        const composer = makeComposer();
        // STRAT_ATO expects $attacker_ip — if we don't include it we get an error
        const incomplete = { ...ATO_CONTEXT };
        delete incomplete.attacker_ip;

        // The strategy requires attacker_ip in required_context.entities
        // but our primitive binding also references $attacker_ip
        // It will throw because the placeholder isn't in context
        assert.throws(
            () => composer.compose({ strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN", context: incomplete }),
            ValidationError
        );
    });

    it("composes STRAT_VELOCITY_FUND_DRAIN correctly", () => {
        const composer = makeComposer();
        const scenario = composer.compose({
            strategy_id: "STRAT_VELOCITY_FUND_DRAIN",
            context: {
                victim_user_id: "usr_victim_001",
                victim_account_id: "acc_victim_001",
                mule_account_id: "acc_mule_001",
                split_amount: 1000,
                simulation_id: "sim_001",
                experiment_id: "exp_001"
            }
        });

        assert.equal(scenario.attack_family, "VELOCITY_ABUSE");
        // Velocity strategy has 4 steps
        assert.equal(scenario.steps.length, 4);
    });

    it("composes STRAT_BRUTE_FORCE_THEN_FREEZE correctly", () => {
        const composer = makeComposer();
        const scenario = composer.compose({
            strategy_id: "STRAT_BRUTE_FORCE_THEN_FREEZE",
            context: {
                victim_user_id: "usr_victim_001",
                victim_account_id: "acc_victim_001",
                simulation_id: "sim_001",
                experiment_id: "exp_001"
            }
        });

        assert.equal(scenario.severity, "CRITICAL");
        assert.equal(scenario.steps.length, 4);
    });

    it("all composed steps use concrete (non-abstract) primitives only", () => {
        const composer = makeComposer();
        const primRegistry = composer._primitiveRegistry;

        const scenario = composer.compose({
            strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
            context: ATO_CONTEXT
        });

        for (const step of scenario.steps) {
            const prim = primRegistry.get(step.primitive_id);
            assert.ok(prim, `Unknown primitive_id in composed step: ${step.primitive_id}`);
            assert.equal(prim.is_abstract, false, `Composed step uses abstract primitive: ${step.primitive_id}`);
        }
    });

    it("assigns unique scenario_id (UUID) on each compose call", () => {
        const composer = makeComposer();
        const s1 = composer.compose({ strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN", context: ATO_CONTEXT });
        const s2 = composer.compose({ strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN", context: ATO_CONTEXT });
        assert.notEqual(s1.scenario_id, s2.scenario_id);
    });
});
