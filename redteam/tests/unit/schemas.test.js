// redteam/tests/unit/schemas.test.js
//
// Unit tests for all M2 schema validators.
// Uses Node.js built-in test framework (node:test) — same as M1 tests.

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { validateAttackPrimitive } = require("../../src/schemas/AttackPrimitive");
const { validateAttackStep } = require("../../src/schemas/AttackStep");
const { validateAttackScenario } = require("../../src/schemas/AttackScenario");
const { validateAttackStrategy } = require("../../src/schemas/AttackStrategy");
const { validatePlannerInput } = require("../../src/schemas/PlannerInput");
const { validatePlannerOutputShape } = require("../../src/schemas/PlannerOutput");
const { ValidationError } = require("../../../simulator/src/domain/errors");

// ============================================================================
// Helpers: minimal valid fixtures
// ============================================================================

function validPrimitive(overrides = {}) {
    return {
        primitive_id: "PRIM_TEST_ACTION",
        name: "Test Primitive",
        description: "A test primitive",
        simulator_action: "ADD_BENEFICIARY",
        category: "TRANSACTION",
        attack_family: "MULE_NETWORK",
        required_parameters: [
            { name: "user_id", type: "string", description: "User ID" }
        ],
        optional_parameters: [],
        expected_success_events: ["BENEFICIARY_ADDED"],
        expected_failure_events: ["VALIDATION_ERROR"],
        preconditions: [],
        postconditions: [],
        is_abstract: false,
        version: "1.0.0",
        tags: ["test"],
        ...overrides
    };
}

function validStep(overrides = {}) {
    return {
        step_id: "step_000",
        step_index: 0,
        primitive_id: "PRIM_ADD_MULE_BENEFICIARY",
        parameters: { user_id: "usr_001", target_account_id: "acc_001" },
        delay_ms: null,
        depends_on: null,
        on_failure: "ABORT",
        max_retries: 0,
        ...overrides
    };
}

function validScenario(overrides = {}) {
    return {
        scenario_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        name: "Test Scenario",
        description: "A test attack scenario",
        attack_family: "ACCOUNT_TAKEOVER",
        severity: "HIGH",
        strategy_id: null,
        simulation_id: "sim_001",
        experiment_id: "exp_001",
        target_entities: {
            user_ids: ["usr_001"],
            account_ids: ["acc_001"],
            device_ids: null,
            merchant_ids: null
        },
        steps: [validStep()],
        max_duration_ms: null,
        requires_seeded_data: true,
        generated_by: "MANUAL",
        planner_model: null,
        generation_timestamp: "2026-08-30T18:00:00.000Z",
        status: "VALIDATED",
        validation_errors: null,
        version: "1.0.0",
        tags: null,
        ...overrides
    };
}

function validStrategy(overrides = {}) {
    return {
        strategy_id: "STRAT_TEST_STRATEGY",
        name: "Test Strategy",
        description: "A test strategy",
        attack_family: "ACCOUNT_TAKEOVER",
        severity: "HIGH",
        step_templates: [
            {
                template_step_id: "tmpl_01",
                primitive_id: "PRIM_ADD_MULE_BENEFICIARY",
                parameter_bindings: { user_id: "$victim_user_id", target_account_id: "$mule_account_id" },
                delay_ms: null,
                depends_on: null,
                on_failure: "ABORT",
                description: "Add mule beneficiary"
            }
        ],
        required_context: {
            entities: ["victim_user_id", "mule_account_id"],
            simulation_id: true,
            experiment_id: true
        },
        version: "1.0.0",
        tags: ["test"],
        planner_prompt_hint: null,
        ...overrides
    };
}

function validPlannerInput(overrides = {}) {
    return {
        objective: "Simulate an account takeover attack",
        attack_family: null,
        available_primitives: [validPrimitive()],
        available_strategies: null,
        target_context: {
            simulation_id: "sim_001",
            experiment_id: "exp_001",
            available_entities: {
                users: [{ user_id: "usr_001", profile_status: "ACTIVE" }],
                accounts: [{ account_id: "acc_001", user_id: "usr_001", balance: 5000, status: "ACTIVE" }],
                merchants: null,
                devices: null
            }
        },
        constraints: null,
        planner_config: null,
        ...overrides
    };
}

