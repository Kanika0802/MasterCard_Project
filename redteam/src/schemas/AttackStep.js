// redteam/src/schemas/AttackStep.js
//
// Defines and validates the AttackStep data shape.
// An AttackStep is a single concrete step in an AttackScenario —
// a specific invocation of an AttackPrimitive with concrete parameter values.

"use strict";

const { ValidationError } = require("../../../simulator/src/domain/errors");

const VALID_ON_FAILURE = Object.freeze(["ABORT", "CONTINUE", "RETRY"]);

/**
 * Validates a single AttackStep object (without cross-step or registry checks).
 * Cross-step checks (unique step_id, depends_on references) are done at the scenario level.
 *
 * @param {object} step
 * @returns {object} The validated step (same reference).
 */
function validateAttackStep(step) {
    if (!step || typeof step !== "object") {
        throw new ValidationError("AttackStep must be a non-null object.");
    }

    // --- Identity ---
    if (typeof step.step_id !== "string" || !step.step_id) {
        throw new ValidationError("AttackStep.step_id must be a non-empty string.");
    }

    if (!Number.isInteger(step.step_index) || step.step_index < 0) {
        throw new ValidationError(`AttackStep '${step.step_id}': step_index must be a non-negative integer.`);
    }

    // --- Primitive Reference ---
    if (typeof step.primitive_id !== "string" || !step.primitive_id) {
        throw new ValidationError(`AttackStep '${step.step_id}': primitive_id must be a non-empty string.`);
    }

    // --- Parameters ---
    if (!step.parameters || typeof step.parameters !== "object" || Array.isArray(step.parameters)) {
        throw new ValidationError(`AttackStep '${step.step_id}': parameters must be a non-null object.`);
    }

    // --- Timing ---
    if (step.delay_ms !== null && step.delay_ms !== undefined) {
        if (!Number.isInteger(step.delay_ms) || step.delay_ms < 0) {
            throw new ValidationError(`AttackStep '${step.step_id}': delay_ms must be a non-negative integer or null.`);
        }
    }

    // --- Dependencies ---
    if (step.depends_on !== null && step.depends_on !== undefined) {
        if (!Array.isArray(step.depends_on)) {
            throw new ValidationError(`AttackStep '${step.step_id}': depends_on must be an array or null.`);
        }
        for (const dep of step.depends_on) {
            if (typeof dep !== "string" || !dep) {
                throw new ValidationError(
                    `AttackStep '${step.step_id}': each depends_on entry must be a non-empty string step_id.`
                );
            }
        }
    }

    // --- Failure Handling ---
    const onFailure = step.on_failure || "ABORT";
    if (!VALID_ON_FAILURE.includes(onFailure)) {
        throw new ValidationError(
            `AttackStep '${step.step_id}': on_failure '${step.on_failure}' is invalid. Valid: ${VALID_ON_FAILURE.join(", ")}`
        );
    }

    if (step.max_retries !== null && step.max_retries !== undefined) {
        if (!Number.isInteger(step.max_retries) || step.max_retries < 0) {
            throw new ValidationError(`AttackStep '${step.step_id}': max_retries must be a non-negative integer.`);
        }
    }

    return step;
}

module.exports = {
    validateAttackStep,
    VALID_ON_FAILURE
};
