// simulator/src/infrastructure/postgres/repositories/LedgerRepository.js

const { pool } = require("../../../config/postgres");
const LedgerEntry = require("../../../domain/entities/LedgerEntry");

class LedgerRepository {
    constructor(dbPool = pool) {
        this.pool = dbPool;
    }

    _mapRow(row) {
        if (!row) return null;
        return new LedgerEntry({
            ledger_entry_id: row.ledger_entry_id,
            transaction_id: row.transaction_id,
            account_id: row.account_id,
            entry_type: row.entry_type,
            amount: row.amount,
            balance_before: row.balance_before,
            balance_after: row.balance_after,
            created_at: row.created_at
        });
    }

    async create(entry, client = null) {
        const db = client || this.pool;
        const query = `
            INSERT INTO ledger_entries (
                ledger_entry_id, transaction_id, account_id, entry_type, amount, balance_before, balance_after, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;
        const values = [
            entry.ledger_entry_id,
            entry.transaction_id,
            entry.account_id,
            entry.entry_type,
            entry.amount,
            entry.balance_before,
            entry.balance_after,
            entry.created_at
        ];
        const res = await db.query(query, values);
        return this._mapRow(res.rows[0]);
    }

    async findByTransactionId(transactionId, client = null) {
        const db = client || this.pool;
        const res = await db.query(
            "SELECT * FROM ledger_entries WHERE transaction_id = $1 ORDER BY created_at ASC",
            [transactionId]
        );
        return res.rows.map(r => this._mapRow(r));
    }

    async findByAccountId(accountId, { limit = 50, offset = 0 } = {}, client = null) {
        const db = client || this.pool;
        const res = await db.query(
            "SELECT * FROM ledger_entries WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            [accountId, limit, offset]
        );
        return res.rows.map(r => this._mapRow(r));
    }
}

module.exports = LedgerRepository;
