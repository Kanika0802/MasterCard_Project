// red-team/tests/executionDomain.test.js

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const ExecutionContext = require("../src/domain/execution/ExecutionContext");
const StepResult = require("../src/domain/execution/StepResult");
const {
    ExecutionState,
    StepExecutionStatus,
    isValidExecutionState,
    isValidStepStatus
} = require("../src/domain/execution/ExecutionState");
const { ScenarioValidationError, StepValidationError } = require("../src/domain/errors");

describe("Red Team Execution Domain Models Unit Tests", () => {
    describe("ExecutionState & StepExecutionStatus", () => {
        it("should expose all required attack execution states", () => {
            assert.equal(ExecutionState.CREATED, "CREATED");
            assert.equal(ExecutionState.VALIDATING, "VALIDATING");
            assert.equal(ExecutionState.VALIDATED, "VALIDATED");
            assert.equal(ExecutionState.RUNNING, "RUNNING");
            assert.equal(ExecutionState.COMPLETED, "COMPLETED");
            assert.equal(ExecutionState.FAILED, "FAILED");
            assert.equal(ExecutionState.ABORTED, "ABORTED");

            assert.equal(isValidExecutionState("RUNNING"), true);
            assert.equal(isValidExecutionState("UNKNOWN_STATE"), false);
        });

        it("should expose all required step execution statuses", () => {
            assert.equal(StepExecutionStatus.PENDING, "PENDING");
            assert.equal(StepExecutionStatus.RUNNING, "RUNNING");
            assert.equal(StepExecutionStatus.COMPLETED, "COMPLETED");
            assert.equal(StepExecutionStatus.FAILED, "FAILED");
            assert.equal(StepExecutionStatus.SKIPPED, "SKIPPED");
            assert.equal(StepExecutionStatus.TIMED_OUT, "TIMED_OUT");

            assert.equal(isValidStepStatus("COMPLETED"), true);
            assert.equal(isValidStepStatus("INVALID_STATUS"), false);
        });
    });

    describe("ExecutionContext", () => {
        it("should construct a valid ExecutionContext with provenance", () => {
            const ctx = new ExecutionContext({
                scenario_id: "scn_001",
                simulation_id: "sim_001",
                experiment_id: "exp_001",
                causation_id: "cause_123",
                metadata: { client: "test_runner" }
            });

            assert.ok(ctx.execution_id);
            assert.equal(ctx.correlation_id, ctx.execution_id);
            assert.equal(ctx.scenario_id, "scn_001");
            assert.equal(ctx.simulation_id, "sim_001");
            assert.equal(ctx.experiment_id, "exp_001");
            assert.equal(ctx.causation_id, "cause_123");

            const json = ctx.toJSON();
            assert.equal(json.scenario_id, "scn_001");

            const restored = ExecutionContext.fromJSON(json);
            assert.equal(restored.execution_id, ctx.execution_id);
        });

        it("should reject missing required identifiers", () => {
            assert.throws(() => new ExecutionContext({ scenario_id: "", simulation_id: "sim", experiment_id: "exp" }), ScenarioValidationError);
            assert.throws(() => new ExecutionContext({ scenario_id: "scn", simulation_id: "", experiment_id: "exp" }), ScenarioValidationError);
            assert.throws(() => new ExecutionContext({ scenario_id: "scn", simulation_id: "sim", experiment_id: "" }), ScenarioValidationError);
        });
    });

    describe("StepResult", () => {
        it("should construct a valid StepResult and evaluate success", () => {
            const result = new StepResult({
                step_id: "step_01",
                status: StepExecutionStatus.COMPLETED,
                latency_ms: 85,
                simulator_response: { action_id: "act_123", success: true }
            });

            assert.equal(result.step_id, "step_01");
            assert.equal(result.status, StepExecutionStatus.COMPLETED);
            assert.equal(result.latency_ms, 85);
            assert.equal(result.isSuccess(), true);

            const json = result.toJSON();
            assert.equal(json.step_id, "step_01");
            assert.equal(json.status, "COMPLETED");
        });

        it("should handle failed StepResult", () => {
            const result = new StepResult({
                step_id: "step_02",
                status: StepExecutionStatus.FAILED,
                latency_ms: 12,
                error: { code: "INSUFFICIENT_FUNDS", message: "Account balance low" }
            });

            assert.equal(result.isSuccess(), false);
            assert.equal(result.status, StepExecutionStatus.FAILED);
            assert.ok(result.error);
        });

        it("should reject invalid status or negative latency", () => {
            assert.throws(() => {
                new StepResult({
                    step_id: "step_01",
                    status: "NOT_A_STATUS"
                });
            }, StepValidationError);

            assert.throws(() => {
                new StepResult({
                    step_id: "step_01",
                    status: StepExecutionStatus.COMPLETED,
                    latency_ms: -50
                });
            }, StepValidationError);
        });
    });
});
