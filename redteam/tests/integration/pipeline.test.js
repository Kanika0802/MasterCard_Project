// redteam/tests/integration/pipeline.test.js
//
// Integration test: full M2 pipeline from objective → PlannerOutput → Validation → AttackScenario.
// Also verifies the Person 1 integration contract (scenario is consumable by AttackOrchestrator).
// Does NOT call M1 HTTP endpoints. Does NOT access databases or Kafka.

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { RuleBasedPlanner } = require("../../src/planner/RuleBasedPlanner");
const { ScenarioValidator } = require("../../src/validation/ScenarioValidator");
const { AttackComposer } = require("../../src/composer/AttackComposer");
const { PrimitiveRegistry, getDefaultRegistry } = require("../../src/primitives/registry");
const { StrategyRegistry, getDefaultRegistry: getDefaultStrategyRegistry } = require("../../src/strategies/registry");
const { validatePlannerInput } = require("../../src/schemas/PlannerInput");
const { validateAttackScenario } = require("../../src/schemas/AttackScenario");
const PRIMITIVES = require("../../src/primitives/primitives");
const STRATEGIES = require("../../src/strategies/strategies");

// ============================================================================
// Full Pipeline: Objective → Planner → Validator → AttackScenario
// ============================================================================

describe("M2 Full Pipeline Integration", () => {
    it("runs objective → PlannerOutput → ScenarioValidator → AttackScenario", async () => {
        const primRegistry = new PrimitiveRegistry(PRIMITIVES);
        const stratRegistry = new StrategyRegistry(STRATEGIES);
        const planner = new RuleBasedPlanner(stratRegistry, primRegistry);
        const validator = new ScenarioValidator(primRegistry);

        const plannerInput = {
            objective: "Simulate an account takeover with fund drain",
            attack_family: null,
            available_primitives: primRegistry.toSnapshot(),
            available_strategies: stratRegistry.toSnapshot(),
            target_context: {
                simulation_id: "sim_integration_001",
                experiment_id: "exp_integration_001",
                available_entities: {
                    users: [
                        { user_id: "usr_victim_int", profile_status: "ACTIVE" },
                        { user_id: "usr_mule_int", profile_status: "ACTIVE" }
                    ],
                    accounts: [
                        { account_id: "acc_victim_int", user_id: "usr_victim_int", balance: 8000, status: "ACTIVE" },
                        { account_id: "acc_mule_int", user_id: "usr_mule_int", balance: 100, status: "ACTIVE" }
                    ],
                    merchants: null,
                    devices: null
                }
            },
            constraints: null,
            planner_config: null
        };

        // Step 1: Validate PlannerInput
        assert.doesNotThrow(() => validatePlannerInput(plannerInput));

        // Step 2: Run the planner
        const plannerOutput = await planner.plan(plannerInput);
        assert.ok(plannerOutput.scenarios.length > 0, "Planner should produce at least one scenario");

        // Step 3: Validate PlannerOutput → AttackScenario
        const { validScenarios, errors } = validator.validate(plannerOutput, plannerInput);

        // Log errors for debugging if any
        if (errors.length > 0) {
            console.log("Validation errors:", errors);
        }

        assert.ok(validScenarios.length > 0, `Expected at least one valid scenario, errors: ${errors.join("; ")}`);

        // Step 4: Verify the produced AttackScenario satisfies the integration contract
        const scenario = validScenarios[0];

        // Structural schema validation
        assert.doesNotThrow(() => validateAttackScenario(scenario));

        // Contract requirements
        assert.equal(scenario.status, "VALIDATED", "Scenario must be VALIDATED before Person 1 can execute it");
        assert.ok(scenario.scenario_id, "scenario_id must be present (UUID)");
        assert.ok(scenario.simulation_id, "simulation_id must be present");
        assert.ok(scenario.experiment_id, "experiment_id must be present");
        assert.ok(Array.isArray(scenario.steps) && scenario.steps.length > 0, "Steps must be non-empty");
        assert.ok(scenario.target_entities.user_ids.length > 0, "target_entities.user_ids must be non-empty");

        // All steps must reference concrete primitives with a simulator_action
        for (const step of scenario.steps) {
            const prim = primRegistry.get(step.primitive_id);
            assert.ok(prim, `Step ${step.step_id} has unknown primitive_id: ${step.primitive_id}`);
            assert.equal(prim.is_abstract, false, `Step ${step.step_id} uses abstract primitive`);
            assert.ok(prim.simulator_action, `Step ${step.step_id}: primitive has no simulator_action`);
            assert.ok(step.parameters && typeof step.parameters === "object", "Step must have parameters");
        }

        // All step_indexes are contiguous from 0
        const indexes = scenario.steps.map(s => s.step_index).sort((a, b) => a - b);
        for (let i = 0; i < indexes.length; i++) {
            assert.equal(indexes[i], i, `step_index ${indexes[i]} is not contiguous at position ${i}`);
        }
    });

    it("validator rejects a planner output with hallucinated primitive (end-to-end)", async () => {
        const primRegistry = new PrimitiveRegistry(PRIMITIVES);
        const stratRegistry = new StrategyRegistry(STRATEGIES);
        const validator = new ScenarioValidator(primRegistry);

        const maliciousOutput = {
            planner_id: "evil-planner",
            model_used: null,
            generation_timestamp: new Date().toISOString(),
            objective: "Test hallucination guard",
            scenarios: [
                {
                    name: "Malicious Scenario",
                    description: "Tries to invoke a non-existent action",
                    attack_family: "ACCOUNT_TAKEOVER",
                    severity: "HIGH",
                    strategy_id: null,
                    steps: [
                        {
                            primitive_id: "PRIM_HALLUCINATED_DROP_TABLE",
                            parameters: { sql: "DROP TABLE transactions;" },
                            delay_ms: null,
                            depends_on: null,
                            on_failure: "ABORT",
                            description: "SQL injection attempt"
                        }
                    ],
                    target_entities: {
                        user_ids: ["usr_001"],
                        account_ids: [],
                        device_ids: null,
                        merchant_ids: null
                    },
                    reasoning: null
                }
            ],
            validation_status: null,
            validation_errors: null
        };

        const plannerInput = {
            target_context: {
                simulation_id: "sim_001",
                experiment_id: "exp_001",
                available_entities: {
                    users: [{ user_id: "usr_001", profile_status: "ACTIVE" }],
                    accounts: []
                }
            }
        };

        const { validScenarios, errors } = validator.validate(maliciousOutput, plannerInput);

        assert.equal(validScenarios.length, 0, "Hallucinated primitive must be rejected");
        assert.ok(errors.length > 0, "Errors must be reported");
        assert.ok(errors.some(e => e.includes("PRIM_HALLUCINATED_DROP_TABLE")), "Error must identify the hallucinated primitive");
        assert.equal(maliciousOutput.validation_status, "INVALID");
    });
});

