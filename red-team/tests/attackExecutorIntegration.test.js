// red-team/tests/attackExecutorIntegration.test.js

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { pool } = require("../../simulator/src/config/postgres");
const { connectMongoDB, client } = require("../../simulator/src/config/mongodb");
const { connectKafka, disconnectKafka } = require("../../simulator/src/config/kafka");
const { app } = require("../../simulator/src/server");

const { AttackExecutor } = require("../src/executor");
const { SimulatorClient } = require("../src/simulator-client");
const AttackStep = require("../src/domain/attack/AttackStep");
const AttackTarget = require("../src/domain/attack/AttackTarget");
const ExecutionContext = require("../src/domain/execution/ExecutionContext");
const { StepExecutionStatus } = require("../src/domain/execution/ExecutionState");

describe("AttackExecutor Integration Tests (AttackStep -> Executor -> SimulatorClient -> M1)", () => {
    let server;
    let executor;

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

        executor = new AttackExecutor({ simulatorClient });
    });

    after(async () => {
        await new Promise(resolve => server.close(resolve));
        await disconnectKafka();
        await pool.end();
        await client.close();
    });

    it("should execute a synthetic SIMULATE_LOGIN attack step against live M1 simulator", async () => {
        const context = new ExecutionContext({
            execution_id: "exec_integ_001",
            scenario_id: "scn_integ_001",
            simulation_id: "sim_integ_01",
            experiment_id: "exp_integ_01",
            metadata: { technique: "T1110" }
        });

        const step = new AttackStep({
            step_id: "step_integ_login",
            primitive_id: "AUTH_CREDENTIAL_STUFF_9",
            action: "SIMULATE_LOGIN",
            target: new AttackTarget({ entity_type: "user", entity_id: "usr_target_integ_1" }),
            parameters: {
                success: true
            }
        });

        const stepResult = await executor.executeStep(step, context);

        assert.equal(stepResult.step_id, "step_integ_login");
        assert.equal(stepResult.status, StepExecutionStatus.COMPLETED);
        assert.equal(stepResult.isSuccess(), true);
        assert.ok(stepResult.latency_ms >= 0);
        assert.ok(stepResult.simulator_response.action_id);
        assert.equal(stepResult.simulator_response.action_type, "SIMULATE_LOGIN");
        assert.equal(stepResult.simulator_response.simulation_id, "sim_integ_01");
        assert.equal(stepResult.simulator_response.state_changes.length, 1);
        assert.equal(stepResult.simulator_response.state_changes[0].entity_type, "auth_event");
    });
});