function validPlannerOutput(overrides = {}) {
    return {
        planner_id: "rule-based-planner-v1",
        model_used: null,
        generation_timestamp: "2026-08-30T18:00:00.000Z",
        objective: "Simulate an account takeover",
        scenarios: [
            {
                name: "ATO Scenario",
                description: "An ATO scenario",
                attack_family: "ACCOUNT_TAKEOVER",
                severity: "HIGH",
                strategy_id: null,
                steps: [
                    {
                        primitive_id: "PRIM_ADD_MULE_BENEFICIARY",
                        parameters: { user_id: "usr_001", target_account_id: "acc_001" },
                        delay_ms: null,
                        depends_on: null,
                        on_failure: "ABORT",
                        description: "Add mule beneficiary"
                    }
                ],
                target_entities: {
                    user_ids: ["usr_001"],
                    account_ids: ["acc_001"],
                    device_ids: null,
                    merchant_ids: null
                },
                reasoning: null
            }
        ],
        validation_status: null,
        validation_errors: null,
        ...overrides
    };
}

// ============================================================================
// AttackPrimitive Validation
// ============================================================================

describe("AttackPrimitive schema", () => {
    it("accepts a valid concrete primitive", () => {
        const p = validPrimitive();
        assert.doesNotThrow(() => validateAttackPrimitive(p));
    });

    it("accepts a valid abstract primitive with null simulator_action", () => {
        const p = validPrimitive({
            primitive_id: "PRIM_ABSTRACT_TEST",
            simulator_action: null,
            is_abstract: true
        });
        assert.doesNotThrow(() => validateAttackPrimitive(p));
    });

    it("rejects primitive with invalid primitive_id pattern", () => {
        const p = validPrimitive({ primitive_id: "bad-id" });
        assert.throws(() => validateAttackPrimitive(p), ValidationError);
    });

    it("rejects primitive with non-existent M1 simulator_action", () => {
        const p = validPrimitive({ simulator_action: "NONEXISTENT_ACTION" });
        assert.throws(() => validateAttackPrimitive(p), ValidationError);
    });

    it("rejects non-abstract primitive with null simulator_action", () => {
        const p = validPrimitive({ simulator_action: null, is_abstract: false });
        assert.throws(() => validateAttackPrimitive(p), ValidationError);
    });

    it("rejects abstract primitive with a non-null simulator_action", () => {
        const p = validPrimitive({ simulator_action: "ADD_BENEFICIARY", is_abstract: true });
        assert.throws(() => validateAttackPrimitive(p), ValidationError);
    });

    it("rejects primitive with invalid category", () => {
        const p = validPrimitive({ category: "INVALID_CATEGORY" });
        assert.throws(() => validateAttackPrimitive(p), ValidationError);
    });

    it("rejects primitive with empty required_parameters", () => {
        const p = validPrimitive({ required_parameters: [] });
        assert.throws(() => validateAttackPrimitive(p), ValidationError);
    });

    it("rejects primitive with invalid EventType in expected_success_events", () => {
        const p = validPrimitive({ expected_success_events: ["NONEXISTENT_EVENT_TYPE"] });
        assert.throws(() => validateAttackPrimitive(p), ValidationError);
    });

    it("rejects primitive with missing version", () => {
        const p = validPrimitive({ version: "" });
        assert.throws(() => validateAttackPrimitive(p), ValidationError);
    });

    it("rejects non-object input", () => {
        assert.throws(() => validateAttackPrimitive(null), ValidationError);
        assert.throws(() => validateAttackPrimitive("string"), ValidationError);
    });

    it("accepts all 6 valid M1 simulator_action values", () => {
        const validActions = [
            "ADD_BENEFICIARY", "PERFORM_TRANSACTION", "SIMULATE_LOGIN",
            "REGISTER_DEVICE", "UPDATE_KYC", "CHANGE_ACCOUNT_STATUS"
        ];
        for (const action of validActions) {
            const p = validPrimitive({ simulator_action: action });
            assert.doesNotThrow(() => validateAttackPrimitive(p), `Should accept action: ${action}`);
        }
    });
});

// ============================================================================
// AttackStep Validation
// ============================================================================

