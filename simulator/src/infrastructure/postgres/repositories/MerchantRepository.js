// simulator/src/infrastructure/postgres/repositories/MerchantRepository.js

const { pool } = require("../../../config/postgres");
const Merchant = require("../../../domain/entities/Merchant");

class MerchantRepository {
    constructor(dbPool = pool) {
        this.pool = dbPool;
    }

    _mapRow(row) {
        if (!row) return null;
        return new Merchant({
            merchant_id: row.merchant_id,
            merchant_name: row.merchant_name,
            merchant_category: row.merchant_category,
            settlement_account_id: row.settlement_account_id,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at
        });
    }

    async create(merchant, client = null) {
        const db = client || this.pool;
        const query = `
            INSERT INTO merchants (
                merchant_id, merchant_name, merchant_category, settlement_account_id, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const values = [
            merchant.merchant_id,
            merchant.merchant_name,
            merchant.merchant_category,
            merchant.settlement_account_id,
            merchant.status,
            merchant.created_at,
            merchant.updated_at
        ];
        const res = await db.query(query, values);
        return this._mapRow(res.rows[0]);
    }

    async findById(merchantId, client = null) {
        const db = client || this.pool;
        const res = await db.query("SELECT * FROM merchants WHERE merchant_id = $1", [merchantId]);
        return this._mapRow(res.rows[0]);
    }

    async list({ status = null, limit = 50, offset = 0 } = {}, client = null) {
        const db = client || this.pool;
        const conditions = [];
        const values = [];

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
            `SELECT * FROM merchants ${whereClause} ORDER BY created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
            values
        );
        return res.rows.map(r => this._mapRow(r));
    }

    async updateStatus(merchantId, newStatus, client = null) {
        const db = client || this.pool;
        const res = await db.query(
            "UPDATE merchants SET status = $1, updated_at = NOW() WHERE merchant_id = $2 RETURNING *",
            [newStatus, merchantId]
        );
        return this._mapRow(res.rows[0]);
    }
}

module.exports = MerchantRepository;
