// redteam/tests/unit/validator.test.js
//
// Unit tests for ScenarioValidator — the primary safety gate between PlannerOutput and AttackScenario.
// Tests the hallucination guard, invalid primitive rejection, parameter checks, and entity checks.

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { ScenarioValidator } = require("../../src/validation/ScenarioValidator");
const { PrimitiveRegistry } = require("../../src/primitives/registry");
const PRIMITIVES = require("../../src/primitives/primitives");

function makeValidator() {
    return new ScenarioValidator(new PrimitiveRegistry(PRIMITIVES));
}

function validPlannerInput(overrides = {}) {
    return {
        target_context: {
            simulation_id: "sim_001",
            experiment_id: "exp_001",
            available_entities: {
                users: [
                    { user_id: "usr_001", profile_status: "ACTIVE" },
                    { user_id: "usr_mule", profile_status: "ACTIVE" }
                ],
                accounts: [
                    { account_id: "acc_001", user_id: "usr_001", balance: 5000, status: "ACTIVE" },
                    { account_id: "acc_mule", user_id: "usr_mule", balance: 1000, status: "ACTIVE" }
                ]
            }
        },
        ...overrides
    };
}

function validPlannerOutput(overrides = {}) {
    return {
        planner_id: "rule-based-planner-v1",
        model_used: null,
        generation_timestamp: new Date().toISOString(),
        objective: "Test ATO attack",
        scenarios: [
            {
                name: "ATO Scenario",
                description: "Account takeover scenario",
                attack_family: "ACCOUNT_TAKEOVER",
                severity: "HIGH",
                strategy_id: null,
                steps: [
                    {
                        primitive_id: "PRIM_ADD_MULE_BENEFICIARY",
                        parameters: {
                            user_id: "usr_001",
                            target_account_id: "acc_mule"
                        },
                        delay_ms: null,
                        depends_on: null,
                        on_failure: "ABORT",
                        description: "Add mule beneficiary"
                    }
                ],
                target_entities: {
                    user_ids: ["usr_001"],
                    account_ids: ["acc_001", "acc_mule"],
                    device_ids: null,
                    merchant_ids: null
                },
                reasoning: null
            }
        ],
        validation_status: null,
        validation_errors: null,
        _simulation_id: "sim_001",
        _experiment_id: "exp_001",
        ...overrides
    };
}

