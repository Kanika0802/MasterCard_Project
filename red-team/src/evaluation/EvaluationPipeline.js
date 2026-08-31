// red-team/src/evaluation/EvaluationPipeline.js
//
// M4.5 — Evaluation Pipeline
//
// Composes the M4 evaluation stages:
//
//   AttackResult
//       ↓
//   ExecutionObserver
//       ↓
//   OutcomeAnalyzer
//       ↓
//   EffectivenessScorer
//       ↓
//   EvaluationResult
//
// This class is evaluation-only.
// It does not execute simulator actions or access infrastructure.

"use strict";

const { ValidationError } = require("../../../simulator/src/domain/errors");

const { ExecutionObserver } = require("./ExecutionObserver");
const { OutcomeAnalyzer } = require("./OutcomeAnalyzer");
const { EffectivenessScorer } = require("./EffectivenessScorer");
const { EvaluationResult } = require("./EvaluationResult");

class EvaluationPipeline {
    constructor(options = {}) {
        this.observer =
            options.observer || new ExecutionObserver();

        this.outcomeAnalyzer =
            options.outcomeAnalyzer || new OutcomeAnalyzer();

        this.scorer =
            options.scorer || new EffectivenessScorer();
    }

    /**
     * Evaluate a P1 AttackResult against its originating scenario.
     *
     * @param {object} scenario
     * @param {object} attackResult
     * @returns {object} canonical EvaluationResult
     */
    evaluate(scenario, attackResult) {
        if (!scenario || typeof scenario !== "object") {
            throw new ValidationError(
                "EvaluationPipeline requires a valid AttackScenario."
            );
        }

        if (!attackResult || typeof attackResult !== "object") {
            throw new ValidationError(
                "EvaluationPipeline requires a valid AttackResult."
            );
        }

        // M4.1
        const observation = this.observer.observe(
            attackResult
        );

        // M4.2
        const outcome = this.outcomeAnalyzer.analyze(
            scenario,
            observation
        );

        // M4.3
        const effectiveness = this.scorer.score(
            outcome
        );

        // M4.4
        const result = EvaluationResult.create(
            observation,
            outcome,
            effectiveness
        );

        // Final integrity check.
        EvaluationResult.validate(result);

        return result;
    }
}

module.exports = {
    EvaluationPipeline
};