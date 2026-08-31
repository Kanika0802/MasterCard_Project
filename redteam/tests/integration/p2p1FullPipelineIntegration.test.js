// redteam/tests/integration/p2p1FullPipelineIntegration.test.js
//
// End-to-End Integration Tests proving:
// Planner → ScenarioValidator → ScenarioHandler → P1 AttackPolicyValidator → AttackOrchestrator → AttackExecutor → SimulatorClient → M1
//
// Verifies:
// 1. Full unmocked pipeline from P2 planner generation to live M1 simulator execution.
// 2. Security validation boundary (malicious/unsupported LLM output strictly rejected by P1 AttackPolicyValidator).
// 3. Complete multi-step attack execution against live MongoDB, PostgreSQL, and Kafka.

"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

// Simulator (M1) infrastructure
const { pool } = require("../../../simulator/src/config/postgres");
const { connectMongoDB, client } = require("../../../simulator/src/config/mongodb");
const { connectKafka, disconnectKafka } = require("../../../simulator/src/config/kafka");
const { app } = require("../../../simulator/src/server");
const UserService = require("../../../simulator/src/application/services/UserService");
const AccountService = require("../../../simulator/src/application/services/AccountService");

// P1 Execution Stack
const { AttackOrchestrator } = require("../../../red-team/src/orchestrator");
const { AttackPolicyValidator } = require("../../../red-team/src/validator");
const { AttackExecutor } = require("../../../red-team/src/executor");
const { SimulatorClient } = require("../../../red-team/src/simulator-client");
const { ExecutionState, StepExecutionStatus } = require("../../../red-team/src/domain/execution/ExecutionState");

// P2 Attack Intelligence
const { RuleBasedPlanner } = require("../../src/planner/RuleBasedPlanner");
const { GenAIPlanner } = require("../../src/planner/GenAIPlanner");
const { MockModelProvider } = require("../../src/planner/ModelProvider");
const { ScenarioValidator } = require("../../src/validation/ScenarioValidator");
const { ScenarioHandler } = require("../../src/ScenarioHandler");
const { getDefaultRegistry: getDefaultPrimitiveRegistry } = require("../../src/primitives/registry");

