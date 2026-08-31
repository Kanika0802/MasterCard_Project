// red-team/src/evaluation/EffectivenessScorer.js
//
// M4.3 — Effectiveness Scoring
//
// Scores the effectiveness of the adversarial attack execution.
//
// IMPORTANT:
// Attack effectiveness and defense effectiveness are separate concepts.
//
// Attack effectiveness:
//   How successfully did the adversarial scenario execute?
//
// Defense effectiveness:
//   Did the defense detect/prevent the attack?
//
// This module does NOT infer a defense failure merely because an attack
// executed successfully.

"use strict";

const { ValidationError } = require("../../../simulator/src/domain/errors");

const SCORE_LEVELS = Object.freeze({
    NONE: "NONE",
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    COMPLETE: "COMPLETE",
    NOT_AVAILABLE: "NOT_AVAILABLE"
});

class EffectivenessScorer {
    /**
     * Score an analyzed attack outcome.
     *
     * @param {object} outcome - Output from OutcomeAnalyzer
     * @returns {object} effectiveness scores
     */
    score(outcome) {
        this._validateOutcome(outcome);

        const attack = this._scoreAttack(outcome);

        return {
            attack_effectiveness: attack,

            defense_effectiveness: {
                score: null,
                level: SCORE_LEVELS.NOT_AVAILABLE,
                basis: "No blue-team detection or prevention signal was supplied."
            }
        };
    }

    /**
     * Calculate attack execution effectiveness.
     *
     * Scale:
     *
     * 0   = not executed
     * 25  = execution attempted but no step completed
     * 50  = partially successful
     * 100 = fully successful
     *
     * @private
     */
    _scoreAttack(outcome) {
        switch (outcome.status) {
            case "SUCCESSFUL":
                return {
                    score: 100,
                    level: SCORE_LEVELS.COMPLETE,
                    basis: "All declared attack steps completed successfully."
                };

            case "PARTIALLY_SUCCESSFUL":
                return {
                    score: this._partialScore(outcome),
                    level: SCORE_LEVELS.MEDIUM,
                    basis: "One or more attack steps completed, but the scenario did not fully complete."
                };

            case "FAILED":
                return {
                    score: 25,
                    level: SCORE_LEVELS.LOW,
                    basis: "Attack execution was attempted, but no attack step completed successfully."
                };

            case "ABORTED":
                return {
                    score: 0,
                    level: SCORE_LEVELS.NONE,
                    basis: "Attack execution was aborted before successful execution."
                };

            case "NOT_EXECUTED":
                return {
                    score: 0,
                    level: SCORE_LEVELS.NONE,
                    basis: "No attack steps were executed."
                };

            default:
                throw new ValidationError(
                    `Unsupported attack outcome '${outcome.status}'.`
                );
        }
    }

    /**
     * Calculate proportional score for partial execution.
     *
     * Minimum partial score is 26 and maximum is 99.
     *
     * @private
     */
    _partialScore(outcome) {
        const declared = outcome.declared_steps;

        if (!declared || declared <= 0) {
            return 50;
        }

        const completed = Math.max(
            0,
            Math.min(outcome.completed_steps, declared)
        );

        const ratio = completed / declared;

        const score = Math.round(ratio * 100);

        return Math.max(26, Math.min(99, score));
    }

    /**
     * Validate OutcomeAnalyzer output.
     *
     * @private
     */
    _validateOutcome(outcome) {
        if (!outcome || typeof outcome !== "object") {
            throw new ValidationError(
                "EffectivenessScorer requires a valid AttackOutcome."
            );
        }

        const validStatuses = [
            "SUCCESSFUL",
            "PARTIALLY_SUCCESSFUL",
            "FAILED",
            "ABORTED",
            "NOT_EXECUTED"
        ];

        if (!validStatuses.includes(outcome.status)) {
            throw new ValidationError(
                `AttackOutcome.status '${outcome.status}' is invalid.`
            );
        }

        if (
            !Number.isInteger(outcome.declared_steps) ||
            outcome.declared_steps < 0
        ) {
            throw new ValidationError(
                "AttackOutcome.declared_steps must be a non-negative integer."
            );
        }

        if (
            !Number.isInteger(outcome.completed_steps) ||
            outcome.completed_steps < 0
        ) {
            throw new ValidationError(
                "AttackOutcome.completed_steps must be a non-negative integer."
            );
        }
    }
}

module.exports = {
    EffectivenessScorer,
    SCORE_LEVELS
};