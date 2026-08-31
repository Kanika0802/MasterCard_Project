// blueteam/src/stream/KafkaConsumer.js
"use strict";

const { Kafka } = require("kafkajs");
const { KafkaTopics } = require("../domain/constants");

class BlueTeamKafkaConsumer {
    constructor(streamProcessor, options = {}) {
        this.streamProcessor = streamProcessor;
        this.brokers = options.brokers || (process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(",") : ["localhost:9092"]);
        this.groupId = options.groupId || "aipaysec-blueteam-group";
        this.topics = options.topics || Object.values(KafkaTopics);

        this.kafka = new Kafka({
            clientId: options.clientId || "aipaysec-blueteam-defense",
            brokers: this.brokers,
            retry: {
                initialRetryTime: 300,
                retries: 2
            }
        });

        this.consumer = null;
        this.isConnected = false;
        this.isRunning = false;
        this.allowAutoTopicCreation = options.allowAutoTopicCreation !== undefined ? options.allowAutoTopicCreation : true;
    }

    async connect() {
        if (this.isConnected) return;
        try {
            this.consumer = this.kafka.consumer({
                groupId: this.groupId,
                allowAutoTopicCreation: this.allowAutoTopicCreation
            });
            await this.consumer.connect();
            this.isConnected = true;
        } catch (err) {
            this.isConnected = false;
            throw err;
        }
    }

    async start() {
        if (!this.isConnected) {
            await this.connect();
        }

        for (const topic of this.topics) {
            await this.consumer.subscribe({ topic, fromBeginning: false });
        }

        this.isRunning = true;
        await this.consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const rawValue = message.value.toString("utf8");
                    const event = JSON.parse(rawValue);
                    await this.streamProcessor.processEvent(event);
                } catch (err) {
                    // Log error and continue stream consumption
                }
            }
        });
    }

    async stop() {
        if (this.consumer && this.isConnected) {
            await this.consumer.disconnect();
            this.isConnected = false;
            this.isRunning = false;
        }
    }
}

module.exports = BlueTeamKafkaConsumer;
