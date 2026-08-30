// redteam/src/strategies/registry.js
//
// StrategyRegistry — loads, validates, and provides lookup access to all
// attack strategies. Validates each strategy definition on load.

"use strict";

const { ValidationError } = require("../../../simulator/src/domain/errors");
const { validateAttackStrategy } = require("../schemas/AttackStrategy");
const STRATEGY_DEFINITIONS = require("./strategies");

class StrategyRegistry {
    constructor(definitions = STRATEGY_DEFINITIONS) {
        this._map = new Map();
        this._loadAndValidate(definitions);
    }

    /**
     * Load all strategies, validate each one, and index by strategy_id.
     */
    _loadAndValidate(definitions) {
        if (!Array.isArray(definitions)) {
            throw new ValidationError("StrategyRegistry: definitions must be an array.");
        }
        for (const def of definitions) {
            validateAttackStrategy(def);

            if (this._map.has(def.strategy_id)) {
                throw new ValidationError(
                    `StrategyRegistry: duplicate strategy_id '${def.strategy_id}'.`
                );
            }
            this._map.set(def.strategy_id, Object.freeze({ ...def }));
        }
    }

    /**
     * Get a strategy by ID.
     * @param {string} strategyId
     * @returns {object|null}
     */
    get(strategyId) {
        return this._map.get(strategyId) || null;
    }

    /**
     * Get all registered strategies.
     * @returns {object[]}
     */
    getAll() {
        return Array.from(this._map.values());
    }

    /**
     * Check whether a strategy_id is registered.
     * @param {string} strategyId
     * @returns {boolean}
     */
    has(strategyId) {
        return this._map.has(strategyId);
    }

    /**
     * Get strategies that match a given attack_family.
     * @param {string} attackFamily
     * @returns {object[]}
     */
    getByFamily(attackFamily) {
        return this.getAll().filter(s => s.attack_family === attackFamily);
    }

    /**
     * Returns a snapshot suitable for inclusion in PlannerInput.
     * @returns {object[]}
     */
    toSnapshot() {
        return this.getAll();
    }

    get size() {
        return this._map.size;
    }
}

// Singleton instance.
let _defaultRegistry = null;

function getDefaultRegistry() {
    if (!_defaultRegistry) {
        _defaultRegistry = new StrategyRegistry();
    }
    return _defaultRegistry;
}

module.exports = { StrategyRegistry, getDefaultRegistry };
