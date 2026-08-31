// redteam/tests/unit/scenarioHandler.test.js
//
// Unit tests for ScenarioHandler — the Person 1 integration facade.

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { ScenarioHandler, SUPPORTED_SCENARIO_VERSION } = require("../../src/ScenarioHandler");
const { PrimitiveRegistry } = require("../../src/primitives/registry");
const PRIMITIVES = require("../../src/primitives/primitives");
const { ValidationError } = require("../../../simulator/src/domain/errors");

function makeHandler() {
    return new ScenarioHandler(new PrimitiveRegistry(PRIMITIVES));
}

function validatedScenario(overrides = {}) {
    return {
        scenario_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        name: "ATO Test",
        description: "Account takeover test scenario",
        attack_family: "ACCOUNT_TAKEOVER",
        severity: "HIGH",
        strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
        simulation_id: "sim_001",
        experiment_id: "exp_001",
        target_entities: {
            user_ids: ["usr_001"],
            account_ids: ["acc_001"],
            device_ids: null,
            merchant_ids: null
        },
        steps: [
            {
                step_id: "step_000",
                step_index: 0,
                primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                parameters: { user_id: "usr_001", device_type: "MOBILE" },
                delay_ms: null,
                depends_on: null,
                on_failure: "ABORT",
                max_retries: 0,
                description: "Register spoofed device",
                expected_outcome: null
            },
            {
                step_id: "step_001",
                step_index: 1,
                primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                parameters: { user_id: "usr_001", success: true },
                delay_ms: 500,
                depends_on: ["step_000"],
                on_failure: "ABORT",
                max_retries: 0,
                description: "ATO login",
                expected_outcome: null
            }
        ],
        max_duration_ms: null,
        requires_seeded_data: true,
        generated_by: "STRATEGY_LIBRARY",
        planner_model: null,
        generation_timestamp: "2026-08-30T18:00:00.000Z",
        status: "VALIDATED",
        validation_errors: null,
        version: "1.0.0",
        tags: ["ato"],
        ...overrides
    };
}

