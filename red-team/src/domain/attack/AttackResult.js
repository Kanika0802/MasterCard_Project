// red-team/src/domain/attack/AttackResult.js

const StepResult = require("../execution/StepResult");
const { ExecutionState, isValidExecutionState } = require("../execution/ExecutionState");
const { ScenarioValidationError } = require("../errors");

const FORBIDDEN_FRAUD_FIELDS = ["fraud_score", "is_fraud", "detection_result", "fraud_label", "blue_team_label"];

class AttackResult {
    constructor({
        execution_id,
        scenario_id,
        status,
        started_at = new Date(),
        completed_at = new Date(),
        step_results = [],
        error = null,
        metadata = {}
    }) {
        this.execution_id = execution_id;
        this.scenario_id = scenario_id;
        this.status = status;
        this.started_at = started_at instanceof Date ? started_at.toISOString() : started_at;
        this.completed_at = completed_at instanceof Date ? completed_at.toISOString() : completed_at;
        this.step_results = Array.isArray(step_results)
            ? step_results.map(r => (r instanceof StepResult ? r : StepResult.fromJSON(r)))
            : step_results;
        this.error = error;
        this.metadata = metadata || {};

        this.validate();
    }

    validate() {
        if (!this.execution_id || typeof this.execution_id !== "string" || !this.execution_id.trim()) {
            throw new ScenarioValidationError("AttackResult requires a non-empty string 'execution_id'.");
        }
        if (!this.scenario_id || typeof this.scenario_id !== "string" || !this.scenario_id.trim()) {
            throw new ScenarioValidationError("AttackResult requires a non-empty string 'scenario_id'.");
        }
        if (!this.status || !isValidExecutionState(this.status)) {
            throw new ScenarioValidationError(`Invalid or missing AttackResult status: '${this.status}'.`);
        }
        if (!Array.isArray(this.step_results)) {
            throw new ScenarioValidationError("AttackResult step_results must be an array.");
        }
        for (const res of this.step_results) {
            if (!(res instanceof StepResult)) {
                throw new ScenarioValidationError("All items in 'step_results' must be valid StepResult instances.");
            }
        }

        // Ensure no fraud labels are attached
        for (const key of Object.keys(this.metadata)) {
            if (FORBIDDEN_FRAUD_FIELDS.includes(key.toLowerCase())) {
                throw new ScenarioValidationError(
                    `Forbidden fraud classification field '${key}' found in AttackResult metadata.`
                );
            }
        }
    }

    isSuccess() {
        return this.status === ExecutionState.COMPLETED && !this.error;
    }

    toJSON() {
        return {
            execution_id: this.execution_id,
            scenario_id: this.scenario_id,
            status: this.status,
            started_at: this.started_at,
            completed_at: this.completed_at,
            step_results: this.step_results.map(r => r.toJSON()),
            error: this.error,
            metadata: this.metadata
        };
    }

    static fromJSON(json) {
        if (!json || typeof json !== "object") {
            throw new ScenarioValidationError("Malformed AttackResult JSON object.");
        }
        return new AttackResult({
            execution_id: json.execution_id,
            scenario_id: json.scenario_id,
            status: json.status,
            started_at: json.started_at,
            completed_at: json.completed_at,
            step_results: json.step_results,
            error: json.error,
            metadata: json.metadata
        });
    }
}

module.exports = AttackResult;
