// redteam/src/schemas/PlannerInput.js
//
// Defines and validates the PlannerInput data shape.
// PlannerInput is the structured object fed into the GenAI Planner.
// It contains the objective, available primitives/strategies, target context, and constraints.

"use strict";

const { ValidationError } = require("../../../simulator/src/domain/errors");

/**
 * Validates an entity summary object (as it appears in available_entities).
 */
function _validateUserSummary(user, index) {
    if (!user || typeof user !== "object") {
        throw new ValidationError(`PlannerInput.target_context.available_entities.users[${index}] must be an object.`);
    }
    if (typeof user.user_id !== "string" || !user.user_id) {
        throw new ValidationError(`PlannerInput.target_context.available_entities.users[${index}]: user_id must be a non-empty string.`);
    }
}

function _validateAccountSummary(account, index) {
    if (!account || typeof account !== "object") {
        throw new ValidationError(`PlannerInput.target_context.available_entities.accounts[${index}] must be an object.`);
    }
    if (typeof account.account_id !== "string" || !account.account_id) {
        throw new ValidationError(`PlannerInput.target_context.available_entities.accounts[${index}]: account_id must be a non-empty string.`);
    }
    if (typeof account.user_id !== "string" || !account.user_id) {
        throw new ValidationError(`PlannerInput.target_context.available_entities.accounts[${index}]: user_id must be a non-empty string.`);
    }
}

/**
 * Validates a PlannerInput object.
 *
 * @param {object} input
 * @returns {object} The validated input (same reference).
 */
function validatePlannerInput(input) {
    if (!input || typeof input !== "object") {
        throw new ValidationError("PlannerInput must be a non-null object.");
    }

    // --- Objective ---
    if (typeof input.objective !== "string" || !input.objective.trim()) {
        throw new ValidationError("PlannerInput.objective must be a non-empty string.");
    }

    // --- Available Primitives ---
    if (!Array.isArray(input.available_primitives) || input.available_primitives.length === 0) {
        throw new ValidationError("PlannerInput.available_primitives must be a non-empty array.");
    }

    // --- Available Strategies (optional) ---
    if (input.available_strategies !== null && input.available_strategies !== undefined) {
        if (!Array.isArray(input.available_strategies)) {
            throw new ValidationError("PlannerInput.available_strategies must be an array or null.");
        }
    }

    // --- Target Context ---
    if (!input.target_context || typeof input.target_context !== "object") {
        throw new ValidationError("PlannerInput.target_context must be a non-null object.");
    }

    const ctx = input.target_context;

    if (typeof ctx.simulation_id !== "string" || !ctx.simulation_id) {
        throw new ValidationError("PlannerInput.target_context.simulation_id must be a non-empty string.");
    }
    if (typeof ctx.experiment_id !== "string" || !ctx.experiment_id) {
        throw new ValidationError("PlannerInput.target_context.experiment_id must be a non-empty string.");
    }

    if (!ctx.available_entities || typeof ctx.available_entities !== "object") {
        throw new ValidationError("PlannerInput.target_context.available_entities must be a non-null object.");
    }

    const ents = ctx.available_entities;

    if (!Array.isArray(ents.users) || ents.users.length === 0) {
        throw new ValidationError("PlannerInput.target_context.available_entities.users must be a non-empty array.");
    }
    for (let i = 0; i < ents.users.length; i++) {
        _validateUserSummary(ents.users[i], i);
    }

    if (!Array.isArray(ents.accounts)) {
        throw new ValidationError("PlannerInput.target_context.available_entities.accounts must be an array.");
    }
    for (let i = 0; i < ents.accounts.length; i++) {
        _validateAccountSummary(ents.accounts[i], i);
    }

    // --- Constraints (optional) ---
    if (input.constraints !== null && input.constraints !== undefined) {
        if (typeof input.constraints !== "object" || Array.isArray(input.constraints)) {
            throw new ValidationError("PlannerInput.constraints must be an object or null.");
        }
        if (input.constraints.max_steps !== null && input.constraints.max_steps !== undefined) {
            if (!Number.isInteger(input.constraints.max_steps) || input.constraints.max_steps < 1) {
                throw new ValidationError("PlannerInput.constraints.max_steps must be a positive integer.");
            }
        }
        if (input.constraints.max_total_amount !== null && input.constraints.max_total_amount !== undefined) {
            if (typeof input.constraints.max_total_amount !== "number" || input.constraints.max_total_amount <= 0) {
                throw new ValidationError("PlannerInput.constraints.max_total_amount must be a positive number.");
            }
        }
    }

    return input;
}

module.exports = { validatePlannerInput };
