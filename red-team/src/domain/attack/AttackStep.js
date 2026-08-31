// red-team/src/domain/attack/AttackStep.js

const AttackTarget = require("./AttackTarget");
const { StepValidationError } = require("../errors");

const ALLOWED_SIMULATOR_ACTIONS = [
    "ADD_BENEFICIARY",
    "PERFORM_TRANSACTION",
    "SIMULATE_LOGIN",
    "REGISTER_DEVICE",
    "UPDATE_KYC",
    "CHANGE_ACCOUNT_STATUS"
];

class AttackStep {
    constructor({
        step_id,
        primitive_id = null,
        action,
        parameters = {},
        target = null,
        depends_on = [],
        condition = null,
        timeout_ms = 5000
    }) {
        this.step_id = step_id;
        this.primitive_id = primitive_id;
        this.action = action;
        this.parameters = parameters;
        this.target = target ? (target instanceof AttackTarget ? target : AttackTarget.fromJSON(target)) : null;
        this.depends_on = depends_on;
        this.condition = condition;
        this.timeout_ms = timeout_ms;

        this.validate();
    }

    validate() {
        if (!this.step_id || typeof this.step_id !== "string" || !this.step_id.trim()) {
            throw new StepValidationError("AttackStep requires a non-empty string 'step_id'.");
        }
        if (!this.action || typeof this.action !== "string" || !this.action.trim()) {
            throw new StepValidationError(`AttackStep '${this.step_id}' requires a non-empty string 'action'.`);
        }
        if (typeof this.parameters !== "object" || this.parameters === null || Array.isArray(this.parameters)) {
            throw new StepValidationError(`AttackStep '${this.step_id}' parameters must be a non-null object.`);
        }

        // Prevent arbitrary executable code / function injection in parameters
        for (const [key, value] of Object.entries(this.parameters)) {
            if (typeof value === "function") {
                throw new StepValidationError(`AttackStep '${this.step_id}' contains invalid executable function in parameter '${key}'.`);
            }
        }

        if (!Array.isArray(this.depends_on)) {
            throw new StepValidationError(`AttackStep '${this.step_id}' 'depends_on' must be an array of step_ids.`);
        }
        for (const dep of this.depends_on) {
            if (typeof dep !== "string" || !dep.trim()) {
                throw new StepValidationError(`AttackStep '${this.step_id}' contains invalid dependency '${dep}'.`);
            }
        }

        if (typeof this.timeout_ms !== "number" || isNaN(this.timeout_ms) || this.timeout_ms <= 0) {
            throw new StepValidationError(`AttackStep '${this.step_id}' 'timeout_ms' must be a positive number.`);
        }
    }

    toJSON() {
        return {
            step_id: this.step_id,
            primitive_id: this.primitive_id,
            action: this.action,
            parameters: this.parameters,
            target: this.target ? this.target.toJSON() : null,
            depends_on: this.depends_on,
            condition: this.condition,
            timeout_ms: this.timeout_ms
        };
    }

    static fromJSON(json) {
        if (!json || typeof json !== "object") {
            throw new StepValidationError("Malformed step object.");
        }
        return new AttackStep({
            step_id: json.step_id,
            primitive_id: json.primitive_id,
            action: json.action,
            parameters: json.parameters,
            target: json.target,
            depends_on: json.depends_on,
            condition: json.condition,
            timeout_ms: json.timeout_ms
        });
    }
}

module.exports = AttackStep;
module.exports.ALLOWED_SIMULATOR_ACTIONS = ALLOWED_SIMULATOR_ACTIONS;
