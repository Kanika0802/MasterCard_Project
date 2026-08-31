// red-team/src/evaluation/OutcomeAnalyzer.js
//
// M4.2 — Attack Outcome Analysis
//
// Determines the observed outcome of an attack execution.
//
// This module does NOT determine fraud detection effectiveness.
// It only interprets execution evidence produced by P1/M1.
//
// Attack execution outcome != fraud detection outcome.

"use strict";

const { ValidationError } = require("../../../simulator/src/domain/errors");
const ATTACK_OUTCOMES = Object.freeze([
    "SUCCESSFUL",
    "PARTIALLY_SUCCESSFUL",
    "FAILED",
    "ABORTED",
    "NOT_EXECUTED"
]);

class OutcomeAnalyzer {
    /**
     * Analyze an AttackScenario against its ExecutionObservation.
     *
     * @param {object} scenario
     * @param {object} observation
     * @returns {object} Attack outcome
     */
    analyze(scenario, observation) {
        this._validateInputs(scenario, observation);

        const declaredSteps = Array.isArray(scenario.steps)
            ? scenario.steps.length
            : 0;

        const executedSteps = observation.executed_steps;
        const completedSteps = observation.completed_steps;
        const failedSteps = observation.failed_steps;
        const timedOutSteps = observation.timed_out_steps;

        // Nothing was dispatched.
        if (executedSteps === 0) {
            if (observation.execution_status === "ABORTED") {
                return this._buildOutcome(
                    "ABORTED",
                    scenario,
                    observation,
                    "Scenario execution was aborted before any step completed."
                );
            }

            return this._buildOutcome(
                "NOT_EXECUTED",
                scenario,
                observation,
                "No attack steps were executed."
            );
        }

        // Explicit scenario abort.
        if (observation.execution_status === "ABORTED") {
            return this._buildOutcome(
                completedSteps > 0
                    ? "PARTIALLY_SUCCESSFUL"
                    : "ABORTED",
                scenario,
                observation,
                completedSteps > 0
                    ? "Scenario was aborted after one or more steps completed."
                    : "Scenario execution was aborted."
            );
        }

        // Every declared step completed successfully.
        if (
            observation.execution_status === "COMPLETED" &&
            completedSteps === declaredSteps &&
            failedSteps === 0 &&
            timedOutSteps === 0
        ) {
            return this._buildOutcome(
                "SUCCESSFUL",
                scenario,
                observation,
                "All declared attack steps completed successfully."
            );
        }

        // Some steps completed, but execution did not fully succeed.
        if (completedSteps > 0) {
            return this._buildOutcome(
                "PARTIALLY_SUCCESSFUL",
                scenario,
                observation,
                "One or more attack steps completed, but the scenario did not fully complete."
            );
        }

        // Execution occurred but no step succeeded.
        return this._buildOutcome(
            "FAILED",
            scenario,
            observation,
            "Attack execution did not successfully complete any step."
        );
    }

    /**
     * Construct the normalized outcome object.
     *
     * @private
     */
    _buildOutcome(status, scenario, observation, reason) {
        return {
            status,

            scenario_id: scenario.scenario_id,
            execution_id: observation.execution_id,

            execution_status: observation.execution_status,

            declared_steps: scenario.steps.length,
            executed_steps: observation.executed_steps,
            completed_steps: observation.completed_steps,
            failed_steps: observation.failed_steps,
            skipped_steps: observation.skipped_steps,
            timed_out_steps: observation.timed_out_steps,

            reason
        };
    }

    /**
     * Validate analyzer inputs.
     *
     * @private
     */
    _validateInputs(scenario, observation) {
        if (!scenario || typeof scenario !== "object") {
            throw new ValidationError(
                "OutcomeAnalyzer requires a valid AttackScenario."
            );
        }

        if (
            typeof scenario.scenario_id !== "string" ||
            !scenario.scenario_id
        ) {
            throw new ValidationError(
                "AttackScenario.scenario_id must be a non-empty string."
            );
        }

        if (!Array.isArray(scenario.steps)) {
            throw new ValidationError(
                "AttackScenario.steps must be an array."
            );
        }

        if (!observation || typeof observation !== "object") {
            throw new ValidationError(
                "OutcomeAnalyzer requires a valid ExecutionObservation."
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
            !Number.isInteger(observation.executed_steps) ||
            observation.executed_steps < 0
        ) {
            throw new ValidationError(
                "ExecutionObservation.executed_steps must be a non-negative integer."
            );
        }

        if (
            !Number.isInteger(observation.completed_steps) ||
            observation.completed_steps < 0
        ) {
            throw new ValidationError(
                "ExecutionObservation.completed_steps must be a non-negative integer."
            );
        }

        if (
            !Number.isInteger(observation.failed_steps) ||
            observation.failed_steps < 0
        ) {
            throw new ValidationError(
                "ExecutionObservation.failed_steps must be a non-negative integer."
            );
        }

        if (
            !Number.isInteger(observation.skipped_steps) ||
            observation.skipped_steps < 0
        ) {
            throw new ValidationError(
                "ExecutionObservation.skipped_steps must be a non-negative integer."
            );
        }

        if (
            !Number.isInteger(observation.timed_out_steps) ||
            observation.timed_out_steps < 0
        ) {
            throw new ValidationError(
                "ExecutionObservation.timed_out_steps must be a non-negative integer."
            );
        }
    }
}

module.exports = {
    OutcomeAnalyzer,
    ATTACK_OUTCOMES
};