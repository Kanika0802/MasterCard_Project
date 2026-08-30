// redteam/src/schemas/AttackScenario.js
//
// Defines and validates the AttackScenario data shape.
// An AttackScenario is the complete validated artifact that Person 2 produces
// and Person 1's AttackOrchestrator consumes.

"use strict";

const { ValidationError } = require("../../../simulator/src/domain/errors");
const { validateAttackStep } = require("./AttackStep");

const VALID_SEVERITY = Object.freeze(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const VALID_STATUS = Object.freeze(["DRAFT", "VALIDATED", "REJECTED"]);
const VALID_GENERATED_BY = Object.freeze(["MANUAL", "GENAI_PLANNER", "STRATEGY_LIBRARY"]);

// UUID v4 regex (relaxed — accepts any valid UUID-like string)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Detects circular dependencies in the step depends_on graph.
 * Returns true if a cycle is detected.
 */
function _hasCyclicDependencies(steps) {
    const stepMap = new Map(steps.map(s => [s.step_id, s.depends_on || []]));

    // DFS-based cycle detection
    const visited = new Set();
    const inStack = new Set();

    function dfs(stepId) {
        if (inStack.has(stepId)) return true;  // cycle
        if (visited.has(stepId)) return false;

        visited.add(stepId);
        inStack.add(stepId);

        for (const dep of (stepMap.get(stepId) || [])) {
            if (dfs(dep)) return true;
        }

        inStack.delete(stepId);
        return false;
    }

    for (const stepId of stepMap.keys()) {
        if (dfs(stepId)) return true;
    }
    return false;
}

/**
 * Validates an AttackScenario object structurally.
 * Registry-level checks (primitive existence, parameter completeness) are done
 * by ScenarioValidator, which has access to the PrimitiveRegistry.
 *
 * @param {object} scenario
 * @returns {object} The validated scenario (same reference).
 */
function validateAttackScenario(scenario) {
    if (!scenario || typeof scenario !== "object") {
        throw new ValidationError("AttackScenario must be a non-null object.");
    }

    // --- Identity ---
    if (typeof scenario.scenario_id !== "string" || !scenario.scenario_id) {
        throw new ValidationError("AttackScenario.scenario_id must be a non-empty string.");
    }
    if (!UUID_REGEX.test(scenario.scenario_id)) {
        throw new ValidationError(`AttackScenario.scenario_id '${scenario.scenario_id}' must be a valid UUID.`);
    }
    if (typeof scenario.name !== "string" || !scenario.name) {
        throw new ValidationError("AttackScenario.name must be a non-empty string.");
    }
    if (typeof scenario.description !== "string" || !scenario.description) {
        throw new ValidationError("AttackScenario.description must be a non-empty string.");
    }

    // --- Classification ---
    if (typeof scenario.attack_family !== "string" || !scenario.attack_family) {
        throw new ValidationError("AttackScenario.attack_family must be a non-empty string.");
    }
    if (!VALID_SEVERITY.includes(scenario.severity)) {
        throw new ValidationError(
            `AttackScenario.severity '${scenario.severity}' is invalid. Valid: ${VALID_SEVERITY.join(", ")}`
        );
    }

    // --- Context ---
    if (typeof scenario.simulation_id !== "string" || !scenario.simulation_id) {
        throw new ValidationError("AttackScenario.simulation_id must be a non-empty string.");
    }
    if (typeof scenario.experiment_id !== "string" || !scenario.experiment_id) {
        throw new ValidationError("AttackScenario.experiment_id must be a non-empty string.");
    }

    // --- Target Entities ---
    if (!scenario.target_entities || typeof scenario.target_entities !== "object") {
        throw new ValidationError("AttackScenario.target_entities must be a non-null object.");
    }
    if (!Array.isArray(scenario.target_entities.user_ids) || scenario.target_entities.user_ids.length === 0) {
        throw new ValidationError("AttackScenario.target_entities.user_ids must be a non-empty array.");
    }
    if (!Array.isArray(scenario.target_entities.account_ids)) {
        throw new ValidationError("AttackScenario.target_entities.account_ids must be an array.");
    }

    // --- Steps ---
    if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
        throw new ValidationError("AttackScenario.steps must be a non-empty array.");
    }

    // Validate each step's shape individually.
    for (const step of scenario.steps) {
        validateAttackStep(step);
    }

    // Unique step_ids
    const stepIds = scenario.steps.map(s => s.step_id);
    const uniqueStepIds = new Set(stepIds);
    if (uniqueStepIds.size !== stepIds.length) {
        throw new ValidationError("AttackScenario.steps contains duplicate step_id values.");
    }

    // step_index must be contiguous starting from 0
    const sortedIndexes = scenario.steps.map(s => s.step_index).sort((a, b) => a - b);
    for (let i = 0; i < sortedIndexes.length; i++) {
        if (sortedIndexes[i] !== i) {
            throw new ValidationError(
                `AttackScenario.steps step_index values must be contiguous starting from 0. ` +
                `Got: ${sortedIndexes.join(", ")}`
            );
        }
    }

    // depends_on references must point to existing step_ids
    for (const step of scenario.steps) {
        for (const dep of (step.depends_on || [])) {
            if (!uniqueStepIds.has(dep)) {
                throw new ValidationError(
                    `AttackStep '${step.step_id}' depends_on unknown step_id '${dep}'.`
                );
            }
            if (dep === step.step_id) {
                throw new ValidationError(
                    `AttackStep '${step.step_id}' cannot depend on itself.`
                );
            }
        }
    }

    // No circular dependencies
    if (_hasCyclicDependencies(scenario.steps)) {
        throw new ValidationError("AttackScenario.steps contains circular depends_on references.");
    }

    // --- Provenance ---
    if (!VALID_GENERATED_BY.includes(scenario.generated_by)) {
        throw new ValidationError(
            `AttackScenario.generated_by '${scenario.generated_by}' is invalid. Valid: ${VALID_GENERATED_BY.join(", ")}`
        );
    }
    if (typeof scenario.generation_timestamp !== "string" || !scenario.generation_timestamp) {
        throw new ValidationError("AttackScenario.generation_timestamp must be a non-empty ISO 8601 string.");
    }

    // --- Status ---
    if (!VALID_STATUS.includes(scenario.status)) {
        throw new ValidationError(
            `AttackScenario.status '${scenario.status}' is invalid. Valid: ${VALID_STATUS.join(", ")}`
        );
    }

    // --- Version ---
    if (typeof scenario.version !== "string" || !scenario.version) {
        throw new ValidationError("AttackScenario.version must be a non-empty string.");
    }

    return scenario;
}

module.exports = {
    validateAttackScenario,
    VALID_SEVERITY,
    VALID_STATUS,
    VALID_GENERATED_BY
};
