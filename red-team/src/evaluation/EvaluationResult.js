// red-team/src/evaluation/EvaluationResult.js
//
// M4.4 — Canonical Evaluation Result
//
// Combines:
//   - execution observation
//   - attack outcome
//   - effectiveness scores
//
// This is a reporting/evaluation artifact.
// It does NOT execute attacks and does NOT modify P1 AttackResult.
//
// IMPORTANT:
// Attack effectiveness != defense effectiveness.
// A successful attack execution does not by itself prove that
// the fraud-defense system failed.

"use strict";

const crypto = require("crypto");
const { ValidationError } = require("../../../simulator/src/domain/errors");

const EVALUATION_VERSION = "1.0.0";

const VALID_OUTCOMES = Object.freeze([
    "SUCCESSFUL",
    "PARTIALLY_SUCCESSFUL",
    "FAILED",
    "ABORTED",
    "NOT_EXECUTED"
]);

class EvaluationResult {
    /**
     * Construct a canonical M4 evaluation result.
     *
     * @param {object} observation
     * @param {object} outcome
     * @param {object} effectiveness
     * @returns {object}
     */
    static create(observation, outcome, effectiveness) {
        this._validateInputs(
            observation,
            outcome,
            effectiveness
        );

        return {
            evaluation_id: crypto.randomUUID(),
            evaluation_version: EVALUATION_VERSION,

            execution: {
                execution_id: observation.execution_id,
                scenario_id: observation.scenario_id,

                status: observation.execution_status,

                started_at: observation.started_at || null,
                completed_at: observation.completed_at || null,
                duration_ms: observation.duration_ms
            },

            observation: {
                total_steps: observation.total_steps,
                executed_steps: observation.executed_steps,
                completed_steps: observation.completed_steps,
                failed_steps: observation.failed_steps,
                skipped_steps: observation.skipped_steps,
                timed_out_steps: observation.timed_out_steps,

                step_observations: observation.step_observations,
                state_changes: observation.state_changes,

                execution_error: observation.execution_error
            },

            outcome: {
                status: outcome.status,
                reason: outcome.reason
            },

            effectiveness: {
                attack_effectiveness: {
                    score: effectiveness.attack_effectiveness.score,
                    level: effectiveness.attack_effectiveness.level,
                    basis: effectiveness.attack_effectiveness.basis
                },

                defense_effectiveness: {
                    score: effectiveness.defense_effectiveness.score,
                    level: effectiveness.defense_effectiveness.level,
                    basis: effectiveness.defense_effectiveness.basis
                }
            },

            metadata: {
                generated_by: "M4_EVALUATION"
            }
        };
    }

