const { Kafka, Partitioners } = require("kafkajs");
const config = require("./env");

const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers
});

const producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner
});

async function connectKafka() {
    await producer.connect();

    console.log(
        "Kafka connected:",
        config.kafka.brokers.join(", ")
    );
}

async function disconnectKafka() {
    try {
        await producer.disconnect();
    } catch (e) {
        // ignore on shutdown
    }
}

module.exports = {
    kafka,
    producer,
    connectKafka,
    disconnectKafka
};