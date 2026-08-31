// red-team/tests/simulatorClient.test.js

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { SimulatorClient, SimulatorClientError, SimulatorClientErrorCode } = require("../src/simulator-client");

describe("SimulatorClient Unit Tests", () => {
    function createMockFetch(handler) {
        return async (url, options) => {
            return handler(url, options);
        };
    }

    it("1. successful action execution", async () => {
        let called = false;
        const mockFetch = createMockFetch((url, options) => {
            called = true;
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    action_id: "act_101",
                    action_type: "SIMULATE_LOGIN",
                    simulation_id: "sim_01",
                    experiment_id: "exp_01",
                    state_changes: [{ entity_type: "auth_event", entity_id: "ev_1", change: "RECORDED" }],
                    adversarial_metadata: null,
                    error: null
                })
            };
        });

        const client = new SimulatorClient({ baseUrl: "http://simulator.test", fetchFn: mockFetch });
        const result = await client.executeAction({
            action: "SIMULATE_LOGIN",
            simulation_id: "sim_01",
            experiment_id: "exp_01",
            parameters: { user_id: "usr_1" }
        });

        assert.equal(called, true);
        assert.equal(result.success, true);
        assert.equal(result.action_type, "SIMULATE_LOGIN");
        assert.equal(result.state_changes.length, 1);
    });

    it("2. JSON request construction", async () => {
        let sentBody;
        let sentHeaders;
        const mockFetch = createMockFetch((url, options) => {
            sentBody = JSON.parse(options.body);
            sentHeaders = options.headers;
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    action_id: "act_102",
                    action_type: "PERFORM_TRANSACTION",
                    state_changes: []
                })
            };
        });

        const client = new SimulatorClient({ baseUrl: "http://simulator.test", fetchFn: mockFetch });
        await client.executeAction({
            action: "PERFORM_TRANSACTION",
            parameters: { amount: 500, sender_account_id: "acc_1" },
            adversarial_metadata: { tactic: "velocity_spike" }
        });

        assert.equal(sentHeaders["Content-Type"], "application/json");
        assert.equal(sentBody.action, "PERFORM_TRANSACTION");
        assert.equal(sentBody.parameters.amount, 500);
        assert.equal(sentBody.adversarial_metadata.tactic, "velocity_spike");
    });

    it("3. correct URL construction", async () => {
        let requestedUrl;
        const mockFetch = createMockFetch((url) => {
            requestedUrl = url;
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true, action_type: "A", state_changes: [] })
            };
        });

        const client = new SimulatorClient({ baseUrl: "http://simulator.test:8080/prefix///", fetchFn: mockFetch });
        await client.executeAction({ action: "SIMULATE_LOGIN" });

        assert.equal(requestedUrl, "http://simulator.test:8080/prefix/api/v1/simulator/actions");
    });

    it("4. simulation_id propagation", async () => {
        let sentBody;
        const mockFetch = createMockFetch((url, options) => {
            sentBody = JSON.parse(options.body);
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true, action_type: "A", state_changes: [] })
            };
        });

        const client = new SimulatorClient({ baseUrl: "http://simulator.test", fetchFn: mockFetch });
        await client.executeAction({ action: "SIMULATE_LOGIN", simulation_id: "sim_custom_99" });

        assert.equal(sentBody.simulation_id, "sim_custom_99");
    });

    it("5. experiment_id propagation", async () => {
        let sentBody;
        const mockFetch = createMockFetch((url, options) => {
            sentBody = JSON.parse(options.body);
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true, action_type: "A", state_changes: [] })
            };
        });

        const client = new SimulatorClient({ baseUrl: "http://simulator.test", fetchFn: mockFetch });
        await client.executeAction({ action: "SIMULATE_LOGIN", experiment_id: "exp_custom_42" });

        assert.equal(sentBody.experiment_id, "exp_custom_42");
    });

    it("6. correlation_id and causation_id propagation in headers", async () => {
        let sentHeaders;
        const mockFetch = createMockFetch((url, options) => {
            sentHeaders = options.headers;
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true, action_type: "A", state_changes: [] })
            };
        });

        const client = new SimulatorClient({ baseUrl: "http://simulator.test", fetchFn: mockFetch });
        await client.executeAction({
            action: "SIMULATE_LOGIN",
            correlation_id: "corr_123",
            causation_id: "cause_456"
        });

        assert.equal(sentHeaders["X-Correlation-Id"], "corr_123");
        assert.equal(sentHeaders["X-Causation-Id"], "cause_456");
    });

    it("7. timeout handling with AbortError", async () => {
        const mockFetch = createMockFetch(async (url, options) => {
            const error = new Error("The operation was aborted");
            error.name = "AbortError";
            throw error;
        });

        const client = new SimulatorClient({ baseUrl: "http://simulator.test", fetchFn: mockFetch, maxRetries: 0 });
        await assert.rejects(async () => {
            await client.executeAction({ action: "SIMULATE_LOGIN" });
        }, (err) => {
            assert.equal(err.code, SimulatorClientErrorCode.TIMEOUT);
            assert.equal(err.retryable, true);
            return true;
        });
    });

    it("8. network failure normalization", async () => {
        const mockFetch = createMockFetch(async () => {
            throw new Error("connect ECONNREFUSED 127.0.0.1:3000");
        });

        const client = new SimulatorClient({ baseUrl: "http://simulator.test", fetchFn: mockFetch, maxRetries: 0 });
        await assert.rejects(async () => {
            await client.executeAction({ action: "SIMULATE_LOGIN" });
        }, (err) => {
            assert.equal(err.code, SimulatorClientErrorCode.NETWORK_ERROR);
            assert.equal(err.retryable, true);
            return true;
        });
    });

    it("9. 400 response from simulator (non-retryable client error)", async () => {
        const mockFetch = createMockFetch(() => ({
            ok: false,
            status: 400,
            json: async () => ({
                success: false,
                action_type: "SIMULATE_LOGIN",
                error: { code: "VALIDATION_FAILED", message: "Missing required parameter user_id" }
            })
        }));

        const client = new SimulatorClient({ baseUrl: "http://simulator.test", fetchFn: mockFetch, maxRetries: 2 });
        await assert.rejects(async () => {
            await client.executeAction({ action: "SIMULATE_LOGIN" });
        }, (err) => {
            assert.equal(err.status, 400);
            assert.equal(err.code, SimulatorClientErrorCode.SIMULATOR_ERROR);
            assert.equal(err.retryable, false);
            assert.equal(err.message, "Missing required parameter user_id");
            return true;
        });
    });

    it("10. 404 response from simulator", async () => {
        const mockFetch = createMockFetch(() => ({
            ok: false,
            status: 404,
            json: async () => ({
                success: false,
                error: { code: "NOT_FOUND", message: "User not found" }
            })
        }));

        const client = new SimulatorClient({ baseUrl: "http://simulator.test", fetchFn: mockFetch, maxRetries: 1 });
        await assert.rejects(async () => {
            await client.executeAction({ action: "SIMULATE_LOGIN" });
        }, (err) => {
            assert.equal(err.status, 404);
            assert.equal(err.retryable, false);
            return true;
        });
    });

    it("11. 500 internal server response", async () => {
        const mockFetch = createMockFetch(() => ({
            ok: false,
            status: 500,
            json: async () => ({
                success: false,
                error: { code: "INTERNAL_ERROR", message: "Database connection failed" }
            })
        }));

        const client = new SimulatorClient({ baseUrl: "http://simulator.test", fetchFn: mockFetch, maxRetries: 0 });
        await assert.rejects(async () => {
            await client.executeAction({ action: "SIMULATE_LOGIN" });
        }, (err) => {
            assert.equal(err.status, 500);
            assert.equal(err.code, SimulatorClientErrorCode.HTTP_ERROR);
            assert.equal(err.retryable, false); // 500 is internal logic error, not transient 502/503/504
            return true;
        });
    });

    it("12. retryable transient failure (503 Service Unavailable recovering on retry)", async () => {
        let attempts = 0;
        const mockFetch = createMockFetch(() => {
            attempts++;
            if (attempts === 1) {
                return {
                    ok: false,
                    status: 503,
                    json: async () => ({ success: false, error: { message: "Server busy" } })
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true, action_type: "SIMULATE_LOGIN", state_changes: [] })
            };
        });

        const client = new SimulatorClient({ baseUrl: "http://simulator.test", fetchFn: mockFetch, maxRetries: 2, retryDelayMs: 5 });
        const result = await client.executeAction({ action: "SIMULATE_LOGIN" });

        assert.equal(attempts, 2);
        assert.equal(result.success, true);
    });

    it("13. non-retryable failure does not retry", async () => {
        let attempts = 0;
        const mockFetch = createMockFetch(() => {
            attempts++;
            return {
                ok: false,
                status: 400,
                json: async () => ({ success: false, error: { message: "Bad request" } })
            };
        });

        const client = new SimulatorClient({ baseUrl: "http://simulator.test", fetchFn: mockFetch, maxRetries: 3, retryDelayMs: 5 });
        await assert.rejects(async () => {
            await client.executeAction({ action: "SIMULATE_LOGIN" });
        });

        assert.equal(attempts, 1, "Non-retryable 400 should only execute once");
    });

    it("14. retry count limit enforced for transient failures", async () => {
        let attempts = 0;
        const mockFetch = createMockFetch(() => {
            attempts++;
            return {
                ok: false,
                status: 503,
                json: async () => ({ success: false, error: { message: "Unavailable" } })
            };
        });

        const client = new SimulatorClient({ baseUrl: "http://simulator.test", fetchFn: mockFetch, maxRetries: 2, retryDelayMs: 5 });
        await assert.rejects(async () => {
            await client.executeAction({ action: "SIMULATE_LOGIN" });
        });

        assert.equal(attempts, 3, "Max attempts should be 1 initial + 2 retries = 3");
    });

    it("15. idempotency key preservation across retries", async () => {
        const capturedKeys = [];
        let attempts = 0;
        const mockFetch = createMockFetch((url, options) => {
            attempts++;
            capturedKeys.push(options.headers["Idempotency-Key"]);
            if (attempts === 1) {
                return {
                    ok: false,
                    status: 502,
                    json: async () => ({ success: false, error: { message: "Bad Gateway" } })
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true, action_type: "PERFORM_TRANSACTION", state_changes: [] })
            };
        });

        const client = new SimulatorClient({ baseUrl: "http://simulator.test", fetchFn: mockFetch, maxRetries: 2, retryDelayMs: 5 });
        await client.executeAction({
            action: "PERFORM_TRANSACTION",
            idempotency_key: "idem_token_abc"
        });

        assert.equal(capturedKeys.length, 2);
        assert.equal(capturedKeys[0], "idem_token_abc");
        assert.equal(capturedKeys[1], "idem_token_abc");
    });

    it("16. malformed JSON response throws INVALID_RESPONSE", async () => {
        const mockFetch = createMockFetch(() => ({
            ok: true,
            status: 200,
            json: async () => { throw new Error("Unexpected token < in JSON at position 0"); }
        }));

        const client = new SimulatorClient({ baseUrl: "http://simulator.test", fetchFn: mockFetch, maxRetries: 0 });
        await assert.rejects(async () => {
            await client.executeAction({ action: "SIMULATE_LOGIN" });
        }, (err) => {
            assert.equal(err.code, SimulatorClientErrorCode.INVALID_RESPONSE);
            return true;
        });
    });

    it("17. malformed successful response schema throws INVALID_RESPONSE", async () => {
        const mockFetch = createMockFetch(() => ({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                // missing state_changes array
                action_type: "SIMULATE_LOGIN"
            })
        }));

        const client = new SimulatorClient({ baseUrl: "http://simulator.test", fetchFn: mockFetch, maxRetries: 0 });
        await assert.rejects(async () => {
            await client.executeAction({ action: "SIMULATE_LOGIN" });
        }, (err) => {
            assert.equal(err.code, SimulatorClientErrorCode.INVALID_RESPONSE);
            return true;
        });
    });

    it("18. normalized SimulatorClientError structure", async () => {
        const err = new SimulatorClientError({
            message: "Simulation failed",
            code: SimulatorClientErrorCode.SIMULATOR_ERROR,
            status: 422,
            retryable: false,
            details: { reason: "Insufficient balance" }
        });

        assert.equal(err.name, "SimulatorClientError");
        assert.equal(err.isSimulatorClientError, true);
        assert.equal(err.code, "SIMULATOR_ERROR");
        assert.equal(err.status, 422);
        assert.equal(err.retryable, false);
        assert.equal(err.details.reason, "Insufficient balance");

        const json = err.toJSON();
        assert.equal(json.code, "SIMULATOR_ERROR");
    });
});
