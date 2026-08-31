// red-team/tests/redTeamApi.test.js

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const path = require("path");

const { createRedTeamApp } = require("../src/api");
const AttackResult = require("../src/domain/attack/AttackResult");
const { ExecutionState, StepExecutionStatus } = require("../src/domain/execution/ExecutionState");

describe("Red Team Execution API Unit Tests", () => {
    let server;
    let baseUrl;
    let mockOrchestrator;
    let lastExecutedCall = null;

    before(async () => {
        mockOrchestrator = {
            executeScenario: async (scenario, context, options) => {
                lastExecutedCall = { scenario, context, options };

                if (scenario.scenario_id === "scn_unhandled_err") {
                    throw new Error("Fatal unhandled internal error");
                }

                if (scenario.scenario_id === "scn_invalid_pol") {
                    return new AttackResult({
                        execution_id: context?.execution_id || "exec_val_fail",
                        scenario_id: "scn_invalid_pol",
                        status: ExecutionState.FAILED,
                        started_at: new Date().toISOString(),
                        completed_at: new Date().toISOString(),
                        step_results: [],
                        error: {
                            code: "SCENARIO_VALIDATION_FAILED",
                            message: "Policy validation rejected scenario.",
                            validation_errors: [{ code: "UNSUPPORTED_ACTION", message: "Action unsupported" }]
                        }
                    });
                }

                if (scenario.scenario_id === "scn_step_fail") {
                    return new AttackResult({
                        execution_id: context?.execution_id || "exec_step_fail",
                        scenario_id: "scn_step_fail",
                        status: ExecutionState.FAILED,
                        started_at: new Date().toISOString(),
                        completed_at: new Date().toISOString(),
                        step_results: [{
                            step_id: "s1",
                            status: StepExecutionStatus.FAILED,
                            started_at: new Date().toISOString(),
                            completed_at: new Date().toISOString(),
                            latency_ms: 5,
                            error: { code: "SIMULATOR_ERROR", message: "Account not found" }
                        }],
                        error: {
                            code: "STEP_EXECUTION_FAILED",
                            message: "Step 's1' failed: Account not found"
                        }
                    });
                }

                return new AttackResult({
                    execution_id: context?.execution_id || "exec_success_100",
                    scenario_id: scenario.scenario_id || "scn_success",
                    status: ExecutionState.COMPLETED,
                    started_at: new Date().toISOString(),
                    completed_at: new Date().toISOString(),
                    step_results: [{
                        step_id: "s1",
                        status: StepExecutionStatus.COMPLETED,
                        started_at: new Date().toISOString(),
                        completed_at: new Date().toISOString(),
                        latency_ms: 12,
                        simulator_response: { success: true }
                    }],
                    error: null,
                    metadata: { campaign: "test" }
                });
            }
        };

        const app = createRedTeamApp({ orchestrator: mockOrchestrator });
        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, resolve));
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
    });

    after(async () => {
        await new Promise(resolve => server.close(resolve));
    });

    it("1. POST /api/v1/red-team/execute endpoint exists", async () => {
        const res = await fetch(`${baseUrl}/api/v1/red-team/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario: { scenario_id: "s1" } })
        });
        assert.notEqual(res.status, 404);
    });

    it("2. valid request reaches orchestrator", async () => {
        lastExecutedCall = null;
        const res = await fetch(`${baseUrl}/api/v1/red-team/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                scenario: { scenario_id: "scn_valid_1", steps: [] }
            })
        });

        assert.equal(res.status, 200);
        assert.ok(lastExecutedCall);
        assert.equal(lastExecutedCall.scenario.scenario_id, "scn_valid_1");
    });

    it("3. correct scenario passed to orchestrator", async () => {
        lastExecutedCall = null;
        await fetch(`${baseUrl}/api/v1/red-team/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                scenario: {
                    scenario_id: "scn_specific_99",
                    objective: "Test objective",
                    steps: [{ step_id: "step_1", action: "SIMULATE_LOGIN" }]
                }
            })
        });

        assert.equal(lastExecutedCall.scenario.scenario_id, "scn_specific_99");
        assert.equal(lastExecutedCall.scenario.objective, "Test objective");
    });

    it("4. execution context passed correctly from request body", async () => {
        lastExecutedCall = null;
        await fetch(`${baseUrl}/api/v1/red-team/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                scenario: { scenario_id: "scn_ctx_test" },
                context: { execution_id: "exec_custom_123", simulation_id: "sim_999" }
            })
        });

        assert.equal(lastExecutedCall.context.execution_id, "exec_custom_123");
        assert.equal(lastExecutedCall.context.simulation_id, "sim_999");
    });

    it("5. correlation header propagation (X-Correlation-Id)", async () => {
        lastExecutedCall = null;
        await fetch(`${baseUrl}/api/v1/red-team/execute`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Correlation-Id": "corr_header_777"
            },
            body: JSON.stringify({
                scenario: { scenario_id: "scn_corr_test" }
            })
        });

        assert.equal(lastExecutedCall.context.correlation_id, "corr_header_777");
    });

    it("6. causation header propagation (X-Causation-Id)", async () => {
        lastExecutedCall = null;
        await fetch(`${baseUrl}/api/v1/red-team/execute`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Causation-Id": "cause_header_888"
            },
            body: JSON.stringify({
                scenario: { scenario_id: "scn_cause_test" }
            })
        });

        assert.equal(lastExecutedCall.context.causation_id, "cause_header_888");
    });

    it("7. idempotency header propagation (Idempotency-Key)", async () => {
        lastExecutedCall = null;
        await fetch(`${baseUrl}/api/v1/red-team/execute`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": "idemp_key_999"
            },
            body: JSON.stringify({
                scenario: { scenario_id: "scn_idemp_test" }
            })
        });

        assert.equal(lastExecutedCall.context.idempotency_key, "idemp_key_999");
    });

    it("8. successful AttackResult serialized correctly with status 200", async () => {
        const res = await fetch(`${baseUrl}/api/v1/red-team/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                scenario: { scenario_id: "scn_ok" }
            })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.status, "COMPLETED");
        assert.equal(data.scenario_id, "scn_ok");
        assert.equal(data.step_results.length, 1);
        assert.equal(data.step_results[0].status, "COMPLETED");
    });

    it("9. malformed JSON request rejected with 400", async () => {
        const res = await fetch(`${baseUrl}/api/v1/red-team/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "invalid_not_json"
        });

        assert.equal(res.status, 400);
    });

    it("10. missing scenario rejected with 400", async () => {
        const res = await fetch(`${baseUrl}/api/v1/red-team/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario: {} })
        });

        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error.code, "MISSING_SCENARIO");
    });

    it("11. orchestrator validation failure serialized correctly with 422", async () => {
        const res = await fetch(`${baseUrl}/api/v1/red-team/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                scenario: { scenario_id: "scn_invalid_pol" }
            })
        });

        assert.equal(res.status, 422);
        const data = await res.json();
        assert.equal(data.status, "FAILED");
        assert.equal(data.error.code, "SCENARIO_VALIDATION_FAILED");
        assert.equal(data.error.validation_errors.length, 1);
    });

    it("12. orchestrator FAILED step result handled correctly with status 200", async () => {
        const res = await fetch(`${baseUrl}/api/v1/red-team/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                scenario: { scenario_id: "scn_step_fail" }
            })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.status, "FAILED");
        assert.equal(data.error.code, "STEP_EXECUTION_FAILED");
        assert.equal(data.step_results.length, 1);
        assert.equal(data.step_results[0].status, "FAILED");
    });

    it("13. unexpected orchestrator exception returns 500", async () => {
        const res = await fetch(`${baseUrl}/api/v1/red-team/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                scenario: { scenario_id: "scn_unhandled_err" }
            })
        });

        assert.equal(res.status, 500);
        const data = await res.json();
        assert.equal(data.error.code, "INTERNAL_ORCHESTRATION_ERROR");
    });

    it("14. raw stack trace not exposed in 500 error", async () => {
        const res = await fetch(`${baseUrl}/api/v1/red-team/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                scenario: { scenario_id: "scn_unhandled_err" }
            })
        });

        const data = await res.json();
        assert.equal(data.stack, undefined);
        assert.equal(data.error.stack, undefined);
        assert.equal(data.error.message, "An unexpected error occurred during scenario orchestration.");
    });

    it("15. API never directly invokes SimulatorClient", () => {
        const controllerCode = fs.readFileSync(path.resolve(__dirname, "../src/api/RedTeamExecutionController.js"), "utf8");
        assert.equal(controllerCode.includes("SimulatorClient"), false);
    });

    it("16. API never directly invokes AttackExecutor", () => {
        const controllerCode = fs.readFileSync(path.resolve(__dirname, "../src/api/RedTeamExecutionController.js"), "utf8");
        assert.equal(controllerCode.includes("AttackExecutor"), false);
    });

    it("17. API does not access PostgreSQL", () => {
        const controllerCode = fs.readFileSync(path.resolve(__dirname, "../src/api/RedTeamExecutionController.js"), "utf8");
        assert.equal(controllerCode.includes("postgres"), false);
        assert.equal(controllerCode.includes("pool"), false);
    });

    it("18. API does not access MongoDB", () => {
        const controllerCode = fs.readFileSync(path.resolve(__dirname, "../src/api/RedTeamExecutionController.js"), "utf8");
        assert.equal(controllerCode.includes("mongodb"), false);
    });

    it("19. API does not publish Kafka messages", () => {
        const controllerCode = fs.readFileSync(path.resolve(__dirname, "../src/api/RedTeamExecutionController.js"), "utf8");
        assert.equal(controllerCode.includes("kafka"), false);
    });

    it("20. invalid scenario cannot bypass orchestrator/validator", async () => {
        lastExecutedCall = null;
        await fetch(`${baseUrl}/api/v1/red-team/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                scenario: { scenario_id: "scn_invalid_pol" }
            })
        });

        // Verify it was routed to the orchestrator for validation
        assert.ok(lastExecutedCall);
        assert.equal(lastExecutedCall.scenario.scenario_id, "scn_invalid_pol");
    });
});
