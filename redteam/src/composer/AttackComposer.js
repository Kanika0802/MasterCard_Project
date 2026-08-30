// redteam/src/composer/AttackComposer.js
//
// AttackComposer — assembles a concrete AttackScenario from an AttackStrategy
// and a caller-supplied context (which maps placeholder variables to real entity IDs).
//
// The Composer:
//  1. Looks up the requested strategy in the StrategyRegistry
//  2. Verifies all required context variables are provided
//  3. Resolves placeholder variables ($variable) in parameter_bindings
//  4. Verifies every referenced primitive in the strategy is concrete (non-abstract)
//  5. Verifies the parameters satisfy each primitive's required_parameters
//  6. Builds a fully-formed AttackScenario with status DRAFT
//  7. Validates the structural shape of the built scenario
//
// The Composer does NOT execute simulator actions.
// The Composer does NOT access PostgreSQL, MongoDB, or Kafka.

"use strict";

const crypto = require("crypto");
const { ValidationError } = require("../../../simulator/src/domain/errors");
const { validateAttackScenario } = require("../schemas/AttackScenario");
const { getDefaultRegistry: getDefaultPrimitiveRegistry } = require("../primitives/registry");
const { getDefaultRegistry: getDefaultStrategyRegistry } = require("../strategies/registry");

class AttackComposer {
    /**
     * @param {import('../primitives/registry').PrimitiveRegistry} primitiveRegistry
     * @param {import('../strategies/registry').StrategyRegistry} strategyRegistry
     */
    constructor(
        primitiveRegistry = getDefaultPrimitiveRegistry(),
        strategyRegistry = getDefaultStrategyRegistry()
    ) {
        this._primitiveRegistry = primitiveRegistry;
        this._strategyRegistry = strategyRegistry;
    }

    /**
     * Compose a concrete AttackScenario from an AttackStrategy and a context object.
     *
     * @param {object} options
     * @param {string} options.strategy_id   - Strategy to use (must be in StrategyRegistry)
     * @param {object} options.context       - Map of variable names → concrete values
     *   Required keys: whatever the strategy's required_context.entities lists, plus
     *   simulation_id and experiment_id.
     * @param {object} [options.overrides]   - Optional per-step overrides (step template id → partial step)
     * @returns {object} A validated AttackScenario with status DRAFT (not yet executed).
     */
    compose({ strategy_id, context = {}, overrides = {} }) {
        // --- 1. Look up the strategy ---
        const strategy = this._strategyRegistry.get(strategy_id);
        if (!strategy) {
            throw new ValidationError(
                `AttackComposer: unknown strategy_id '${strategy_id}'. ` +
                `Available: ${this._strategyRegistry.getAll().map(s => s.strategy_id).join(", ")}`
            );
        }

        // --- 2. Verify required context variables ---
        const missingVars = [];
        for (const varName of strategy.required_context.entities) {
            if (context[varName] === undefined || context[varName] === null) {
                missingVars.push(varName);
            }
        }
        if (strategy.required_context.simulation_id && !context.simulation_id) {
            missingVars.push("simulation_id");
        }
        if (strategy.required_context.experiment_id && !context.experiment_id) {
            missingVars.push("experiment_id");
        }
        if (missingVars.length > 0) {
            throw new ValidationError(
                `AttackComposer: strategy '${strategy_id}' requires context variables: ${missingVars.join(", ")}.`
            );
        }

        // --- 3. Build concrete steps from step templates ---
        const steps = strategy.step_templates.map((tmpl, index) => {
            // Verify primitive is concrete.
            this._primitiveRegistry.assertExecutable(tmpl.primitive_id);

            // Resolve placeholder variables in parameter_bindings.
            const resolvedParams = this._resolveBindings(tmpl.parameter_bindings, context);

            // Apply any caller-supplied overrides for this template step.
            const override = overrides[tmpl.template_step_id] || {};
            const finalParams = { ...resolvedParams, ...(override.parameters || {}) };

            // Verify required parameters are satisfied.
            this._primitiveRegistry.assertParametersSatisfied(tmpl.primitive_id, finalParams);

            // Resolve depends_on references from template_step_id → step_id format.
            const resolvedDependsOn = this._resolveTemplateDepends(
                tmpl.depends_on,
                strategy.step_templates
            );

            return {
                step_id: `step_${String(index).padStart(3, "0")}`,
                step_index: index,
                primitive_id: tmpl.primitive_id,
                parameters: finalParams,
                delay_ms: override.delay_ms !== undefined ? override.delay_ms : (tmpl.delay_ms || null),
                depends_on: resolvedDependsOn,
                on_failure: override.on_failure || tmpl.on_failure || "ABORT",
                max_retries: override.max_retries !== undefined ? override.max_retries : 0,
                description: tmpl.description || null,
                expected_outcome: null
            };
        });

        // --- 4. Build the scenario object ---
        const scenario = {
            scenario_id: crypto.randomUUID(),
            name: context.scenario_name || strategy.name,
            description: context.scenario_description || strategy.description,
            attack_family: strategy.attack_family,
            severity: context.severity || strategy.severity,
            strategy_id: strategy.strategy_id,
            simulation_id: context.simulation_id || "default_sim",
            experiment_id: context.experiment_id || "default_exp",
            target_entities: {
                user_ids: this._collectEntityIds("user_id", context, strategy),
                account_ids: this._collectEntityIds("account_id", context, strategy),
                device_ids: null,
                merchant_ids: null
            },
            steps,
            max_duration_ms: context.max_duration_ms || null,
            requires_seeded_data: context.requires_seeded_data !== undefined
                ? context.requires_seeded_data
                : true,
            generated_by: "STRATEGY_LIBRARY",
            planner_model: null,
            generation_timestamp: new Date().toISOString(),
            status: "DRAFT",
            validation_errors: null,
            version: "1.0.0",
            tags: strategy.tags || null
        };

        // --- 5. Structural validation ---
        validateAttackScenario(scenario);

        return scenario;
    }

