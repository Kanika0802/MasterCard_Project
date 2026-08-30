// red-team/src/domain/execution/ExecutionContext.js

const crypto = require("crypto");
const { ScenarioValidationError } = require("../errors");

class ExecutionContext {
    constructor({
        execution_id = crypto.randomUUID(),
        scenario_id,
        simulation_id,
        experiment_id,
        correlation_id = null,
        causation_id = null,
        metadata = {}
    }) {
        this.execution_id = execution_id;
        this.scenario_id = scenario_id;
        this.simulation_id = simulation_id;
        this.experiment_id = experiment_id;
        this.correlation_id = correlation_id || execution_id;
        this.causation_id = causation_id;
        this.metadata = metadata || {};

        this.validate();
    }

    validate() {
        if (!this.execution_id || typeof this.execution_id !== "string" || !this.execution_id.trim()) {
            throw new ScenarioValidationError("ExecutionContext requires a non-empty string 'execution_id'.");
        }
        if (!this.scenario_id || typeof this.scenario_id !== "string" || !this.scenario_id.trim()) {
            throw new ScenarioValidationError("ExecutionContext requires a non-empty string 'scenario_id'.");
        }
        if (!this.simulation_id || typeof this.simulation_id !== "string" || !this.simulation_id.trim()) {
            throw new ScenarioValidationError("ExecutionContext requires a non-empty string 'simulation_id'.");
        }
        if (!this.experiment_id || typeof this.experiment_id !== "string" || !this.experiment_id.trim()) {
            throw new ScenarioValidationError("ExecutionContext requires a non-empty string 'experiment_id'.");
        }
    }

    toJSON() {
        return {
            execution_id: this.execution_id,
            scenario_id: this.scenario_id,
            simulation_id: this.simulation_id,
            experiment_id: this.experiment_id,
            correlation_id: this.correlation_id,
            causation_id: this.causation_id,
            metadata: this.metadata
        };
    }

    static fromJSON(json) {
        if (!json || typeof json !== "object") {
            throw new ScenarioValidationError("Malformed execution context JSON object.");
        }
        return new ExecutionContext({
            execution_id: json.execution_id,
            scenario_id: json.scenario_id,
            simulation_id: json.simulation_id,
            experiment_id: json.experiment_id,
            correlation_id: json.correlation_id,
            causation_id: json.causation_id,
            metadata: json.metadata
        });
    }
}

module.exports = ExecutionContext;
