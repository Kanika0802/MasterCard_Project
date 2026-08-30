// simulator/src/infrastructure/postgres/repositories/TransactionRepository.js

const { pool } = require("../../../config/postgres");
const Transaction = require("../../../domain/entities/Transaction");

class TransactionRepository {
    constructor(dbPool = pool) {
        this.pool = dbPool;
    }

    _mapRow(row) {
        if (!row) return null;
        return new Transaction({
            transaction_id: row.transaction_id,
            transaction_reference: row.transaction_reference,
            sender_account_id: row.sender_account_id,
            receiver_account_id: row.receiver_account_id,
            merchant_id: row.merchant_id,
            initiator_user_id: row.initiator_user_id,
            amount: row.amount,
            currency: row.currency,
            transaction_type: row.transaction_type,
            channel: row.channel,
            device_id: row.device_id,
            location: row.location,
            status: row.status,
            created_at: row.created_at,
            authorized_at: row.authorized_at,
            completed_at: row.completed_at,
            failure_reason: row.failure_reason,
            experiment_id: row.experiment_id
        });
    }

    async create(tx, client = null) {
        const db = client || this.pool;
        const query = `
            INSERT INTO transactions (
                transaction_id, transaction_reference, sender_account_id, receiver_account_id, merchant_id,
                initiator_user_id, amount, currency, transaction_type, channel, device_id, location,
                status, created_at, authorized_at, completed_at, failure_reason, experiment_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING *;
        `;
        const values = [
            tx.transaction_id,
            tx.transaction_reference,
            tx.sender_account_id,
            tx.receiver_account_id,
            tx.merchant_id,
            tx.initiator_user_id,
            tx.amount,
            tx.currency,
            tx.transaction_type,
            tx.channel,
            tx.device_id,
            tx.location ? JSON.stringify(tx.location) : null,
            tx.status,
            tx.created_at,
            tx.authorized_at,
            tx.completed_at,
            tx.failure_reason,
            tx.experiment_id
        ];
        const res = await db.query(query, values);
        return this._mapRow(res.rows[0]);
    }

    async findById(transactionId, client = null) {
        const db = client || this.pool;
        const res = await db.query("SELECT * FROM transactions WHERE transaction_id = $1", [transactionId]);
        return this._mapRow(res.rows[0]);
    }

    async findByReference(reference, client = null) {
        const db = client || this.pool;
        const res = await db.query("SELECT * FROM transactions WHERE transaction_reference = $1", [reference]);
        return this._mapRow(res.rows[0]);
    }

    async list({ accountId = null, status = null, experimentId = null, limit = 50, offset = 0 } = {}, client = null) {
        const db = client || this.pool;
        const conditions = [];
        const values = [];

        if (accountId) {
            values.push(accountId);
            conditions.push(`(sender_account_id = $${values.length} OR receiver_account_id = $${values.length})`);
        }
        if (status) {
            values.push(status);
            conditions.push(`status = $${values.length}`);
        }
        if (experimentId) {
            values.push(experimentId);
            conditions.push(`experiment_id = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        values.push(limit);
        const limitParam = `$${values.length}`;
        values.push(offset);
        const offsetParam = `$${values.length}`;

        const res = await db.query(
            `SELECT * FROM transactions ${whereClause} ORDER BY created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
            values
        );
        return res.rows.map(r => this._mapRow(r));
    }

    async updateStatus(transactionId, status, failureReason = null, client = null) {
        const db = client || this.pool;
        const res = await db.query(
            `UPDATE transactions 
             SET status = $1, failure_reason = $2, completed_at = CASE WHEN $1 IN ('COMPLETED', 'FAILED', 'REVERSED') THEN NOW() ELSE completed_at END
             WHERE transaction_id = $3 
             RETURNING *`,
            [status, failureReason, transactionId]
        );
        return this._mapRow(res.rows[0]);
    }

    async delete(transactionId, client = null) {
        const db = client || this.pool;
        await db.query("DELETE FROM transactions WHERE transaction_id = $1", [transactionId]);
    }
}

module.exports = TransactionRepository;
