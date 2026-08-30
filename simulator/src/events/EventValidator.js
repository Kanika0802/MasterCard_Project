// simulator/src/events/EventValidator.js

const { ValidationError } = require("../domain/errors");
const { EventType } = require("../domain/constants");

class EventValidator {
    static validate(event) {
        if (!event) throw new ValidationError("Event cannot be null or undefined.");

        const json = typeof event.toJSON === "function" ? event.toJSON() : event;

        // Verify required envelope keys
        const requiredKeys = [
            "event_id",
            "event_type",
            "event_version",
            "occurred_at",
            "simulation_id",
            "experiment_id",
            "source",
            "entity_type",
            "entity_id",
            "payload"
        ];

        for (const key of requiredKeys) {
            if (json[key] === undefined || json[key] === null || json[key] === "") {
                throw new ValidationError(`Missing required event field: ${key}`);
            }
        }

        if (json.source !== "bank_simulator") {
            throw new ValidationError(`Invalid event source: ${json.source}. Must be 'bank_simulator'.`);
        }

        // Validate payload structure if specific type
        if (json.entity_type === "transaction" && json.payload) {
            if (!json.payload.transaction_id) throw new ValidationError("Transaction payload missing transaction_id");
            if (json.payload.amount === undefined || json.payload.amount <= 0) {
                throw new ValidationError("Transaction payload amount must be positive");
            }
        }

        return true;
    }
}

module.exports = EventValidator;
