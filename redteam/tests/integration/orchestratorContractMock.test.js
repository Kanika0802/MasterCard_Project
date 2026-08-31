// redteam/tests/integration/orchestratorContractMock.test.js
//
// Mock Contract Test: verifies how Person 1's AttackOrchestrator will consume
// the AttackScenario and ScenarioHandler interface under various execution conditions.
// Does NOT implement or modify Person 1's actual orchestrator.

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { ScenarioHandler } = require("../../src/ScenarioHandler");
const { GenAIPlanner } = require("../../src/planner/GenAIPlanner");
const { MockModelProvider } = require("../../src/planner/ModelProvider");
const { ScenarioValidator } = require("../../src/validation/ScenarioValidator");
const { ValidationError } = require("../../../simulator/src/domain/errors");

/**
 * Lightweight mock orchestrator runner strictly for testing contract handoff.
 */
class MockOrchestratorHarness {
    constructor(handler = new ScenarioHandler(), mockSimulatorActionHandler = null) {
        this.handler = handler;
        this.simulatorHandler = mockSimulatorActionHandler || (async (req) => ({
            success: true,
            action_id: "act_" + Math.random().toString(36).substring(2, 9),
            action_type: req.action,
            state_changes: [{ entity: "mock", id: "1" }],
            adversarial_metadata: req.adversarial_metadata
        }));
    }

    async executeScenario(scenario) {
        // Step 1: Pre-flight validation gate
        this.handler.assertConsumable(scenario);

        const executionLog = [];
        const sortedSteps = this.handler.getSortedSteps(scenario);

        for (const step of sortedSteps) {
            const actionRequest = this.handler.toActionRequest(scenario, step);
            let attempts = 0;
            let success = false;
            let lastResult = null;
            const maxAttempts = (step.max_retries || 0) + 1;

            while (attempts < maxAttempts && !success) {
                attempts++;
                lastResult = await this.simulatorHandler(actionRequest, step);
                success = lastResult.success === true;
            }

            executionLog.push({
                step_id: step.step_id,
                step_index: step.step_index,
                action: actionRequest.action,
                attempts,
                success,
                result: lastResult
            });

            if (!success) {
                if (step.on_failure === "ABORT") {
                    break;
                }
            }
        }

        return {
            scenario_id: scenario.scenario_id,
            total_steps: sortedSteps.length,
            executed_steps: executionLog.length,
            completed: executionLog.length === sortedSteps.length && executionLog.every(e => e.success),
            log: executionLog
        };
    }
}