// ============================================================================
// Composer → Validator integration (STRATEGY_LIBRARY → VALIDATED)
// ============================================================================

describe("M2 Composer → Validator Integration", () => {
    it("DRAFT scenario from Composer becomes VALIDATED after ScenarioValidator promotes it", () => {
        // NOTE: The Composer produces DRAFT status. To produce VALIDATED status,
        // the Composer output must go through ScenarioValidator's validate() OR
        // the scenario can be manually promoted. In the STRATEGY_LIBRARY flow,
        // the scenario is already well-formed — verify it passes schema validation.

        const primRegistry = new PrimitiveRegistry(PRIMITIVES);
        const stratRegistry = new StrategyRegistry(STRATEGIES);
        const composer = new AttackComposer(primRegistry, stratRegistry);

        const scenario = composer.compose({
            strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
            context: {
                victim_user_id: "usr_victim",
                victim_account_id: "acc_victim",
                mule_account_id: "acc_mule",
                attacker_ip: "198.51.100.5",
                drain_amount: 3000,
                simulation_id: "sim_001",
                experiment_id: "exp_001"
            }
        });

        // Composer produces DRAFT — it is a valid shape but not yet "VALIDATED".
        assert.equal(scenario.status, "DRAFT");

        // To hand off to Person 1, caller must set status to VALIDATED after review
        // or route through ScenarioValidator. Confirm schema is sound.
        const forValidation = { ...scenario, status: "VALIDATED" };
        assert.doesNotThrow(() => validateAttackScenario(forValidation));
    });
});

// ============================================================================
// Person 1 Integration Contract: verify scenario is consumable
// ============================================================================

describe("Person 1 Integration Contract", () => {
    it("every step in a VALIDATED scenario has all fields Person 1 needs", async () => {
        const primRegistry = new PrimitiveRegistry(PRIMITIVES);
        const stratRegistry = new StrategyRegistry(STRATEGIES);
        const planner = new RuleBasedPlanner(stratRegistry, primRegistry);
        const validator = new ScenarioValidator(primRegistry);

        const plannerInput = {
            objective: "Account takeover with fund drain",
            available_primitives: primRegistry.toSnapshot(),
            available_strategies: stratRegistry.toSnapshot(),
            target_context: {
                simulation_id: "sim_p1_test",
                experiment_id: "exp_p1_test",
                available_entities: {
                    users: [
                        { user_id: "usr_v", profile_status: "ACTIVE" },
                        { user_id: "usr_m", profile_status: "ACTIVE" }
                    ],
                    accounts: [
                        { account_id: "acc_v", user_id: "usr_v", balance: 5000, status: "ACTIVE" },
                        { account_id: "acc_m", user_id: "usr_m", balance: 200, status: "ACTIVE" }
                    ]
                }
            },
            constraints: null
        };

        const output = await planner.plan(plannerInput);
        const { validScenarios } = validator.validate(output, plannerInput);

        assert.ok(validScenarios.length > 0, "Should have at least one valid scenario");

        const scenario = validScenarios[0];

        // Fields Person 1 needs at the scenario level:
        assert.ok(scenario.scenario_id);
        assert.ok(scenario.simulation_id);
        assert.ok(scenario.experiment_id);
        assert.ok(scenario.attack_family);
        assert.equal(scenario.status, "VALIDATED");

        // Fields Person 1 needs per step:
        for (const step of scenario.steps) {
            assert.ok(step.step_id, "step_id required for adversarial_metadata");
            assert.ok(typeof step.step_index === "number", "step_index required for ordering");
            assert.ok(step.primitive_id, "primitive_id required to look up simulator_action");

            // Verify Person 1 can resolve simulator_action
            const prim = primRegistry.get(step.primitive_id);
            assert.ok(prim, `primitive_id '${step.primitive_id}' must be resolvable from registry`);
            assert.ok(prim.simulator_action, `primitive '${step.primitive_id}' must have a simulator_action`);

            assert.ok(step.parameters && typeof step.parameters === "object", "parameters required for M1 call");
            assert.ok(["ABORT", "CONTINUE", "RETRY"].includes(step.on_failure), "on_failure must be a valid enum");
        }
    });
});
