// red-team/tests/redTeamApiIntegration.test.js

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { pool } = require("../../simulator/src/config/postgres");
const { connectMongoDB, client } = require("../../simulator/src/config/mongodb");
const { connectKafka, disconnectKafka } = require("../../simulator/src/config/kafka");
const { app: simulatorApp } = require("../../simulator/src/server");
const UserService = require("../../simulator/src/application/services/UserService");

const { createRedTeamApp } = require("../src/api");
const { AttackOrchestrator } = require("../src/orchestrator");
const { AttackPolicyValidator } = require("../src/validator");
const { AttackExecutor } = require("../src/executor");
const { SimulatorClient } = require("../src/simulator-client");

describe("Red Team Execution API Integration Tests (HTTP -> RedTeam API -> Orchestrator -> Executor -> SimulatorClient -> M1)", () => {
    let simulatorServer;
    let simulatorBaseUrl;
    let redTeamServer;
    let redTeamBaseUrl;
    let syntheticUser;

    before(async () => {
        await connectMongoDB();
        await connectKafka();

        // 1. Start live in-memory M1 HTTP server
        simulatorServer = http.createServer(simulatorApp);
        await new Promise(resolve => simulatorServer.listen(0, resolve));
        const simPort = simulatorServer.address().port;
        simulatorBaseUrl = `http://localhost:${simPort}`;

        // 2. Setup full real M2 stack
        const simulatorClient = new SimulatorClient({
            baseUrl: simulatorBaseUrl,
            timeoutMs: 5000,
            maxRetries: 1
        });
        const executor = new AttackExecutor({ simulatorClient });
        const validator = new AttackPolicyValidator();
        const orchestrator = new AttackOrchestrator({ validator, executor });

        // 3. Start live Red Team Express API server
        const redTeamApp = createRedTeamApp({ orchestrator });
        redTeamServer = http.createServer(redTeamApp);
        await new Promise(resolve => redTeamServer.listen(0, resolve));
        const redTeamPort = redTeamServer.address().port;
        redTeamBaseUrl = `http://localhost:${redTeamPort}`;

        // 4. Seed a test synthetic user
        const userService = new UserService();
        syntheticUser = await userService.createUser({
            first_name: "APIUser",
            last_name: "Integration",
            email: `api_user_${Date.now()}@example.test`,
            phone: "+12025550111",
            date_of_birth: "1992-05-15"
        });
    });

    after(async () => {
        await new Promise(resolve => redTeamServer.close(resolve));
        await new Promise(resolve => simulatorServer.close(resolve));
        await disconnectKafka();
        await pool.end();
        await client.close();
    });

    it("should execute a multi-step attack scenario over HTTP POST /api/v1/red-team/execute", async () => {
        const payload = {
            scenario: {
                scenario_id: "scn_http_integ_001",
                version: 1,
                objective: "Multi-step attack via HTTP API",
                simulation_id: "sim_http_integ",
                experiment_id: "exp_http_integ",
                target: {
                    entity_type: "user",
                    entity_id: syntheticUser.user_id
                },
                steps: [
                    {
                        step_id: "step_http_auth",
                        primitive_id: "AUTH_CREDENTIAL_STUFF_9",
                        action: "SIMULATE_LOGIN",
                        parameters: {
                            user_id: syntheticUser.user_id,
                            success: true
                        },
                        timeout_ms: 3000
                    },
                    {
                        step_id: "step_http_device",
                        primitive_id: "DEVICE_SPOOF_9",
                        action: "REGISTER_DEVICE",
                        parameters: {
                            user_id: syntheticUser.user_id,
                            device_type: "MOBILE",
                            operating_system: "Android 14"
                        },
                        depends_on: ["step_http_auth"],
                        timeout_ms: 3000
                    }
                ],
                metadata: {
                    source: "http_client_test"
                }
            },
            context: {
                execution_id: "exec_http_999",
                simulation_id: "sim_http_integ",
                experiment_id: "exp_http_integ"
            }
        };

        const response = await fetch(`${redTeamBaseUrl}/api/v1/red-team/execute`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Correlation-Id": "corr_http_999",
                "X-Causation-Id": "cause_http_999"
            },
            body: JSON.stringify(payload)
        });

        assert.equal(response.status, 200);
        const data = await response.json();

        assert.equal(data.execution_id, "exec_http_999");
        assert.equal(data.scenario_id, "scn_http_integ_001");
        assert.equal(data.status, "COMPLETED");
        assert.equal(data.step_results.length, 2);

        // Step 1 check
        assert.equal(data.step_results[0].step_id, "step_http_auth");
        assert.equal(data.step_results[0].status, "COMPLETED");
        assert.equal(data.step_results[0].simulator_response.action_type, "SIMULATE_LOGIN");

        // Step 2 check
        assert.equal(data.step_results[1].step_id, "step_http_device");
        assert.equal(data.step_results[1].status, "COMPLETED");
        assert.equal(data.step_results[1].simulator_response.action_type, "REGISTER_DEVICE");
    });
});
