// red-team/tests/m2EndToEnd.test.js

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { pool } = require("../../simulator/src/config/postgres");
const { connectMongoDB, client } = require("../../simulator/src/config/mongodb");
const { connectKafka, disconnectKafka } = require("../../simulator/src/config/kafka");
const { app } = require("../../simulator/src/server");
const UserService = require("../../simulator/src/application/services/UserService");

const { AttackOrchestrator } = require("../src/orchestrator");
const { AttackPolicyValidator } = require("../src/validator");
const { AttackExecutor } = require("../src/executor");
const { SimulatorClient } = require("../src/simulator-client");
const AttackScenario = require("../src/domain/attack/AttackScenario");
const AttackStep = require("../src/domain/attack/AttackStep");
const AttackTarget = require("../src/domain/attack/AttackTarget");
const ExecutionContext = require("../src/domain/execution/ExecutionContext");
const { ExecutionState, StepExecutionStatus } = require("../src/domain/execution/ExecutionState");

describe("M2 Canonical End-to-End Attack Execution Integration Tests", () => {
    let server;
    let baseUrl;
    let orchestrator;
    let syntheticUser;

    before(async () => {
        await connectMongoDB();
        await connectKafka();

        // 1. Start live in-memory M1 HTTP server
        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, resolve));
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;

        // 2. Initialize real, unmocked M2 pipeline stack
        const simulatorClient = new SimulatorClient({
            baseUrl,
            timeoutMs: 5000,
            maxRetries: 1
        });
        const executor = new AttackExecutor({ simulatorClient });
        const validator = new AttackPolicyValidator();

        orchestrator = new AttackOrchestrator({ validator, executor });

        // 3. Create a synthetic test user in M1 to provide valid target entities
        const userService = new UserService();
        syntheticUser = await userService.createUser({
            first_name: "TargetUser",
            last_name: "E2E",
            email: `target_e2e_${Date.now()}@example.test`,
            phone: "+12025550999",
            date_of_birth: "1990-01-01"
        });
    });

    after(async () => {
        await new Promise(resolve => server.close(resolve));
        await disconnectKafka();
        await pool.end();
        await client.close();
    });

    it("1. Canonical 3-Step Scenario: executes through entire unmocked M2 pipeline to M1", async () => {
        const executionContext = new ExecutionContext({
            execution_id: "exec_canonical_e2e_001",
            scenario_id: "scn_credential_abuse_01",
            simulation_id: "sim_canonical_e2e",
            experiment_id: "exp_canonical_e2e",
            correlation_id: "corr_canonical_001",
            causation_id: "cause_canonical_001",
            metadata: {
                campaign: "synthetic_red_team_baseline",
                attacker_id: "red_agent_alpha"
            }
        });

        // 3-step scenario with dependencies: Probe -> Compromise -> Register Rogue Device
        const scenario = new AttackScenario({
            scenario_id: "scn_credential_abuse_01",
            version: 1,
            objective: "Simulated multi-stage account compromise and device enrollment",
            simulation_id: "sim_canonical_e2e",
            experiment_id: "exp_canonical_e2e",
            target: new AttackTarget({
                entity_type: "user",
                entity_id: syntheticUser.user_id
            }),
            steps: [
                new AttackStep({
                    step_id: "STEP_001_PROBE",
                    primitive_id: "AUTH_CREDENTIAL_STUFF_9",
                    action: "SIMULATE_LOGIN",
                    parameters: {
                        user_id: syntheticUser.user_id,
                        success: false
                    },
                    timeout_ms: 3000
                }),
                new AttackStep({
                    step_id: "STEP_002_COMPROMISE",
                    primitive_id: "AUTH_OTP_INTERCEPT_9",
                    action: "SIMULATE_LOGIN",
                    parameters: {
                        user_id: syntheticUser.user_id,
                        success: true
                    },
                    depends_on: ["STEP_001_PROBE"],
                    timeout_ms: 3000
                }),
                new AttackStep({
                    step_id: "STEP_003_ENROLL_DEVICE",
                    primitive_id: "DEVICE_SPOOF_9",
                    action: "REGISTER_DEVICE",
                    parameters: {
                        user_id: syntheticUser.user_id,
                        device_type: "MOBILE",
                        operating_system: "Android 14",
                        browser: "Chrome Mobile 128",
                        ip_address: "198.51.100.45",
                        device_fingerprint: "fp_e2e_rogue_device_99"
                    },
                    depends_on: ["STEP_002_COMPROMISE"],
                    timeout_ms: 3000
                })
            ],
            metadata: {
                attack_family: "account_takeover"
            }
        });

        // Execute through the complete M2 stack
        const attackResult = await orchestrator.executeScenario(scenario, executionContext);

        // Verify Overall Outcome
        assert.equal(attackResult.execution_id, "exec_canonical_e2e_001");
        assert.equal(attackResult.scenario_id, "scn_credential_abuse_01");
        assert.equal(attackResult.status, ExecutionState.COMPLETED);
        assert.equal(attackResult.isSuccess(), true);
        assert.equal(attackResult.error, null);

        // Verify Step Results Aggregation
        assert.equal(attackResult.step_results.length, 3);

        // Verify Step 1: Probe Login (failed login event)
        const step1 = attackResult.step_results[0];
        assert.equal(step1.step_id, "STEP_001_PROBE");
        assert.equal(step1.status, StepExecutionStatus.COMPLETED);
        assert.ok(step1.latency_ms >= 0);
        assert.equal(step1.simulator_response.action_type, "SIMULATE_LOGIN");
        assert.equal(step1.simulator_response.simulation_id, "sim_canonical_e2e");

        // Verify Step 2: Compromise Login (successful login event)
        const step2 = attackResult.step_results[1];
        assert.equal(step2.step_id, "STEP_002_COMPROMISE");
        assert.equal(step2.status, StepExecutionStatus.COMPLETED);
        assert.equal(step2.simulator_response.action_type, "SIMULATE_LOGIN");

        // Verify Step 3: Register Rogue Device
        const step3 = attackResult.step_results[2];
        assert.equal(step3.step_id, "STEP_003_ENROLL_DEVICE");
        assert.equal(step3.status, StepExecutionStatus.COMPLETED);
        assert.equal(step3.simulator_response.action_type, "REGISTER_DEVICE");
        assert.equal(step3.simulator_response.state_changes[0].entity_type, "device");
    });

    it("2. Dependency Ordering: enforces prerequisites and single execution per step", async () => {
        // Pass steps in scrambled order (Step 2 declared before Step 1)
        const scenario = new AttackScenario({
            scenario_id: "scn_dep_order_01",
            objective: "Verify topological ordering in live execution",
            simulation_id: "sim_canonical_e2e",
            experiment_id: "exp_canonical_e2e",
            steps: [
                new AttackStep({
                    step_id: "STEP_B",
                    action: "SIMULATE_LOGIN",
                    parameters: { user_id: syntheticUser.user_id, success: true },
                    depends_on: ["STEP_A"]
                }),
                new AttackStep({
                    step_id: "STEP_A",
                    action: "SIMULATE_LOGIN",
                    parameters: { user_id: syntheticUser.user_id, success: false },
                    depends_on: []
                })
            ]
        });

        const attackResult = await orchestrator.executeScenario(scenario);

        assert.equal(attackResult.status, ExecutionState.COMPLETED);
        assert.equal(attackResult.step_results.length, 2);

        // STEP_A must have executed before STEP_B
        assert.equal(attackResult.step_results[0].step_id, "STEP_A");
        assert.equal(attackResult.step_results[1].step_id, "STEP_B");
    });

    it("3. Provenance Preservation: propagates execution context to M1 responses", async () => {
        const customCtx = new ExecutionContext({
            execution_id: "exec_prov_999",
            scenario_id: "scn_prov_999",
            simulation_id: "sim_prov_999",
            experiment_id: "exp_prov_999",
            correlation_id: "corr_prov_999",
            causation_id: "cause_prov_999",
            metadata: { operator: "red_ai" }
        });

        const scenario = new AttackScenario({
            scenario_id: "scn_prov_999",
            objective: "Verify provenance propagation",
            simulation_id: "sim_prov_999",
            experiment_id: "exp_prov_999",
            steps: [
                new AttackStep({
                    step_id: "step_prov",
                    primitive_id: "AUTH_OTP_INTERCEPT_9",
                    action: "SIMULATE_LOGIN",
                    parameters: { user_id: syntheticUser.user_id, success: true }
                })
            ]
        });

        const attackResult = await orchestrator.executeScenario(scenario, customCtx);

        assert.equal(attackResult.execution_id, "exec_prov_999");
        assert.equal(attackResult.metadata.operator, "red_ai");

        const response = attackResult.step_results[0].simulator_response;
        assert.equal(response.simulation_id, "sim_prov_999");
        assert.equal(response.experiment_id, "exp_prov_999");
        assert.equal(response.adversarial_metadata.execution_id, "exec_prov_999");
        assert.equal(response.adversarial_metadata.primitive_id, "AUTH_OTP_INTERCEPT_9");
    });

    it("4. Validation Boundary: invalid scenario is rejected before reaching M1", async () => {
        const invalidScenario = {
            scenario_id: "scn_malicious_01",
            objective: "Attempt unauthorized action execution",
            simulation_id: "sim_test",
            experiment_id: "exp_test",
            steps: [
                {
                    step_id: "step_bad",
                    action: "DROP_DATABASE_TABLE",
                    parameters: { table: "users" }
                }
            ]
        };

        const attackResult = await orchestrator.executeScenario(invalidScenario);

        assert.equal(attackResult.status, ExecutionState.FAILED);
        assert.equal(attackResult.error.code, "SCENARIO_VALIDATION_FAILED");
        assert.equal(attackResult.step_results.length, 0, "No steps should have been dispatched");
    });

    it("5. Failure Propagation (Fail-Fast): halts execution and preserves earlier step results", async () => {
        const scenario = new AttackScenario({
            scenario_id: "scn_fail_fast_01",
            objective: "Verify fail-fast policy on step failure",
            simulation_id: "sim_fail_fast",
            experiment_id: "exp_fail_fast",
            steps: [
                new AttackStep({
                    step_id: "step_1_ok",
                    action: "SIMULATE_LOGIN",
                    parameters: { user_id: syntheticUser.user_id, success: true }
                }),
                new AttackStep({
                    step_id: "step_2_fail",
                    action: "REGISTER_DEVICE",
                    parameters: { user_id: "usr_nonexistent_ghost_99999", device_type: "MOBILE" },
                    depends_on: ["step_1_ok"]
                }),
                new AttackStep({
                    step_id: "step_3_skipped",
                    action: "SIMULATE_LOGIN",
                    parameters: { user_id: syntheticUser.user_id, success: true },
                    depends_on: ["step_2_fail"]
                })
            ]
        });

        const attackResult = await orchestrator.executeScenario(scenario);

        assert.equal(attackResult.status, ExecutionState.FAILED);
        assert.equal(attackResult.error.code, "STEP_EXECUTION_FAILED");
        assert.equal(attackResult.error.failed_step_id, "step_2_fail");

        // Step 1 completed, Step 2 failed, Step 3 never ran
        assert.equal(attackResult.step_results.length, 2);
        assert.equal(attackResult.step_results[0].step_id, "step_1_ok");
        assert.equal(attackResult.step_results[0].status, StepExecutionStatus.COMPLETED);

        assert.equal(attackResult.step_results[1].step_id, "step_2_fail");
        assert.equal(attackResult.step_results[1].status, StepExecutionStatus.FAILED);
    });

    it("6. Abort Handling: abort signal halts scenario execution", async () => {
        const abortController = new AbortController();

        const scenario = new AttackScenario({
            scenario_id: "scn_abort_01",
            objective: "Verify abort signal",
            simulation_id: "sim_abort",
            experiment_id: "exp_abort",
            steps: [
                new AttackStep({
                    step_id: "s_pending_1",
                    action: "SIMULATE_LOGIN",
                    parameters: { user_id: syntheticUser.user_id, success: true }
                })
            ]
        });

        // Abort before execution
        abortController.abort();

        const attackResult = await orchestrator.executeScenario(scenario, null, { signal: abortController.signal });

        assert.equal(attackResult.status, ExecutionState.ABORTED);
        assert.equal(attackResult.error.code, "EXECUTION_ABORTED");
        assert.equal(attackResult.step_results.length, 0);
    });
});
