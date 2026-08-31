// redteam/src/ScenarioHandler.js
//
// ScenarioHandler — the clean integration facade for Person 1.
//
// Person 1's AttackOrchestrator should only interact with this class.
// It provides:
//   1. toActionRequest(scenario, step) → the exact body for POST /api/v1/simulator/actions
//   2. assertConsumable(scenario)      → validates a scenario is safe to execute
//   3. resolveSimulatorAction(primitiveId) → maps primitive_id → M1 simulator_action
//
// Person 1 does NOT need to import PrimitiveRegistry, ScenarioValidator,
// or any other M2 internal directly.

"use strict";

const crypto = require("crypto");
const { ValidationError } = require("../../simulator/src/domain/errors");
const { validateAttackScenario, VALID_STATUS } = require("./schemas/AttackScenario");
const { getDefaultRegistry: getDefaultPrimitiveRegistry } = require("./primitives/registry");

// P1 Domain Models for adapter translation
const AttackScenario = require("../../red-team/src/domain/attack/AttackScenario");
const AttackStep = require("../../red-team/src/domain/attack/AttackStep");
const AttackTarget = require("../../red-team/src/domain/attack/AttackTarget");
const ExecutionContext = require("../../red-team/src/domain/execution/ExecutionContext");

// The only supported schema version Person 1 can consume.
const SUPPORTED_SCENARIO_VERSION = "1.0.0";

class ScenarioHandler {
    /**
     * @param {import('./primitives/registry').PrimitiveRegistry} primitiveRegistry
     */
    constructor(primitiveRegistry = getDefaultPrimitiveRegistry()) {
        this._registry = primitiveRegistry;
    }

    /**
     * Assert that a scenario is safe to hand off to Person 1's AttackOrchestrator.
     *
     * Checks:
     *   - Structural schema is valid
     *   - status === "VALIDATED"
     *   - version is supported
     *   - All step primitive_ids exist and are concrete (not abstract)
     *
     * @param {object} scenario - The AttackScenario to validate.
     * @throws {ValidationError} with a clear message if any check fails.
     */
    assertConsumable(scenario) {
        // 1. Structural schema check.
        validateAttackScenario(scenario);

        // 2. Must be VALIDATED — not DRAFT or REJECTED.
        if (scenario.status !== "VALIDATED") {
            throw new ValidationError(
                `AttackScenario '${scenario.scenario_id}' has status '${scenario.status}'. ` +
                `Only status 'VALIDATED' scenarios may be executed. ` +
                `Run the scenario through ScenarioValidator before handing off to Person 1.`
            );
        }

        // 3. Schema version check.
        if (scenario.version !== SUPPORTED_SCENARIO_VERSION) {
            throw new ValidationError(
                `AttackScenario '${scenario.scenario_id}' has unsupported version '${scenario.version}'. ` +
                `Supported version: '${SUPPORTED_SCENARIO_VERSION}'.`
            );
        }

        // 4. Every step must reference a concrete (non-abstract) primitive.
        for (const step of scenario.steps) {
            this._registry.assertExecutable(step.primitive_id);
        }
    }

    /**
     * Build the exact request body for POST /api/v1/simulator/actions
     * for a given step in the scenario.
     *
     * Person 1 calls this for each step — it never needs to construct
     * adversarial_metadata or resolve simulator_action manually.
     *
     * @param {object} scenario - A VALIDATED AttackScenario.
     * @param {object} step     - One step from scenario.steps.
     * @returns {object} The full request body for POST /api/v1/simulator/actions.
     * @throws {ValidationError} if the primitive cannot be resolved or is abstract.
     */
    toActionRequest(scenario, step) {
        this._registry.assertExecutable(step.primitive_id);
        const primitive = this._registry.get(step.primitive_id);

        return {
            action: primitive.simulator_action,
            simulation_id: scenario.simulation_id,
            experiment_id: scenario.experiment_id,
            adversarial_metadata: {
                attack_scenario_id: scenario.scenario_id,
                primitive_id: step.primitive_id,
                step_id: step.step_id,
                attack_family: scenario.attack_family,
                generated_by: scenario.generated_by
            },
            parameters: { ...step.parameters }
        };
    }

    /**
     * Resolve a primitive_id to its M1 simulator_action string.
     * Convenience method for Person 1 if it needs the action name directly.
     *
     * @param {string} primitiveId
     * @returns {string} The M1 simulator_action (e.g. "ADD_BENEFICIARY").
     * @throws {ValidationError} if the primitive is unknown or abstract.
     */
    resolveSimulatorAction(primitiveId) {
        this._registry.assertExecutable(primitiveId);
        return this._registry.get(primitiveId).simulator_action;
    }

    /**
     * Return the steps of a scenario sorted by step_index (ascending).
     * Utility for Person 1's orchestrator to iterate in the correct order.
     *
     * @param {object} scenario - A VALIDATED AttackScenario.
     * @returns {object[]} Steps sorted by step_index.
     */
    getSortedSteps(scenario) {
        return [...scenario.steps].sort((a, b) => a.step_index - b.step_index);
    }

