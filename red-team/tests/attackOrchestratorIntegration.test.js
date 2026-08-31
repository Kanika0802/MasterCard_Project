// red-team/tests/attackOrchestratorIntegration.test.js

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { pool } = require("../../simulator/src/config/postgres");
const { connectMongoDB, client } = require("../../simulator/src/config/mongodb");
const { connectKafka, disconnectKafka } = require("../../simulator/src/config/kafka");
const { app } = require("../../simulator/src/server");

const { AttackOrchestrator } = require("../src/orchestrator");
const { AttackPolicyValidator } = require("../src/validator");
const { AttackExecutor } = require("../src/executor");
const { SimulatorClient } = require("../src/simulator-client");
const AttackScenario = require("../src/domain/attack/AttackScenario");
const AttackStep = require("../src/domain/attack/AttackStep");
const AttackTarget = require("../src/domain/attack/AttackTarget");
const { ExecutionState, StepExecutionStatus } = require("../src/domain/execution/ExecutionState");

describe("AttackOrchestrator Integration Tests (Scenario -> Validator -> Orchestrator -> Executor -> Client -> M1)", () => {
    let server;
    let orchestrator;

    before(async () => {
        await connectMongoDB();
        await connectKafka();

        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, resolve));
        const port = server.address().port;
        const baseUrl = `http://localhost:${port}`;

        const simulatorClient = new SimulatorClient({
            baseUrl,
            timeoutMs: 5000,
            maxRetries: 1
        });

        const executor = new AttackExecutor({ simulatorClient });
        const validator = new AttackPolicyValidator();

        orchestrator = new AttackOrchestrator({ validator, executor });
    });

    after(async () => {
        await new Promise(resolve => server.close(resolve));
        await disconnectKafka();
        await pool.end();
        await client.close();
    });

    it("should execute a full multi-step attack scenario against live M1 simulator", async () => {
        const scenario = new AttackScenario({
            scenario_id: "scn_full_pipe_001",
            objective: "Multi-step synthetic credential stuffing attack scenario",
            simulation_id: "sim_orch_integ",
            experiment_id: "exp_orch_integ",
            target: new AttackTarget({ entity_type: "user", entity_id: "usr_orch_victim_1" }),
            steps: [
                new AttackStep({
                    step_id: "step_probe",
                    primitive_id: "AUTH_CREDENTIAL_STUFF_9",
                    action: "SIMULATE_LOGIN",
                    parameters: {
                        user_id: "usr_orch_victim_1",
                        success: false
                    },
                    timeout_ms: 3000
                }),
                new AttackStep({
                    step_id: "step_compromise",
                    primitive_id: "AUTH_OTP_INTERCEPT_9",
                    action: "SIMULATE_LOGIN",
                    parameters: {
                        user_id: "usr_orch_victim_1",
                        success: true
                    },
                    depends_on: ["step_probe"],
                    timeout_ms: 3000
                })
            ],
            metadata: {
                attack_family: "credential_abuse"
            }
        });

        const attackResult = await orchestrator.executeScenario(scenario);

        assert.equal(attackResult.scenario_id, "scn_full_pipe_001");
        assert.equal(attackResult.status, ExecutionState.COMPLETED);
        assert.equal(attackResult.isSuccess(), true);
        assert.equal(attackResult.error, null);
        assert.equal(attackResult.step_results.length, 2);

        // Verify Step 1
        assert.equal(attackResult.step_results[0].step_id, "step_probe");
        assert.equal(attackResult.step_results[0].status, StepExecutionStatus.COMPLETED);
        assert.equal(attackResult.step_results[0].simulator_response.action_type, "SIMULATE_LOGIN");

        // Verify Step 2
        assert.equal(attackResult.step_results[1].step_id, "step_compromise");
        assert.equal(attackResult.step_results[1].status, StepExecutionStatus.COMPLETED);
        assert.equal(attackResult.step_results[1].simulator_response.action_type, "SIMULATE_LOGIN");
    });
});