describe("ScenarioHandler", () => {

    // ── assertConsumable ─────────────────────────────────────────

    it("assertConsumable() passes on a valid VALIDATED scenario", () => {
        const handler = makeHandler();
        assert.doesNotThrow(() => handler.assertConsumable(validatedScenario()));
    });

    it("assertConsumable() throws if status is DRAFT", () => {
        const handler = makeHandler();
        const scenario = validatedScenario({ status: "DRAFT" });
        assert.throws(() => handler.assertConsumable(scenario), ValidationError);
    });

    it("assertConsumable() throws if status is REJECTED", () => {
        const handler = makeHandler();
        const scenario = validatedScenario({ status: "REJECTED" });
        assert.throws(() => handler.assertConsumable(scenario), ValidationError);
    });

    it("assertConsumable() throws if version is unsupported", () => {
        const handler = makeHandler();
        const scenario = validatedScenario({ version: "9.9.9" });
        assert.throws(() => handler.assertConsumable(scenario), ValidationError);
    });

    it("assertConsumable() throws if a step uses an unknown primitive_id", () => {
        const handler = makeHandler();
        const scenario = validatedScenario();
        scenario.steps[0].primitive_id = "PRIM_DOES_NOT_EXIST";
        assert.throws(() => handler.assertConsumable(scenario), ValidationError);
    });

    it("assertConsumable() throws if a step uses an abstract primitive", () => {
        const handler = makeHandler();
        const scenario = validatedScenario();
        scenario.steps[0].primitive_id = "PRIM_OTP_INTERCEPT";
        assert.throws(() => handler.assertConsumable(scenario), ValidationError);
    });

    it("assertConsumable() throws if scenario is structurally invalid (missing scenario_id)", () => {
        const handler = makeHandler();
        const scenario = validatedScenario({ scenario_id: "not-a-uuid" });
        assert.throws(() => handler.assertConsumable(scenario), ValidationError);
    });

    // ── toActionRequest ──────────────────────────────────────────

    it("toActionRequest() produces the correct M1 action body", () => {
        const handler = makeHandler();
        const scenario = validatedScenario();
        const step = scenario.steps[0]; // PRIM_REGISTER_SPOOFED_DEVICE

        const req = handler.toActionRequest(scenario, step);

        assert.equal(req.action, "REGISTER_DEVICE");
        assert.equal(req.simulation_id, "sim_001");
        assert.equal(req.experiment_id, "exp_001");
        assert.deepEqual(req.parameters, { user_id: "usr_001", device_type: "MOBILE" });
    });

    it("toActionRequest() includes adversarial_metadata with all required fields", () => {
        const handler = makeHandler();
        const scenario = validatedScenario();
        const step = scenario.steps[0];

        const req = handler.toActionRequest(scenario, step);
        const meta = req.adversarial_metadata;

        assert.equal(meta.attack_scenario_id, scenario.scenario_id);
        assert.equal(meta.primitive_id, step.primitive_id);
        assert.equal(meta.step_id, step.step_id);
        assert.equal(meta.attack_family, scenario.attack_family);
        assert.equal(meta.generated_by, scenario.generated_by);
    });

    it("toActionRequest() maps PRIM_ADD_MULE_BENEFICIARY → ADD_BENEFICIARY", () => {
        const handler = makeHandler();
        const scenario = validatedScenario({
            steps: [{
                step_id: "step_000",
                step_index: 0,
                primitive_id: "PRIM_ADD_MULE_BENEFICIARY",
                parameters: { user_id: "usr_001", target_account_id: "acc_mule" },
                delay_ms: null,
                depends_on: null,
                on_failure: "ABORT",
                max_retries: 0,
                description: null,
                expected_outcome: null
            }]
        });

        const req = handler.toActionRequest(scenario, scenario.steps[0]);
        assert.equal(req.action, "ADD_BENEFICIARY");
    });

    it("toActionRequest() maps PRIM_EXECUTE_FRAUDULENT_TRANSFER → PERFORM_TRANSACTION", () => {
        const handler = makeHandler();
        const step = {
            step_id: "step_000", step_index: 0,
            primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
            parameters: { sender_account_id: "acc_v", receiver_account_id: "acc_m", initiator_user_id: "usr_v", amount: 500 },
            delay_ms: null, depends_on: null, on_failure: "ABORT", max_retries: 0, description: null, expected_outcome: null
        };
        const scenario = validatedScenario({ steps: [step] });
        const req = handler.toActionRequest(scenario, step);
        assert.equal(req.action, "PERFORM_TRANSACTION");
    });

    it("toActionRequest() maps PRIM_ACCOUNT_TAKEOVER_LOGIN → SIMULATE_LOGIN", () => {
        const handler = makeHandler();
        const step = scenario => scenario.steps[1]; // second step in validatedScenario
        const scenario = validatedScenario();
        const req = handler.toActionRequest(scenario, step(scenario));
        assert.equal(req.action, "SIMULATE_LOGIN");
    });

    it("toActionRequest() maps PRIM_TAMPER_KYC_VERIFICATION → UPDATE_KYC", () => {
        const handler = makeHandler();
        const step = {
            step_id: "step_000", step_index: 0,
            primitive_id: "PRIM_TAMPER_KYC_VERIFICATION",
            parameters: { kyc_id: "kyc_001", verification_status: "VERIFIED" },
            delay_ms: null, depends_on: null, on_failure: "ABORT", max_retries: 0, description: null, expected_outcome: null
        };
        const scenario = validatedScenario({ steps: [step] });
        const req = handler.toActionRequest(scenario, step);
        assert.equal(req.action, "UPDATE_KYC");
    });

    it("toActionRequest() maps PRIM_MANIPULATE_ACCOUNT_STATUS → CHANGE_ACCOUNT_STATUS", () => {
        const handler = makeHandler();
        const step = {
            step_id: "step_000", step_index: 0,
            primitive_id: "PRIM_MANIPULATE_ACCOUNT_STATUS",
            parameters: { account_id: "acc_001", status: "FROZEN" },
            delay_ms: null, depends_on: null, on_failure: "ABORT", max_retries: 0, description: null, expected_outcome: null
        };
        const scenario = validatedScenario({ steps: [step] });
        const req = handler.toActionRequest(scenario, step);
        assert.equal(req.action, "CHANGE_ACCOUNT_STATUS");
    });

    it("toActionRequest() throws for abstract primitive", () => {
        const handler = makeHandler();
        const step = {
            step_id: "step_000", step_index: 0,
            primitive_id: "PRIM_OTP_INTERCEPT",
            parameters: { user_id: "usr_001" },
            delay_ms: null, depends_on: null, on_failure: "ABORT", max_retries: 0, description: null, expected_outcome: null
        };
        const scenario = validatedScenario({ steps: [step] });
        assert.throws(() => handler.toActionRequest(scenario, step), ValidationError);
    });

    it("toActionRequest() does not mutate the original parameters", () => {
        const handler = makeHandler();
        const scenario = validatedScenario();
        const step = scenario.steps[0];
        const originalParams = { ...step.parameters };

        handler.toActionRequest(scenario, step);

        assert.deepEqual(step.parameters, originalParams);
    });

    // ── resolveSimulatorAction ───────────────────────────────────

    it("resolveSimulatorAction() returns correct action for known concrete primitive", () => {
        const handler = makeHandler();
        assert.equal(handler.resolveSimulatorAction("PRIM_ADD_MULE_BENEFICIARY"), "ADD_BENEFICIARY");
        assert.equal(handler.resolveSimulatorAction("PRIM_EXECUTE_FRAUDULENT_TRANSFER"), "PERFORM_TRANSACTION");
        assert.equal(handler.resolveSimulatorAction("PRIM_ACCOUNT_TAKEOVER_LOGIN"), "SIMULATE_LOGIN");
        assert.equal(handler.resolveSimulatorAction("PRIM_REGISTER_SPOOFED_DEVICE"), "REGISTER_DEVICE");
        assert.equal(handler.resolveSimulatorAction("PRIM_TAMPER_KYC_VERIFICATION"), "UPDATE_KYC");
        assert.equal(handler.resolveSimulatorAction("PRIM_MANIPULATE_ACCOUNT_STATUS"), "CHANGE_ACCOUNT_STATUS");
    });

    it("resolveSimulatorAction() throws for unknown primitive", () => {
        const handler = makeHandler();
        assert.throws(() => handler.resolveSimulatorAction("PRIM_UNKNOWN"), ValidationError);
    });

    it("resolveSimulatorAction() throws for abstract primitive", () => {
        const handler = makeHandler();
        assert.throws(() => handler.resolveSimulatorAction("PRIM_OTP_INTERCEPT"), ValidationError);
    });

    // ── getSortedSteps ───────────────────────────────────────────

    it("getSortedSteps() returns steps in step_index order", () => {
        const handler = makeHandler();
        const scenario = validatedScenario();
        // Reverse the steps array to test sorting
        const reversed = { ...scenario, steps: [...scenario.steps].reverse() };

        const sorted = handler.getSortedSteps(reversed);
        assert.equal(sorted[0].step_index, 0);
        assert.equal(sorted[1].step_index, 1);
    });

    it("getSortedSteps() does not mutate the original steps array", () => {
        const handler = makeHandler();
        const scenario = validatedScenario();
        const originalFirst = scenario.steps[0].step_id;

        handler.getSortedSteps(scenario);

        assert.equal(scenario.steps[0].step_id, originalFirst);
    });

    // ── Public API from index.js ─────────────────────────────────

    it("ScenarioHandler is exported from redteam/src/index.js", () => {
        const m2 = require("../../src/index");
        assert.ok(m2.ScenarioHandler);
        assert.equal(m2.ScenarioHandler, ScenarioHandler);
    });

    it("SUPPORTED_SCENARIO_VERSION is exported from index.js", () => {
        const m2 = require("../../src/index");
        assert.equal(typeof m2.SUPPORTED_SCENARIO_VERSION, "string");
        assert.equal(m2.SUPPORTED_SCENARIO_VERSION, "1.0.0");
    });
});
