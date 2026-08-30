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

const { ValidationError } = require("../../simulator/src/domain/errors");
const { validateAttackScenario, VALID_STATUS } = require("./schemas/AttackScenario");
const { getDefaultRegistry: getDefaultPrimitiveRegistry } = require("./primitives/registry");

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
}

module.exports = { ScenarioHandler, SUPPORTED_SCENARIO_VERSION };
