// simulator/tests/unit/eventContract.test.js

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const EventEnvelope = require("../../src/events/EventEnvelope");
const EventFactory = require("../../src/events/EventFactory");
const EventValidator = require("../../src/events/EventValidator");
const { EventType, KafkaTopics } = require("../../src/domain/constants");
const { ValidationError } = require("../../src/domain/errors");

describe("Event System & Contract Unit Tests", () => {
    it("should build a valid canonical EventEnvelope", () => {
        const event = EventFactory.create({
            event_type: EventType.TRANSACTION_COMPLETED,
            entity_type: "transaction",
            entity_id: "tx_999",
            actor_id: "usr_111",
            device_id: "dev_222",
            simulation_id: "sim_test",
            experiment_id: "exp_test",
            payload: {
                transaction_id: "tx_999",
                amount: 500,
                currency: "USD",
                status: "COMPLETED"
            }
        });

        assert.equal(event.source, "bank_simulator");
        assert.equal(event.event_type, EventType.TRANSACTION_COMPLETED);
        assert.equal(event.entity_type, "transaction");
        assert.ok(event.occurred_at);

        const isValid = EventValidator.validate(event);
        assert.equal(isValid, true);
    });

    it("should resolve correct Kafka topics based on event prefix", () => {
        assert.equal(EventFactory.getTopicForEventType(EventType.USER_CREATED), KafkaTopics.USERS);
        assert.equal(EventFactory.getTopicForEventType(EventType.ACCOUNT_CREATED), KafkaTopics.ACCOUNTS);
        assert.equal(EventFactory.getTopicForEventType(EventType.TRANSACTION_COMPLETED), KafkaTopics.TRANSACTIONS);
        assert.equal(EventFactory.getTopicForEventType(EventType.DEVICE_REGISTERED), KafkaTopics.DEVICES);
        assert.equal(EventFactory.getTopicForEventType(EventType.KYC_CREATED), KafkaTopics.KYC);
        assert.equal(EventFactory.getTopicForEventType(EventType.BENEFICIARY_ADDED), KafkaTopics.BENEFICIARIES);
        assert.equal(EventFactory.getTopicForEventType(EventType.AUTH_LOGIN_SUCCESS), KafkaTopics.AUTH);
        assert.equal(EventFactory.getTopicForEventType(EventType.SIMULATION_STARTED), KafkaTopics.SIMULATIONS);
    });

    it("should reject invalid EventEnvelope missing required fields", () => {
        assert.throws(() => {
            new EventEnvelope({
                event_type: null,
                entity_type: "user",
                entity_id: "usr_1"
            });
        }, ValidationError);
    });
});