    /**
     * Validate an existing EvaluationResult.
     *
     * @param {object} result
     * @returns {object}
     */
    static validate(result) {
        if (!result || typeof result !== "object") {
            throw new ValidationError(
                "EvaluationResult must be a non-null object."
            );
        }

        if (
            typeof result.evaluation_id !== "string" ||
            !result.evaluation_id
        ) {
            throw new ValidationError(
                "EvaluationResult.evaluation_id must be a non-empty string."
            );
        }

        if (result.evaluation_version !== EVALUATION_VERSION) {
            throw new ValidationError(
                `EvaluationResult.evaluation_version '${result.evaluation_version}' is unsupported.`
            );
        }

        if (
            !result.execution ||
            typeof result.execution !== "object"
        ) {
            throw new ValidationError(
                "EvaluationResult.execution must be an object."
            );
        }

        if (
            typeof result.execution.execution_id !== "string" ||
            !result.execution.execution_id
        ) {
            throw new ValidationError(
                "EvaluationResult.execution.execution_id must be a non-empty string."
            );
        }

        if (
            typeof result.execution.scenario_id !== "string" ||
            !result.execution.scenario_id
        ) {
            throw new ValidationError(
                "EvaluationResult.execution.scenario_id must be a non-empty string."
            );
        }

        if (
            !result.outcome ||
            typeof result.outcome !== "object"
        ) {
            throw new ValidationError(
                "EvaluationResult.outcome must be an object."
            );
        }

        if (!VALID_OUTCOMES.includes(result.outcome.status)) {
            throw new ValidationError(
                `EvaluationResult.outcome.status '${result.outcome.status}' is invalid.`
            );
        }

        if (
            !result.effectiveness ||
            typeof result.effectiveness !== "object"
        ) {
            throw new ValidationError(
                "EvaluationResult.effectiveness must be an object."
            );
        }

        if (
            !result.effectiveness.attack_effectiveness ||
            typeof result.effectiveness.attack_effectiveness !== "object"
        ) {
            throw new ValidationError(
                "EvaluationResult.attack_effectiveness is required."
            );
        }

        const attackScore =
            result.effectiveness.attack_effectiveness.score;

        if (
            typeof attackScore !== "number" ||
            !Number.isFinite(attackScore) ||
            attackScore < 0 ||
            attackScore > 100
        ) {
            throw new ValidationError(
                "Attack effectiveness score must be a number between 0 and 100."
            );
        }

        if (
            !result.effectiveness.defense_effectiveness ||
            typeof result.effectiveness.defense_effectiveness !== "object"
        ) {
            throw new ValidationError(
                "EvaluationResult.defense_effectiveness is required."
            );
        }

        const defenseScore =
            result.effectiveness.defense_effectiveness.score;

        if (
            defenseScore !== null &&
            (
                typeof defenseScore !== "number" ||
                !Number.isFinite(defenseScore) ||
                defenseScore < 0 ||
                defenseScore > 100
            )
        ) {
            throw new ValidationError(
                "Defense effectiveness score must be null or a number between 0 and 100."
            );
        }

        return result;
    }

    /**
     * @private
     */
    static _validateInputs(
        observation,
        outcome,
        effectiveness
    ) {
        if (!observation || typeof observation !== "object") {
            throw new ValidationError(
                "EvaluationResult requires an ExecutionObservation."
            );
        }

        if (
            typeof observation.execution_id !== "string" ||
            !observation.execution_id
        ) {
            throw new ValidationError(
                "ExecutionObservation.execution_id must be a non-empty string."
            );
        }

        if (
            typeof observation.scenario_id !== "string" ||
            !observation.scenario_id
        ) {
            throw new ValidationError(
                "ExecutionObservation.scenario_id must be a non-empty string."
            );
        }

        if (!outcome || typeof outcome !== "object") {
            throw new ValidationError(
                "EvaluationResult requires an AttackOutcome."
            );
        }

        if (!VALID_OUTCOMES.includes(outcome.status)) {
            throw new ValidationError(
                `AttackOutcome.status '${outcome.status}' is invalid.`
            );
        }

        if (!effectiveness || typeof effectiveness !== "object") {
            throw new ValidationError(
                "EvaluationResult requires effectiveness data."
            );
        }

        if (
            !effectiveness.attack_effectiveness ||
            typeof effectiveness.attack_effectiveness !== "object"
        ) {
            throw new ValidationError(
                "Attack effectiveness data is required."
            );
        }

        if (
            typeof effectiveness.attack_effectiveness.score !== "number" ||
            !Number.isFinite(effectiveness.attack_effectiveness.score) ||
            effectiveness.attack_effectiveness.score < 0 ||
            effectiveness.attack_effectiveness.score > 100
        ) {
            throw new ValidationError(
                "Attack effectiveness score must be between 0 and 100."
            );
        }

        if (
            !effectiveness.defense_effectiveness ||
            typeof effectiveness.defense_effectiveness !== "object"
        ) {
            throw new ValidationError(
                "Defense effectiveness data is required."
            );
        }
    }
}

module.exports = {
    EvaluationResult,
    EVALUATION_VERSION
};