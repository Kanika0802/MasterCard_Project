// simulator/src/infrastructure/postgres/repositories/BeneficiaryRepository.js

const { pool } = require("../../../config/postgres");
const Beneficiary = require("../../../domain/entities/Beneficiary");

class BeneficiaryRepository {
    constructor(dbPool = pool) {
        this.pool = dbPool;
    }

    _mapRow(row) {
        if (!row) return null;
        return new Beneficiary({
            beneficiary_id: row.beneficiary_id,
            user_id: row.user_id,
            target_account_id: row.target_account_id,
            nickname: row.nickname,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at
        });
    }

    async create(beneficiary, client = null) {
        const db = client || this.pool;
        const query = `
            INSERT INTO beneficiaries (
                beneficiary_id, user_id, target_account_id, nickname, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const values = [
            beneficiary.beneficiary_id,
            beneficiary.user_id,
            beneficiary.target_account_id,
            beneficiary.nickname,
            beneficiary.status,
            beneficiary.created_at,
            beneficiary.updated_at
        ];
        const res = await db.query(query, values);
        return this._mapRow(res.rows[0]);
    }

    async findById(beneficiaryId, client = null) {
        const db = client || this.pool;
        const res = await db.query("SELECT * FROM beneficiaries WHERE beneficiary_id = $1", [beneficiaryId]);
        return this._mapRow(res.rows[0]);
    }

    async findByUserAndTarget(userId, targetAccountId, client = null) {
        const db = client || this.pool;
        const res = await db.query(
            "SELECT * FROM beneficiaries WHERE user_id = $1 AND target_account_id = $2 AND status != 'DISABLED'",
            [userId, targetAccountId]
        );
        return this._mapRow(res.rows[0]);
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
            `SELECT * FROM beneficiaries ${whereClause} ORDER BY created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
            values
        );
        return res.rows.map(r => this._mapRow(r));
    }

    async updateStatus(beneficiaryId, newStatus, client = null) {
        const db = client || this.pool;
        const res = await db.query(
            "UPDATE beneficiaries SET status = $1, updated_at = NOW() WHERE beneficiary_id = $2 RETURNING *",
            [newStatus, beneficiaryId]
        );
        return this._mapRow(res.rows[0]);
    }

    async update(beneficiaryId, updates = {}, client = null) {
        const db = client || this.pool;
        const fields = [];
        const values = [];

        if (updates.nickname !== undefined) {
            values.push(updates.nickname);
            fields.push(`nickname = $${values.length}`);
        }
        if (updates.status !== undefined) {
            values.push(updates.status);
            fields.push(`status = $${values.length}`);
        }

        if (fields.length === 0) {
            return this.findById(beneficiaryId, client);
        }

        fields.push("updated_at = NOW()");
        values.push(beneficiaryId);
        const idParam = `$${values.length}`;

        const res = await db.query(
            `UPDATE beneficiaries SET ${fields.join(", ")} WHERE beneficiary_id = ${idParam} RETURNING *`,
            values
        );
        return this._mapRow(res.rows[0]);
    }

    async delete(beneficiaryId, client = null) {
        const db = client || this.pool;
        await db.query("DELETE FROM beneficiaries WHERE beneficiary_id = $1", [beneficiaryId]);
    }
}

module.exports = BeneficiaryRepository;
