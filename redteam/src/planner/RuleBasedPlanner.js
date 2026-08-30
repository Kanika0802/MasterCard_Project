// redteam/src/planner/RuleBasedPlanner.js
//
// RuleBasedPlanner — a deterministic, dependency-free planner implementation.
//
// This planner:
//  - Requires NO external API keys or GenAI credentials.
//  - Is fully testable and produces predictable output.
//  - Selects strategies based on keyword matching in the objective.
//  - Falls back to a sensible default when no matching strategy is found.
//
// When a GenAI provider becomes available, implement GenAIPlanner.js
// extending PlannerInterface with the same contract.
//
// This planner is the REFERENCE implementation for M2 testing.

"use strict";

const crypto = require("crypto");
const { PlannerInterface } = require("./PlannerInterface");
const { getDefaultRegistry: getDefaultStrategyRegistry } = require("../strategies/registry");
const { getDefaultRegistry: getDefaultPrimitiveRegistry } = require("../primitives/registry");
const { ValidationError } = require("../../../simulator/src/domain/errors");

// Keyword-to-attack-family mapping for intent detection.
const FAMILY_KEYWORDS = {
    ACCOUNT_TAKEOVER: [
        "ato", "account takeover", "takeover", "stolen credentials", "brute force",
        "credential", "login", "unauthorized access", "hijack", "session", "atm", "cash-out"
    ],
    MULE_NETWORK: [
        "mule", "beneficiary", "fund siphoning", "drain", "transfer", "money transfer", "launder"
    ],
    VELOCITY_ABUSE: [
        "velocity", "rapid", "split", "structuring", "multiple transfer", "volume", "frequency"
    ],
    IDENTITY_FRAUD: [
        "kyc", "identity", "synthetic id", "fake identity", "document", "verification bypass"
    ],
    MERCHANT_FRAUD: [
        "merchant", "pos", "point of sale", "e-commerce", "collusion", "unauthorized purchase"
    ]
};

class RuleBasedPlanner extends PlannerInterface {
    /**
     * @param {import('../strategies/registry').StrategyRegistry} strategyRegistry
     * @param {import('../primitives/registry').PrimitiveRegistry} primitiveRegistry
     */
    constructor(
        strategyRegistry = getDefaultStrategyRegistry(),
        primitiveRegistry = getDefaultPrimitiveRegistry()
    ) {
        super();
        this._strategyRegistry = strategyRegistry;
        this._primitiveRegistry = primitiveRegistry;
    }

    get name() {
        return "rule-based-planner-v1";
    }

    /**
     * Generate scenario proposals based on the objective in PlannerInput.
     *
     * @param {object} plannerInput - Validated PlannerInput.
     * @returns {Promise<object>} PlannerOutput
     */
    async plan(plannerInput) {
        const { objective, target_context, constraints } = plannerInput;

        // Detect the most relevant attack family from the objective text.
        const detectedFamily = this._detectAttackFamily(objective);

        // Find matching strategies; fall back to all strategies if the detected family has none.
        let candidateStrategies = detectedFamily
            ? this._strategyRegistry.getByFamily(detectedFamily)
            : this._strategyRegistry.getAll();

        if (candidateStrategies.length === 0) {
            // Detected family has no dedicated strategy — fall back to all available strategies.
            candidateStrategies = this._strategyRegistry.getAll();
        }

        if (candidateStrategies.length === 0) {
            throw new ValidationError(
                `RuleBasedPlanner: no strategies are registered. Add at least one strategy to the StrategyRegistry.`
            );
        }

        // Select the first matching strategy (prioritize by severity if constrained).
        const selectedStrategy = this._selectStrategy(candidateStrategies, constraints);

        // Build one scenario proposal from the selected strategy using the available entities.
        const rawScenario = this._buildRawScenario(selectedStrategy, target_context, constraints, objective);

        return {
            planner_id: this.name,
            model_used: null,
            generation_timestamp: new Date().toISOString(),
            objective,
            scenarios: [rawScenario],
            // These are set by ScenarioValidator after validation.
            validation_status: null,
            validation_errors: null,
            // Internal fields used by ScenarioValidator to inject simulation context.
            _simulation_id: target_context.simulation_id,
            _experiment_id: target_context.experiment_id
        };
    }

    /**
     * Detect the most relevant attack family from the objective string.
     * @private
     */
    _detectAttackFamily(objective) {
        const lower = objective.toLowerCase();
        let bestFamily = null;
        let bestScore = 0;

        for (const [family, keywords] of Object.entries(FAMILY_KEYWORDS)) {
            const score = keywords.filter(kw => lower.includes(kw)).length;
            if (score > bestScore) {
                bestScore = score;
                bestFamily = family;
            }
        }
        return bestFamily;
    }

    /**
     * Select the best strategy from candidates, respecting severity constraints.
     * @private
     */
    _selectStrategy(candidates, constraints) {
        const severityRange = constraints?.severity_range;
        if (severityRange && severityRange.length > 0) {
            const filtered = candidates.filter(s => severityRange.includes(s.severity));
            if (filtered.length > 0) return filtered[0];
        }
        return candidates[0];
    }