describe("Person 1 Mock Orchestrator Contract Integration", () => {
    const validModelResponse = {
        scenarios: [
            {
                name: "Multi-Step Account Takeover Contract Test",
                description: "Tests step handoff to Person 1 orchestrator",
                attack_family: "ACCOUNT_TAKEOVER",
                severity: "HIGH",
                strategy_id: null,
                steps: [
                    {
                        primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                        parameters: { user_id: "usr_v_001", device_type: "MOBILE" },
                        delay_ms: null,
                        depends_on: null,
                        on_failure: "ABORT",
                        description: "Step 0"
                    },
                    {
                        primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                        parameters: { user_id: "usr_v_001", success: true },
                        delay_ms: 100,
                        depends_on: ["step_000"],
                        on_failure: "ABORT",
                        description: "Step 1"
                    },
                    {
                        primitive_id: "PRIM_ADD_MULE_BENEFICIARY",
                        parameters: { user_id: "usr_v_001", target_account_id: "acc_m_001" },
                        delay_ms: 200,
                        depends_on: ["step_001"],
                        on_failure: "CONTINUE",
                        description: "Step 2"
                    },
                    {
                        primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                        parameters: {
                            sender_account_id: "acc_v_001",
                            receiver_account_id: "acc_m_001",
                            initiator_user_id: "usr_v_001",
                            amount: 2500
                        },
                        delay_ms: 500,
                        depends_on: ["step_002"],
                        on_failure: "ABORT",
                        description: "Step 3"
                    }
                ],
                target_entities: {
                    user_ids: ["usr_v_001"],
                    account_ids: ["acc_v_001", "acc_m_001"],
                    device_ids: null,
                    merchant_ids: null
                }
            }
        ]
    };

    it("successfully runs complete 4-step scenario via ScenarioHandler", async () => {
        const planner = new GenAIPlanner({
            provider: new MockModelProvider(validModelResponse)
        });

        const input = {
            objective: "ATO test",
            available_primitives: planner._primitiveRegistry.toSnapshot(),
            target_context: {
                simulation_id: "sim_test_001",
                experiment_id: "exp_test_001",
                available_entities: {
                    users: [{ user_id: "usr_v_001", profile_status: "ACTIVE" }],
                    accounts: [
                        { account_id: "acc_v_001", user_id: "usr_v_001", balance: 5000, status: "ACTIVE" },
                        { account_id: "acc_m_001", user_id: "usr_m_001", balance: 0, status: "ACTIVE" }
                    ]
                }
            }
        };

        const { validScenarios } = await planner.planAndValidate(input);
        assert.equal(validScenarios.length, 1);

        const harness = new MockOrchestratorHarness();
        const executionResult = await harness.executeScenario(validScenarios[0]);

        assert.equal(executionResult.completed, true);
        assert.equal(executionResult.total_steps, 4);
        assert.equal(executionResult.executed_steps, 4);

        // Verify adversarial_metadata is attached to each step call
        for (const log of executionResult.log) {
            assert.ok(log.result.adversarial_metadata);
            assert.equal(log.result.adversarial_metadata.attack_scenario_id, validScenarios[0].scenario_id);
            assert.equal(log.result.adversarial_metadata.attack_family, "ACCOUNT_TAKEOVER");
        }
    });

    it("honors on_failure: ABORT and stops subsequent steps", async () => {
        const planner = new GenAIPlanner({
            provider: new MockModelProvider(validModelResponse)
        });

        const input = {
            objective: "ATO test",
            available_primitives: planner._primitiveRegistry.toSnapshot(),
            target_context: {
                simulation_id: "sim_test_001",
                experiment_id: "exp_test_001",
                available_entities: {
                    users: [{ user_id: "usr_v_001", profile_status: "ACTIVE" }],
                    accounts: [
                        { account_id: "acc_v_001", user_id: "usr_v_001", balance: 5000, status: "ACTIVE" },
                        { account_id: "acc_m_001", user_id: "usr_m_001", balance: 0, status: "ACTIVE" }
                    ]
                }
            }
        };

        const { validScenarios } = await planner.planAndValidate(input);
        const scenario = validScenarios[0];

        // Simulator mock that fails on step 1 (LOGIN)
        const harness = new MockOrchestratorHarness(new ScenarioHandler(), async (req, step) => {
            if (step.primitive_id === "PRIM_ACCOUNT_TAKEOVER_LOGIN") {
                return { success: false, error: "AUTH_FAILED" };
            }
            return { success: true, adversarial_metadata: req.adversarial_metadata };
        });

        const result = await harness.executeScenario(scenario);

        assert.equal(result.completed, false);
        // Step 0 succeeded, Step 1 failed with on_failure: ABORT -> total executed = 2
        assert.equal(result.executed_steps, 2);
        assert.equal(result.log[0].success, true);
        assert.equal(result.log[1].success, false);
    });

    it("honors on_failure: CONTINUE and proceeds with subsequent steps", async () => {
        const scenario = {
            scenario_id: "99999999-8888-7777-6666-555555555555",
            name: "Continue Policy Scenario",
            description: "Step 0 fails but continues",
            attack_family: "ACCOUNT_TAKEOVER",
            severity: "HIGH",
            strategy_id: null,
            simulation_id: "sim_cont_01",
            experiment_id: "exp_cont_01",
            target_entities: {
                user_ids: ["usr_001"],
                account_ids: ["acc_001"],
                device_ids: null,
                merchant_ids: null
            },
            steps: [
                {
                    step_id: "step_000",
                    step_index: 0,
                    primitive_id: "PRIM_SIMULATE_FAILED_LOGIN",
                    parameters: { user_id: "usr_001" },
                    delay_ms: null,
                    depends_on: null,
                    on_failure: "CONTINUE",
                    max_retries: 0,
                    description: "Failed login"
                },
                {
                    step_id: "step_001",
                    step_index: 1,
                    primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                    parameters: { user_id: "usr_001", success: true },
                    delay_ms: null,
                    depends_on: ["step_000"],
                    on_failure: "ABORT",
                    max_retries: 0,
                    description: "Successful login"
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

        const harness = new MockOrchestratorHarness(new ScenarioHandler(), async (req, step) => {
            if (step.step_id === "step_000") {
                return { success: false, error: "FAILED" };
            }
            return { success: true, adversarial_metadata: req.adversarial_metadata };
        });

        const result = await harness.executeScenario(scenario);

        assert.equal(result.executed_steps, 2);
        assert.equal(result.log[0].success, false);
        assert.equal(result.log[1].success, true);
    });

    it("rejects execution if scenario status is not VALIDATED", async () => {
        const draftScenario = {
            scenario_id: "12345678-1234-1234-1234-123456789abc",
            name: "Draft scenario",
            description: "Not validated",
            attack_family: "ACCOUNT_TAKEOVER",
            severity: "HIGH",
            strategy_id: null,
            simulation_id: "sim_1",
            experiment_id: "exp_1",
            target_entities: { user_ids: ["usr_1"], account_ids: [] },
            steps: [{
                step_id: "step_000",
                step_index: 0,
                primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                parameters: { user_id: "usr_1", success: true },
                on_failure: "ABORT"
            }],
            generated_by: "MANUAL",
            generation_timestamp: "2026-08-31T00:00:00Z",
            status: "DRAFT",
            version: "1.0.0"
        };

        const harness = new MockOrchestratorHarness();
        await assert.rejects(
            () => harness.executeScenario(draftScenario),
            ValidationError
        );
    });
});
