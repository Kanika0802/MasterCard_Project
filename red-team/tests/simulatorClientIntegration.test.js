// red-team/tests/simulatorClientIntegration.test.js

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { pool } = require("../../simulator/src/config/postgres");
const { connectMongoDB, client } = require("../../simulator/src/config/mongodb");
const { connectKafka, disconnectKafka } = require("../../simulator/src/config/kafka");
const { app } = require("../../simulator/src/server");
const { SimulatorClient } = require("../src/simulator-client");

describe("SimulatorClient Integration Tests (M2 -> M1 HTTP Boundary)", () => {
    let server;
    let simulatorClient;

    before(async () => {
        await connectMongoDB();
        await connectKafka();

        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, resolve));
        const port = server.address().port;
        const baseUrl = `http://localhost:${port}`;

        simulatorClient = new SimulatorClient({
            baseUrl,
            timeoutMs: 5000,
            maxRetries: 1
        });
    });

    after(async () => {
        await new Promise(resolve => server.close(resolve));
        await disconnectKafka();
        await pool.end();
        await client.close();
    });

    it("should verify health check against live M1 simulator", async () => {
        const health = await simulatorClient.checkHealth();
        assert.equal(health.status, "ok");
        assert.equal(health.service, "synthetic-banking-simulator");
    });

    it("should execute SIMULATE_LOGIN action through M2 SimulatorClient against M1", async () => {
        const actionResponse = await simulatorClient.executeAction({
            action: "SIMULATE_LOGIN",
            simulation_id: "sim_client_integ",
            experiment_id: "exp_client_integ",
            adversarial_metadata: { provenance: "red_team_integ_test" },
            parameters: {
                user_id: "usr_client_integ_01",
                success: true
            }
        });

        assert.equal(actionResponse.success, true);
        assert.equal(actionResponse.action_type, "SIMULATE_LOGIN");
        assert.equal(actionResponse.simulation_id, "sim_client_integ");
        assert.ok(actionResponse.action_id);
        assert.ok(Array.isArray(actionResponse.state_changes));
        assert.equal(actionResponse.state_changes.length, 1);
        assert.equal(actionResponse.state_changes[0].entity_type, "auth_event");
    });

    it("should handle semantic failure from M1 with normalized SimulatorClientError", async () => {
        await assert.rejects(async () => {
            await simulatorClient.executeAction({
                action: "UNSUPPORTED_ACTION_TYPE",
                parameters: {}
            });
        }, (err) => {
            assert.equal(err.name, "SimulatorClientError");
            assert.equal(err.status, 400);
            assert.equal(err.retryable, false);
            assert.ok(err.message.includes("Unsupported simulator action"));
            return true;
        });
    });
});
