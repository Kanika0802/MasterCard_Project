// redteam/src/primitives/registry.js
//
// PrimitiveRegistry — loads, validates, and provides lookup access to all
// attack primitives. Validates each primitive on load; any invalid definition
// causes startup to fail fast rather than silently shipping corrupt data.

"use strict";

const { ValidationError } = require("../../../simulator/src/domain/errors");
const { validateAttackPrimitive } = require("../schemas/AttackPrimitive");
const PRIMITIVE_DEFINITIONS = require("./primitives");

class PrimitiveRegistry {
    constructor(definitions = PRIMITIVE_DEFINITIONS) {
        this._map = new Map();
        this._loadAndValidate(definitions);
    }

    /**
     * Load all primitives, validate each one, and index by primitive_id.
     * Throws ValidationError if any definition is invalid or if duplicate IDs exist.
     */
    _loadAndValidate(definitions) {
        if (!Array.isArray(definitions)) {
            throw new ValidationError("PrimitiveRegistry: definitions must be an array.");
        }
        for (const def of definitions) {
            // Throws on invalid definition.
            validateAttackPrimitive(def);

            if (this._map.has(def.primitive_id)) {
                throw new ValidationError(
                    `PrimitiveRegistry: duplicate primitive_id '${def.primitive_id}'.`
                );
            }
            this._map.set(def.primitive_id, Object.freeze({ ...def }));
        }
    }

    /**
     * Get a primitive by ID.
     * @param {string} primitiveId
     * @returns {object|null} The primitive or null if not found.
     */
    get(primitiveId) {
        return this._map.get(primitiveId) || null;
    }

    /**
     * Get all registered primitives as an array.
     * @returns {object[]}
     */
    getAll() {
        return Array.from(this._map.values());
    }

    /**
     * Get only concrete (non-abstract) primitives.
     * @returns {object[]}
     */
    getConcrete() {
        return this.getAll().filter(p => !p.is_abstract);
    }

    /**
     * Get only abstract primitives (no M1 backing).
     * @returns {object[]}
     */
    getAbstract() {
        return this.getAll().filter(p => p.is_abstract);
    }

    /**
     * Check whether a primitive_id is registered.
     * @param {string} primitiveId
     * @returns {boolean}
     */
    has(primitiveId) {
        return this._map.has(primitiveId);
    }

    /**
     * Assert a primitive exists and is not abstract.
     * Throws ValidationError with a clear message if either condition fails.
     * Used by ScenarioValidator as the safety gate.
     *
     * @param {string} primitiveId
     */
    assertExecutable(primitiveId) {
        const primitive = this._map.get(primitiveId);
        if (!primitive) {
            throw new ValidationError(
                `Unknown primitive_id '${primitiveId}'. ` +
                `Registered primitives: ${Array.from(this._map.keys()).join(", ")}`
            );
        }
        if (primitive.is_abstract) {
            throw new ValidationError(
                `Primitive '${primitiveId}' is abstract and has no M1 action backing. ` +
                `It cannot be executed. Remove it from the scenario or wait for M1 to implement it.`
            );
        }
    }

    /**
     * Validate that an AttackStep's parameters satisfy the primitive's required_parameters.
     * Throws ValidationError listing all missing parameters.
     *
     * @param {string} primitiveId
     * @param {object} parameters - The concrete parameter values from an AttackStep.
     */
    assertParametersSatisfied(primitiveId, parameters) {
        const primitive = this._map.get(primitiveId);
        if (!primitive) {
            throw new ValidationError(`Cannot check parameters: unknown primitive_id '${primitiveId}'.`);
        }

        const missing = [];
        for (const paramDef of primitive.required_parameters) {
            if (parameters[paramDef.name] === undefined || parameters[paramDef.name] === null) {
                missing.push(paramDef.name);
            }
        }
        if (missing.length > 0) {
            throw new ValidationError(
                `AttackStep using primitive '${primitiveId}' is missing required parameters: ${missing.join(", ")}.`
            );
        }
    }

    /**
     * Returns a snapshot of primitives suitable for inclusion in PlannerInput.
     * Includes all primitives (concrete and abstract) so the planner knows the full landscape.
     * @returns {object[]}
     */
    toSnapshot() {
        return this.getAll();
    }

    get size() {
        return this._map.size;
    }
}

// Singleton instance used throughout the redteam module.
let _defaultRegistry = null;

function getDefaultRegistry() {
    if (!_defaultRegistry) {
        _defaultRegistry = new PrimitiveRegistry();
    }
    return _defaultRegistry;
}

module.exports = { PrimitiveRegistry, getDefaultRegistry };
