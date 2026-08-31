// red-team/tests/evaluation/evaluationResult.test.js

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
    EvaluationResult,
    EVALUATION_VERSION
} = require("../../src/evaluation/EvaluationResult");

describe("M4.4 EvaluationResult", () => {
    function observation() {
        return {
            execution_id: "exec_001",
            scenario_id: "scn_001",

            execution_status: "COMPLETED",

            started_at: "2026-08-31T10:00:00.000Z",
            completed_at: "2026-08-31T10:00:01.000Z",
            duration_ms: 1000,

            total_steps: 2,
            executed_steps: 2,
            completed_steps: 2,
            failed_steps: 0,
            skipped_steps: 0,
            timed_out_steps: 0,

            step_observations: [],
            state_changes: [],

            execution_error: null
        };
    }

    function outcome() {
        return {
            status: "SUCCESSFUL",
            scenario_id: "scn_001",
            execution_id: "exec_001",

            declared_steps: 2,
            executed_steps: 2,
            completed_steps: 2,
            failed_steps: 0,
            skipped_steps: 0,
            timed_out_steps: 0,

            reason: "All declared attack steps completed successfully."
        };
    }

    function effectiveness() {
        return {
            attack_effectiveness: {
                score: 100,
                level: "COMPLETE",
                basis: "All declared attack steps completed successfully."
            },

            defense_effectiveness: {
                score: null,
                level: "NOT_AVAILABLE",
                basis: "No blue-team detection or prevention signal was supplied."
            }
        };
    }

    it("creates a canonical evaluation result", () => {
        const result = EvaluationResult.create(
            observation(),
            outcome(),
            effectiveness()
        );

        assert.equal(result.evaluation_version, EVALUATION_VERSION);

        assert.match(
            result.evaluation_id,
            /^[0-9a-f-]{36}$/i
        );

        assert.equal(
            result.execution.execution_id,
            "exec_001"
        );

        assert.equal(
            result.execution.scenario_id,
            "scn_001"
        );

        assert.equal(
            result.execution.status,
            "COMPLETED"
        );

        assert.equal(
            result.outcome.status,
            "SUCCESSFUL"
        );

        assert.equal(
            result.effectiveness.attack_effectiveness.score,
            100
        );
    });

    it("preserves execution observation metrics", () => {
        const result = EvaluationResult.create(
            observation(),
            outcome(),
            effectiveness()
        );

        assert.equal(
            result.observation.total_steps,
            2
        );

        assert.equal(
            result.observation.completed_steps,
            2
        );

        assert.equal(
            result.observation.failed_steps,
            0
        );

        assert.deepEqual(
            result.observation.state_changes,
            []
        );
    });

    it("preserves attack outcome reasoning", () => {
        const result = EvaluationResult.create(
            observation(),
            outcome(),
            effectiveness()
        );

        assert.equal(
            result.outcome.reason,
            "All declared attack steps completed successfully."
        );
    });

    it("preserves unavailable defense effectiveness", () => {
        const result = EvaluationResult.create(
            observation(),
            outcome(),
            effectiveness()
        );

        assert.equal(
            result.effectiveness.defense_effectiveness.score,
            null
        );

        assert.equal(
            result.effectiveness.defense_effectiveness.level,
            "NOT_AVAILABLE"
        );
    });

    it("validates a correctly constructed result", () => {
        const result = EvaluationResult.create(
            observation(),
            outcome(),
            effectiveness()
        );

        assert.strictEqual(
            EvaluationResult.validate(result),
            result
        );
    });

    it("rejects an invalid evaluation version", () => {
        const result = EvaluationResult.create(
            observation(),
            outcome(),
            effectiveness()
        );

        result.evaluation_version = "99.0.0";

        assert.throws(
            () => EvaluationResult.validate(result),
            /unsupported/
        );
    });

    it("rejects an invalid outcome", () => {
        const result = EvaluationResult.create(
            observation(),
            outcome(),
            effectiveness()
        );

        result.outcome.status = "FRAUD_DETECTED";

        assert.throws(
            () => EvaluationResult.validate(result),
            /invalid/
        );
    });

    it("rejects an attack effectiveness score above 100", () => {
        const result = EvaluationResult.create(
            observation(),
            outcome(),
            effectiveness()
        );

        result.effectiveness.attack_effectiveness.score = 101;

        assert.throws(
            () => EvaluationResult.validate(result),
            /between 0 and 100/
        );
    });

    it("rejects a negative attack effectiveness score", () => {
        const result = EvaluationResult.create(
            observation(),
            outcome(),
            effectiveness()
        );

        result.effectiveness.attack_effectiveness.score = -1;

        assert.throws(
            () => EvaluationResult.validate(result),
            /between 0 and 100/
        );
    });

    it("allows defense effectiveness to be unavailable", () => {
        const result = EvaluationResult.create(
            observation(),
            outcome(),
            effectiveness()
        );

        assert.equal(
            result.effectiveness.defense_effectiveness.score,
            null
        );

        assert.doesNotThrow(
            () => EvaluationResult.validate(result)
        );
    });

    it("rejects invalid defense effectiveness scores", () => {
        const result = EvaluationResult.create(
            observation(),
            outcome(),
            effectiveness()
        );

        result.effectiveness.defense_effectiveness.score = 150;

        assert.throws(
            () => EvaluationResult.validate(result),
            /between 0 and 100/
        );
    });

    it("does not introduce fraud classification fields", () => {
        const result = EvaluationResult.create(
            observation(),
            outcome(),
            effectiveness()
        );

        assert.equal(
            Object.prototype.hasOwnProperty.call(
                result,
                "fraud_detected"
            ),
            false
        );

        assert.equal(
            Object.prototype.hasOwnProperty.call(
                result,
                "fraud_score"
            ),
            false
        );

        assert.equal(
            Object.prototype.hasOwnProperty.call(
                result,
                "fraud_label"
            ),
            false
        );
    });

    it("rejects missing observation", () => {
        assert.throws(
            () =>
                EvaluationResult.create(
                    null,
                    outcome(),
                    effectiveness()
                ),
            /ExecutionObservation/
        );
    });

    it("rejects missing outcome", () => {
        assert.throws(
            () =>
                EvaluationResult.create(
                    observation(),
                    null,
                    effectiveness()
                ),
            /AttackOutcome/
        );
    });

    it("rejects missing effectiveness", () => {
        assert.throws(
            () =>
                EvaluationResult.create(
                    observation(),
                    outcome(),
                    null
                ),
            /effectiveness data/
        );
    });
});