describe("P2 Attack Intelligence → P1 Execution Stack Full Integration", () => {
    let server;
    let baseUrl;
    let orchestrator;
    let policyValidator;
    let scenarioHandler;
    let scenarioValidator;

    async function createTestEntities() {
        const userService = new UserService();
        const accountService = new AccountService();
        const nonce = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const victim = await userService.createUser({
            first_name: "VictimUser",
            last_name: "P2P1",
            email: `victim_${nonce}@example.test`,
            phone: "+12025550101",
            date_of_birth: "1988-03-15"
        });

        const mule = await userService.createUser({
            first_name: "MuleUser",
            last_name: "P2P1",
            email: `mule_${nonce}@example.test`,
            phone: "+12025550102",
            date_of_birth: "1992-07-20"
        });

        const vAcc = await accountService.createAccount({
            user_id: victim.user_id,
            account_type: "CHECKING",
            initial_balance: 10000
        });

        const mAcc = await accountService.createAccount({
            user_id: mule.user_id,
            account_type: "SAVINGS",
            initial_balance: 0
        });

        return { victimUser: victim, muleUser: mule, victimAccount: vAcc, muleAccount: mAcc };
    }

    before(async () => {
        await connectMongoDB();
        await connectKafka();

        // 1. Start live in-memory M1 HTTP server on ephemeral port
        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, resolve));
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;

        // 2. Initialize live P1 execution stack
        const simulatorClient = new SimulatorClient({
            baseUrl,
            timeoutMs: 5000,
            maxRetries: 1
        });
        const executor = new AttackExecutor({ simulatorClient });
        policyValidator = new AttackPolicyValidator();
        orchestrator = new AttackOrchestrator({ validator: policyValidator, executor });

        // 3. Initialize P2 components
        scenarioHandler = new ScenarioHandler();
        scenarioValidator = new ScenarioValidator();
    });

    after(async () => {
        await new Promise(resolve => server.close(resolve));
        await disconnectKafka();
        await pool.end();
        await client.close();
    });

    it("1. Full Pipeline: RuleBasedPlanner → ScenarioValidator → ScenarioHandler → AttackPolicyValidator → AttackOrchestrator → AttackExecutor → SimulatorClient → M1", async () => {
        const { victimUser, muleUser, victimAccount, muleAccount } = await createTestEntities();
        const primitiveRegistry = getDefaultPrimitiveRegistry();
        const planner = new RuleBasedPlanner();

        // Step 1: Planner Input specification
        const plannerInput = {
            objective: "Simulate Account Takeover login, rogue device registration, and mule fund transfer",
            available_primitives: primitiveRegistry.toSnapshot(),
            target_context: {
                simulation_id: "sim_p2p1_full_001",
                experiment_id: "exp_p2p1_full_001",
                available_entities: {
                    users: [
                        { user_id: victimUser.user_id, profile_status: "ACTIVE" },
                        { user_id: muleUser.user_id, profile_status: "ACTIVE" }
                    ],
                    accounts: [
                        { account_id: victimAccount.account_id, user_id: victimUser.user_id, balance: 10000, status: "ACTIVE" },
                        { account_id: muleAccount.account_id, user_id: muleUser.user_id, balance: 0, status: "ACTIVE" }
                    ]
                }
            },
            constraints: {
                max_steps: 10,
                max_total_amount: 5000
            }
        };

        // Step 2: Planner generates raw proposals (PlannerOutput)
        const plannerOutput = await planner.plan(plannerInput);
        assert.ok(plannerOutput);
        assert.ok(Array.isArray(plannerOutput.scenarios));
        assert.ok(plannerOutput.scenarios.length > 0);

        // Step 3: ScenarioValidator validates proposal shape, primitives, and entity cross-references
        const validationResult = scenarioValidator.validate(plannerOutput, plannerInput);
        assert.equal(validationResult.errors.length, 0, `Validation errors: ${validationResult.errors.join(", ")}`);
        assert.equal(validationResult.validScenarios.length, 1);

        const validatedP2Scenario = validationResult.validScenarios[0];
        assert.equal(validatedP2Scenario.status, "VALIDATED");

        // Step 4: ScenarioHandler adapts P2 scenario to canonical P1 domain model
        const p1Scenario = scenarioHandler.toP1Scenario(validatedP2Scenario);
        assert.ok(p1Scenario);
        assert.equal(p1Scenario.scenario_id, validatedP2Scenario.scenario_id);
        assert.equal(p1Scenario.simulation_id, "sim_p2p1_full_001");
        assert.equal(p1Scenario.experiment_id, "exp_p2p1_full_001");
        assert.ok(p1Scenario.steps.length > 0);

        // Step 5: P1 AttackPolicyValidator directly validates the adapted scenario
        const policyCheck = policyValidator.validate(p1Scenario);
        assert.equal(policyCheck.valid, true, `Policy validation failed: ${JSON.stringify(policyCheck.errors)}`);

        // Step 6: Create ExecutionContext via ScenarioHandler
        const executionContext = scenarioHandler.toExecutionContext(validatedP2Scenario, {
            correlation_id: "corr_p2p1_full_001",
            causation_id: "cause_p2p1_full_001"
        });

        // Step 7: Execute through AttackOrchestrator -> AttackExecutor -> SimulatorClient -> M1
        const attackResult = await orchestrator.executeScenario(p1Scenario, executionContext);

        // Step 8: Verify Complete Successful Execution
        assert.equal(attackResult.status, ExecutionState.COMPLETED);
        assert.equal(attackResult.isSuccess(), true);
        assert.equal(attackResult.error, null);
        assert.equal(attackResult.scenario_id, validatedP2Scenario.scenario_id);
        assert.equal(attackResult.step_results.length, p1Scenario.steps.length);

        for (const stepResult of attackResult.step_results) {
            assert.equal(stepResult.status, StepExecutionStatus.COMPLETED);
            assert.ok(stepResult.simulator_response);
            assert.equal(stepResult.simulator_response.success, true);
        }
    });

    it("2. Malicious / Hallucinated LLM Output is Strictly Blocked by P1 AttackPolicyValidator", async () => {
        const { victimUser } = await createTestEntities();

        // Mock LLM output that attempts dangerous actions and policy overrides
        const maliciousModelResponse = {
            scenarios: [
                {
                    name: "Malicious Injection Attack",
                    description: "Attempted SQL injection and shell bypass",
                    attack_family: "ACCOUNT_TAKEOVER",
                    severity: "CRITICAL",
                    strategy_id: null,
                    steps: [
                        {
                            primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                            parameters: {
                                user_id: victimUser.user_id,
                                success: true
                            },
                            delay_ms: null,
                            depends_on: null,
                            on_failure: "ABORT",
                            description: "Login step"
                        }
                    ],
                    target_entities: {
                        user_ids: [victimUser.user_id],
                        account_ids: []
                    }
                }
            ]
        };

        const planner = new GenAIPlanner({
            provider: new MockModelProvider(maliciousModelResponse)
        });

        const input = {
            objective: "Malicious test",
            available_primitives: planner._primitiveRegistry.toSnapshot(),
            target_context: {
                simulation_id: "sim_malicious_001",
                experiment_id: "exp_malicious_001",
                available_entities: {
                    users: [{ user_id: victimUser.user_id, profile_status: "ACTIVE" }],
                    accounts: []
                }
            }
        };

        const { validScenarios } = await planner.planAndValidate(input);
        assert.equal(validScenarios.length, 1);

        const p1Scenario = scenarioHandler.toP1Scenario(validScenarios[0]);

        // Manually inject a forbidden safety override and dangerous shell string to test security gate
        p1Scenario.constraints = { bypass_safety: true, allow_unsafe: true };
        p1Scenario.simulation_id = "https://external-c2-server.evil.com/payload";

        // Execute via Orchestrator — must be blocked by AttackPolicyValidator
        const attackResult = await orchestrator.executeScenario(p1Scenario);

        assert.equal(attackResult.status, ExecutionState.FAILED);
        assert.equal(attackResult.error.code, "SCENARIO_VALIDATION_FAILED");
        assert.ok(attackResult.error.validation_errors.some(e => e.code === "SAFETY_OVERRIDE_REJECTED" || e.code === "DANGEROUS_VALUE_REJECTED"));
        assert.equal(attackResult.step_results.length, 0, "No steps should reach M1 simulator");
    });

    it("3. Multi-Step GenAI Scenario executes to live M1 database and ledger state changes", async () => {
        const { victimUser, muleUser, victimAccount, muleAccount } = await createTestEntities();

        // Deterministic multi-step GenAI scenario: Device Register -> Login -> Add Beneficiary -> Transfer
        const multiStepGenAiResponse = {
            scenarios: [
                {
                    name: "Live Multi-Step ATO and Siphoning",
                    description: "End-to-end ATO and mule payment against live bank state",
                    attack_family: "ACCOUNT_TAKEOVER",
                    severity: "HIGH",
                    strategy_id: null,
                    steps: [
                        {
                            primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                            parameters: {
                                user_id: victimUser.user_id,
                                device_type: "MOBILE",
                                ip_address: "198.51.100.88",
                                operating_system: "iOS 18"
                            },
                            delay_ms: null,
                            depends_on: null,
                            on_failure: "ABORT",
                            description: "Register attacker mobile device"
                        },
                        {
                            primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                            parameters: {
                                user_id: victimUser.user_id,
                                success: true
                            },
                            delay_ms: 100,
                            depends_on: ["step_000"],
                            on_failure: "ABORT",
                            description: "Attacker login from new device"
                        },
                        {
                            primitive_id: "PRIM_ADD_MULE_BENEFICIARY",
                            parameters: {
                                user_id: victimUser.user_id,
                                target_account_id: muleAccount.account_id,
                                nickname: "Mule Beneficiary P2P1"
                            },
                            delay_ms: 200,
                            depends_on: ["step_001"],
                            on_failure: "ABORT",
                            description: "Add mule account as beneficiary"
                        },
                        {
                            primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                            parameters: {
                                sender_account_id: victimAccount.account_id,
                                receiver_account_id: muleAccount.account_id,
                                initiator_user_id: victimUser.user_id,
                                amount: 1500,
                                currency: "USD",
                                transaction_type: "P2P_TRANSFER"
                            },
                            delay_ms: 300,
                            depends_on: ["step_002"],
                            on_failure: "ABORT",
                            description: "Siphon funds to mule"
                        }
                    ],
                    target_entities: {
                        user_ids: [victimUser.user_id],
                        account_ids: [victimAccount.account_id, muleAccount.account_id],
                        device_ids: null,
                        merchant_ids: null
                    }
                }
            ]
        };

        const planner = new GenAIPlanner({
            provider: new MockModelProvider(multiStepGenAiResponse)
        });

        const input = {
            objective: "Drain funds via ATO and mule network",
            available_primitives: planner._primitiveRegistry.toSnapshot(),
            target_context: {
                simulation_id: "sim_p2p1_ato_drain_001",
                experiment_id: "exp_p2p1_ato_drain_001",
                available_entities: {
                    users: [
                        { user_id: victimUser.user_id, profile_status: "ACTIVE" }
                    ],
                    accounts: [
                        { account_id: victimAccount.account_id, user_id: victimUser.user_id, balance: 10000, status: "ACTIVE" },
                        { account_id: muleAccount.account_id, user_id: muleUser.user_id, balance: 0, status: "ACTIVE" }
                    ]
                }
            }
        };

        const { validScenarios } = await planner.planAndValidate(input);
        assert.equal(validScenarios.length, 1);

        const p1Scenario = scenarioHandler.toP1Scenario(validScenarios[0]);
        const executionContext = scenarioHandler.toExecutionContext(validScenarios[0], {
            correlation_id: "corr_ato_live_001"
        });

        const attackResult = await orchestrator.executeScenario(p1Scenario, executionContext);

        assert.equal(attackResult.status, ExecutionState.COMPLETED);
        assert.equal(attackResult.step_results.length, 4);

        // Verify Step 0: Register Device
        assert.equal(attackResult.step_results[0].step_id, "step_000");
        assert.equal(attackResult.step_results[0].simulator_response.action_type, "REGISTER_DEVICE");

        // Verify Step 1: Login
        assert.equal(attackResult.step_results[1].step_id, "step_001");
        assert.equal(attackResult.step_results[1].simulator_response.action_type, "SIMULATE_LOGIN");

        // Verify Step 2: Add Beneficiary
        assert.equal(attackResult.step_results[2].step_id, "step_002");
        assert.equal(attackResult.step_results[2].simulator_response.action_type, "ADD_BENEFICIARY");

        // Verify Step 3: Transfer
        assert.equal(attackResult.step_results[3].step_id, "step_003");
        assert.equal(attackResult.step_results[3].simulator_response.action_type, "PERFORM_TRANSACTION");
        assert.equal(attackResult.step_results[3].simulator_response.success, true);
        assert.ok(attackResult.step_results[3].simulator_response.state_changes.length > 0);
    });

    it("4. Abstract primitive cannot be adapted or executed through P1 stack", async () => {
        const { victimUser } = await createTestEntities();

        const scenarioWithAbstractPrimitive = {
            scenario_id: "11111111-2222-3333-4444-555555555555",
            name: "Abstract Primitive Scenario",
            description: "Uses unimplemented primitive",
            attack_family: "ACCOUNT_TAKEOVER",
            severity: "HIGH",
            strategy_id: null,
            simulation_id: "sim_abstract_001",
            experiment_id: "exp_abstract_001",
            target_entities: {
                user_ids: [victimUser.user_id],
                account_ids: []
            },
            steps: [
                {
                    step_id: "step_000",
                    step_index: 0,
                    primitive_id: "PRIM_OTP_INTERCEPT", // abstract primitive
                    parameters: { user_id: victimUser.user_id },
                    delay_ms: null,
                    depends_on: null,
                    on_failure: "ABORT",
                    max_retries: 0,
                    description: "Intercept OTP"
                }
            ],
            max_duration_ms: null,
            requires_seeded_data: true,
            generated_by: "MANUAL",
            planner_model: null,
            generation_timestamp: "2026-08-31T00:00:00.000Z",
            status: "VALIDATED",
            validation_errors: null,
            version: "1.0.0",
            tags: null
        };

        // ScenarioHandler assertConsumable/toP1Scenario must throw ValidationError
        assert.throws(
            () => scenarioHandler.toP1Scenario(scenarioWithAbstractPrimitive),
            /abstract and has no M1 action backing/
        );
    });

    it("5. LLM attempting to inject fraud labels or circular dependencies is blocked by P1 Validator", async () => {
        const { victimUser } = await createTestEntities();

        const p2Scenario = {
            scenario_id: "22222222-3333-4444-5555-666666666666",
            name: "Circular & Fraud Label Test",
            description: "Test scenario with circular depends_on and fraud labels",
            attack_family: "ACCOUNT_TAKEOVER",
            severity: "MEDIUM",
            strategy_id: null,
            simulation_id: "sim_fraud_cycle_001",
            experiment_id: "exp_fraud_cycle_001",
            target_entities: {
                user_ids: [victimUser.user_id],
                account_ids: []
            },
            steps: [
                {
                    step_id: "step_000",
                    step_index: 0,
                    primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                    parameters: { user_id: victimUser.user_id, success: true },
                    delay_ms: null,
                    depends_on: null,
                    on_failure: "ABORT"
                },
                {
                    step_id: "step_001",
                    step_index: 1,
                    primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                    parameters: { user_id: victimUser.user_id, device_type: "MOBILE" },
                    delay_ms: null,
                    depends_on: ["step_000"],
                    on_failure: "ABORT"
                }
            ],
            generated_by: "MANUAL",
            generation_timestamp: "2026-08-31T00:00:00.000Z",
            status: "VALIDATED",
            version: "1.0.0"
        };

        const p1Scenario = scenarioHandler.toP1Scenario(p2Scenario);

        // 1. Test policy validator rejection of fraud labels
        const p1ScenarioWithFraudLabels = {
            ...p1Scenario,
            metadata: {
                ...p1Scenario.metadata,
                fraud_score: 0.99,
                blue_team_label: "CONFIRMED_FRAUD"
            }
        };

        const fraudValidation = policyValidator.validate(p1ScenarioWithFraudLabels);
        assert.equal(fraudValidation.valid, false);
        assert.ok(fraudValidation.errors.some(e => e.code === "FORBIDDEN_FRAUD_LABEL"));

        // 2. Test orchestrator & validator rejection of circular dependency
        p1Scenario.steps[0].depends_on = ["step_001"];
        p1Scenario.steps[1].depends_on = ["step_000"];

        const attackResult = await orchestrator.executeScenario(p1Scenario);

        assert.equal(attackResult.status, ExecutionState.FAILED);
        assert.equal(attackResult.error.code, "SCENARIO_VALIDATION_FAILED");
        const errorCodes = attackResult.error.validation_errors.map(e => e.code);
        assert.ok(errorCodes.includes("CIRCULAR_DEPENDENCY"));
        assert.equal(attackResult.step_results.length, 0);
    });
});
