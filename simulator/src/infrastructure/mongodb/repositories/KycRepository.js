// simulator/src/infrastructure/mongodb/repositories/KycRepository.js

const { getDatabase } = require("../../../config/mongodb");
const KycRecord = require("../../../domain/entities/KycRecord");

class KycRepository {
    _collection() {
        return getDatabase().collection("kyc_records");
    }

    _mapDoc(doc) {
        if (!doc) return null;
        return new KycRecord({
            kyc_id: doc.kyc_id || doc._id,
            user_id: doc.user_id,
            document_type: doc.document_type,
            document_reference: doc.document_reference,
            verification_status: doc.verification_status,
            liveness_status: doc.liveness_status,
            risk_profile: doc.risk_profile,
            created_at: doc.created_at,
            updated_at: doc.updated_at
        });
    }

    async create(kyc) {
        const doc = kyc.toJSON();
        await this._collection().insertOne(doc);
        return this._mapDoc(doc);
    }

    async findById(kycId) {
        const doc = await this._collection().findOne({ $or: [{ _id: kycId }, { kyc_id: kycId }] });
        return this._mapDoc(doc);
    }

    async findByUserId(userId) {
        const doc = await this._collection().findOne({ user_id: userId });
        return this._mapDoc(doc);
    }

    async update(kycId, updates = {}) {
        const payload = { ...updates, updated_at: new Date().toISOString() };
        delete payload._id;
        delete payload.kyc_id;

        const res = await this._collection().findOneAndUpdate(
            { $or: [{ _id: kycId }, { kyc_id: kycId }] },
            { $set: payload },
            { returnDocument: "after" }
        );
        return this._mapDoc(res);
    }

    async list({ userId = null, verificationStatus = null, limit = 50, offset = 0 } = {}) {
        const query = {};
        if (userId) query.user_id = userId;
        if (verificationStatus) query.verification_status = verificationStatus;

        const docs = await this._collection()
            .find(query)
            .sort({ created_at: -1 })
            .skip(offset)
            .limit(limit)
            .toArray();

        return docs.map(d => this._mapDoc(d));
    }

    async delete(kycId) {
        await this._collection().deleteOne({ $or: [{ _id: kycId }, { kyc_id: kycId }] });
    }
}

module.exports = KycRepository;
