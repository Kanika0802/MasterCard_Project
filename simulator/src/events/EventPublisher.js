// simulator/src/events/EventPublisher.js

const EventValidator = require("./EventValidator");

class EventPublisher {
    /**
     * @param {import('./EventEnvelope')} event
     * @param {string} topic
     * @param {string} partitionKey
     */
    async publish(event, topic, partitionKey) {
        EventValidator.validate(event);
        return this._doPublish(event, topic, partitionKey);
    }

    async _doPublish(event, topic, partitionKey) {
        throw new Error("_doPublish must be implemented by subclass");
    }
}

module.exports = EventPublisher;