    /**
     * Resolve placeholder variables ($varName) in a parameter_bindings object
     * against the supplied context.
     * Non-placeholder values (literals) are passed through unchanged.
     *
     * @param {object} bindings
     * @param {object} context
     * @returns {object} Resolved parameters.
     * @private
     */
    _resolveBindings(bindings, context) {
        const resolved = {};
        for (const [key, value] of Object.entries(bindings)) {
            if (typeof value === "string" && value.startsWith("$")) {
                const varName = value.slice(1); // strip '$'
                const contextValue = context[varName];
                if (contextValue === undefined) {
                    throw new ValidationError(
                        `AttackComposer: parameter binding '$${varName}' not found in context. ` +
                        `Provide '${varName}' in the context object.`
                    );
                }
                resolved[key] = contextValue;
            } else {
                resolved[key] = value;
            }
        }
        return resolved;
    }

    /**
     * Convert template_step_id depends_on references to step_id (step_000) format.
     * @private
     */
    _resolveTemplateDepends(rawDepends, allTemplates) {
        if (!rawDepends || rawDepends.length === 0) return null;
        return rawDepends.map(templateStepId => {
            const idx = allTemplates.findIndex(t => t.template_step_id === templateStepId);
            if (idx === -1) {
                throw new ValidationError(
                    `AttackComposer: template depends_on references unknown template_step_id '${templateStepId}'.`
                );
            }
            return `step_${String(idx).padStart(3, "0")}`;
        });
    }

    /**
     * Collect unique entity IDs of a given type from the context.
     * Looks for context keys ending in 'user_id' or 'account_id'.
     * @private
     */
    _collectEntityIds(suffix, context, strategy) {
        const ids = new Set();
        for (const varName of strategy.required_context.entities) {
            if (varName.endsWith(suffix) && context[varName]) {
                ids.add(context[varName]);
            }
        }
        return Array.from(ids);
    }
}

module.exports = { AttackComposer };