describe("AttackStep schema", () => {
    it("accepts a valid step", () => {
        assert.doesNotThrow(() => validateAttackStep(validStep()));
    });

    it("rejects step with missing step_id", () => {
        assert.throws(() => validateAttackStep(validStep({ step_id: "" })), ValidationError);
    });

    it("rejects step with negative step_index", () => {
        assert.throws(() => validateAttackStep(validStep({ step_index: -1 })), ValidationError);
    });

    it("rejects step with non-integer step_index", () => {
        assert.throws(() => validateAttackStep(validStep({ step_index: 1.5 })), ValidationError);
    });

    it("rejects step with null parameters", () => {
        assert.throws(() => validateAttackStep(validStep({ parameters: null })), ValidationError);
    });

    it("rejects step with array as parameters", () => {
        assert.throws(() => validateAttackStep(validStep({ parameters: [] })), ValidationError);
    });

    it("rejects step with invalid on_failure", () => {
        assert.throws(() => validateAttackStep(validStep({ on_failure: "EXPLODE" })), ValidationError);
    });

    it("accepts valid on_failure values", () => {
        for (const val of ["ABORT", "CONTINUE", "RETRY"]) {
            assert.doesNotThrow(() => validateAttackStep(validStep({ on_failure: val })));
        }
    });

    it("accepts null delay_ms", () => {
        assert.doesNotThrow(() => validateAttackStep(validStep({ delay_ms: null })));
    });

    it("rejects negative delay_ms", () => {
        assert.throws(() => validateAttackStep(validStep({ delay_ms: -100 })), ValidationError);
    });

    it("accepts valid depends_on array", () => {
        const step = validStep({ step_index: 1, step_id: "step_001", depends_on: ["step_000"] });
        assert.doesNotThrow(() => validateAttackStep(step));
    });

    it("rejects depends_on with empty string entries", () => {
        const step = validStep({ depends_on: [""] });
        assert.throws(() => validateAttackStep(step), ValidationError);
    });
});

// ============================================================================
// AttackScenario Validation
// ============================================================================

describe("AttackScenario schema", () => {
    it("accepts a valid scenario", () => {
        assert.doesNotThrow(() => validateAttackScenario(validScenario()));
    });

    it("rejects scenario with invalid UUID", () => {
        assert.throws(() => validateAttackScenario(validScenario({ scenario_id: "not-a-uuid" })), ValidationError);
    });

    it("rejects scenario with empty steps array", () => {
        assert.throws(() => validateAttackScenario(validScenario({ steps: [] })), ValidationError);
    });

    it("rejects scenario with duplicate step_ids", () => {
        const scenario = validScenario({
            steps: [validStep({ step_id: "step_000", step_index: 0 }), validStep({ step_id: "step_000", step_index: 1 })]
        });
        assert.throws(() => validateAttackScenario(scenario), ValidationError);
    });

    it("rejects scenario with non-contiguous step_indexes", () => {
        const scenario = validScenario({
            steps: [validStep({ step_id: "step_000", step_index: 0 }), validStep({ step_id: "step_002", step_index: 2 })]
        });
        assert.throws(() => validateAttackScenario(scenario), ValidationError);
    });

    it("rejects scenario where depends_on references nonexistent step", () => {
        const scenario = validScenario({
            steps: [validStep({ step_id: "step_000", step_index: 0, depends_on: ["step_999"] })]
        });
        assert.throws(() => validateAttackScenario(scenario), ValidationError);
    });

    it("rejects scenario where a step depends on itself", () => {
        const scenario = validScenario({
            steps: [validStep({ step_id: "step_000", step_index: 0, depends_on: ["step_000"] })]
        });
        assert.throws(() => validateAttackScenario(scenario), ValidationError);
    });

    it("detects circular dependencies", () => {
        const scenario = validScenario({
            steps: [
                validStep({ step_id: "step_000", step_index: 0, depends_on: ["step_001"] }),
                validStep({ step_id: "step_001", step_index: 1, depends_on: ["step_000"] })
            ]
        });
        assert.throws(() => validateAttackScenario(scenario), ValidationError);
    });

    it("rejects invalid severity", () => {
        assert.throws(() => validateAttackScenario(validScenario({ severity: "SUPER_HIGH" })), ValidationError);
    });

    it("rejects invalid status", () => {
        assert.throws(() => validateAttackScenario(validScenario({ status: "PENDING" })), ValidationError);
    });

    it("rejects invalid generated_by", () => {
        assert.throws(() => validateAttackScenario(validScenario({ generated_by: "ROBOT" })), ValidationError);
    });

    it("rejects empty user_ids in target_entities", () => {
        const scenario = validScenario({ target_entities: { user_ids: [], account_ids: [] } });
        assert.throws(() => validateAttackScenario(scenario), ValidationError);
    });

    it("accepts valid two-step scenario with dependency", () => {
        const scenario = validScenario({
            steps: [
                validStep({ step_id: "step_000", step_index: 0, depends_on: null }),
                validStep({ step_id: "step_001", step_index: 1, depends_on: ["step_000"] })
            ]
        });
        assert.doesNotThrow(() => validateAttackScenario(scenario));
    });
});

// ============================================================================
// AttackStrategy Validation
// ============================================================================