    /**
     * Build a raw scenario proposal from the selected strategy and available entities.
     * Binds real entity IDs to placeholder variables using a simple heuristic.
     * @private
     */
    _buildRawScenario(strategy, targetContext, constraints, objective) {
        const { available_entities, simulation_id, experiment_id } = targetContext;
        const users = available_entities.users || [];
        const accounts = available_entities.accounts || [];

        // Simple entity assignment: pick the first user as victim,
        // last user/account as mule when there are multiple.
        const victimUser = users[0] || null;
        const muleUser = users.length > 1 ? users[users.length - 1] : users[0];
        const victimAccounts = accounts.filter(a => a.user_id === victimUser?.user_id);
        const muleAccounts = accounts.filter(a => a.user_id === muleUser?.user_id && a !== victimAccounts[0]);

        const victimAccount = victimAccounts[0] || null;
        const muleAccount = muleAccounts[0] || accounts.find(a => a !== victimAccount) || null;

        const merchants = available_entities.merchants || [];
        const merchant = merchants[0] || { merchant_id: "mch_synthetic_001" };

        // Build context map matching the strategy's required variables.
        const context = {
            simulation_id,
            experiment_id
        };

        // Resolve known variable names heuristically.
        for (const varName of strategy.required_context.entities) {
            if (varName.includes("victim_user")) context[varName] = victimUser?.user_id || null;
            else if (varName.includes("victim_account")) context[varName] = victimAccount?.account_id || null;
            else if (varName.includes("mule_account")) context[varName] = muleAccount?.account_id || null;
            else if (varName.includes("dormant_account")) context[varName] = victimAccount?.account_id || null;
            else if (varName.includes("mule_user")) context[varName] = muleUser?.user_id || null;
            else if (varName.includes("target_merchant")) context[varName] = merchant?.merchant_id || "mch_synthetic_001";
            else if (varName.includes("kyc_id")) context[varName] = null; // abstract, skip
            else if (varName.includes("target_user")) context[varName] = victimUser?.user_id || null;
            else if (varName.includes("target_account")) context[varName] = victimAccount?.account_id || null;
            else if (varName.includes("target_kyc")) context[varName] = null;
            else if (varName.includes("attacker_ip")) context[varName] = "198.51.100.99";
            else if (varName.includes("drain_amount") || varName.includes("transfer_amount") || varName.includes("payment_amount"))
                context[varName] = this._calcAmount(victimAccount, constraints);
            else if (varName.includes("cash_amount") || varName.includes("split_amount"))
                context[varName] = Math.round(this._calcAmount(victimAccount, constraints) / 2);
            else context[varName] = null;
        }

        // Build steps by resolving bindings.
        const steps = strategy.step_templates
            .filter(tmpl => {
                // Skip templates that need null required parameters (e.g., kyc_id for abstract).
                const primitive = this._primitiveRegistry.get(tmpl.primitive_id);
                if (!primitive || primitive.is_abstract) return false;
                return true;
            })
            .map((tmpl, index) => {
                const params = {};
                for (const [key, value] of Object.entries(tmpl.parameter_bindings)) {
                    if (typeof value === "string" && value.startsWith("$")) {
                        params[key] = context[value.slice(1)];
                    } else {
                        params[key] = value;
                    }
                }
                return {
                    primitive_id: tmpl.primitive_id,
                    parameters: params,
                    delay_ms: tmpl.delay_ms || null,
                    depends_on: null, // Simplified — sequential ordering
                    on_failure: tmpl.on_failure || "ABORT",
                    description: tmpl.description || null
                };
            });

        // Collect target entity IDs from resolved context.
        const userIds = [...new Set(
            [context.victim_user_id, context.target_user_id, context.mule_user_id]
                .filter(Boolean)
        )];
        const accountIds = [...new Set(
            [context.victim_account_id, context.target_account_id, context.mule_account_id]
                .filter(Boolean)
        )];

        return {
            name: strategy.name,
            description: `${strategy.description}\n\nObjective: ${objective}`,
            attack_family: strategy.attack_family,
            severity: strategy.severity,
            strategy_id: strategy.strategy_id,
            steps,
            target_entities: {
                user_ids: userIds.length > 0 ? userIds : [victimUser?.user_id].filter(Boolean),
                account_ids: accountIds,
                device_ids: null,
                merchant_ids: null
            },
            reasoning: `Selected strategy '${strategy.strategy_id}' for attack family '${strategy.attack_family}' ` +
                `based on objective analysis. Victim: ${victimUser?.user_id}, ` +
                `Mule account: ${muleAccount?.account_id}.`
        };
    }

    /**
     * Calculate a reasonable transaction amount within any max_total_amount constraint.
     * @private
     */
    _calcAmount(account, constraints) {
        const maxConfigured = constraints?.max_total_amount;
        const balance = account?.balance || 1000;
        const maxPossible = Math.min(balance * 0.8, maxConfigured || Infinity);
        return Math.max(100, Math.round(maxPossible * 100) / 100);
    }
}

module.exports = { RuleBasedPlanner };
