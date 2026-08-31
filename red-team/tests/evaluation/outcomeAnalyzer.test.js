// red-team/tests/evaluation/outcomeAnalyzer.test.js

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
    OutcomeAnalyzer
} = require("../../src/evaluation/OutcomeAnalyzer");

describe("M4.2 OutcomeAnalyzer", () => {
    const analyzer = new OutcomeAnalyzer();

    function scenario(stepCount = 3) {
        return {
            scenario_id: "scn_test",
            steps: Array.from(
                { length: stepCount },
                (_, index) => ({
                    step_id: `step_${index}`,
                    step_index: index
                })
            )
        };
    }

    function observation(overrides = {}) {
        return {
            execution_id: "exec_test",
            execution_status: "COMPLETED",

            executed_steps: 3,
            completed_steps: 3,
            failed_steps: 0,
            skipped_steps: 0,
            timed_out_steps: 0,

            ...overrides
        };
    }

    it("classifies a fully completed scenario as SUCCESSFUL", () => {
        const result = analyzer.analyze(
            scenario(3),
            observation()
        );

        assert.equal(result.status, "SUCCESSFUL");
        assert.equal(result.declared_steps, 3);
        assert.equal(result.executed_steps, 3);
        assert.equal(result.completed_steps, 3);
    });

    it("classifies a partially executed scenario as PARTIALLY_SUCCESSFUL", () => {
        const result = analyzer.analyze(
            scenario(3),
            observation({
                execution_status: "FAILED",
                executed_steps: 2,
                completed_steps: 1,
                failed_steps: 1
            })
        );

        assert.equal(result.status, "PARTIALLY_SUCCESSFUL");
        assert.equal(result.completed_steps, 1);
        assert.equal(result.failed_steps, 1);
    });

    it("classifies a completely failed execution as FAILED", () => {
        const result = analyzer.analyze(
            scenario(3),
            observation({
                execution_status: "FAILED",
                executed_steps: 1,
                completed_steps: 0,
                failed_steps: 1
            })
        );

        assert.equal(result.status, "FAILED");
        assert.equal(result.completed_steps, 0);
        assert.equal(result.failed_steps, 1);
    });

    it("classifies an aborted execution with no steps as ABORTED", () => {
        const result = analyzer.analyze(
            scenario(3),
            observation({
                execution_status: "ABORTED",
                executed_steps: 0,
                completed_steps: 0,
                failed_steps: 0
            })
        );

        assert.equal(result.status, "ABORTED");
    });

    it("classifies a partial execution followed by abort as PARTIALLY_SUCCESSFUL", () => {
        const result = analyzer.analyze(
            scenario(3),
            observation({
                execution_status: "ABORTED",
                executed_steps: 1,
                completed_steps: 1,
                failed_steps: 0
            })
        );

        assert.equal(result.status, "PARTIALLY_SUCCESSFUL");
    });

    it("classifies zero execution without abort as NOT_EXECUTED", () => {
        const result = analyzer.analyze(
            scenario(3),
            observation({
                execution_status: "FAILED",
                executed_steps: 0,
                completed_steps: 0,
                failed_steps: 0
            })
        );

        assert.equal(result.status, "NOT_EXECUTED");
    });

    it("preserves timeout information", () => {
        const result = analyzer.analyze(
            scenario(3),
            observation({
                execution_status: "FAILED",
                executed_steps: 2,
                completed_steps: 1,
                failed_steps: 0,
                timed_out_steps: 1
            })
        );

        assert.equal(result.status, "PARTIALLY_SUCCESSFUL");
        assert.equal(result.timed_out_steps, 1);
    });

    it("preserves scenario and execution provenance", () => {
        const result = analyzer.analyze(
            scenario(2),
            observation({
                execution_id: "exec_999",
                executed_steps: 2,
                completed_steps: 2
            })
        );

        assert.equal(result.scenario_id, "scn_test");
        assert.equal(result.execution_id, "exec_999");
    });

    it("rejects missing scenario", () => {
        assert.throws(
            () => analyzer.analyze(
                null,
                observation()
            ),
            /valid AttackScenario/
        );
    });

    it("rejects missing observation", () => {
        assert.throws(
            () => analyzer.analyze(
                scenario(),
                null
            ),
            /valid ExecutionObservation/
        );
    });

    it("does not classify fraud detection", () => {
        const result = analyzer.analyze(
            scenario(1),
            observation({
                executed_steps: 1,
                completed_steps: 1
            })
        );

        assert.equal(result.status, "SUCCESSFUL");

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
    });
});