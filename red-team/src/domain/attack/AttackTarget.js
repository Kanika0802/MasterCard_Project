// red-team/src/domain/attack/AttackTarget.js

const { ScenarioValidationError } = require("../errors");

const VALID_TARGET_ENTITY_TYPES = ["user", "account", "device", "kyc", "beneficiary", "merchant", "system"];

class AttackTarget {
    constructor({ entity_type, entity_id }) {
        this.entity_type = entity_type;
        this.entity_id = entity_id;

        this.validate();
    }

    validate() {
        if (!this.entity_type || typeof this.entity_type !== "string" || !this.entity_type.trim()) {
            throw new ScenarioValidationError("AttackTarget requires a non-empty string 'entity_type'.");
        }
        if (!VALID_TARGET_ENTITY_TYPES.includes(this.entity_type.toLowerCase())) {
            throw new ScenarioValidationError(
                `Invalid AttackTarget entity_type '${this.entity_type}'. Must be one of: ${VALID_TARGET_ENTITY_TYPES.join(", ")}`
            );
        }
        if (!this.entity_id || typeof this.entity_id !== "string" || !this.entity_id.trim()) {
            throw new ScenarioValidationError("AttackTarget requires a non-empty string 'entity_id'.");
        }
    }

    toJSON() {
        return {
            entity_type: this.entity_type.toLowerCase(),
            entity_id: this.entity_id
        };
    }

    static fromJSON(json) {
        if (!json || typeof json !== "object") {
            throw new ScenarioValidationError("Malformed target object.");
        }
        return new AttackTarget({
            entity_type: json.entity_type,
            entity_id: json.entity_id
        });
    }
}

module.exports = AttackTarget;
