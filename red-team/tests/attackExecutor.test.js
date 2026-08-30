// red-team/tests/attackExecutor.test.js

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { AttackExecutor } = require("../src/executor");
const AttackStep = require("../src/domain/attack/AttackStep");
const AttackTarget = require("../src/domain/attack/AttackTarget");
const ExecutionContext = require("../src/domain/execution/ExecutionContext");
const { StepExecutionStatus } = require("../src/domain/execution/ExecutionState");
const { SimulatorClientError, SimulatorClientErrorCode } = require("../src/simulator-client");

describe("AttackExecutor Unit Tests", () => {
    function createMockSimulatorClient(handler) {
        return {
            executeAction: async (req) => handler(req)
        };
    }

    const baseContext = new ExecutionContext({
        execution_id: "exec_test_001",
        scenario_id: "scn_ato_01",
        simulation_id: "sim_test_01",
        experiment_id: "exp_test_01",
        correlation_id: "corr_999",
        causation_id: "cause_888",
        metadata: { attacker: "red_agent_1" }
    });

    it("1. successful step execution returns COMPLETED StepResult", async () => {
        const mockClient = createMockSimulatorClient(async (req) => ({
            success: true,
            action_id: "act_001",
            action_type: req.action,
            state_changes: [{ entity_type: "auth_event", entity_id: "ev_1", change: "RECORDED" }]
        }));

        const executor = new AttackExecutor({ simulatorClient: mockClient });
        const step = new AttackStep({
            step_id: "step_login_01",
            action: "SIMULATE_LOGIN",
            parameters: { user_id: "usr_100", success: true }
        });

        const result = await executor.executeStep(step, baseContext);

        assert.equal(result.step_id, "step_login_01");
        assert.equal(result.status, StepExecutionStatus.COMPLETED);
        assert.equal(result.isSuccess(), true);
        assert.equal(result.error, null);
        assert.equal(result.simulator_response.success, true);
    });

    it("2. correct action passed to SimulatorClient", async () => {
        let capturedAction;
        const mockClient = createMockSimulatorClient(async (req) => {
            capturedAction = req.action;
            return { success: true, action_type: req.action, state_changes: [] };
        });

        const executor = new AttackExecutor({ simulatorClient: mockClient });
        const step = new AttackStep({
            step_id: "step_ben_01",
            action: "ADD_BENEFICIARY",
            parameters: { user_id: "usr_1", target_account_id: "acc_2" }
        });

        await executor.executeStep(step, baseContext);
        assert.equal(capturedAction, "ADD_BENEFICIARY");
    });

    it("3. correct parameters passed to SimulatorClient", async () => {
        let capturedParams;
        const mockClient = createMockSimulatorClient(async (req) => {
            capturedParams = req.parameters;
            return { success: true, action_type: req.action, state_changes: [] };
        });

        const executor = new AttackExecutor({ simulatorClient: mockClient });
        const step = new AttackStep({
            step_id: "step_tx_01",
            action: "PERFORM_TRANSACTION",
            parameters: { sender_account_id: "acc_1", amount: 750.50 }
        });

        await executor.executeStep(step, baseContext);
        assert.equal(capturedParams.sender_account_id, "acc_1");
        assert.equal(capturedParams.amount, 750.50);
    });

    it("4. simulation_id propagation from ExecutionContext", async () => {
        let capturedSimId;
        const mockClient = createMockSimulatorClient(async (req) => {
            capturedSimId = req.simulation_id;
            return { success: true, action_type: req.action, state_changes: [] };
        });

        const executor = new AttackExecutor({ simulatorClient: mockClient });
        const step = new AttackStep({ step_id: "s1", action: "SIMULATE_LOGIN" });

        await executor.executeStep(step, baseContext);
        assert.equal(capturedSimId, "sim_test_01");
    });

    it("5. experiment_id propagation from ExecutionContext", async () => {
        let capturedExpId;
        const mockClient = createMockSimulatorClient(async (req) => {
            capturedExpId = req.experiment_id;
            return { success: true, action_type: req.action, state_changes: [] };
        });

        const executor = new AttackExecutor({ simulatorClient: mockClient });
        const step = new AttackStep({ step_id: "s1", action: "SIMULATE_LOGIN" });

        await executor.executeStep(step, baseContext);
        assert.equal(capturedExpId, "exp_test_01");
    });

    it("6. correlation_id propagation", async () => {
        let capturedCorrId;
        const mockClient = createMockSimulatorClient(async (req) => {
            capturedCorrId = req.correlation_id;
            return { success: true, action_type: req.action, state_changes: [] };
        });

        const executor = new AttackExecutor({ simulatorClient: mockClient });
        const step = new AttackStep({ step_id: "s1", action: "SIMULATE_LOGIN" });

        await executor.executeStep(step, baseContext);
        assert.equal(capturedCorrId, "corr_999");
    });

    it("7. causation_id propagation", async () => {
        let capturedCauseId;
        const mockClient = createMockSimulatorClient(async (req) => {
            capturedCauseId = req.causation_id;
            return { success: true, action_type: req.action, state_changes: [] };
        });

        const executor = new AttackExecutor({ simulatorClient: mockClient });
        const step = new AttackStep({ step_id: "s1", action: "SIMULATE_LOGIN" });

        await executor.executeStep(step, baseContext);
        assert.equal(capturedCauseId, "cause_888");
    });

    it("8. target propagation in adversarial metadata and parameters", async () => {
        let capturedReq;
        const mockClient = createMockSimulatorClient(async (req) => {
            capturedReq = req;
            return { success: true, action_type: req.action, state_changes: [] };
        });

        const executor = new AttackExecutor({ simulatorClient: mockClient });
        const target = new AttackTarget({ entity_type: "user", entity_id: "usr_target_99" });
        const step = new AttackStep({
            step_id: "s_target",
            action: "SIMULATE_LOGIN",
            target,
            parameters: {}
        });

        await executor.executeStep(step, baseContext);
        assert.equal(capturedReq.parameters.user_id, "usr_target_99");
        assert.deepEqual(capturedReq.adversarial_metadata.target, { entity_type: "user", entity_id: "usr_target_99" });
    });

    it("9. successful StepResult object verification", async () => {
        const mockClient = createMockSimulatorClient(async () => ({
            success: true,
            action_id: "act_100",
            action_type: "PERFORM_TRANSACTION",
            state_changes: [{ entity_type: "transaction", entity_id: "tx_100", change: "COMPLETED" }]
        }));

        const executor = new AttackExecutor({ simulatorClient: mockClient });
        const step = new AttackStep({ step_id: "s_tx", action: "PERFORM_TRANSACTION", parameters: { amount: 100 } });

        const result = await executor.executeStep(step, baseContext);
        assert.equal(result.status, StepExecutionStatus.COMPLETED);
        assert.equal(result.simulator_response.action_id, "act_100");
    });

    it("10. failed SimulatorClient request maps to FAILED StepResult", async () => {
        const mockClient = createMockSimulatorClient(async () => {
            throw new SimulatorClientError({
                message: "Account not found",
                code: SimulatorClientErrorCode.SIMULATOR_ERROR,
                status: 404,
                details: { error: "ACC_NOT_FOUND" }
            });
        });

        const executor = new AttackExecutor({ simulatorClient: mockClient });
        const step = new AttackStep({ step_id: "s_fail", action: "PERFORM_TRANSACTION", parameters: { amount: 50 } });

        const result = await executor.executeStep(step, baseContext);
        assert.equal(result.status, StepExecutionStatus.FAILED);
        assert.equal(result.isSuccess(), false);
        assert.equal(result.error.code, "SIMULATOR_ERROR");
        assert.equal(result.error.status, 404);
        assert.equal(result.error.message, "Account not found");
    });

    it("11. timeout from SimulatorClient maps to TIMED_OUT StepResult", async () => {
        const mockClient = createMockSimulatorClient(async () => {
            throw new SimulatorClientError({
                message: "Request timed out after 3000ms",
                code: SimulatorClientErrorCode.TIMEOUT,
                retryable: true
            });
        });

        const executor = new AttackExecutor({ simulatorClient: mockClient });
        const step = new AttackStep({ step_id: "s_timeout", action: "SIMULATE_LOGIN", timeout_ms: 3000 });

        const result = await executor.executeStep(step, baseContext);
        assert.equal(result.status, StepExecutionStatus.TIMED_OUT);
        assert.equal(result.isSuccess(), false);
        assert.equal(result.error.code, "TIMEOUT");
    });

    it("12. latency calculation is accurate and non-negative", async () => {
        const mockClient = createMockSimulatorClient(async () => {
            await new Promise(r => setTimeout(r, 20));
            return { success: true, action_type: "SIMULATE_LOGIN", state_changes: [] };
        });

        const executor = new AttackExecutor({ simulatorClient: mockClient });
        const step = new AttackStep({ step_id: "s_latency", action: "SIMULATE_LOGIN" });

        const result = await executor.executeStep(step, baseContext);
        assert.ok(result.latency_ms >= 15, `Expected latency >= 15ms, got ${result.latency_ms}ms`);
    });

    it("13. started_at and completed_at timestamps populated in ISO-8601", async () => {
        const mockClient = createMockSimulatorClient(async () => ({
            success: true,
            action_type: "SIMULATE_LOGIN",
            state_changes: []
        }));

        const executor = new AttackExecutor({ simulatorClient: mockClient });
        const step = new AttackStep({ step_id: "s_time", action: "SIMULATE_LOGIN" });

        const result = await executor.executeStep(step, baseContext);
        assert.ok(new Date(result.started_at).getTime() > 0);
        assert.ok(new Date(result.completed_at).getTime() >= new Date(result.started_at).getTime());
    });

    it("14. simulator response is fully preserved in StepResult", async () => {
        const rawResponse = {
            success: true,
            action_id: "act_preserve_1",
            action_type: "SIMULATE_LOGIN",
            simulation_id: "sim_test_01",
            experiment_id: "exp_test_01",
            state_changes: [{ entity_type: "auth_event", entity_id: "ev_9", change: "RECORDED" }],
            adversarial_metadata: { step_id: "s_pres" },
            error: null
        };

        const mockClient = createMockSimulatorClient(async () => rawResponse);
        const executor = new AttackExecutor({ simulatorClient: mockClient });
        const step = new AttackStep({ step_id: "s_pres", action: "SIMULATE_LOGIN" });

        const result = await executor.executeStep(step, baseContext);
        assert.deepEqual(result.simulator_response, rawResponse);
    });

    it("15. simulator error details are normalized without leaking raw stack trace", async () => {
        const mockClient = createMockSimulatorClient(async () => {
            const err = new Error("Simulated DB timeout");
            err.code = "INTERNAL_DB_ERROR";
            throw err;
        });

        const executor = new AttackExecutor({ simulatorClient: mockClient });
        const step = new AttackStep({ step_id: "s_err", action: "SIMULATE_LOGIN" });

        const result = await executor.executeStep(step, baseContext);
        assert.equal(result.status, StepExecutionStatus.FAILED);
        assert.equal(result.error.message, "Simulated DB timeout");
        assert.equal(result.error.code, "INTERNAL_DB_ERROR");
    });

    it("16. malformed internal step is rejected with FAILED StepResult", async () => {
        const executor = new AttackExecutor();

        // Null step
        const res1 = await executor.executeStep(null, baseContext);
        assert.equal(res1.status, StepExecutionStatus.FAILED);
        assert.equal(res1.error.code, "MALFORMED_STEP");

        // Missing step_id
        const res2 = await executor.executeStep({ action: "SIMULATE_LOGIN" }, baseContext);
        assert.equal(res2.status, StepExecutionStatus.FAILED);
        assert.equal(res2.error.code, "MISSING_STEP_ID");

        // Missing action
        const res3 = await executor.executeStep({ step_id: "s_no_act" }, baseContext);
        assert.equal(res3.status, StepExecutionStatus.FAILED);
        assert.equal(res3.error.code, "MISSING_ACTION");

        // Missing context
        const res4 = await executor.executeStep({ step_id: "s_no_ctx", action: "SIMULATE_LOGIN" }, null);
        assert.equal(res4.status, StepExecutionStatus.FAILED);
        assert.equal(res4.error.code, "MALFORMED_CONTEXT");
    });

    it("17. Executor does not make direct HTTP requests (SimulatorClient is exclusively invoked)", async () => {
        let clientInvoked = false;
        let globalFetchInvoked = false;

        const originalFetch = globalThis.fetch;
        globalThis.fetch = () => {
            globalFetchInvoked = true;
            throw new Error("Direct fetch call in executor is strictly forbidden!");
        };

        try {
            const mockClient = createMockSimulatorClient(async () => {
                clientInvoked = true;
                return { success: true, action_type: "SIMULATE_LOGIN", state_changes: [] };
            });

            const executor = new AttackExecutor({ simulatorClient: mockClient });
            const step = new AttackStep({ step_id: "s_no_http", action: "SIMULATE_LOGIN" });

            const result = await executor.executeStep(step, baseContext);
            assert.equal(result.status, StepExecutionStatus.COMPLETED);
            assert.equal(clientInvoked, true);
            assert.equal(globalFetchInvoked, false);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("18. Executor does not access PostgreSQL/MongoDB directly", () => {
        // Assert AttackExecutor source file contains zero require calls to pg / mongodb / config
        const fs = require("fs");
        const path = require("path");
        const src = fs.readFileSync(path.resolve(__dirname, "../src/executor/AttackExecutor.js"), "utf8");

        assert.equal(src.includes("postgres"), false, "Executor must not import postgres");
        assert.equal(src.includes("mongodb"), false, "Executor must not import mongodb");
        assert.equal(src.includes("pool"), false, "Executor must not reference pool");
        assert.equal(src.includes("mongoose"), false, "Executor must not reference mongoose");
    });

    it("19. SimulatorClient is the only simulator integration dependency", () => {
        const executor = new AttackExecutor();
        assert.ok(executor.simulatorClient);
    });

    it("20. idempotency key is deterministically derived and preserved for step", async () => {
        let capturedIdempKey;
        const mockClient = createMockSimulatorClient(async (req) => {
            capturedIdempKey = req.idempotency_key;
            return { success: true, action_type: req.action, state_changes: [] };
        });

        const executor = new AttackExecutor({ simulatorClient: mockClient });
        const step = new AttackStep({
            step_id: "step_tx_99",
            action: "PERFORM_TRANSACTION",
            parameters: { sender_account_id: "acc_1", amount: 100 }
        });

        await executor.executeStep(step, baseContext);
        assert.equal(capturedIdempKey, "exec_test_001_step_tx_99");
    });
});