describe("AttackStrategy schema", () => {
    it("accepts a valid strategy", () => {
        assert.doesNotThrow(() => validateAttackStrategy(validStrategy()));
    });

    it("rejects strategy with invalid strategy_id pattern", () => {
        assert.throws(() => validateAttackStrategy(validStrategy({ strategy_id: "bad_strat" })), ValidationError);
    });

    it("rejects strategy with empty step_templates", () => {
        assert.throws(() => validateAttackStrategy(validStrategy({ step_templates: [] })), ValidationError);
    });

    it("rejects strategy with duplicate template_step_ids", () => {
        const strategy = validStrategy({
            step_templates: [
                { template_step_id: "tmpl_01", primitive_id: "PRIM_TEST", parameter_bindings: {}, depends_on: null, on_failure: "ABORT" },
                { template_step_id: "tmpl_01", primitive_id: "PRIM_TEST", parameter_bindings: {}, depends_on: null, on_failure: "ABORT" }
            ]
        });
        assert.throws(() => validateAttackStrategy(strategy), ValidationError);
    });

    it("rejects strategy with invalid severity", () => {
        assert.throws(() => validateAttackStrategy(validStrategy({ severity: "EXTREME" })), ValidationError);
    });

    it("rejects strategy where template depends_on references unknown template_step_id", () => {
        const strategy = validStrategy({
            step_templates: [
                {
                    template_step_id: "tmpl_01",
                    primitive_id: "PRIM_ADD_MULE_BENEFICIARY",
                    parameter_bindings: {},
                    depends_on: ["nonexistent_tmpl"],
                    on_failure: "ABORT"
                }
            ]
        });
        assert.throws(() => validateAttackStrategy(strategy), ValidationError);
    });
});

// ============================================================================
// PlannerInput Validation
// ============================================================================

describe("PlannerInput schema", () => {
    it("accepts a valid planner input", () => {
        assert.doesNotThrow(() => validatePlannerInput(validPlannerInput()));
    });

    it("rejects input with empty objective", () => {
        assert.throws(() => validatePlannerInput(validPlannerInput({ objective: "" })), ValidationError);
    });

    it("rejects input with whitespace-only objective", () => {
        assert.throws(() => validatePlannerInput(validPlannerInput({ objective: "   " })), ValidationError);
    });

    it("rejects input with empty available_primitives", () => {
        assert.throws(() => validatePlannerInput(validPlannerInput({ available_primitives: [] })), ValidationError);
    });

    it("rejects input with missing simulation_id", () => {
        const input = validPlannerInput();
        input.target_context.simulation_id = "";
        assert.throws(() => validatePlannerInput(input), ValidationError);
    });

    it("rejects input with empty users array", () => {
        const input = validPlannerInput();
        input.target_context.available_entities.users = [];
        assert.throws(() => validatePlannerInput(input), ValidationError);
    });

    it("rejects constraint with max_steps = 0", () => {
        const input = validPlannerInput({ constraints: { max_steps: 0 } });
        assert.throws(() => validatePlannerInput(input), ValidationError);
    });

    it("accepts constraint with max_steps = 5", () => {
        const input = validPlannerInput({ constraints: { max_steps: 5 } });
        assert.doesNotThrow(() => validatePlannerInput(input));
    });
});

// ============================================================================
// PlannerOutput Shape Validation
// ============================================================================

describe("PlannerOutput schema", () => {
    it("accepts a valid planner output", () => {
        assert.doesNotThrow(() => validatePlannerOutputShape(validPlannerOutput()));
    });

    it("rejects output with empty planner_id", () => {
        assert.throws(() => validatePlannerOutputShape(validPlannerOutput({ planner_id: "" })), ValidationError);
    });

    it("rejects output with empty scenarios", () => {
        assert.throws(() => validatePlannerOutputShape(validPlannerOutput({ scenarios: [] })), ValidationError);
    });

    it("rejects scenario with invalid severity", () => {
        const out = validPlannerOutput();
        out.scenarios[0].severity = "CATASTROPHIC";
        assert.throws(() => validatePlannerOutputShape(out), ValidationError);
    });

    it("rejects scenario with empty steps", () => {
        const out = validPlannerOutput();
        out.scenarios[0].steps = [];
        assert.throws(() => validatePlannerOutputShape(out), ValidationError);
    });

    it("rejects step with missing primitive_id", () => {
        const out = validPlannerOutput();
        out.scenarios[0].steps[0].primitive_id = "";
        assert.throws(() => validatePlannerOutputShape(out), ValidationError);
    });

    it("rejects step with null parameters", () => {
        const out = validPlannerOutput();
        out.scenarios[0].steps[0].parameters = null;
        assert.throws(() => validatePlannerOutputShape(out), ValidationError);
    });
});
