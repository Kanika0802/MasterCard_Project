// redteam/src/schemas/AttackPrimitive.js
//
// Defines and validates the AttackPrimitive data shape.
// An AttackPrimitive is the smallest unit of attack capability,
// mapping 1:1 to an M1 simulator action (or marked abstract if none exists).
//
// M1 verified actions (from simulator/src/api/controllers/ActionController.js):
//   ADD_BENEFICIARY, PERFORM_TRANSACTION, SIMULATE_LOGIN,
//   REGISTER_DEVICE, UPDATE_KYC, CHANGE_ACCOUNT_STATUS

"use strict";

const { ValidationError } = require("../../../simulator/src/domain/errors");
const { EventType } = require("../../../simulator/src/domain/constants");

// The exact set of M1 simulator actions that currently exist.
const VALID_SIMULATOR_ACTIONS = Object.freeze([
    "ADD_BENEFICIARY",
    "PERFORM_TRANSACTION",
    "SIMULATE_LOGIN",
    "REGISTER_DEVICE",
    "UPDATE_KYC",
    "CHANGE_ACCOUNT_STATUS"
]);

const VALID_CATEGORIES = Object.freeze([
    "IDENTITY",
    "AUTHENTICATION",
    "ACCOUNT",
    "TRANSACTION",
    "DEVICE",
    "KYC"
]);

const PRIMITIVE_ID_REGEX = /^PRIM_[A-Z0-9_]+$/;

// Collect all valid EventType values once for quick lookup.
const VALID_EVENT_TYPES = new Set(Object.values(EventType));

/**
 * Validates a single parameter definition object.
 * @param {object} param
 * @param {string} context - label for error messages
 */
function _validateParamDef(param, context) {
    if (!param || typeof param !== "object") {
        throw new ValidationError(`${context}: each parameter definition must be an object.`);
    }
    if (typeof param.name !== "string" || !param.name) {
        throw new ValidationError(`${context}: parameter definition must have a non-empty 'name' string.`);
    }
    if (typeof param.type !== "string" || !param.type) {
        throw new ValidationError(`${context}: parameter '${param.name}' must have a non-empty 'type' string.`);
    }
    if (typeof param.description !== "string" || !param.description) {
        throw new ValidationError(`${context}: parameter '${param.name}' must have a non-empty 'description' string.`);
    }
}

/**
 * Validates an AttackPrimitive definition object.
 * Throws ValidationError with a descriptive message on any violation.
 *
 * @param {object} primitive - The primitive definition to validate.
 * @returns {object} The validated primitive (same reference).
 */
function validateAttackPrimitive(primitive) {
    if (!primitive || typeof primitive !== "object") {
        throw new ValidationError("AttackPrimitive must be a non-null object.");
    }

    // --- Identity ---
    if (typeof primitive.primitive_id !== "string" || !primitive.primitive_id) {
        throw new ValidationError("AttackPrimitive.primitive_id must be a non-empty string.");
    }
    if (!PRIMITIVE_ID_REGEX.test(primitive.primitive_id)) {
        throw new ValidationError(
            `AttackPrimitive.primitive_id '${primitive.primitive_id}' must match pattern PRIM_[A-Z0-9_]+`
        );
    }
    if (typeof primitive.name !== "string" || !primitive.name) {
        throw new ValidationError(`AttackPrimitive '${primitive.primitive_id}': name must be a non-empty string.`);
    }
    if (typeof primitive.description !== "string" || !primitive.description) {
        throw new ValidationError(`AttackPrimitive '${primitive.primitive_id}': description must be a non-empty string.`);
    }

    // --- is_abstract must be boolean first, drives M1 action rule ---
    if (typeof primitive.is_abstract !== "boolean") {
        throw new ValidationError(`AttackPrimitive '${primitive.primitive_id}': is_abstract must be a boolean.`);
    }

    // --- M1 Mapping ---
    if (primitive.is_abstract) {
        // Abstract primitives have no M1 backing — simulator_action must be null.
        if (primitive.simulator_action !== null && primitive.simulator_action !== undefined) {
            throw new ValidationError(
                `AttackPrimitive '${primitive.primitive_id}': abstract primitives must have simulator_action = null.`
            );
        }
    } else {
        // Concrete primitives must map to a verified M1 action.
        if (typeof primitive.simulator_action !== "string" || !primitive.simulator_action) {
            throw new ValidationError(
                `AttackPrimitive '${primitive.primitive_id}': simulator_action must be a non-empty string for non-abstract primitives.`
            );
        }
        if (!VALID_SIMULATOR_ACTIONS.includes(primitive.simulator_action)) {
            throw new ValidationError(
                `AttackPrimitive '${primitive.primitive_id}': simulator_action '${primitive.simulator_action}' is not a valid M1 action. ` +
                `Valid actions: ${VALID_SIMULATOR_ACTIONS.join(", ")}`
            );
        }
    }

    // --- Category ---
    if (!VALID_CATEGORIES.includes(primitive.category)) {
        throw new ValidationError(
            `AttackPrimitive '${primitive.primitive_id}': category '${primitive.category}' is invalid. ` +
            `Valid: ${VALID_CATEGORIES.join(", ")}`
        );
    }

    // --- attack_family is optional but must be string if present ---
    if (primitive.attack_family !== null && primitive.attack_family !== undefined) {
        if (typeof primitive.attack_family !== "string" || !primitive.attack_family) {
            throw new ValidationError(
                `AttackPrimitive '${primitive.primitive_id}': attack_family must be a non-empty string or null.`
            );
        }
    }

    // --- Parameter Schemas ---
    if (!Array.isArray(primitive.required_parameters) || primitive.required_parameters.length === 0) {
        throw new ValidationError(
            `AttackPrimitive '${primitive.primitive_id}': required_parameters must be a non-empty array.`
        );
    }
    for (const param of primitive.required_parameters) {
        _validateParamDef(param, `AttackPrimitive '${primitive.primitive_id}' required_parameters`);
    }

    if (primitive.optional_parameters !== null && primitive.optional_parameters !== undefined) {
        if (!Array.isArray(primitive.optional_parameters)) {
            throw new ValidationError(
                `AttackPrimitive '${primitive.primitive_id}': optional_parameters must be an array or null.`
            );
        }
        for (const param of primitive.optional_parameters) {
            _validateParamDef(param, `AttackPrimitive '${primitive.primitive_id}' optional_parameters`);
        }
    }

    // --- Expected Events ---
    if (!Array.isArray(primitive.expected_success_events) || primitive.expected_success_events.length === 0) {
        throw new ValidationError(
            `AttackPrimitive '${primitive.primitive_id}': expected_success_events must be a non-empty array.`
        );
    }
    for (const evt of primitive.expected_success_events) {
        if (!VALID_EVENT_TYPES.has(evt)) {
            throw new ValidationError(
                `AttackPrimitive '${primitive.primitive_id}': expected_success_event '${evt}' is not a known M1 EventType.`
            );
        }
    }

    if (!Array.isArray(primitive.expected_failure_events)) {
        throw new ValidationError(
            `AttackPrimitive '${primitive.primitive_id}': expected_failure_events must be an array.`
        );
    }

    // --- Version ---
    if (typeof primitive.version !== "string" || !primitive.version) {
        throw new ValidationError(`AttackPrimitive '${primitive.primitive_id}': version must be a non-empty string.`);
    }

    return primitive;
}

module.exports = {
    validateAttackPrimitive,
    VALID_SIMULATOR_ACTIONS,
    VALID_CATEGORIES,
    PRIMITIVE_ID_REGEX
};
