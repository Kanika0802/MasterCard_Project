// simulator/src/events/EventFactory.js

const EventEnvelope = require("./EventEnvelope");
const { KafkaTopics } = require("../domain/constants");

class EventFactory {
    static getTopicForEventType(eventType) {
        if (eventType.startsWith("USER_")) return KafkaTopics.USERS;
        if (eventType.startsWith("ACCOUNT_")) return KafkaTopics.ACCOUNTS;
        if (eventType.startsWith("TRANSACTION_")) return KafkaTopics.TRANSACTIONS;
        if (eventType.startsWith("DEVICE_")) return KafkaTopics.DEVICES;
        if (eventType.startsWith("KYC_")) return KafkaTopics.KYC;
        if (eventType.startsWith("BENEFICIARY_")) return KafkaTopics.BENEFICIARIES;
        if (eventType.startsWith("AUTH_")) return KafkaTopics.AUTH;
        if (eventType.startsWith("SIMULATION_")) return KafkaTopics.SIMULATIONS;
        return "simulator.misc.v1";
    }

    static create({
        event_type,
        entity_type,
        entity_id,
        payload,
        simulation_id = "sim_default",
        experiment_id = "exp_default",
        simulation_time = null,
        actor_id = null,
        device_id = null,
        correlation_id = null,
        causation_id = null,
        idempotency_key = null,
        adversarial_metadata = null
    }) {
        return new EventEnvelope({
            event_type,
            entity_type,
            entity_id,
            payload,
            simulation_id,
            experiment_id,
            simulation_time,
            actor_id,
            device_id,
            correlation_id,
            causation_id,
            idempotency_key,
            adversarial_metadata
        });
    }
}

module.exports = EventFactory;
