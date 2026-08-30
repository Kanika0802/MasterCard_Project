// red-team/src/domain/execution/StepResult.js

const { StepExecutionStatus, isValidStepStatus } = require("./ExecutionState");
const { StepValidationError } = require("../errors");

class StepResult {
    constructor({
        step_id,
        status,
        started_at = new Date(),
        completed_at = new Date(),
        latency_ms = 0,
        simulator_response = {},
        error = null
    }) {
        this.step_id = step_id;
        this.status = status;
        this.started_at = started_at instanceof Date ? started_at.toISOString() : started_at;
        this.completed_at = completed_at instanceof Date ? completed_at.toISOString() : completed_at;
        this.latency_ms = typeof latency_ms === "number" ? latency_ms : 0;
        this.simulator_response = simulator_response || {};
        this.error = error;

        this.validate();
    }

    validate() {
        if (!this.step_id || typeof this.step_id !== "string" || !this.step_id.trim()) {
            throw new StepValidationError("StepResult requires a non-empty string 'step_id'.");
        }
        if (!this.status || !isValidStepStatus(this.status)) {
            throw new StepValidationError(`Invalid or missing StepResult status: '${this.status}'.`);
        }
        if (typeof this.latency_ms !== "number" || isNaN(this.latency_ms) || this.latency_ms < 0) {
            throw new StepValidationError(`StepResult latency_ms cannot be negative. Value: ${this.latency_ms}`);
        }
    }

    isSuccess() {
        return this.status === StepExecutionStatus.COMPLETED && !this.error;
    }

    toJSON() {
        return {
            step_id: this.step_id,
            status: this.status,
            started_at: this.started_at,
            completed_at: this.completed_at,
            latency_ms: this.latency_ms,
            simulator_response: this.simulator_response,
            error: this.error
        };
    }

    static fromJSON(json) {
        if (!json || typeof json !== "object") {
            throw new StepValidationError("Malformed StepResult JSON object.");
        }
        return new StepResult({
            step_id: json.step_id,
            status: json.status,
            started_at: json.started_at,
            completed_at: json.completed_at,
            latency_ms: json.latency_ms,
            simulator_response: json.simulator_response,
            error: json.error
        });
    }
}

module.exports = StepResult;
