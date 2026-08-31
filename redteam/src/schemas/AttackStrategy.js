// redteam/src/schemas/AttackStrategy.js
//
// Defines and validates the AttackStrategy data shape.
// A strategy is a reusable template that the Composer uses to generate
// concrete AttackScenarios. Strategies are data (not executable logic).

"use strict";

const { ValidationError } = require("../../../simulator/src/domain/errors");
const { VALID_SEVERITY, VALID_GENERATED_BY } = require("./AttackScenario");
const { VALID_ON_FAILURE } = require("./AttackStep");

const STRATEGY_ID_REGEX = /^STRAT_[A-Z0-9_]+$/;

/**
 * Validates a single step template inside an AttackStrategy.
 */
function _validateStepTemplate(tmpl, strategyId) {
    const ctx = `AttackStrategy '${strategyId}' step_template '${tmpl.template_step_id || "?"}'`;

    if (!tmpl || typeof tmpl !== "object") {
        throw new ValidationError(`${ctx}: each step_template must be an object.`);
    }
    if (typeof tmpl.template_step_id !== "string" || !tmpl.template_step_id) {
        throw new ValidationError(`${ctx}: template_step_id must be a non-empty string.`);
    }
    if (typeof tmpl.primitive_id !== "string" || !tmpl.primitive_id) {
        throw new ValidationError(`${ctx}: primitive_id must be a non-empty string.`);
    }
    if (!tmpl.parameter_bindings || typeof tmpl.parameter_bindings !== "object" || Array.isArray(tmpl.parameter_bindings)) {
        throw new ValidationError(`${ctx}: parameter_bindings must be a non-null object.`);
    }

    const onFailure = tmpl.on_failure || "ABORT";
    if (!VALID_ON_FAILURE.includes(onFailure)) {
        throw new ValidationError(`${ctx}: on_failure '${tmpl.on_failure}' is invalid. Valid: ${VALID_ON_FAILURE.join(", ")}`);
    }

    if (tmpl.depends_on !== null && tmpl.depends_on !== undefined) {
        if (!Array.isArray(tmpl.depends_on)) {
            throw new ValidationError(`${ctx}: depends_on must be an array or null.`);
        }
    }
}

/**
 * Validates an AttackStrategy definition object.
 *
 * @param {object} strategy
 * @returns {object} The validated strategy (same reference).
 */
function validateAttackStrategy(strategy) {
    if (!strategy || typeof strategy !== "object") {
        throw new ValidationError("AttackStrategy must be a non-null object.");
    }

    // --- Identity ---
    if (typeof strategy.strategy_id !== "string" || !strategy.strategy_id) {
        throw new ValidationError("AttackStrategy.strategy_id must be a non-empty string.");
    }
    if (!STRATEGY_ID_REGEX.test(strategy.strategy_id)) {
        throw new ValidationError(
            `AttackStrategy.strategy_id '${strategy.strategy_id}' must match pattern STRAT_[A-Z0-9_]+`
        );
    }
    if (typeof strategy.name !== "string" || !strategy.name) {
        throw new ValidationError(`AttackStrategy '${strategy.strategy_id}': name must be a non-empty string.`);
    }
    if (typeof strategy.description !== "string" || !strategy.description) {
        throw new ValidationError(`AttackStrategy '${strategy.strategy_id}': description must be a non-empty string.`);
    }

    // --- Classification ---
    if (typeof strategy.attack_family !== "string" || !strategy.attack_family) {
        throw new ValidationError(`AttackStrategy '${strategy.strategy_id}': attack_family must be a non-empty string.`);
    }
    if (!VALID_SEVERITY.includes(strategy.severity)) {
        throw new ValidationError(
            `AttackStrategy '${strategy.strategy_id}': severity '${strategy.severity}' is invalid. Valid: ${VALID_SEVERITY.join(", ")}`
        );
    }

    // --- Step Templates ---
    if (!Array.isArray(strategy.step_templates) || strategy.step_templates.length === 0) {
        throw new ValidationError(`AttackStrategy '${strategy.strategy_id}': step_templates must be a non-empty array.`);
    }

    const templateIds = strategy.step_templates.map(t => t.template_step_id);
    const uniqueTemplateIds = new Set(templateIds);
    if (uniqueTemplateIds.size !== templateIds.length) {
        throw new ValidationError(`AttackStrategy '${strategy.strategy_id}': step_templates contains duplicate template_step_id values.`);
    }

    for (const tmpl of strategy.step_templates) {
        _validateStepTemplate(tmpl, strategy.strategy_id);
    }

    // depends_on references within templates must be valid
    for (const tmpl of strategy.step_templates) {
        for (const dep of (tmpl.depends_on || [])) {
            if (!uniqueTemplateIds.has(dep)) {
                throw new ValidationError(
                    `AttackStrategy '${strategy.strategy_id}' template '${tmpl.template_step_id}' ` +
                    `depends_on unknown template_step_id '${dep}'.`
                );
            }
        }
    }

    // --- Required Context ---
    if (!strategy.required_context || typeof strategy.required_context !== "object") {
        throw new ValidationError(`AttackStrategy '${strategy.strategy_id}': required_context must be a non-null object.`);
    }
    if (!Array.isArray(strategy.required_context.entities)) {
        throw new ValidationError(`AttackStrategy '${strategy.strategy_id}': required_context.entities must be an array.`);
    }

    // --- Version ---
    if (typeof strategy.version !== "string" || !strategy.version) {
        throw new ValidationError(`AttackStrategy '${strategy.strategy_id}': version must be a non-empty string.`);
    }

    return strategy;
}

module.exports = {
    validateAttackStrategy,
    STRATEGY_ID_REGEX
};
