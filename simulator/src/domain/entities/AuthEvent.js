// simulator/src/domain/entities/AuthEvent.js

const { ValidationError } = require("../errors");
const { EventType } = require("../constants");

class AuthEvent {
    constructor({
        event_id,
        user_id,
        device_id = null,
        event_type,
        timestamp = new Date(),
        simulation_id = null,
        experiment_id = null,
        metadata = {}
    }) {
        this.event_id = event_id;
        this.user_id = user_id;
        this.device_id = device_id;
        this.event_type = event_type;
        this.timestamp = timestamp instanceof Date ? timestamp.toISOString() : timestamp;
        this.simulation_id = simulation_id;
        this.experiment_id = experiment_id;
        this.metadata = metadata;

        this.validate();
    }

    validate() {
        if (!this.event_id) throw new ValidationError("event_id is required.");
        if (!this.user_id) throw new ValidationError("user_id is required.");
        if (!this.event_type) throw new ValidationError("event_type is required.");
    }

    toJSON() {
        return {
            _id: this.event_id,
            event_id: this.event_id,
            user_id: this.user_id,
            device_id: this.device_id,
            event_type: this.event_type,
            timestamp: this.timestamp,
            simulation_id: this.simulation_id,
            experiment_id: this.experiment_id,
            metadata: this.metadata
        };
    }
}

module.exports = AuthEvent;
