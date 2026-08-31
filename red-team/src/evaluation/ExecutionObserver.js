// red-team/src/evaluation/ExecutionObserver.js
//
// M4.1 — Execution Observation
//
// Converts a P1 AttackResult into a normalized, read-only observation.
// This class does NOT execute attacks, access databases, publish events,
// or determine whether fraud was detected.
//
// Observation != interpretation.
// This layer reports what P1/M1 actually returned.

"use strict";
const { ValidationError } = require("../../../simulator/src/domain/errors");

const VALID_EXECUTION_STATUSES = Object.freeze([
    "CREATED",
    "VALIDATING",
    "VALIDATED",
    "RUNNING",
    "COMPLETED",
    "FAILED",
    "ABORTED"
]);

const VALID_STEP_STATUSES = Object.freeze([
    "PENDING",
    "RUNNING",
    "COMPLETED",
    "FAILED",
    "SKIPPED",
    "TIMED_OUT"
]);

class ExecutionObserver {
    /**
     * Observe a completed P1 AttackResult.
     *
     * @param {object} attackResult
     * @returns {object} normalized execution observation
     */
    observe(attackResult) {
        this._validateAttackResult(attackResult);

        const stepResults = Array.isArray(attackResult.step_results)
            ? attackResult.step_results
            : [];

        const stepObservations = stepResults.map(step =>
            this._observeStep(step)
        );

        const stateChanges = stepObservations.flatMap(
            step => step.state_changes
        );

        return {
            execution_id: attackResult.execution_id,
            scenario_id: attackResult.scenario_id,

            execution_status: attackResult.status,

            started_at: attackResult.started_at,
            completed_at: attackResult.completed_at,
            duration_ms: this._calculateDuration(
                attackResult.started_at,
                attackResult.completed_at
            ),

            total_steps: stepResults.length,
            executed_steps: stepResults.filter(
                step => step.status !== "PENDING"
            ).length,

            completed_steps: stepResults.filter(
                step => step.status === "COMPLETED"
            ).length,

            failed_steps: stepResults.filter(
                step => step.status === "FAILED"
            ).length,

            skipped_steps: stepResults.filter(
                step => step.status === "SKIPPED"
            ).length,

            timed_out_steps: stepResults.filter(
                step => step.status === "TIMED_OUT"
            ).length,

            step_observations: stepObservations,

            state_changes: stateChanges,

            execution_error: attackResult.error || null
        };
    }

    /**
     * Extract normalized information from one StepResult.
     *
     * @private
     */
    _observeStep(step) {
        if (!step || typeof step !== "object") {
            throw new ValidationError(
                "ExecutionObserver received an invalid step result."
            );
        }

        const response =
            step.simulator_response &&
            typeof step.simulator_response === "object"
                ? step.simulator_response
                : {};

        const stateChanges = Array.isArray(response.state_changes)
            ? response.state_changes
            : [];

        return {
            step_id: step.step_id,
            status: step.status,

            started_at: step.started_at || null,
            completed_at: step.completed_at || null,
            latency_ms:
                Number.isFinite(step.latency_ms)
                    ? step.latency_ms
                    : null,

            action_type: response.action_type || null,
            simulator_success:
                typeof response.success === "boolean"
                    ? response.success
                    : null,

            state_changes: stateChanges,

            error: step.error || null
        };
    }

    /**
     * Calculate execution duration.
     *
     * Returns null if timestamps are unavailable or invalid.
     *
     * @private
     */
    _calculateDuration(startedAt, completedAt) {
        if (!startedAt || !completedAt) {
            return null;
        }

        const start = Date.parse(startedAt);
        const end = Date.parse(completedAt);

        if (!Number.isFinite(start) || !Number.isFinite(end)) {
            return null;
        }

        return Math.max(0, end - start);
    }

    /**
     * Validate the minimum P1 AttackResult contract required by M4.
     *
     * @private
     */
    _validateAttackResult(attackResult) {
        if (!attackResult || typeof attackResult !== "object") {
            throw new ValidationError(
                "ExecutionObserver requires a non-null AttackResult object."
            );
        }

        if (
            typeof attackResult.execution_id !== "string" ||
            !attackResult.execution_id
        ) {
            throw new ValidationError(
                "AttackResult.execution_id must be a non-empty string."
            );
        }

        if (
            typeof attackResult.scenario_id !== "string" ||
            !attackResult.scenario_id
        ) {
            throw new ValidationError(
                "AttackResult.scenario_id must be a non-empty string."
            );
        }

        if (!VALID_EXECUTION_STATUSES.includes(attackResult.status)) {
            throw new ValidationError(
                `AttackResult.status '${attackResult.status}' is invalid.`
            );
        }

        if (!Array.isArray(attackResult.step_results)) {
            throw new ValidationError(
                "AttackResult.step_results must be an array."
            );
        }

        for (const step of attackResult.step_results) {
            if (
                !step ||
                typeof step.step_id !== "string" ||
                !step.step_id
            ) {
                throw new ValidationError(
                    "Each AttackResult.step_results entry must have a step_id."
                );
            }

            if (!VALID_STEP_STATUSES.includes(step.status)) {
                throw new ValidationError(
                    `StepResult.status '${step.status}' is invalid.`
                );
            }
        }
    }
}

module.exports = {
    ExecutionObserver,
    VALID_EXECUTION_STATUSES,
    VALID_STEP_STATUSES
};