    /**
     * Convert a validated P2 AttackScenario into a canonical P1 AttackScenario domain instance.
     *
     * Performs:
     *   - Validation assertion via assertConsumable(scenario)
     *   - Mapping of semver version -> integer version
     *   - Objective resolution from scenario.objective || scenario.description || scenario.name
     *   - Focal target extraction from target_entities (preserving full entities in metadata)
     *   - Step transformation: resolves primitive_id -> action, normalizes depends_on array and timeout_ms
     *   - Structured metadata and constraints consolidation
     *
     * @param {object} scenario - A VALIDATED P2 AttackScenario
     * @returns {AttackScenario} Canonical P1 AttackScenario domain model instance
     * @throws {ValidationError} if scenario fails consumable assertion
     */
    toP1Scenario(scenario) {
        this.assertConsumable(scenario);

        const sortedSteps = this.getSortedSteps(scenario);

        // Derive primary focal target if available
        let target = null;
        if (scenario.target) {
            target = scenario.target instanceof AttackTarget ? scenario.target : AttackTarget.fromJSON(scenario.target);
        } else if (scenario.target_entities?.user_ids?.length > 0) {
            target = new AttackTarget({
                entity_type: "user",
                entity_id: scenario.target_entities.user_ids[0]
            });
        } else if (scenario.target_entities?.account_ids?.length > 0) {
            target = new AttackTarget({
                entity_type: "account",
                entity_id: scenario.target_entities.account_ids[0]
            });
        } else if (scenario.target_entities?.merchant_ids?.length > 0) {
            target = new AttackTarget({
                entity_type: "merchant",
                entity_id: scenario.target_entities.merchant_ids[0]
            });
        } else if (scenario.target_entities?.device_ids?.length > 0) {
            target = new AttackTarget({
                entity_type: "device",
                entity_id: scenario.target_entities.device_ids[0]
            });
        }

        // Map steps to P1 AttackStep instances
        const p1Steps = sortedSteps.map(step => {
            const action = step.action || this.resolveSimulatorAction(step.primitive_id);
            const dependsOn = Array.isArray(step.depends_on) ? [...step.depends_on] : [];
            const timeoutMs = typeof step.timeout_ms === "number" && step.timeout_ms > 0
                ? step.timeout_ms
                : (typeof step.delay_ms === "number" && step.delay_ms > 0 ? Math.max(step.delay_ms + 5000, 5000) : 5000);

            return new AttackStep({
                step_id: step.step_id,
                primitive_id: step.primitive_id || null,
                action,
                parameters: { ...step.parameters },
                target: step.target ? (step.target instanceof AttackTarget ? step.target : AttackTarget.fromJSON(step.target)) : null,
                depends_on: dependsOn,
                condition: step.condition || null,
                timeout_ms: timeoutMs
            });
        });

        // Parse integer version
        let version = 1;
        if (typeof scenario.version === "number") {
            version = scenario.version;
        } else if (typeof scenario.version === "string") {
            const parsed = parseInt(scenario.version.split(".")[0], 10);
            if (!isNaN(parsed) && parsed > 0) version = parsed;
        }

        const objective = scenario.objective || scenario.description || scenario.name;

        const metadata = {
            attack_family: scenario.attack_family,
            severity: scenario.severity,
            strategy_id: scenario.strategy_id || null,
            generated_by: scenario.generated_by || "GENAI_PLANNER",
            planner_model: scenario.planner_model || null,
            generation_timestamp: scenario.generation_timestamp || new Date().toISOString(),
            status: scenario.status,
            target_entities: scenario.target_entities || null,
            tags: scenario.tags || null,
            ...(scenario.metadata || {})
        };

        const constraints = {
            max_duration_ms: scenario.max_duration_ms || null,
            requires_seeded_data: scenario.requires_seeded_data || false,
            ...(scenario.constraints || {})
        };

        return new AttackScenario({
            scenario_id: scenario.scenario_id,
            version,
            objective,
            simulation_id: scenario.simulation_id,
            experiment_id: scenario.experiment_id,
            target,
            steps: p1Steps,
            constraints,
            metadata
        });
    }

    /**
     * Create an ExecutionContext initialized for this scenario.
     *
     * @param {object} scenario - A VALIDATED P2 AttackScenario or P1 AttackScenario
     * @param {object} [overrides={}] - Optional context field overrides
     * @returns {ExecutionContext}
     */
    toExecutionContext(scenario, overrides = {}) {
        const scenarioId = scenario.scenario_id;
        const simulationId = scenario.simulation_id;
        const experimentId = scenario.experiment_id;

        return new ExecutionContext({
            execution_id: overrides.execution_id || crypto.randomUUID(),
            scenario_id: scenarioId,
            simulation_id: simulationId,
            experiment_id: experimentId,
            correlation_id: overrides.correlation_id || null,
            causation_id: overrides.causation_id || null,
            metadata: {
                ...(scenario.metadata || {}),
                ...(overrides.metadata || {})
            }
        });
    }
}

module.exports = { ScenarioHandler, SUPPORTED_SCENARIO_VERSION };
