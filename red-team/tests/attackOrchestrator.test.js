// red-team/tests/attackOrchestrator.test.js

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { AttackOrchestrator } = require("../src/orchestrator");
const AttackScenario = require("../src/domain/attack/AttackScenario");
const AttackStep = require("../src/domain/attack/AttackStep");
const ExecutionContext = require("../src/domain/execution/ExecutionContext");
const StepResult = require("../src/domain/execution/StepResult");
const { ExecutionState, StepExecutionStatus } = require("../src/domain/execution/ExecutionState");

describe("AttackOrchestrator Unit Tests", () => {
    function createMockValidator(isValid = true, errors = []) {
        return {
            validate: (scn) => {
                createMockValidator.calledWith = scn;
                createMockValidator.callCount = (createMockValidator.callCount || 0) + 1;
                return { valid: isValid, errors, warnings: [] };
            }
        };
    }

    function createMockExecutor(handler = null) {
        const executor = {
            executedSteps: [],
            executeStep: async (step, context) => {
                executor.executedSteps.push({ step, context });
                if (handler) {
                    return handler(step, context);
                }
                return new StepResult({
                    step_id: step.step_id,
                    status: StepExecutionStatus.COMPLETED,
                    simulator_response: { success: true, action: step.action }
                });
            }
        };
        return executor;
    }

    function createTestScenario(steps = [], overrides = {}) {
        return new AttackScenario({
            scenario_id: "scn_orch_01",
            objective: "Test orchestration execution",
            simulation_id: "sim_test_01",
            experiment_id: "exp_test_01",
            steps: steps.length > 0 ? steps : [
                new AttackStep({ step_id: "s1", action: "SIMULATE_LOGIN", parameters: { user_id: "u1" } })
            ],
            ...overrides
        });
    }

    it("1. valid scenario executes successfully", async () => {
        const validator = createMockValidator(true);
        const executor = createMockExecutor();
        const orchestrator = new AttackOrchestrator({ validator, executor });

        const scenario = createTestScenario();
        const result = await orchestrator.executeScenario(scenario);

        assert.equal(result.status, ExecutionState.COMPLETED);
        assert.equal(result.isSuccess(), true);
        assert.equal(result.step_results.length, 1);
        assert.equal(executor.executedSteps.length, 1);
    });

    it("2. validator called before execution", async () => {
        createMockValidator.callCount = 0;
        const validator = createMockValidator(true);
        const executor = createMockExecutor();
        const orchestrator = new AttackOrchestrator({ validator, executor });

        const scenario = createTestScenario();
        await orchestrator.executeScenario(scenario);

        assert.equal(createMockValidator.callCount >= 1, true);
    });

    it("3. invalid scenario never reaches executor", async () => {
        const validator = createMockValidator(false, [{ code: "UNSUPPORTED_ACTION", message: "Action dropped" }]);
        const executor = createMockExecutor();
        const orchestrator = new AttackOrchestrator({ validator, executor });

        const scenario = createTestScenario();
        const result = await orchestrator.executeScenario(scenario);

        assert.equal(result.status, ExecutionState.FAILED);
        assert.equal(result.error.code, "SCENARIO_VALIDATION_FAILED");
        assert.equal(executor.executedSteps.length, 0, "Executor must not be invoked on validation failure");
    });

    it("4. simple one-step scenario execution", async () => {
        const executor = createMockExecutor();
        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor });

        const scenario = createTestScenario([
            new AttackStep({ step_id: "single_step", action: "SIMULATE_LOGIN", parameters: { user_id: "usr_1" } })
        ]);

        const result = await orchestrator.executeScenario(scenario);
        assert.equal(result.status, ExecutionState.COMPLETED);
        assert.equal(result.step_results[0].step_id, "single_step");
    });

    it("5. multiple sequential steps execute in declaration order", async () => {
        const executor = createMockExecutor();
        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor });

        const scenario = createTestScenario([
            new AttackStep({ step_id: "step_1", action: "SIMULATE_LOGIN" }),
            new AttackStep({ step_id: "step_2", action: "REGISTER_DEVICE" }),
            new AttackStep({ step_id: "step_3", action: "PERFORM_TRANSACTION" })
        ]);

        const result = await orchestrator.executeScenario(scenario);
        assert.equal(result.status, ExecutionState.COMPLETED);
        assert.equal(executor.executedSteps.length, 3);
        assert.equal(executor.executedSteps[0].step.step_id, "step_1");
        assert.equal(executor.executedSteps[1].step.step_id, "step_2");
        assert.equal(executor.executedSteps[2].step.step_id, "step_3");
    });

    it("6. dependency ordering enforces prerequisite execution first", async () => {
        const executor = createMockExecutor();
        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor });

        // Declared in order: step_3, step_1, step_2 (where step_3 depends on step_2, and step_2 depends on step_1)
        const scenario = createTestScenario([
            new AttackStep({ step_id: "step_3", action: "PERFORM_TRANSACTION", depends_on: ["step_2"] }),
            new AttackStep({ step_id: "step_1", action: "SIMULATE_LOGIN", depends_on: [] }),
            new AttackStep({ step_id: "step_2", action: "ADD_BENEFICIARY", depends_on: ["step_1"] })
        ]);

        const result = await orchestrator.executeScenario(scenario);
        assert.equal(result.status, ExecutionState.COMPLETED);
        assert.equal(executor.executedSteps[0].step.step_id, "step_1");
        assert.equal(executor.executedSteps[1].step.step_id, "step_2");
        assert.equal(executor.executedSteps[2].step.step_id, "step_3");
    });

    it("7. deterministic topological ordering for independent sibling nodes", async () => {
        const executor = createMockExecutor();
        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor });

        // Node A, B both independent, C depends on both
        const scenario = createTestScenario([
            new AttackStep({ step_id: "node_A", action: "SIMULATE_LOGIN" }),
            new AttackStep({ step_id: "node_B", action: "REGISTER_DEVICE" }),
            new AttackStep({ step_id: "node_C", action: "PERFORM_TRANSACTION", depends_on: ["node_A", "node_B"] })
        ]);

        await orchestrator.executeScenario(scenario);
        assert.equal(executor.executedSteps[0].step.step_id, "node_A");
        assert.equal(executor.executedSteps[1].step.step_id, "node_B");
        assert.equal(executor.executedSteps[2].step.step_id, "node_C");
    });

    it("8. branching dependency graph execution", async () => {
        const executor = createMockExecutor();
        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor });

        // Root -> (Branch1, Branch2) -> Sink
        const scenario = createTestScenario([
            new AttackStep({ step_id: "root", action: "SIMULATE_LOGIN" }),
            new AttackStep({ step_id: "branch_1", action: "REGISTER_DEVICE", depends_on: ["root"] }),
            new AttackStep({ step_id: "branch_2", action: "UPDATE_KYC", depends_on: ["root"] }),
            new AttackStep({ step_id: "sink", action: "PERFORM_TRANSACTION", depends_on: ["branch_1", "branch_2"] })
        ]);

        await orchestrator.executeScenario(scenario);
        const order = executor.executedSteps.map(e => e.step.step_id);
        assert.equal(order[0], "root");
        assert.ok(order.indexOf("branch_1") > order.indexOf("root"));
        assert.ok(order.indexOf("branch_2") > order.indexOf("root"));
        assert.equal(order[3], "sink");
    });

    it("9. missing dependency rejected", async () => {
        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true) });
        const scenario = {
            scenario_id: "scn_missing",
            objective: "test",
            simulation_id: "sim",
            experiment_id: "exp",
            steps: [
                { step_id: "s1", action: "SIMULATE_LOGIN", depends_on: ["s_ghost"] }
            ]
        };

        const result = await orchestrator.executeScenario(scenario);
        assert.equal(result.status, ExecutionState.FAILED);
        assert.ok(result.error.code.includes("DEPENDENCY") || result.error.code.includes("VALIDATION"));
    });

    it("10. dependency cycle rejected", async () => {
        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true) });
        const scenario = {
            scenario_id: "scn_cycle",
            objective: "test",
            simulation_id: "sim",
            experiment_id: "exp",
            steps: [
                { step_id: "s1", action: "SIMULATE_LOGIN", depends_on: ["s2"] },
                { step_id: "s2", action: "SIMULATE_LOGIN", depends_on: ["s1"] }
            ]
        };

        const result = await orchestrator.executeScenario(scenario);
        assert.equal(result.status, ExecutionState.FAILED);
    });

    it("11. duplicate step execution prevention (each step executed once)", async () => {
        const executor = createMockExecutor();
        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor });

        const scenario = createTestScenario([
            new AttackStep({ step_id: "s1", action: "SIMULATE_LOGIN" }),
            new AttackStep({ step_id: "s2", action: "REGISTER_DEVICE", depends_on: ["s1"] })
        ]);

        await orchestrator.executeScenario(scenario);
        const countMap = {};
        for (const s of executor.executedSteps) {
            countMap[s.step.step_id] = (countMap[s.step.step_id] || 0) + 1;
        }

        assert.equal(countMap["s1"], 1);
        assert.equal(countMap["s2"], 1);
    });

    it("12. executor receives correct step instance", async () => {
        const executor = createMockExecutor();
        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor });

        const step = new AttackStep({ step_id: "s_target", action: "SIMULATE_LOGIN", parameters: { key: "val" } });
        const scenario = createTestScenario([step]);

        await orchestrator.executeScenario(scenario);
        assert.equal(executor.executedSteps[0].step.step_id, "s_target");
        assert.equal(executor.executedSteps[0].step.parameters.key, "val");
    });

    it("13. executor receives correct ExecutionContext with provenance", async () => {
        const executor = createMockExecutor();
        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor });

        const customContext = new ExecutionContext({
            execution_id: "exec_custom_888",
            scenario_id: "scn_custom",
            simulation_id: "sim_custom",
            experiment_id: "exp_custom",
            correlation_id: "corr_custom"
        });

        const scenario = createTestScenario();
        await orchestrator.executeScenario(scenario, customContext);

        const receivedCtx = executor.executedSteps[0].context;
        assert.equal(receivedCtx.execution_id, "exec_custom_888");
        assert.equal(receivedCtx.correlation_id, "corr_custom");
    });

    it("14. StepResults aggregated correctly in AttackResult", async () => {
        const executor = createMockExecutor();
        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor });

        const scenario = createTestScenario([
            new AttackStep({ step_id: "s1", action: "SIMULATE_LOGIN" }),
            new AttackStep({ step_id: "s2", action: "PERFORM_TRANSACTION" })
        ]);

        const result = await orchestrator.executeScenario(scenario);
        assert.equal(result.step_results.length, 2);
        assert.equal(result.step_results[0].step_id, "s1");
        assert.equal(result.step_results[1].step_id, "s2");
    });

    it("15. successful scenario returns COMPLETED status", async () => {
        const executor = createMockExecutor();
        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor });

        const scenario = createTestScenario();
        const result = await orchestrator.executeScenario(scenario);

        assert.equal(result.status, ExecutionState.COMPLETED);
        assert.equal(result.error, null);
    });

    it("16. step failure returns FAILED status", async () => {
        const executor = createMockExecutor(async () => {
            return new StepResult({
                step_id: "s_fail",
                status: StepExecutionStatus.FAILED,
                error: { code: "AUTH_FAILED", message: "Invalid credentials" }
            });
        });

        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor });
        const scenario = createTestScenario([
            new AttackStep({ step_id: "s_fail", action: "SIMULATE_LOGIN" })
        ]);

        const result = await orchestrator.executeScenario(scenario);
        assert.equal(result.status, ExecutionState.FAILED);
        assert.equal(result.error.code, "STEP_EXECUTION_FAILED");
    });

    it("17. fail-fast policy halts subsequent step execution immediately", async () => {
        let step3Executed = false;
        const executor = createMockExecutor(async (step) => {
            if (step.step_id === "s2_fail") {
                return new StepResult({
                    step_id: "s2_fail",
                    status: StepExecutionStatus.FAILED,
                    error: { message: "Payment declined" }
                });
            }
            if (step.step_id === "s3") {
                step3Executed = true;
            }
            return new StepResult({ step_id: step.step_id, status: StepExecutionStatus.COMPLETED });
        });

        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor });
        const scenario = createTestScenario([
            new AttackStep({ step_id: "s1", action: "SIMULATE_LOGIN" }),
            new AttackStep({ step_id: "s2_fail", action: "PERFORM_TRANSACTION", depends_on: ["s1"] }),
            new AttackStep({ step_id: "s3", action: "ADD_BENEFICIARY", depends_on: ["s2_fail"] })
        ]);

        const result = await orchestrator.executeScenario(scenario);
        assert.equal(result.status, ExecutionState.FAILED);
        assert.equal(executor.executedSteps.length, 2, "Only step 1 and 2 should have been attempted");
        assert.equal(step3Executed, false, "Step 3 must not execute after Step 2 failure");
    });

    it("18. previously completed StepResults preserved after step failure", async () => {
        const executor = createMockExecutor(async (step) => {
            if (step.step_id === "s2") {
                return new StepResult({ step_id: "s2", status: StepExecutionStatus.FAILED, error: { message: "err" } });
            }
            return new StepResult({ step_id: step.step_id, status: StepExecutionStatus.COMPLETED });
        });

        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor });
        const scenario = createTestScenario([
            new AttackStep({ step_id: "s1", action: "SIMULATE_LOGIN" }),
            new AttackStep({ step_id: "s2", action: "PERFORM_TRANSACTION" })
        ]);

        const result = await orchestrator.executeScenario(scenario);
        assert.equal(result.step_results.length, 2);
        assert.equal(result.step_results[0].status, StepExecutionStatus.COMPLETED);
        assert.equal(result.step_results[1].status, StepExecutionStatus.FAILED);
    });

    it("19. scenario timestamps populated in ISO-8601", async () => {
        const executor = createMockExecutor();
        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor });

        const scenario = createTestScenario();
        const result = await orchestrator.executeScenario(scenario);

        assert.ok(new Date(result.started_at).getTime() > 0);
        assert.ok(new Date(result.completed_at).getTime() >= new Date(result.started_at).getTime());
    });

    it("20. validation errors preserved in result", async () => {
        const validator = createMockValidator(false, [
            { code: "ERR_1", message: "First error", path: "steps[0]" },
            { code: "ERR_2", message: "Second error", path: "simulation_id" }
        ]);
        const orchestrator = new AttackOrchestrator({ validator });

        const scenario = createTestScenario();
        const result = await orchestrator.executeScenario(scenario);

        assert.equal(result.status, ExecutionState.FAILED);
        assert.equal(result.error.validation_errors.length, 2);
        assert.equal(result.error.validation_errors[0].code, "ERR_1");
    });

    it("21. unexpected executor error handled cleanly", async () => {
        const executor = {
            executeStep: async () => {
                throw new Error("Fatal unhandled crash in executor");
            }
        };

        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor });
        const scenario = createTestScenario();
        const result = await orchestrator.executeScenario(scenario);

        assert.equal(result.status, ExecutionState.FAILED);
        assert.equal(result.error.code, "STEP_EXECUTION_FAILED");
    });

    it("22. orchestrator does not invoke SimulatorClient directly", () => {
        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor: createMockExecutor() });
        assert.equal(orchestrator.simulatorClient, undefined, "Orchestrator must not hold SimulatorClient");
    });

    it("23. orchestrator does not make direct HTTP calls", () => {
        const fs = require("fs");
        const path = require("path");
        const src = fs.readFileSync(path.resolve(__dirname, "../src/orchestrator/AttackOrchestrator.js"), "utf8");

        assert.equal(src.includes("fetch("), false, "Orchestrator must not call fetch directly");
        assert.equal(src.includes("http"), false, "Orchestrator must not import http");
    });

    it("24. orchestrator does not access PostgreSQL/MongoDB", () => {
        const fs = require("fs");
        const path = require("path");
        const src = fs.readFileSync(path.resolve(__dirname, "../src/orchestrator/AttackOrchestrator.js"), "utf8");

        assert.equal(src.includes("postgres"), false);
        assert.equal(src.includes("mongodb"), false);
        assert.equal(src.includes("pool"), false);
    });

    it("25. no arbitrary condition / code execution", () => {
        const fs = require("fs");
        const path = require("path");
        const src = fs.readFileSync(path.resolve(__dirname, "../src/orchestrator/AttackOrchestrator.js"), "utf8");

        assert.equal(src.includes("eval("), false);
        assert.equal(src.includes("Function("), false);
    });

    it("26. abort signal prevents future steps from executing", async () => {
        const controller = new AbortController();
        let step2Executed = false;

        const executor = createMockExecutor(async (step) => {
            if (step.step_id === "s1") {
                controller.abort(); // Abort after step 1
            }
            if (step.step_id === "s2") {
                step2Executed = true;
            }
            return new StepResult({ step_id: step.step_id, status: StepExecutionStatus.COMPLETED });
        });

        const orchestrator = new AttackOrchestrator({ validator: createMockValidator(true), executor });
        const scenario = createTestScenario([
            new AttackStep({ step_id: "s1", action: "SIMULATE_LOGIN" }),
            new AttackStep({ step_id: "s2", action: "REGISTER_DEVICE" })
        ]);

        const result = await orchestrator.executeScenario(scenario, null, { signal: controller.signal });
        assert.equal(result.status, ExecutionState.ABORTED);
        assert.equal(result.step_results.length, 1);
        assert.equal(step2Executed, false);
    });
});
