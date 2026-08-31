// blueteam/tests/unit/kafkaConsumer.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const BlueTeamKafkaConsumer = require("../../src/stream/KafkaConsumer");
const StreamProcessor = require("../../src/stream/StreamProcessor");
const DefenseEngine = require("../../src/DefenseEngine");
const { KafkaTopics } = require("../../src/domain/constants");

describe("M3 Blue Team Kafka Consumer & Stream Startup Unit Tests", () => {
    it("should export all expected simulator KafkaTopics", () => {
        assert.ok(KafkaTopics.USERS);
        assert.ok(KafkaTopics.ACCOUNTS);
        assert.ok(KafkaTopics.TRANSACTIONS);
        assert.ok(KafkaTopics.DEVICES);
        assert.ok(KafkaTopics.KYC);
        assert.ok(KafkaTopics.BENEFICIARIES);
        assert.ok(KafkaTopics.AUTH);
        assert.ok(KafkaTopics.SIMULATIONS);

        assert.strictEqual(KafkaTopics.USERS, "simulator.users.v1");
        assert.strictEqual(KafkaTopics.ACCOUNTS, "simulator.accounts.v1");
        assert.strictEqual(KafkaTopics.TRANSACTIONS, "simulator.transactions.v1");
        assert.strictEqual(KafkaTopics.DEVICES, "simulator.devices.v1");
        assert.strictEqual(KafkaTopics.KYC, "simulator.kyc.v1");
        assert.strictEqual(KafkaTopics.BENEFICIARIES, "simulator.beneficiaries.v1");
        assert.strictEqual(KafkaTopics.AUTH, "simulator.auth.v1");
        assert.strictEqual(KafkaTopics.SIMULATIONS, "simulator.simulations.v1");
    });

    it("should initialize BlueTeamKafkaConsumer with default configuration", () => {
        const streamProcessor = new StreamProcessor();
        const consumer = new BlueTeamKafkaConsumer(streamProcessor);

        assert.strictEqual(consumer.groupId, "aipaysec-blueteam-group");
        assert.strictEqual(consumer.allowAutoTopicCreation, true);
        assert.strictEqual(consumer.isConnected, false);
        assert.strictEqual(consumer.isRunning, false);
        assert.ok(Array.isArray(consumer.topics));
        assert.strictEqual(consumer.topics.length, 8);
        assert.ok(consumer.topics.includes("simulator.transactions.v1"));
        assert.ok(consumer.topics.includes("simulator.devices.v1"));
    });

    it("should accept custom options in BlueTeamKafkaConsumer", () => {
        const streamProcessor = new StreamProcessor();
        const customTopics = ["simulator.custom.v1"];
        const consumer = new BlueTeamKafkaConsumer(streamProcessor, {
            groupId: "custom-defense-group",
            brokers: ["localhost:9093"],
            topics: customTopics,
            allowAutoTopicCreation: false
        });

        assert.strictEqual(consumer.groupId, "custom-defense-group");
        assert.deepStrictEqual(consumer.brokers, ["localhost:9093"]);
        assert.deepStrictEqual(consumer.topics, customTopics);
        assert.strictEqual(consumer.allowAutoTopicCreation, false);
    });

    it("should cleanly manage defense engine Kafka stream lifecycle", async () => {
        const engine = new DefenseEngine();
        assert.strictEqual(engine.kafkaConsumer, null);

        // When stopping before start, should be a safe no-op
        await engine.stopKafkaStream();
        assert.strictEqual(engine.kafkaConsumer, null);
    });
});
