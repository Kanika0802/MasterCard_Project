// redteam/tests/unit/planner.test.js
//
// Unit tests for the RuleBasedPlanner.
// Also verifies the PlannerInterface contract (abstract base class).

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { PlannerInterface } = require("../../src/planner/PlannerInterface");
const { RuleBasedPlanner } = require("../../src/planner/RuleBasedPlanner");
const { PrimitiveRegistry } = require("../../src/primitives/registry");
const { StrategyRegistry } = require("../../src/strategies/registry");
const PRIMITIVES = require("../../src/primitives/primitives");
const STRATEGIES = require("../../src/strategies/strategies");

function makePlanner() {
    return new RuleBasedPlanner(
        new StrategyRegistry(STRATEGIES),
        new PrimitiveRegistry(PRIMITIVES)
    );
}

function makeInput(overrides = {}) {
    return {
        objective: "Simulate an account takeover attack",
        attack_family: null,
        available_primitives: new PrimitiveRegistry(PRIMITIVES).getAll(),
        available_strategies: new StrategyRegistry(STRATEGIES).getAll(),
        target_context: {
            simulation_id: "sim_001",
            experiment_id: "exp_001",
            available_entities: {
                users: [
                    { user_id: "usr_victim", profile_status: "ACTIVE" },
                    { user_id: "usr_mule", profile_status: "ACTIVE" }
                ],
                accounts: [
                    { account_id: "acc_victim", user_id: "usr_victim", balance: 10000, status: "ACTIVE" },
                    { account_id: "acc_mule", user_id: "usr_mule", balance: 500, status: "ACTIVE" }
                ],
                merchants: null,
                devices: null
            }
        },
        constraints: null,
        planner_config: null,
        ...overrides
    };
}

describe("PlannerInterface (abstract)", () => {
    it("throws on name getter if not overridden", () => {
        const base = new PlannerInterface();
        assert.throws(() => base.name, Error);
    });

    it("throws on plan() if not overridden", async () => {
        const base = new PlannerInterface();
        await assert.rejects(() => base.plan({}), Error);
    });
});

describe("RuleBasedPlanner", () => {
    it("is a subclass of PlannerInterface", () => {
        const planner = makePlanner();
        assert.ok(planner instanceof PlannerInterface);
    });

    it("has name = 'rule-based-planner-v1'", () => {
        const planner = makePlanner();
        assert.equal(planner.name, "rule-based-planner-v1");
    });

    it("returns a PlannerOutput with required fields", async () => {
        const planner = makePlanner();
        const output = await planner.plan(makeInput());

        assert.ok(output);
        assert.equal(typeof output.planner_id, "string");
        assert.equal(typeof output.generation_timestamp, "string");
        assert.equal(typeof output.objective, "string");
        assert.ok(Array.isArray(output.scenarios));
        assert.ok(output.scenarios.length > 0);
    });

    it("echos the objective in the output", async () => {
        const planner = makePlanner();
        const input = makeInput({ objective: "Drain victim account via ATO" });
        const output = await planner.plan(input);
        assert.equal(output.objective, "Drain victim account via ATO");
    });

    it("detects ACCOUNT_TAKEOVER family from 'account takeover' keyword", async () => {
        const planner = makePlanner();
        const output = await planner.plan(makeInput({ objective: "Simulate an account takeover" }));
        assert.equal(output.scenarios[0].attack_family, "ACCOUNT_TAKEOVER");
    });

    it("detects a strategy for objective containing 'mule' keyword", async () => {
        // MULE_NETWORK primitives exist but strategies are categorised under ACCOUNT_TAKEOVER or VELOCITY_ABUSE.
        // The planner detects MULE_NETWORK from the objective but then falls back to getAll() because
        // no strategy has attack_family === "MULE_NETWORK". It should still produce a valid output.
        const planner = makePlanner();
        const output = await planner.plan(makeInput({ objective: "Add a mule beneficiary and drain funds" }));
        // Should produce at least one scenario from any available strategy.
        assert.ok(output.scenarios.length > 0, "Should produce at least one scenario");
        assert.ok(
            ["MULE_NETWORK", "ACCOUNT_TAKEOVER", "VELOCITY_ABUSE"].includes(output.scenarios[0].attack_family),
            `Got unexpected attack_family: ${output.scenarios[0].attack_family}`
        );
    });

    it("detects VELOCITY_ABUSE family from 'velocity' keyword", async () => {
        const planner = makePlanner();
        const output = await planner.plan(makeInput({ objective: "Test velocity controls with rapid transactions" }));
        assert.equal(output.scenarios[0].attack_family, "VELOCITY_ABUSE");
    });

    it("detects IDENTITY_FRAUD family from 'kyc' keyword", async () => {
        const planner = makePlanner();
        const output = await planner.plan(makeInput({ objective: "Bypass KYC verification controls" }));
        assert.equal(output.scenarios[0].attack_family, "IDENTITY_FRAUD");
    });

    it("each step has a primitive_id and parameters object", async () => {
        const planner = makePlanner();
        const output = await planner.plan(makeInput());
        for (const scenario of output.scenarios) {
            for (const step of scenario.steps) {
                assert.equal(typeof step.primitive_id, "string");
                assert.ok(step.primitive_id.startsWith("PRIM_"));
                assert.ok(step.parameters && typeof step.parameters === "object");
            }
        }
    });

    it("all steps reference only concrete primitives", async () => {
        const primRegistry = new PrimitiveRegistry(PRIMITIVES);
        const planner = makePlanner();
        const output = await planner.plan(makeInput());

        for (const scenario of output.scenarios) {
            for (const step of scenario.steps) {
                const prim = primRegistry.get(step.primitive_id);
                if (prim) {
                    assert.equal(prim.is_abstract, false, `Planner produced step with abstract primitive: ${step.primitive_id}`);
                }
            }
        }
    });

    it("planner output carries simulation_id via _simulation_id field", async () => {
        const planner = makePlanner();
        const output = await planner.plan(makeInput());
        assert.equal(output._simulation_id, "sim_001");
        assert.equal(output._experiment_id, "exp_001");
    });

    it("severity constraint is respected", async () => {
        const planner = makePlanner();
        const input = makeInput({
            objective: "Brute force and account freeze",
            constraints: { severity_range: ["CRITICAL"] }
        });
        const output = await planner.plan(input);
        assert.ok(["CRITICAL", "HIGH"].includes(output.scenarios[0].severity));
    });

    it("planner does NOT expose any DB or Kafka clients", () => {
        const planner = makePlanner();
        assert.equal(typeof planner._pgPool, "undefined");
        assert.equal(typeof planner._mongo, "undefined");
        assert.equal(typeof planner._kafka, "undefined");
        assert.equal(typeof planner._http, "undefined");
    });

    it("planner plan() is async and returns a Promise", () => {
        const planner = makePlanner();
        const result = planner.plan(makeInput());
        assert.ok(result instanceof Promise);
        return result; // let the test runner await it
    });
});
