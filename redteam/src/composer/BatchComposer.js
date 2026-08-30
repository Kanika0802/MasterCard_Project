// redteam/src/composer/BatchComposer.js
//
// BatchComposer — generates multi-scenario experiment variations from strategies
// by performing parameter sweeps, timing variations, or multi-target rotations.
//
// Pure domain logic: does not execute simulator actions or touch databases.

"use strict";

const { AttackComposer } = require("./AttackComposer");
const { getDefaultRegistry: getDefaultPrimitiveRegistry } = require("../primitives/registry");
const { getDefaultRegistry: getDefaultStrategyRegistry } = require("../strategies/registry");
const { ValidationError } = require("../../../simulator/src/domain/errors");

class BatchComposer {
    /**
     * @param {import('../primitives/registry').PrimitiveRegistry} [primitiveRegistry]
     * @param {import('../strategies/registry').StrategyRegistry} [strategyRegistry]
     * @param {AttackComposer} [composer]
     */
    constructor(
        primitiveRegistry = getDefaultPrimitiveRegistry(),
        strategyRegistry = getDefaultStrategyRegistry(),
        composer = null
    ) {
        this._primitiveRegistry = primitiveRegistry;
        this._strategyRegistry = strategyRegistry;
        this._composer = composer || new AttackComposer(this._primitiveRegistry, this._strategyRegistry);
    }

    /**
     * Generate variations of a strategy across a parameter sweep.
     *
     * Example: sweep `drain_amount` across [500, 2500, 7500, 15000].
     *
     * @param {object} options
     * @param {string} options.strategy_id - Strategy ID to use
     * @param {object} options.baseContext - Base context values
     * @param {string} options.sweepParam - The parameter key to vary
     * @param {Array<*>} options.sweepValues - Array of values to sweep through
     * @returns {object[]} Array of composed AttackScenarios
     */
    composeParameterSweep({ strategy_id, baseContext, sweepParam, sweepValues }) {
        if (!strategy_id || typeof strategy_id !== "string") {
            throw new ValidationError("BatchComposer.composeParameterSweep: strategy_id is required.");
        }
        if (!baseContext || typeof baseContext !== "object") {
            throw new ValidationError("BatchComposer.composeParameterSweep: baseContext is required.");
        }
        if (!sweepParam || typeof sweepParam !== "string") {
            throw new ValidationError("BatchComposer.composeParameterSweep: sweepParam is required.");
        }
        if (!Array.isArray(sweepValues) || sweepValues.length === 0) {
            throw new ValidationError("BatchComposer.composeParameterSweep: sweepValues must be a non-empty array.");
        }

        const scenarios = [];
        for (let i = 0; i < sweepValues.length; i++) {
            const val = sweepValues[i];
            const context = {
                ...baseContext,
                [sweepParam]: val,
                scenario_name: `${baseContext.scenario_name || strategy_id} (Variation ${i + 1}: ${sweepParam}=${val})`
            };

            const scenario = this._composer.compose({
                strategy_id,
                context
            });

            scenarios.push(scenario);
        }

        return scenarios;
    }

    /**
     * Generate a batch of scenarios covering all strategies in an attack family.
     *
     * @param {object} options
     * @param {string} options.attack_family - Attack family to generate for
     * @param {object} options.context - Context to supply to all strategies
     * @returns {object[]} Array of composed AttackScenarios
     */
    composeFamilyBatch({ attack_family, context }) {
        if (!attack_family || typeof attack_family !== "string") {
            throw new ValidationError("BatchComposer.composeFamilyBatch: attack_family is required.");
        }

        const strategies = this._strategyRegistry.getByFamily(attack_family);
        if (strategies.length === 0) {
            throw new ValidationError(`BatchComposer.composeFamilyBatch: no strategies found for family '${attack_family}'.`);
        }

        const scenarios = [];
        for (const strategy of strategies) {
            try {
                const scenario = this._composer.compose({
                    strategy_id: strategy.strategy_id,
                    context
                });
                scenarios.push(scenario);
            } catch (err) {
                // If context doesn't satisfy a particular strategy, record error or skip
                continue;
            }
        }

        return scenarios;
    }
}

module.exports = {
    BatchComposer
};
