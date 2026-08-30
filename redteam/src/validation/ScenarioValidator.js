// redteam/src/validation/ScenarioValidator.js
//
// ScenarioValidator — the primary safety gate between PlannerOutput and AttackScenario.
//
// Responsibilities:
//  1. Validate PlannerOutput structural shape
//  2. Verify every primitive_id exists in the PrimitiveRegistry and is NOT abstract
//  3. Verify every step's parameters satisfy the primitive's required_parameters
//  4. Verify entity IDs referenced in target_entities appear in available_entities
//  5. Attach validation_status + validation_errors to the PlannerOutput
//  6. Return a list of fully-validated AttackScenario-ready proposals
//
// The validator NEVER executes simulator actions.
// It NEVER accesses PostgreSQL, MongoDB, or Kafka.

"use strict";

const crypto = require("crypto");
const { ValidationError } = require("../../../simulator/src/domain/errors");
const { validatePlannerOutputShape } = require("../schemas/PlannerOutput");
const { validateAttackScenario } = require("../schemas/AttackScenario");
const { getDefaultRegistry: getDefaultPrimitiveRegistry } = require("../primitives/registry");

class ScenarioValidator {
    /**
     * @param {import('../primitives/registry').PrimitiveRegistry} primitiveRegistry
     */
    constructor(primitiveRegistry = getDefaultPrimitiveRegistry()) {
        this._primitiveRegistry = primitiveRegistry;
    }

    /**
     * Validate a PlannerOutput and produce one AttackScenario per valid scenario proposal.
     *
     * Mutates plannerOutput.validation_status and plannerOutput.validation_errors.
     *
     * @param {object} plannerOutput - Raw output from any planner implementation.
     * @param {object} plannerInput  - The original input (used for entity cross-reference).
     * @returns {{ validScenarios: object[], errors: string[] }}
     *   validScenarios — fully constructed AttackScenario objects (status: VALIDATED)
     *   errors         — all validation errors collected across all proposals
     */
    validate(plannerOutput, plannerInput) {
        const allErrors = [];

        // --- Step 1: Structural shape check on the raw output ---
        try {
            validatePlannerOutputShape(plannerOutput);
        } catch (err) {
            plannerOutput.validation_status = "INVALID";
            plannerOutput.validation_errors = [err.message];
            return { validScenarios: [], errors: [err.message] };
        }

        // Build sets for entity cross-reference checks.
        const availableUserIds = new Set(
            (plannerInput?.target_context?.available_entities?.users || []).map(u => u.user_id)
        );
        const availableAccountIds = new Set(
            (plannerInput?.target_context?.available_entities?.accounts || []).map(a => a.account_id)
        );

        const validScenarios = [];

        // --- Step 2: Validate each raw scenario proposal ---
        for (let i = 0; i < plannerOutput.scenarios.length; i++) {
            const raw = plannerOutput.scenarios[i];
            const proposalErrors = [];

            // Check each step's primitive and parameters.
            for (let si = 0; si < raw.steps.length; si++) {
                const step = raw.steps[si];

                // Must reference a known, non-abstract primitive.
                try {
                    this._primitiveRegistry.assertExecutable(step.primitive_id);
                } catch (err) {
                    proposalErrors.push(`scenarios[${i}].steps[${si}]: ${err.message}`);
                    continue; // Can't check parameters if primitive is unknown.
                }

                // Required parameters must be present and non-null.
                try {
                    this._primitiveRegistry.assertParametersSatisfied(step.primitive_id, step.parameters);
                } catch (err) {
                    proposalErrors.push(`scenarios[${i}].steps[${si}]: ${err.message}`);
                }
            }

            // Entity cross-reference check (only if plannerInput provides entity context).
            if (plannerInput?.target_context?.available_entities) {
                for (const userId of (raw.target_entities?.user_ids || [])) {
                    if (!availableUserIds.has(userId)) {
                        proposalErrors.push(
                            `scenarios[${i}].target_entities.user_ids: '${userId}' is not in the available entities from PlannerInput.`
                        );
                    }
                }
                for (const accountId of (raw.target_entities?.account_ids || [])) {
                    if (!availableAccountIds.has(accountId)) {
                        proposalErrors.push(
                            `scenarios[${i}].target_entities.account_ids: '${accountId}' is not in the available entities from PlannerInput.`
                        );
                    }
                }
            }

            if (proposalErrors.length > 0) {
                allErrors.push(...proposalErrors);
                continue; // This scenario proposal is invalid.
            }

            // --- Step 3: Build a fully-formed AttackScenario and structural-validate it ---
            let scenario;
            try {
                scenario = this._buildScenario(raw, plannerOutput);
                validateAttackScenario(scenario);
            } catch (err) {
                allErrors.push(`scenarios[${i}] (build/schema): ${err.message}`);
                continue;
            }

            validScenarios.push(scenario);
        }

        // --- Step 4: Annotate the plannerOutput with results ---
        if (allErrors.length === 0) {
            plannerOutput.validation_status = "VALID";
            plannerOutput.validation_errors = null;
        } else {
            plannerOutput.validation_status = validScenarios.length > 0 ? "PARTIAL" : "INVALID";
            plannerOutput.validation_errors = allErrors;
        }

        return { validScenarios, errors: allErrors };
    }

