// red-team/tests/evaluation/executionObserver.test.js

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
    ExecutionObserver
} = require("../../src/evaluation/ExecutionObserver");

describe("M4.1 ExecutionObserver", () => {
    it("normalizes a completed multi-step AttackResult", () => {
        const observer = new ExecutionObserver();

        const result = observer.observe({
            execution_id: "exec_001",
            scenario_id: "scn_001",
            status: "COMPLETED",

            started_at: "2026-08-31T10:00:00.000Z",
            completed_at: "2026-08-31T10:00:01.250Z",

            step_results: [
                {
                    step_id: "step_001",
                    status: "COMPLETED",
                    started_at: "2026-08-31T10:00:00.100Z",
                    completed_at: "2026-08-31T10:00:00.500Z",
                    latency_ms: 400,
                    simulator_response: {
                        success: true,
                        action_type: "SIMULATE_LOGIN",
                        state_changes: [
                            {
                                entity_type: "auth_event",
                                entity_id: "ev_001",
                                change: "RECORDED"
                            }
                        ]
                    },
                    error: null
                },
                {
                    step_id: "step_002",
                    status: "COMPLETED",
                    started_at: "2026-08-31T10:00:00.600Z",
                    completed_at: "2026-08-31T10:00:01.000Z",
                    latency_ms: 400,
                    simulator_response: {
                        success: true,
                        action_type: "REGISTER_DEVICE",
                        state_changes: [
                            {
                                entity_type: "device",
                                entity_id: "dev_001",
                                change: "CREATED"
                            }
                        ]
                    },
                    error: null
                }
            ],

            error: null
        });

        assert.equal(result.execution_id, "exec_001");
        assert.equal(result.scenario_id, "scn_001");
        assert.equal(result.execution_status, "COMPLETED");

        assert.equal(result.duration_ms, 1250);

        assert.equal(result.total_steps, 2);
        assert.equal(result.executed_steps, 2);
        assert.equal(result.completed_steps, 2);
        assert.equal(result.failed_steps, 0);
        assert.equal(result.skipped_steps, 0);
        assert.equal(result.timed_out_steps, 0);

        assert.equal(result.step_observations.length, 2);

        assert.equal(
            result.step_observations[0].action_type,
            "SIMULATE_LOGIN"
        );

        assert.equal(
            result.step_observations[1].action_type,
            "REGISTER_DEVICE"
        );

        assert.equal(result.state_changes.length, 2);
        assert.equal(
            result.state_changes[0].entity_type,
            "auth_event"
        );
        assert.equal(
            result.state_changes[1].entity_type,
            "device"
        );
    });

    it("observes a fail-fast execution correctly", () => {
        const observer = new ExecutionObserver();

        const result = observer.observe({
            execution_id: "exec_fail",
            scenario_id: "scn_fail",
            status: "FAILED",

            started_at: "2026-08-31T10:00:00.000Z",
            completed_at: "2026-08-31T10:00:00.800Z",

            step_results: [
                {
                    step_id: "step_1",
                    status: "COMPLETED",
                    latency_ms: 100,
                    simulator_response: {
                        success: true,
                        action_type: "SIMULATE_LOGIN",
                        state_changes: []
                    },
                    error: null
                },
                {
                    step_id: "step_2",
                    status: "FAILED",
                    latency_ms: 200,
                    simulator_response: {
                        success: false,
                        action_type: "REGISTER_DEVICE",
                        state_changes: []
                    },
                    error: {
                        code: "SIMULATOR_ERROR",
                        message: "Simulator returned 404."
                    }
                }
            ],

            error: {
                code: "STEP_EXECUTION_FAILED",
                failed_step_id: "step_2"
            }
        });

        assert.equal(result.execution_status, "FAILED");

        assert.equal(result.total_steps, 2);
        assert.equal(result.executed_steps, 2);
        assert.equal(result.completed_steps, 1);
        assert.equal(result.failed_steps, 1);

        assert.equal(result.execution_error.code, "STEP_EXECUTION_FAILED");

        assert.equal(
            result.step_observations[1].error.code,
            "SIMULATOR_ERROR"
        );
    });

    it("observes an aborted execution with zero steps", () => {
        const observer = new ExecutionObserver();

        const result = observer.observe({
            execution_id: "exec_abort",
            scenario_id: "scn_abort",
            status: "ABORTED",

            started_at: "2026-08-31T10:00:00.000Z",
            completed_at: "2026-08-31T10:00:00.001Z",

            step_results: [],

            error: {
                code: "EXECUTION_ABORTED"
            }
        });

        assert.equal(result.execution_status, "ABORTED");
        assert.equal(result.total_steps, 0);
        assert.equal(result.executed_steps, 0);
        assert.equal(result.completed_steps, 0);
        assert.equal(result.failed_steps, 0);
        assert.equal(result.state_changes.length, 0);

        assert.equal(
            result.execution_error.code,
            "EXECUTION_ABORTED"
        );
    });

    it("counts skipped and timed-out steps separately", () => {
        const observer = new ExecutionObserver();

        const result = observer.observe({
            execution_id: "exec_statuses",
            scenario_id: "scn_statuses",
            status: "FAILED",

            started_at: "2026-08-31T10:00:00.000Z",
            completed_at: "2026-08-31T10:00:02.000Z",

            step_results: [
                {
                    step_id: "step_ok",
                    status: "COMPLETED",
                    simulator_response: {
                        success: true,
                        state_changes: []
                    }
                },
                {
                    step_id: "step_skip",
                    status: "SKIPPED",
                    simulator_response: {}
                },
                {
                    step_id: "step_timeout",
                    status: "TIMED_OUT",
                    simulator_response: {}
                }
            ],

            error: null
        });

        assert.equal(result.total_steps, 3);
        assert.equal(result.executed_steps, 3);

        assert.equal(result.completed_steps, 1);
        assert.equal(result.skipped_steps, 1);
        assert.equal(result.timed_out_steps, 1);
        assert.equal(result.failed_steps, 0);
    });

    it("normalizes missing state_changes to an empty array", () => {
        const observer = new ExecutionObserver();

        const result = observer.observe({
            execution_id: "exec_empty",
            scenario_id: "scn_empty",
            status: "COMPLETED",

            started_at: "2026-08-31T10:00:00.000Z",
            completed_at: "2026-08-31T10:00:00.100Z",

            step_results: [
                {
                    step_id: "step_001",
                    status: "COMPLETED",
                    simulator_response: {
                        success: true,
                        action_type: "SIMULATE_LOGIN"
                    }
                }
            ],

            error: null
        });

        assert.deepEqual(
            result.step_observations[0].state_changes,
            []
        );

        assert.deepEqual(
            result.state_changes,
            []
        );
    });

    it("returns null duration when timestamps are unavailable", () => {
        const observer = new ExecutionObserver();

        const result = observer.observe({
            execution_id: "exec_time",
            scenario_id: "scn_time",
            status: "COMPLETED",

            started_at: null,
            completed_at: null,

            step_results: [],

            error: null
        });

        assert.equal(result.duration_ms, null);
    });

    it("rejects an invalid AttackResult", () => {
        const observer = new ExecutionObserver();

        assert.throws(
            () => observer.observe(null),
            /non-null AttackResult object/
        );

        assert.throws(
            () =>
                observer.observe({
                    execution_id: "exec_001",
                    scenario_id: "scn_001",
                    status: "COMPLETED",
                    step_results: "invalid"
                }),
            /step_results must be an array/
        );
    });
});