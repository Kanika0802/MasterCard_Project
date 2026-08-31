// redteam/src/planner/GenAIPlanner.js
//
// GenAI Attack Planner — uses an LLM / GenAI provider to generate
// adversarial attack scenarios targeting payment defense systems.
//
// Safety Guarantees:
//  1. Never executes simulator actions.
//  2. Never accesses PostgreSQL, MongoDB, or Kafka directly.
//  3. Never produces executable code (only structured JSON data).
//  4. Pluggable provider adapter (no hardcoded keys/secrets).
//  5. Integrates with ScenarioValidator as the safety/hallucination gate.

"use strict";

const { PlannerInterface } = require("./PlannerInterface");
const { MockModelProvider, FunctionModelProvider, BaseModelProvider } = require("./ModelProvider");
const { validatePlannerInput } = require("../schemas/PlannerInput");
const { validatePlannerOutputShape } = require("../schemas/PlannerOutput");
const { ScenarioValidator } = require("../validation/ScenarioValidator");
const { getDefaultRegistry: getDefaultPrimitiveRegistry } = require("../primitives/registry");
const { getDefaultRegistry: getDefaultStrategyRegistry } = require("../strategies/registry");
const { ValidationError } = require("../../../simulator/src/domain/errors");

const DEFAULT_SYSTEM_PROMPT = `You are an Adversarial Red Team Attack Planner for financial and payment systems (AipaySec).
Your mission is to synthesize realistic adversarial payment fraud scenarios to proactively test automated fraud defenses.

CRITICAL CONSTRAINTS:
1. You MUST select and use ONLY available primitives provided in the catalog. Do NOT invent new action names or primitives.
2. Only reference user_ids and account_ids that exist in the provided simulation target context.
3. Every step must have concrete parameters matching the primitive's required schema.
4. Output MUST be strictly valid JSON conforming to the schema requested with no commentary outside JSON.`;

class GenAIPlanner extends PlannerInterface {
    /**
     * @param {object} [options]
     * @param {BaseModelProvider|Function} [options.provider] - LLM provider adapter or async function
     * @param {import('../primitives/registry').PrimitiveRegistry} [options.primitiveRegistry]
     * @param {import('../strategies/registry').StrategyRegistry} [options.strategyRegistry]
     * @param {ScenarioValidator} [options.validator]
     * @param {string} [options.modelName]
     * @param {string} [options.systemPrompt]
     * @param {number} [options.temperature=0.2]
     */
    constructor(options = {}) {
        super();
        this._primitiveRegistry = options.primitiveRegistry || getDefaultPrimitiveRegistry();
        this._strategyRegistry = options.strategyRegistry || getDefaultStrategyRegistry();
        this._validator = options.validator || new ScenarioValidator(this._primitiveRegistry);

        if (typeof options.provider === "function") {
            this.provider = new FunctionModelProvider(options.provider, { modelName: options.modelName });
        } else if (options.provider instanceof BaseModelProvider) {
            this.provider = options.provider;
        } else if (options.provider) {
            // Duck-typing support for custom provider objects with .generate()
            if (typeof options.provider.generate !== "function") {
                throw new ValidationError("GenAIPlanner provider must implement a generate() method.");
            }
            this.provider = options.provider;
        } else {
            this.provider = new MockModelProvider(null, { modelName: options.modelName || "mock-genai-v1" });
        }

        this.modelName = options.modelName || this.provider.modelName || "genai-model";
        this.systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
        this.temperature = options.temperature !== undefined ? options.temperature : 0.2;
    }

    get name() {
        return `genai-planner-${this.modelName}`;
    }

    /**
     * Helper to retrieve the validator instance.
     */
    get validator() {
        return this._validator;
    }

    /**
     * Generate structured scenario proposals using the GenAI provider.
     *
     * @param {object} plannerInput - Validated PlannerInput object.
     * @returns {Promise<object>} PlannerOutput object.
     */
    async plan(plannerInput) {
        // 1. Validate incoming input contract
        validatePlannerInput(plannerInput);

        // 2. Build structured prompt context for LLM
        const prompt = this._buildPrompt(plannerInput);

        // 3. Invoke provider adapter
        let rawResponse;
        try {
            rawResponse = await this.provider.generate({
                prompt,
                systemPrompt: this.systemPrompt,
                temperature: plannerInput.planner_config?.temperature ?? this.temperature,
                modelName: this.modelName
            });
        } catch (err) {
            throw new ValidationError(`GenAI provider generation failed: ${err.message}`);
        }

        // 4. Parse JSON from model output
        const parsedData = this._extractJson(rawResponse);

        // 5. Structure into canonical PlannerOutput shape
        const scenarios = Array.isArray(parsedData.scenarios)
            ? parsedData.scenarios
            : (parsedData.steps ? [parsedData] : []);

        if (scenarios.length === 0) {
            throw new ValidationError("GenAI model output contained no attack scenarios.");
        }

        const plannerOutput = {
            planner_id: this.name,
            model_used: this.modelName,
            generation_timestamp: new Date().toISOString(),
            objective: plannerInput.objective,
            scenarios,
            validation_status: null,
            validation_errors: null,
            _simulation_id: plannerInput.target_context.simulation_id,
            _experiment_id: plannerInput.target_context.experiment_id
        };

        // 6. Validate raw structural shape of PlannerOutput
        validatePlannerOutputShape(plannerOutput);

        return plannerOutput;
    }

