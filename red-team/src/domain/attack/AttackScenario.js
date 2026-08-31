// red-team/src/domain/attack/AttackScenario.js

const AttackStep = require("./AttackStep");
const AttackTarget = require("./AttackTarget");
const { ScenarioValidationError } = require("../errors");

const FORBIDDEN_FRAUD_FIELDS = ["fraud_score", "is_fraud", "detection_result", "fraud_label", "blue_team_label"];

class AttackScenario {
    constructor({
        scenario_id,
        version = 1,
        objective,
        simulation_id,
        experiment_id,
        target = null,
        steps = [],
        constraints = {},
        metadata = {}
    }) {
        this.scenario_id = scenario_id;
        this.version = version;
        this.objective = objective;
        this.simulation_id = simulation_id;
        this.experiment_id = experiment_id;
        this.target = target ? (target instanceof AttackTarget ? target : AttackTarget.fromJSON(target)) : null;
        this.steps = Array.isArray(steps)
            ? steps.map(s => (s instanceof AttackStep ? s : AttackStep.fromJSON(s)))
            : steps;
        this.constraints = constraints || {};
        this.metadata = metadata || {};

        this.validate();
    }

    validate() {
        if (!this.scenario_id || typeof this.scenario_id !== "string" || !this.scenario_id.trim()) {
            throw new ScenarioValidationError("AttackScenario requires a non-empty string 'scenario_id'.");
        }
        if (!this.simulation_id || typeof this.simulation_id !== "string" || !this.simulation_id.trim()) {
            throw new ScenarioValidationError("AttackScenario requires a non-empty string 'simulation_id'.");
        }
        if (!this.experiment_id || typeof this.experiment_id !== "string" || !this.experiment_id.trim()) {
            throw new ScenarioValidationError("AttackScenario requires a non-empty string 'experiment_id'.");
        }
        if (!this.objective || typeof this.objective !== "string" || !this.objective.trim()) {
            throw new ScenarioValidationError("AttackScenario requires a non-empty string 'objective'.");
        }
        if (!Array.isArray(this.steps) || this.steps.length === 0) {
            throw new ScenarioValidationError("AttackScenario requires a non-empty array of 'steps'.");
        }

        // Validate uniqueness of step_ids and dependencies
        const stepIdSet = new Set();
        for (const step of this.steps) {
            if (!(step instanceof AttackStep)) {
                throw new ScenarioValidationError("All items in 'steps' must be valid AttackStep instances.");
            }
            if (stepIdSet.has(step.step_id)) {
                throw new ScenarioValidationError(`Duplicate step_id '${step.step_id}' found in scenario '${this.scenario_id}'.`);
            }
            stepIdSet.add(step.step_id);
        }

        for (const step of this.steps) {
            for (const depId of step.depends_on) {
                if (depId === step.step_id) {
                    throw new ScenarioValidationError(`Step '${step.step_id}' cannot depend on itself.`);
                }
                if (!stepIdSet.has(depId)) {
                    throw new ScenarioValidationError(`Step '${step.step_id}' depends on non-existent step '${depId}'.`);
                }
            }
        }

        // Ensure no fraud labels are present in the scenario or metadata
        this._assertNoFraudLabels(this.metadata, "metadata");
        this._assertNoFraudLabels(this.constraints, "constraints");
    }

    _assertNoFraudLabels(obj, locationName) {
        if (!obj || typeof obj !== "object") return;
        for (const key of Object.keys(obj)) {
            if (FORBIDDEN_FRAUD_FIELDS.includes(key.toLowerCase())) {
                throw new ScenarioValidationError(
                    `Forbidden fraud classification field '${key}' found in ${locationName}. Red Team cannot decide fraud labels.`
                );
            }
        }
    }

    toJSON() {
        return {
            scenario_id: this.scenario_id,
            version: this.version,
            objective: this.objective,
            simulation_id: this.simulation_id,
            experiment_id: this.experiment_id,
            target: this.target ? this.target.toJSON() : null,
            steps: this.steps.map(s => s.toJSON()),
            constraints: this.constraints,
            metadata: this.metadata
        };
    }

    static fromJSON(json) {
        if (!json || typeof json !== "object") {
            throw new ScenarioValidationError("Malformed scenario JSON object.");
        }
        return new AttackScenario({
            scenario_id: json.scenario_id,
            version: json.version,
            objective: json.objective,
            simulation_id: json.simulation_id,
            experiment_id: json.experiment_id,
            target: json.target,
            steps: json.steps,
            constraints: json.constraints,
            metadata: json.metadata
        });
    }
}

module.exports = AttackScenario;
