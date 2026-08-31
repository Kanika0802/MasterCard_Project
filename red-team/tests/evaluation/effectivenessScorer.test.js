// red-team/tests/evaluation/effectivenessScorer.test.js

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
    EffectivenessScorer
} = require("../../src/evaluation/EffectivenessScorer");

describe("M4.3 EffectivenessScorer", () => {
    const scorer = new EffectivenessScorer();

    function outcome(overrides = {}) {
        return {
            status: "SUCCESSFUL",

            scenario_id: "scn_001",
            execution_id: "exec_001",

            declared_steps: 4,
            executed_steps: 4,
            completed_steps: 4,
            failed_steps: 0,
            skipped_steps: 0,
            timed_out_steps: 0,

            ...overrides
        };
    }

    it("scores a fully successful attack at 100", () => {
        const result = scorer.score(
            outcome({
                status: "SUCCESSFUL"
            })
        );

        assert.equal(
            result.attack_effectiveness.score,
            100
        );

        assert.equal(
            result.attack_effectiveness.level,
            "COMPLETE"
        );
    });

    it("scores a 50% partially successful attack at 50", () => {
        const result = scorer.score(
            outcome({
                status: "PARTIALLY_SUCCESSFUL",
                declared_steps: 4,
                completed_steps: 2
            })
        );

        assert.equal(
            result.attack_effectiveness.score,
            50
        );

        assert.equal(
            result.attack_effectiveness.level,
            "MEDIUM"
        );
    });

    it("scores a one-of-four partial attack at 26", () => {
        const result = scorer.score(
            outcome({
                status: "PARTIALLY_SUCCESSFUL",
                declared_steps: 4,
                completed_steps: 1
            })
        );

        assert.equal(
            result.attack_effectiveness.score,
            26
        );
    });

    it("scores a three-of-four partial attack at 75", () => {
        const result = scorer.score(
            outcome({
                status: "PARTIALLY_SUCCESSFUL",
                declared_steps: 4,
                completed_steps: 3
            })
        );

        assert.equal(
            result.attack_effectiveness.score,
            75
        );
    });

    it("scores a failed attack at 25", () => {
        const result = scorer.score(
            outcome({
                status: "FAILED",
                declared_steps: 4,
                executed_steps: 1,
                completed_steps: 0,
                failed_steps: 1
            })
        );

        assert.equal(
            result.attack_effectiveness.score,
            25
        );

        assert.equal(
            result.attack_effectiveness.level,
            "LOW"
        );
    });

    it("scores an aborted attack at 0", () => {
        const result = scorer.score(
            outcome({
                status: "ABORTED",
                executed_steps: 0,
                completed_steps: 0
            })
        );

        assert.equal(
            result.attack_effectiveness.score,
            0
        );

        assert.equal(
            result.attack_effectiveness.level,
            "NONE"
        );
    });

    it("scores a non-executed attack at 0", () => {
        const result = scorer.score(
            outcome({
                status: "NOT_EXECUTED",
                executed_steps: 0,
                completed_steps: 0
            })
        );

        assert.equal(
            result.attack_effectiveness.score,
            0
        );
    });

    it("does not infer defense effectiveness", () => {
        const result = scorer.score(
            outcome({
                status: "SUCCESSFUL"
            })
        );

        assert.equal(
            result.defense_effectiveness.score,
            null
        );

        assert.equal(
            result.defense_effectiveness.level,
            "NOT_AVAILABLE"
        );
    });

    it("provides an explicit basis for defense score absence", () => {
        const result = scorer.score(
            outcome()
        );

        assert.match(
            result.defense_effectiveness.basis,
            /No blue-team detection or prevention signal/
        );
    });

    it("rejects a missing outcome", () => {
        assert.throws(
            () => scorer.score(null),
            /valid AttackOutcome/
        );
    });

    it("rejects an invalid outcome status", () => {
        assert.throws(
            () =>
                scorer.score(
                    outcome({
                        status: "FRAUD_DETECTED"
                    })
                ),
            /invalid/
        );
    });

    it("rejects invalid declared step counts", () => {
        assert.throws(
            () =>
                scorer.score(
                    outcome({
                        declared_steps: -1
                    })
                ),
            /declared_steps/
        );
    });
});