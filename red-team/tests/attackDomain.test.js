// red-team/tests/attackDomain.test.js

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const AttackScenario = require("../src/domain/attack/AttackScenario");
const AttackStep = require("../src/domain/attack/AttackStep");
const AttackTarget = require("../src/domain/attack/AttackTarget");
const AttackResult = require("../src/domain/attack/AttackResult");
const StepResult = require("../src/domain/execution/StepResult");
const { ExecutionState, StepExecutionStatus } = require("../src/domain/execution/ExecutionState");
const { ScenarioValidationError, StepValidationError } = require("../src/domain/errors");

describe("Red Team Attack Domain Models Unit Tests", () => {
    describe("AttackTarget", () => {
        it("should create a valid AttackTarget", () => {
            const target = new AttackTarget({
                entity_type: "user",
                entity_id: "usr_1001"
            });
            assert.equal(target.entity_type, "user");
            assert.equal(target.entity_id, "usr_1001");
            assert.deepEqual(target.toJSON(), { entity_type: "user", entity_id: "usr_1001" });
        });

        it("should reject empty entity_type or entity_id", () => {
            assert.throws(() => new AttackTarget({ entity_type: "", entity_id: "usr_1" }), ScenarioValidationError);
            assert.throws(() => new AttackTarget({ entity_type: "user", entity_id: "" }), ScenarioValidationError);
        });

        it("should reject unsupported entity_type", () => {
            assert.throws(() => new AttackTarget({ entity_type: "invalid_type", entity_id: "id_1" }), ScenarioValidationError);
        });
    });

    describe("AttackStep", () => {
        it("should create a valid AttackStep", () => {
            const step = new AttackStep({
                step_id: "step_01",
                primitive_id: "AUTH_OTP_INTERCEPT_9",
                action: "SIMULATE_LOGIN",
                parameters: { user_id: "usr_1001", success: true },
                target: { entity_type: "user", entity_id: "usr_1001" },
                depends_on: [],
                timeout_ms: 3000
            });

            assert.equal(step.step_id, "step_01");
            assert.equal(step.action, "SIMULATE_LOGIN");
            assert.equal(step.timeout_ms, 3000);
            assert.ok(step.target instanceof AttackTarget);
            assert.equal(step.target.entity_id, "usr_1001");
        });

        it("should reject missing step_id or action", () => {
            assert.throws(() => new AttackStep({ step_id: "", action: "PERFORM_TRANSACTION" }), StepValidationError);
            assert.throws(() => new AttackStep({ step_id: "step_1", action: "" }), StepValidationError);
        });

        it("should reject executable function in parameters", () => {
            assert.throws(() => {
                new AttackStep({
                    step_id: "step_1",
                    action: "PERFORM_TRANSACTION",
                    parameters: {
                        fn: () => console.log("injected code")
                    }
                });
            }, StepValidationError);
        });

        it("should reject non-positive timeout_ms", () => {
            assert.throws(() => {
                new AttackStep({
                    step_id: "step_1",
                    action: "PERFORM_TRANSACTION",
                    timeout_ms: -500
                });
            }, StepValidationError);
        });
    });

    describe("AttackScenario", () => {
        it("should construct a valid multi-step AttackScenario", () => {
            const scenario = new AttackScenario({
                scenario_id: "scn_ato_001",
                version: 1,
                objective: "Simulated ATO and Fraudulent Transfer",
                simulation_id: "sim_test_01",
                experiment_id: "exp_test_01",
                target: { entity_type: "user", entity_id: "usr_target_01" },
                steps: [
                    {
                        step_id: "step_1",
                        primitive_id: "AUTH_OTP_INTERCEPT_9",
                        action: "SIMULATE_LOGIN",
                        parameters: { user_id: "usr_target_01", success: true }
                    },
                    {
                        step_id: "step_2",
                        primitive_id: "NETWORK_MULE_ADD_9",
                        action: "ADD_BENEFICIARY",
                        parameters: { user_id: "usr_target_01", target_account_id: "acc_mule_01" },
                        depends_on: ["step_1"]
                    },
                    {
                        step_id: "step_3",
                        primitive_id: "TXN_SPLIT_VELOCITY_9",
                        action: "PERFORM_TRANSACTION",
                        parameters: {
                            sender_account_id: "acc_victim_01",
                            receiver_account_id: "acc_mule_01",
                            initiator_user_id: "usr_target_01",
                            amount: 1200
                        },
                        depends_on: ["step_2"]
                    }
                ],
                metadata: {
                    attack_family: "account_takeover",
                    generated_by: "synthetic_planner"
                }
            });

            assert.equal(scenario.scenario_id, "scn_ato_001");
            assert.equal(scenario.steps.length, 3);
            assert.equal(scenario.steps[0].step_id, "step_1");
            assert.equal(scenario.steps[1].depends_on[0], "step_1");

            const json = scenario.toJSON();
            assert.equal(json.scenario_id, "scn_ato_001");
            assert.equal(json.steps.length, 3);
        });

        it("should reject missing required identifiers", () => {
            assert.throws(() => new AttackScenario({ scenario_id: "", objective: "obj", simulation_id: "sim", experiment_id: "exp", steps: [{ step_id: "s1", action: "A" }] }), ScenarioValidationError);
            assert.throws(() => new AttackScenario({ scenario_id: "scn", objective: "", simulation_id: "sim", experiment_id: "exp", steps: [{ step_id: "s1", action: "A" }] }), ScenarioValidationError);
            assert.throws(() => new AttackScenario({ scenario_id: "scn", objective: "obj", simulation_id: "", experiment_id: "exp", steps: [{ step_id: "s1", action: "A" }] }), ScenarioValidationError);
            assert.throws(() => new AttackScenario({ scenario_id: "scn", objective: "obj", simulation_id: "sim", experiment_id: "", steps: [{ step_id: "s1", action: "A" }] }), ScenarioValidationError);
            assert.throws(() => new AttackScenario({ scenario_id: "scn", objective: "obj", simulation_id: "sim", experiment_id: "exp", steps: [] }), ScenarioValidationError);
        });

        it("should reject duplicate step_ids within scenario", () => {
            assert.throws(() => {
                new AttackScenario({
                    scenario_id: "scn_dup",
                    objective: "Duplicate step test",
                    simulation_id: "sim",
                    experiment_id: "exp",
                    steps: [
                        { step_id: "step_dup", action: "SIMULATE_LOGIN" },
                        { step_id: "step_dup", action: "PERFORM_TRANSACTION" }
                    ]
                });
            }, ScenarioValidationError);
        });

        it("should reject non-existent step dependency or self-dependency", () => {
            assert.throws(() => {
                new AttackScenario({
                    scenario_id: "scn_dep_err",
                    objective: "Invalid dependency",
                    simulation_id: "sim",
                    experiment_id: "exp",
                    steps: [
                        { step_id: "step_1", action: "SIMULATE_LOGIN", depends_on: ["step_missing"] }
                    ]
                });
            }, ScenarioValidationError);

            assert.throws(() => {
                new AttackScenario({
                    scenario_id: "scn_self_dep",
                    objective: "Self dependency",
                    simulation_id: "sim",
                    experiment_id: "exp",
                    steps: [
                        { step_id: "step_1", action: "SIMULATE_LOGIN", depends_on: ["step_1"] }
                    ]
                });
            }, ScenarioValidationError);
        });

        it("should strictly reject forbidden Blue Team fraud classification fields", () => {
            assert.throws(() => {
                new AttackScenario({
                    scenario_id: "scn_fraud",
                    objective: "Attempting to supply fraud label",
                    simulation_id: "sim",
                    experiment_id: "exp",
                    steps: [{ step_id: "s1", action: "PERFORM_TRANSACTION" }],
                    metadata: {
                        is_fraud: true
                    }
                });
            }, ScenarioValidationError);

            assert.throws(() => {
                new AttackScenario({
                    scenario_id: "scn_fraud2",
                    objective: "Attempting to supply fraud score",
                    simulation_id: "sim",
                    experiment_id: "exp",
                    steps: [{ step_id: "s1", action: "PERFORM_TRANSACTION" }],
                    metadata: {
                        fraud_score: 0.99
                    }
                });
            }, ScenarioValidationError);
        });
    });

    describe("AttackResult", () => {
        it("should construct a valid AttackResult", () => {
            const stepRes = new StepResult({
                step_id: "step_1",
                status: StepExecutionStatus.COMPLETED,
                latency_ms: 120,
                simulator_response: { success: true }
            });

            const attackRes = new AttackResult({
                execution_id: "exec_100",
                scenario_id: "scn_ato_001",
                status: ExecutionState.COMPLETED,
                step_results: [stepRes]
            });

            assert.equal(attackRes.execution_id, "exec_100");
            assert.equal(attackRes.status, ExecutionState.COMPLETED);
            assert.equal(attackRes.isSuccess(), true);
            assert.equal(attackRes.step_results.length, 1);
        });

        it("should reject missing required fields or invalid status", () => {
            assert.throws(() => new AttackResult({ execution_id: "", scenario_id: "s", status: ExecutionState.COMPLETED }), ScenarioValidationError);
            assert.throws(() => new AttackResult({ execution_id: "e", scenario_id: "", status: ExecutionState.COMPLETED }), ScenarioValidationError);
            assert.throws(() => new AttackResult({ execution_id: "e", scenario_id: "s", status: "INVALID_STATUS" }), ScenarioValidationError);
        });

        it("should reject fraud labels in metadata", () => {
            assert.throws(() => {
                new AttackResult({
                    execution_id: "e",
                    scenario_id: "s",
                    status: ExecutionState.COMPLETED,
                    metadata: {
                        fraud_score: 0.95
                    }
                });
            }, ScenarioValidationError);
        });
    });
});
