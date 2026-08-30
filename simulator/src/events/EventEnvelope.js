// simulator/src/events/EventEnvelope.js

const crypto = require("crypto");
const { ValidationError } = require("../domain/errors");

const VALID_ENTITY_TYPES = ["user", "account", "transaction", "device", "kyc", "beneficiary", "auth_event", "simulation"];

class EventEnvelope {
    constructor({
        event_id = crypto.randomUUID(),
        event_type,
        event_version = 1,
        occurred_at = new Date().toISOString(),
        simulation_time = null,
        simulation_id = "default_sim",
        experiment_id = "default_exp",
        source = "bank_simulator",
        entity_type,
        entity_id,
        actor_id = null,
        device_id = null,
        correlation_id = null,
        causation_id = null,
        idempotency_key = null,
        payload = {},
        adversarial_metadata = null
    }) {
        this.event_id = event_id;
        this.event_type = event_type;
        this.event_version = event_version;
        this.occurred_at = occurred_at instanceof Date ? occurred_at.toISOString() : occurred_at;
        this.simulation_time = simulation_time instanceof Date ? simulation_time.toISOString() : simulation_time;
        this.simulation_id = simulation_id;
        this.experiment_id = experiment_id;
        this.source = source;
        this.entity_type = entity_type;
        this.entity_id = entity_id;
        this.actor_id = actor_id;
        this.device_id = device_id;
        this.correlation_id = correlation_id;
        this.causation_id = causation_id;
        this.idempotency_key = idempotency_key;
        this.payload = payload;
        this.adversarial_metadata = adversarial_metadata;

        this.validate();
    }

    validate() {
        if (!this.event_id) throw new ValidationError("event_id is required in EventEnvelope.");
        if (!this.event_type) throw new ValidationError("event_type is required in EventEnvelope.");
        if (!this.occurred_at) throw new ValidationError("occurred_at is required in EventEnvelope.");
        if (!this.simulation_id) throw new ValidationError("simulation_id is required in EventEnvelope.");
        if (!this.experiment_id) throw new ValidationError("experiment_id is required in EventEnvelope.");
        if (this.source !== "bank_simulator") throw new ValidationError("source must be 'bank_simulator'.");
        if (!VALID_ENTITY_TYPES.includes(this.entity_type)) {
            throw new ValidationError(`Invalid entity_type: ${this.entity_type}. Expected one of: ${VALID_ENTITY_TYPES.join(", ")}`);
        }
        if (!this.entity_id) throw new ValidationError("entity_id is required in EventEnvelope.");
        if (typeof this.payload !== "object" || this.payload === null) {
            throw new ValidationError("payload must be a non-null object.");
        }
    }

    toJSON() {
        return {
            event_id: this.event_id,
            event_type: this.event_type,
            event_version: this.event_version,
            occurred_at: this.occurred_at,
            simulation_time: this.simulation_time,
            simulation_id: this.simulation_id,
            experiment_id: this.experiment_id,
            source: this.source,
            entity_type: this.entity_type,
            entity_id: this.entity_id,
            actor_id: this.actor_id,
            device_id: this.device_id,
            correlation_id: this.correlation_id,
            causation_id: this.causation_id,
            idempotency_key: this.idempotency_key,
            payload: this.payload,
            adversarial_metadata: this.adversarial_metadata
        };
    }
}

module.exports = EventEnvelope;
