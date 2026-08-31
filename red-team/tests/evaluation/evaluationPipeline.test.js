// red-team/tests/evaluation/evaluationPipeline.test.js

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
    EvaluationPipeline
} = require("../../src/evaluation/EvaluationPipeline");

describe("M4.5 EvaluationPipeline", () => {
    const pipeline = new EvaluationPipeline();

    function scenario(stepCount = 3) {
        return {
            scenario_id: "scn_pipeline_001",

            steps: Array.from(
                { length: stepCount },
                (_, index) => ({
                    step_id: `step_${index}`,
                    step_index: index
                })
            )
        };
    }

    function attackResult(overrides = {}) {
        return {
            execution_id: "exec_pipeline_001",
            scenario_id: "scn_pipeline_001",

            status: "COMPLETED",

            started_at:
                "2026-08-31T10:00:00.000Z",

            completed_at:
                "2026-08-31T10:00:01.500Z",

            step_results: [
                {
                    step_id: "step_0",
                    status: "COMPLETED",

                    started_at:
                        "2026-08-31T10:00:00.100Z",

                    completed_at:
                        "2026-08-31T10:00:00.500Z",

                    latency_ms: 400,

                    simulator_response: {
                        success: true,
                        action_type: "SIMULATE_LOGIN",

                        state_changes: [
                            {
                                entity_type: "auth_event",
                                entity_id: "auth_001",
                                change: "CREATED"
                            }
                        ]
                    },

                    error: null
                },

                {
                    step_id: "step_1",
                    status: "COMPLETED",

                    started_at:
                        "2026-08-31T10:00:00.600Z",

                    completed_at:
                        "2026-08-31T10:00:01.000Z",

                    latency_ms: 400,

                    simulator_response: {
                        success: true,
                        action_type: "REGISTER_DEVICE",

                        state_changes: [
                            {
                                entity_type: "device",
                                entity_id: "device_001",
                                change: "CREATED"
                            }
                        ]
                    },

                    error: null
                },

                {
                    step_id: "step_2",
                    status: "COMPLETED",

                    started_at:
                        "2026-08-31T10:00:01.100Z",

                    completed_at:
                        "2026-08-31T10:00:01.400Z",

                    latency_ms: 300,

                    simulator_response: {
                        success: true,
                        action_type: "TRANSFER_FUNDS",

                        state_changes: [
                            {
                                entity_type: "transaction",
                                entity_id: "txn_001",
                                change: "CREATED"
                            }
                        ]
                    },

                    error: null
                }
            ],

            error: null,

            ...overrides
        };
    }

    it("runs the complete successful evaluation pipeline", () => {
        const result = pipeline.evaluate(
            scenario(3),
            attackResult()
        );

        assert.equal(
            result.execution.execution_id,
            "exec_pipeline_001"
        );

        assert.equal(
            result.execution.scenario_id,
            "scn_pipeline_001"
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
            result.effectiveness
                .attack_effectiveness.score,
            100
        );

        assert.equal(
            result.effectiveness
                .attack_effectiveness.level,
            "COMPLETE"
        );
    });

    it("propagates state changes through the complete pipeline", () => {
        const result = pipeline.evaluate(
            scenario(3),
            attackResult()
        );

        assert.equal(
            result.observation.state_changes.length,
            3
        );

        assert.deepEqual(
            result.observation.state_changes.map(
                change => change.entity_type
            ),
            [
                "auth_event",
                "device",
                "transaction"
            ]
        );
    });

    it("handles a partially successful attack", () => {
        const result = pipeline.evaluate(
            scenario(3),
            attackResult({
                status: "FAILED",

                step_results: [
                    {
                        step_id: "step_0",
                        status: "COMPLETED",

                        latency_ms: 300,

                        simulator_response: {
                            success: true,
                            action_type: "SIMULATE_LOGIN",

                            state_changes: [
                                {
                                    entity_type: "auth_event",
                                    entity_id: "auth_001",
                                    change: "CREATED"
                                }
                            ]
                        },

                        error: null
                    },

                    {
                        step_id: "step_1",
                        status: "FAILED",

                        latency_ms: 200,

                        simulator_response: {
                            success: false,
                            action_type: "REGISTER_DEVICE",

                            state_changes: []
                        },

                        error: {
                            code: "SIMULATOR_ERROR",
                            message: "Action failed."
                        }
                    }
                ],

                error: {
                    code: "STEP_EXECUTION_FAILED"
                }
            })
        );

        assert.equal(
            result.outcome.status,
            "PARTIALLY_SUCCESSFUL"
        );

        assert.equal(
            result.effectiveness
                .attack_effectiveness.score,
            33
        );
    });

    it("handles a completely failed attack", () => {
        const result = pipeline.evaluate(
            scenario(3),
            attackResult({
                status: "FAILED",

                step_results: [
                    {
                        step_id: "step_0",
                        status: "FAILED",

                        latency_ms: 100,

                        simulator_response: {
                            success: false,
                            action_type: "SIMULATE_LOGIN",
                            state_changes: []
                        },

                        error: {
                            code: "SIMULATOR_ERROR"
                        }
                    }
                ],

                error: {
                    code: "STEP_EXECUTION_FAILED"
                }
            })
        );

        assert.equal(
            result.outcome.status,
            "FAILED"
        );

        assert.equal(
            result.effectiveness
                .attack_effectiveness.score,
            25
        );
    });

    it("handles an aborted execution", () => {
        const result = pipeline.evaluate(
            scenario(3),
            attackResult({
                status: "ABORTED",
                step_results: [],

                error: {
                    code: "EXECUTION_ABORTED"
                }
            })
        );

        assert.equal(
            result.outcome.status,
            "ABORTED"
        );

        assert.equal(
            result.effectiveness
                .attack_effectiveness.score,
            0
        );
    });

    it("does not infer defense effectiveness", () => {
        const result = pipeline.evaluate(
            scenario(3),
            attackResult()
        );

        assert.equal(
            result.effectiveness
                .defense_effectiveness.score,
            null
        );

        assert.equal(
            result.effectiveness
                .defense_effectiveness.level,
            "NOT_AVAILABLE"
        );
    });

    it("produces a valid canonical EvaluationResult", () => {
        const result = pipeline.evaluate(
            scenario(3),
            attackResult()
        );

        assert.doesNotThrow(() => {
            const {
                EvaluationResult
            } = require(
                "../../src/evaluation/EvaluationResult"
            );

            EvaluationResult.validate(result);
        });
    });

    it("rejects a missing scenario", () => {
        assert.throws(
            () =>
                pipeline.evaluate(
                    null,
                    attackResult()
                ),
            /valid AttackScenario/
        );
    });

    it("rejects a missing AttackResult", () => {
        assert.throws(
            () =>
                pipeline.evaluate(
                    scenario(),
                    null
                ),
            /valid AttackResult/
        );
    });

    it("does not expose fraud classification fields", () => {
        const result = pipeline.evaluate(
            scenario(3),
            attackResult()
        );

        assert.equal(
            Object.hasOwn(result, "fraud_detected"),
            false
        );

        assert.equal(
            Object.hasOwn(result, "fraud_score"),
            false
        );

        assert.equal(
            Object.hasOwn(result, "fraud_label"),
            false
        );
    });
});