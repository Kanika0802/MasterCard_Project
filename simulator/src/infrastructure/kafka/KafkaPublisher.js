// simulator/src/infrastructure/kafka/KafkaPublisher.js

const EventPublisher = require("../../events/EventPublisher");
const { producer } = require("../../config/kafka");

class KafkaPublisher extends EventPublisher {
    constructor(kafkaProducer = producer) {
        super();
        this.producer = kafkaProducer;
    }

    async _doPublish(event, topic, partitionKey) {
        const payloadJson = JSON.stringify(typeof event.toJSON === "function" ? event.toJSON() : event);
        
        await this.producer.send({
            topic,
            messages: [
                {
                    key: partitionKey ? String(partitionKey) : String(event.entity_id),
                    value: payloadJson,
                    headers: {
                        eventType: event.event_type,
                        eventId: event.event_id,
                        simulationId: event.simulation_id || "default"
                    }
                }
            ]
        });

        return {
            success: true,
            eventId: event.event_id,
            topic
        };
    }
}

module.exports = KafkaPublisher;
