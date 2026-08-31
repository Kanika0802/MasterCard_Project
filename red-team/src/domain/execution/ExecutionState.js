// red-team/src/domain/execution/ExecutionState.js

const ExecutionState = Object.freeze({
    CREATED: "CREATED",
    VALIDATING: "VALIDATING",
    VALIDATED: "VALIDATED",
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    ABORTED: "ABORTED"
});

const StepExecutionStatus = Object.freeze({
    PENDING: "PENDING",
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    SKIPPED: "SKIPPED",
    TIMED_OUT: "TIMED_OUT"
});

function isValidExecutionState(state) {
    return Object.values(ExecutionState).includes(state);
}

function isValidStepStatus(status) {
    return Object.values(StepExecutionStatus).includes(status);
}

module.exports = {
    ExecutionState,
    StepExecutionStatus,
    isValidExecutionState,
    isValidStepStatus
};
