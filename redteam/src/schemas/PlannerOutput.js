// redteam/src/schemas/PlannerOutput.js
//
// Defines and validates the PlannerOutput data shape.
// PlannerOutput is the raw structured JSON produced by any planner implementation.
// It is validated by ScenarioValidator before becoming an AttackScenario.
//
// NOTE: The planner sets planner_id, model_used, generation_timestamp, objective, scenarios.
// The validator subsequently sets validation_status and validation_errors.

"use strict";

const { ValidationError } = require("../../../simulator/src/domain/errors");
const { VALID_SEVERITY } = require("./AttackScenario");
const { VALID_ON_FAILURE } = require("./AttackStep");

/**
 * Validates a single raw scenario proposal within PlannerOutput.
 */
function _validateRawScenario(raw, index) {
    const ctx = `PlannerOutput.scenarios[${index}]`;

    if (!raw || typeof raw !== "object") {
        throw new ValidationError(`${ctx} must be an object.`);
    }
    if (typeof raw.name !== "string" || !raw.name) {
        throw new ValidationError(`${ctx}.name must be a non-empty string.`);
    }
    if (typeof raw.description !== "string" || !raw.description) {
        throw new ValidationError(`${ctx}.description must be a non-empty string.`);
    }
    if (typeof raw.attack_family !== "string" || !raw.attack_family) {
        throw new ValidationError(`${ctx}.attack_family must be a non-empty string.`);
    }
    if (!VALID_SEVERITY.includes(raw.severity)) {
        throw new ValidationError(
            `${ctx}.severity '${raw.severity}' is invalid. Valid: ${VALID_SEVERITY.join(", ")}`
        );
    }

    // Steps
    if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
        throw new ValidationError(`${ctx}.steps must be a non-empty array.`);
    }
    for (let si = 0; si < raw.steps.length; si++) {
        const step = raw.steps[si];
        const sctx = `${ctx}.steps[${si}]`;

        if (!step || typeof step !== "object") {
            throw new ValidationError(`${sctx} must be an object.`);
        }
        if (typeof step.primitive_id !== "string" || !step.primitive_id) {
            throw new ValidationError(`${sctx}.primitive_id must be a non-empty string.`);
        }
        if (!step.parameters || typeof step.parameters !== "object" || Array.isArray(step.parameters)) {
            throw new ValidationError(`${sctx}.parameters must be a non-null object.`);
        }
        if (step.on_failure !== null && step.on_failure !== undefined) {
            if (!VALID_ON_FAILURE.includes(step.on_failure)) {
                throw new ValidationError(
                    `${sctx}.on_failure '${step.on_failure}' is invalid. Valid: ${VALID_ON_FAILURE.join(", ")}`
                );
            }
        }
        if (step.depends_on !== null && step.depends_on !== undefined) {
            if (!Array.isArray(step.depends_on)) {
                throw new ValidationError(`${sctx}.depends_on must be an array or null.`);
            }
        }
    }

    // Target entities
    if (!raw.target_entities || typeof raw.target_entities !== "object") {
        throw new ValidationError(`${ctx}.target_entities must be a non-null object.`);
    }
    if (!Array.isArray(raw.target_entities.user_ids) || raw.target_entities.user_ids.length === 0) {
        throw new ValidationError(`${ctx}.target_entities.user_ids must be a non-empty array.`);
    }
    if (!Array.isArray(raw.target_entities.account_ids)) {
        throw new ValidationError(`${ctx}.target_entities.account_ids must be an array.`);
    }
}

/**
 * Validates the structural shape of a PlannerOutput object.
 * Does NOT check primitive registry membership — that is ScenarioValidator's job.
 *
 * @param {object} output
 * @returns {object} The validated output (same reference).
 */
function validatePlannerOutputShape(output) {
    if (!output || typeof output !== "object") {
        throw new ValidationError("PlannerOutput must be a non-null object.");
    }

    if (typeof output.planner_id !== "string" || !output.planner_id) {
        throw new ValidationError("PlannerOutput.planner_id must be a non-empty string.");
    }
    if (typeof output.generation_timestamp !== "string" || !output.generation_timestamp) {
        throw new ValidationError("PlannerOutput.generation_timestamp must be a non-empty ISO 8601 string.");
    }
    if (typeof output.objective !== "string" || !output.objective) {
        throw new ValidationError("PlannerOutput.objective must be a non-empty string.");
    }

    if (!Array.isArray(output.scenarios) || output.scenarios.length === 0) {
        throw new ValidationError("PlannerOutput.scenarios must be a non-empty array.");
    }
    for (let i = 0; i < output.scenarios.length; i++) {
        _validateRawScenario(output.scenarios[i], i);
    }

    return output;
}

module.exports = { validatePlannerOutputShape };
