// simulator/src/infrastructure/postgres/repositories/AccountRepository.js

const { pool } = require("../../../config/postgres");
const Account = require("../../../domain/entities/Account");

class AccountRepository {
    constructor(dbPool = pool) {
        this.pool = dbPool;
    }

    _mapRow(row) {
        if (!row) return null;
        return new Account({
            account_id: row.account_id,
            user_id: row.user_id,
            account_number: row.account_number,
            account_type: row.account_type,
            currency: row.currency,
            balance: row.balance,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at
        });
    }

    async create(account, client = null) {
        const db = client || this.pool;
        const query = `
            INSERT INTO accounts (
                account_id, user_id, account_number, account_type, currency, balance, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *;
        `;
        const values = [
            account.account_id,
            account.user_id,
            account.account_number,
            account.account_type,
            account.currency,
            account.balance,
            account.status,
            account.created_at,
            account.updated_at
        ];
        const res = await db.query(query, values);
        return this._mapRow(res.rows[0]);
    }

    async findById(accountId, client = null) {
        const db = client || this.pool;
        const res = await db.query("SELECT * FROM accounts WHERE account_id = $1", [accountId]);
        return this._mapRow(res.rows[0]);
    }

    /**
     * Row locking for atomic transactions.
     */
    async findByIdForUpdate(accountId, client) {
        if (!client) {
            throw new Error("findByIdForUpdate requires an explicit transaction client");
        }
        const res = await client.query("SELECT * FROM accounts WHERE account_id = $1 FOR UPDATE", [accountId]);
        return this._mapRow(res.rows[0]);
    }

    async findByAccountNumber(accountNumber, client = null) {
        const db = client || this.pool;
        const res = await db.query("SELECT * FROM accounts WHERE account_number = $1", [accountNumber]);
        return this._mapRow(res.rows[0]);
    }

    async findByUserId(userId, client = null) {
        const db = client || this.pool;
        const res = await db.query("SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at ASC", [userId]);
        return res.rows.map(r => this._mapRow(r));
    }

    async list({ userId = null, status = null, limit = 50, offset = 0 } = {}, client = null) {
        const db = client || this.pool;
        const conditions = [];
        const values = [];

        if (userId) {
            values.push(userId);
            conditions.push(`user_id = $${values.length}`);
        }
        if (status) {
            values.push(status);
            conditions.push(`status = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        values.push(limit);
        const limitParam = `$${values.length}`;
        values.push(offset);
        const offsetParam = `$${values.length}`;

        const res = await db.query(
            `SELECT * FROM accounts ${whereClause} ORDER BY created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
            values
        );
        return res.rows.map(r => this._mapRow(r));
    }

    async updateBalance(accountId, newBalance, client = null) {
        const db = client || this.pool;
        const res = await db.query(
            `UPDATE accounts SET balance = $1, updated_at = NOW() WHERE account_id = $2 RETURNING *`,
            [newBalance, accountId]
        );
        return this._mapRow(res.rows[0]);
    }

    async updateStatus(accountId, newStatus, client = null) {
        const db = client || this.pool;
        const res = await db.query(
            `UPDATE accounts SET status = $1, updated_at = NOW() WHERE account_id = $2 RETURNING *`,
            [newStatus, accountId]
        );
        return this._mapRow(res.rows[0]);
    }

    async delete(accountId, client = null) {
        const db = client || this.pool;
        await db.query("DELETE FROM accounts WHERE account_id = $1", [accountId]);
    }
}

module.exports = AccountRepository;
