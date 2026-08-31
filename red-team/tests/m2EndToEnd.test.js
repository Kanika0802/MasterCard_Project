// red-team/tests/m2EndToEnd.test.js

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { pool } = require("../../simulator/src/config/postgres");
const { connectMongoDB, client } = require("../../simulator/src/config/mongodb");
const { connectKafka, disconnectKafka } = require("../../simulator/src/config/kafka");
const { app } = require("../../simulator/src/server");
const UserService = require("../../simulator/src/application/services/UserService");
const AccountService = require("../../simulator/src/application/services/AccountService");

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

    it("7. Dynamic Step Reference Propagation: SIMULATE_LOGIN -> REGISTER_DEVICE -> PERFORM_TRANSACTION with {{steps.spoofed-device-001.device_id}}", async () => {
        const accountService = new AccountService();

        // 1. Seed sender and receiver accounts for the transaction
        const senderAccount = await accountService.createAccount({
            user_id: syntheticUser.user_id,
            initial_balance: 5000.00
        });

        const receiverAccount = await accountService.createAccount({
            user_id: syntheticUser.user_id,
            initial_balance: 100.00
        });

        const executionContext = new ExecutionContext({
            execution_id: "exec_dynamic_ref_e2e_001",
            scenario_id: "ato-device-transfer-001",
            simulation_id: "sim_dynamic_ref_e2e",
            experiment_id: "exp_dynamic_ref_e2e",
            metadata: {
                scenario_name: "ATO Device Spoofing and Dynamic UUID Transaction"
            }
        });

        // 2. Scenario where step 3 dynamically references the device UUID created in step 2
        const scenario = new AttackScenario({
            scenario_id: "ato-device-transfer-001",
            version: 1,
            objective: "Simulate ATO login, register spoofed device, and execute transfer using created device UUID",
            simulation_id: "sim_dynamic_ref_e2e",
            experiment_id: "exp_dynamic_ref_e2e",
            target: new AttackTarget({
                entity_type: "user",
                entity_id: syntheticUser.user_id
            }),
            steps: [
                new AttackStep({
                    step_id: "ato-login-001",
                    primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                    action: "SIMULATE_LOGIN",
                    parameters: {
                        user_id: syntheticUser.user_id,
                        device_id: "attacker-device-001",
                        ip_address: "198.51.100.99",
                        success: true
                    },
                    timeout_ms: 5000
                }),
                new AttackStep({
                    step_id: "spoofed-device-001",
                    primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                    action: "REGISTER_DEVICE",
                    parameters: {
                        user_id: syntheticUser.user_id,
                        device_type: "MOBILE",
                        operating_system: "Android 14",
                        browser: "Adversarial-Test-Agent",
                        ip_address: "198.51.100.99",
                        device_fingerprint: "spoofed-fingerprint-001"
                    },
                    depends_on: ["ato-login-001"],
                    timeout_ms: 5000
                }),
                new AttackStep({
                    step_id: "fraud-transfer-001",
                    primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                    action: "PERFORM_TRANSACTION",
                    parameters: {
                        initiator_user_id: syntheticUser.user_id,
                        sender_account_id: senderAccount.account_id,
                        receiver_account_id: receiverAccount.account_id,
                        amount: 500.00,
                        currency: "USD",
                        channel: "MOBILE_APP",
                        device_id: "{{steps.spoofed-device-001.device_id}}"
                    },
                    depends_on: ["spoofed-device-001"],
                    timeout_ms: 5000
                })
            ]
        });

        // 3. Execute scenario through orchestrator
        const attackResult = await orchestrator.executeScenario(scenario, executionContext);

        // 4. Assert overall success
        assert.equal(attackResult.status, ExecutionState.COMPLETED);
        assert.equal(attackResult.error, null);
        assert.equal(attackResult.step_results.length, 3);

        // Step 1: SIMULATE_LOGIN completed
        const step1 = attackResult.step_results[0];
        assert.equal(step1.step_id, "ato-login-001");
        assert.equal(step1.status, StepExecutionStatus.COMPLETED);
        assert.equal(step1.simulator_response.action_type, "SIMULATE_LOGIN");

        // Step 2: REGISTER_DEVICE completed with real UUID
        const step2 = attackResult.step_results[1];
        assert.equal(step2.step_id, "spoofed-device-001");
        assert.equal(step2.status, StepExecutionStatus.COMPLETED);
        assert.equal(step2.simulator_response.action_type, "REGISTER_DEVICE");

        const registeredDeviceId = step2.simulator_response.state_changes[0].data.device_id;
        assert.ok(registeredDeviceId, "REGISTER_DEVICE must emit a device_id");
        // Verify it matches standard UUID regex
        assert.match(
            registeredDeviceId,
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );

        // Step 3: PERFORM_TRANSACTION completed with the resolved UUID
        const step3 = attackResult.step_results[2];
        assert.equal(step3.step_id, "fraud-transfer-001");
        assert.equal(step3.status, StepExecutionStatus.COMPLETED);
        assert.equal(step3.simulator_response.action_type, "PERFORM_TRANSACTION");

        const txData = step3.simulator_response.state_changes[0].data;
        assert.equal(txData.device_id, registeredDeviceId, "Transaction must use the resolved device UUID");
        assert.equal(txData.sender_account_id, senderAccount.account_id);
        assert.equal(txData.receiver_account_id, receiverAccount.account_id);
        assert.equal(Number(txData.amount), 500.00);
        assert.equal(txData.status, "COMPLETED");
    });
});