    /**
     * Convenience pipeline method: generates plan via LLM and executes
     * ScenarioValidator to return verified AttackScenarios.
     *
     * @param {object} plannerInput
     * @returns {Promise<{ plannerOutput: object, validScenarios: object[], errors: string[] }>}
     */
    async planAndValidate(plannerInput) {
        const plannerOutput = await this.plan(plannerInput);
        const { validScenarios, errors } = this._validator.validate(plannerOutput, plannerInput);
        return {
            plannerOutput,
            validScenarios,
            errors
        };
    }

    /**
     * Constructs the structured prompt for the LLM.
     * @private
     */
    _buildPrompt(plannerInput) {
        const { objective, target_context, constraints, available_primitives, available_strategies } = plannerInput;

        // Primitives summary
        const primitivesList = (available_primitives || this._primitiveRegistry.getConcrete()).map(p => ({
            primitive_id: p.primitive_id,
            name: p.name,
            description: p.description,
            simulator_action: p.simulator_action,
            category: p.category,
            required_parameters: p.required_parameters,
            optional_parameters: p.optional_parameters,
            is_abstract: p.is_abstract
        }));

        // Context summary
        const targetSummary = {
            simulation_id: target_context.simulation_id,
            experiment_id: target_context.experiment_id,
            users: target_context.available_entities?.users || [],
            accounts: target_context.available_entities?.accounts || [],
            merchants: target_context.available_entities?.merchants || [],
            devices: target_context.available_entities?.devices || []
        };

        return JSON.stringify({
            instruction: "Generate a multi-step adversarial attack scenario strictly based on the objective and constraints.",
            objective,
            constraints: constraints || "None",
            available_primitives: primitivesList,
            target_context: targetSummary,
            reference_strategies: (available_strategies || this._strategyRegistry.getAll()).map(s => ({
                strategy_id: s.strategy_id,
                name: s.name,
                attack_family: s.attack_family,
                description: s.description
            })),
            expected_output_format: {
                scenarios: [
                    {
                        name: "Descriptive Scenario Title",
                        description: "Detailed narrative explaining the attack technique",
                        attack_family: "ACCOUNT_TAKEOVER | MULE_NETWORK | VELOCITY_ABUSE | IDENTITY_FRAUD",
                        severity: "LOW | MEDIUM | HIGH | CRITICAL",
                        strategy_id: "STRAT_ID or null",
                        steps: [
                            {
                                primitive_id: "EXACT_PRIM_ID_FROM_CATALOG",
                                parameters: { "param_name": "param_value" },
                                delay_ms: 0,
                                depends_on: null,
                                on_failure: "ABORT | CONTINUE | RETRY",
                                description: "Step description"
                            }
                        ],
                        target_entities: {
                            user_ids: ["usr_..."],
                            account_ids: ["acc_..."],
                            device_ids: null,
                            merchant_ids: null
                        },
                        reasoning: "Why this attack sequence effectively tests fraud detection"
                    }
                ]
            }
        }, null, 2);
    }

    /**
     * Extracts and parses JSON from raw LLM output.
     * Handles markdown codeblocks, raw string JSON, and object structures.
     * @private
     */
    _extractJson(raw) {
        if (typeof raw === "object" && raw !== null) {
            return raw;
        }

        if (typeof raw !== "string" || !raw.trim()) {
            throw new ValidationError("GenAI model returned an empty or invalid response.");
        }

        let cleanText = raw.trim();

        // Strip ```json ... ``` or ``` ... ``` code fences if present
        if (cleanText.startsWith("```")) {
            cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        }

        try {
            return JSON.parse(cleanText);
        } catch (err) {
            throw new ValidationError(`Failed to parse JSON from GenAI model response: ${err.message}. Response preview: ${cleanText.slice(0, 120)}`);
        }
    }
}

module.exports = {
    GenAIPlanner,
    DEFAULT_SYSTEM_PROMPT
};
