// simulator/src/infrastructure/postgres/repositories/OutboxRepository.js

const { pool } = require("../../../config/postgres");
const crypto = require("crypto");

class OutboxRepository {
    constructor(dbPool = pool) {
        this.pool = dbPool;
    }

    async insert(eventRecord, client = null) {
        const db = client || this.pool;
        const outboxId = eventRecord.outbox_id || crypto.randomUUID();
        const query = `
            INSERT INTO event_outbox (
                outbox_id, event_id, event_type, event_version, topic, partition_key, payload,
                status, attempt_count, available_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *;
        `;
        const values = [
            outboxId,
            eventRecord.event_id,
            eventRecord.event_type,
            eventRecord.event_version || 1,
            eventRecord.topic,
            eventRecord.partition_key,
            JSON.stringify(eventRecord.payload),
            eventRecord.status || "PENDING",
            eventRecord.attempt_count || 0,
            eventRecord.available_at || new Date(),
            eventRecord.created_at || new Date()
        ];
        const res = await db.query(query, values);
        return res.rows[0];
    }

    async fetchPending(batchSize = 20, client = null) {
        const db = client || this.pool;
        const res = await db.query(
            `SELECT * FROM event_outbox 
             WHERE status = 'PENDING' AND available_at <= NOW()
             ORDER BY created_at ASC 
             LIMIT $1
             FOR UPDATE SKIP LOCKED`,
            [batchSize]
        );
        return res.rows.map(r => ({
            ...r,
            payload: typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload
        }));
    }

    async markPublished(outboxId, client = null) {
        const db = client || this.pool;
        await db.query(
            "UPDATE event_outbox SET status = 'PUBLISHED', published_at = NOW() WHERE outbox_id = $1",
            [outboxId]
        );
    }

    async markFailed(outboxId, errorMessage, nextAvailableAt = null, client = null) {
        const db = client || this.pool;
        await db.query(
            `UPDATE event_outbox 
             SET attempt_count = attempt_count + 1,
                 last_error = $1,
                 status = CASE WHEN attempt_count >= 5 THEN 'FAILED' ELSE 'PENDING' END,
                 available_at = COALESCE($2, NOW() + INTERVAL '5 seconds')
             WHERE outbox_id = $3`,
            [errorMessage, nextAvailableAt, outboxId]
        );
    }
}

module.exports = OutboxRepository;