    /**
     * Build a fully-formed AttackScenario object from a raw scenario proposal.
     * Assigns stable IDs, step_index, and provenance fields.
     *
     * @private
     */
    _buildScenario(raw, plannerOutput) {
        const steps = raw.steps.map((rawStep, index) => ({
            step_id: `step_${String(index).padStart(3, "0")}`,
            step_index: index,
            primitive_id: rawStep.primitive_id,
            parameters: { ...rawStep.parameters },
            delay_ms: rawStep.delay_ms !== undefined ? rawStep.delay_ms : null,
            depends_on: this._resolveDepends(rawStep.depends_on, index, raw.steps),
            on_failure: rawStep.on_failure || "ABORT",
            max_retries: rawStep.max_retries !== undefined ? rawStep.max_retries : 0,
            description: rawStep.description || null,
            expected_outcome: rawStep.expected_outcome || null
        }));

        return {
            scenario_id: crypto.randomUUID(),
            name: raw.name,
            description: raw.description,
            attack_family: raw.attack_family,
            severity: raw.severity,
            strategy_id: raw.strategy_id || null,
            simulation_id: plannerOutput._simulation_id || "default_sim",
            experiment_id: plannerOutput._experiment_id || "default_exp",
            target_entities: {
                user_ids: raw.target_entities.user_ids,
                account_ids: raw.target_entities.account_ids,
                device_ids: raw.target_entities.device_ids || null,
                merchant_ids: raw.target_entities.merchant_ids || null
            },
            steps,
            max_duration_ms: raw.max_duration_ms || null,
            requires_seeded_data: raw.requires_seeded_data || false,
            generated_by: "GENAI_PLANNER",
            planner_model: plannerOutput.model_used || null,
            generation_timestamp: plannerOutput.generation_timestamp,
            status: "VALIDATED",
            validation_errors: null,
            version: "1.0.0",
            tags: raw.tags || null
        };
    }

    /**
     * Resolve depends_on from raw step (which uses array-position references)
     * into the step_id format used in the built scenario.
     *
     * The planner outputs depends_on as either null or an array of primitive_ids
     * or step-position strings. We normalize to step_id strings (step_000, step_001 …).
     *
     * @private
     */
    _resolveDepends(rawDepends, currentIndex, allRawSteps) {
        if (!rawDepends || rawDepends.length === 0) return null;
        // Accept numeric indices (e.g. [0, 1]) or step_id strings (step_000).
        return rawDepends.map(dep => {
            if (typeof dep === "number") {
                return `step_${String(dep).padStart(3, "0")}`;
            }
            if (/^\d+$/.test(dep)) {
                return `step_${String(parseInt(dep, 10)).padStart(3, "0")}`;
            }
            // Already a step_id string.
            return dep;
        });
    }
}

module.exports = { ScenarioValidator };
