// simulator/src/outbox/OutboxRelay.js

const OutboxRepository = require("../infrastructure/postgres/repositories/OutboxRepository");
const KafkaPublisher = require("../infrastructure/kafka/KafkaPublisher");
const EventEnvelope = require("../events/EventEnvelope");

class OutboxRelay {
    constructor(outboxRepo = new OutboxRepository(), publisher = new KafkaPublisher()) {
        this.outboxRepo = outboxRepo;
        this.publisher = publisher;
        this.isRunning = false;
        this._intervalHandle = null;
    }

    async processBatch(batchSize = 20) {
        const pendingEvents = await this.outboxRepo.fetchPending(batchSize);
        if (pendingEvents.length === 0) return 0;

        let processedCount = 0;

        for (const record of pendingEvents) {
            try {
                const envelope = new EventEnvelope(record.payload);
                await this.publisher.publish(envelope, record.topic, record.partition_key);
                await this.outboxRepo.markPublished(record.outbox_id);
                processedCount++;
            } catch (err) {
                console.error(`[OutboxRelay] Failed to publish outbox event ${record.event_id}:`, err.message);
                await this.outboxRepo.markFailed(record.outbox_id, err.message);
            }
        }

        return processedCount;
    }

    start(intervalMs = 1000) {
        if (this.isRunning) return;
        this.isRunning = true;

        this._intervalHandle = setInterval(async () => {
            try {
                await this.processBatch();
            } catch (err) {
                console.error("[OutboxRelay] Polling error:", err.message);
            }
        }, intervalMs);

        console.log(`[OutboxRelay] Started polling outbox every ${intervalMs}ms`);
    }

    stop() {
        if (this._intervalHandle) {
            clearInterval(this._intervalHandle);
            this._intervalHandle = null;
        }
        this.isRunning = false;
        console.log("[OutboxRelay] Stopped outbox polling.");
    }
}

module.exports = OutboxRelay;