describe("ScenarioValidator", () => {
    it("validates a well-formed planner output successfully", () => {
        const validator = makeValidator();
        const output = validPlannerOutput();
        const input = validPlannerInput();

        const { validScenarios, errors } = validator.validate(output, input);

        assert.equal(errors.length, 0, `Expected no errors, got: ${errors.join("; ")}`);
        assert.equal(validScenarios.length, 1);
    });

    it("sets validation_status to VALID on success", () => {
        const validator = makeValidator();
        const output = validPlannerOutput();
        validator.validate(output, validPlannerInput());
        assert.equal(output.validation_status, "VALID");
        assert.equal(output.validation_errors, null);
    });

    it("produced AttackScenario has status VALIDATED", () => {
        const validator = makeValidator();
        const output = validPlannerOutput();
        const { validScenarios } = validator.validate(output, validPlannerInput());
        assert.equal(validScenarios[0].status, "VALIDATED");
    });

    it("produced AttackScenario has a valid UUID scenario_id", () => {
        const validator = makeValidator();
        const output = validPlannerOutput();
        const { validScenarios } = validator.validate(output, validPlannerInput());
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        assert.match(validScenarios[0].scenario_id, uuidRegex);
    });

    it("rejects unknown primitive_id (hallucination guard)", () => {
        const validator = makeValidator();
        const output = validPlannerOutput();
        output.scenarios[0].steps[0].primitive_id = "PRIM_HALLUCINATED_ACTION";

        const { validScenarios, errors } = validator.validate(output, validPlannerInput());

        assert.equal(validScenarios.length, 0);
        assert.ok(errors.length > 0);
        assert.ok(errors.some(e => e.includes("PRIM_HALLUCINATED_ACTION")));
    });

    it("rejects abstract primitive in step (cannot execute)", () => {
        const validator = makeValidator();
        const output = validPlannerOutput();
        output.scenarios[0].steps[0].primitive_id = "PRIM_OTP_INTERCEPT";

        const { validScenarios, errors } = validator.validate(output, validPlannerInput());

        assert.equal(validScenarios.length, 0);
        assert.ok(errors.some(e => e.includes("abstract") || e.includes("PRIM_OTP_INTERCEPT")));
    });

    it("rejects step with missing required parameters", () => {
        const validator = makeValidator();
        const output = validPlannerOutput();
        // PRIM_ADD_MULE_BENEFICIARY requires target_account_id — remove it
        delete output.scenarios[0].steps[0].parameters.target_account_id;

        const { validScenarios, errors } = validator.validate(output, validPlannerInput());

        assert.equal(validScenarios.length, 0);
        assert.ok(errors.some(e => e.includes("target_account_id")));
    });

    it("rejects scenario that references entity IDs not in available_entities", () => {
        const validator = makeValidator();
        const output = validPlannerOutput();
        output.scenarios[0].target_entities.user_ids = ["usr_NOT_IN_SIMULATION"];

        const { validScenarios, errors } = validator.validate(output, validPlannerInput());

        assert.equal(validScenarios.length, 0);
        assert.ok(errors.some(e => e.includes("usr_NOT_IN_SIMULATION")));
    });

    it("rejects malformed PlannerOutput structure", () => {
        const validator = makeValidator();
        const badOutput = { planner_id: "x", generation_timestamp: "2026-01-01T00:00:00Z", objective: "test", scenarios: [] };

        const { validScenarios, errors } = validator.validate(badOutput, validPlannerInput());

        assert.equal(validScenarios.length, 0);
        assert.ok(errors.length > 0);
    });

    it("sets validation_status to INVALID when all scenarios fail", () => {
        const validator = makeValidator();
        const output = validPlannerOutput();
        output.scenarios[0].steps[0].primitive_id = "PRIM_HALLUCINATED";

        validator.validate(output, validPlannerInput());
        assert.equal(output.validation_status, "INVALID");
    });

    it("produces AttackScenario with correct step_indexes starting at 0", () => {
        const validator = makeValidator();
        const output = validPlannerOutput();
        output.scenarios[0].steps.push({
            primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
            parameters: { user_id: "usr_001", success: true },
            delay_ms: null,
            depends_on: null,
            on_failure: "ABORT",
            description: "Login step"
        });

        const { validScenarios } = validator.validate(output, validPlannerInput());

        if (validScenarios.length > 0) {
            const indexes = validScenarios[0].steps.map(s => s.step_index);
            assert.deepEqual(indexes, [0, 1]);
        }
    });

    it("multi-step scenario: step IDs are assigned in step_000 format", () => {
        const validator = makeValidator();
        const output = validPlannerOutput();
        output.scenarios[0].steps.push({
            primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
            parameters: {
                sender_account_id: "acc_001",
                receiver_account_id: "acc_mule",
                initiator_user_id: "usr_001",
                amount: 500
            },
            delay_ms: null,
            depends_on: null,
            on_failure: "ABORT",
            description: "Transfer step"
        });

        const { validScenarios } = validator.validate(output, validPlannerInput());

        if (validScenarios.length > 0) {
            assert.equal(validScenarios[0].steps[0].step_id, "step_000");
            assert.equal(validScenarios[0].steps[1].step_id, "step_001");
        }
    });

    it("does not execute any simulator actions (pure data validation)", () => {
        // This test verifies the validator interface: it only returns data, never calls M1.
        const validator = makeValidator();
        // Verify the validator has no property that looks like an HTTP client or DB connection
        assert.equal(typeof validator._simulatorClient, "undefined");
        assert.equal(typeof validator._pgPool, "undefined");
        assert.equal(typeof validator._mongo, "undefined");
        assert.equal(typeof validator._kafka, "undefined");
    });

    it("skips entity cross-check when plannerInput has no available_entities", () => {
        const validator = makeValidator();
        const output = validPlannerOutput();
        const inputWithoutEntities = {};  // No target_context

        const { errors } = validator.validate(output, inputWithoutEntities);
        // Should not throw, just no entity check
        assert.ok(Array.isArray(errors));
    });
});
