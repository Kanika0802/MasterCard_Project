// simulator/src/infrastructure/mongodb/repositories/UserRepository.js

const { getDatabase } = require("../../../config/mongodb");
const User = require("../../../domain/entities/User");
const { UserProfileStatus } = require("../../../domain/constants");

class UserRepository {
    _collection() {
        return getDatabase().collection("users");
    }

    _mapDoc(doc) {
        if (!doc) return null;
        return new User({
            user_id: doc.user_id || doc._id,
            first_name: doc.first_name,
            last_name: doc.last_name,
            email: doc.email,
            phone: doc.phone,
            date_of_birth: doc.date_of_birth,
            address: doc.address,
            occupation: doc.occupation,
            profile_status: doc.profile_status,
            created_at: doc.created_at,
            updated_at: doc.updated_at
        });
    }

    async create(user) {
        const doc = user.toJSON();
        await this._collection().insertOne(doc);
        return this._mapDoc(doc);
    }

    async findById(userId) {
        const doc = await this._collection().findOne({ $or: [{ _id: userId }, { user_id: userId }] });
        return this._mapDoc(doc);
    }

    async findByEmail(email) {
        const doc = await this._collection().findOne({ email: email.toLowerCase() });
        return this._mapDoc(doc);
    }

    async update(userId, updates = {}) {
        const payload = { ...updates, updated_at: new Date().toISOString() };
        delete payload._id;
        delete payload.user_id;

        const res = await this._collection().findOneAndUpdate(
            { $or: [{ _id: userId }, { user_id: userId }] },
            { $set: payload },
            { returnDocument: "after" }
        );
        return this._mapDoc(res);
    }

    async deactivate(userId) {
        return this.update(userId, { profile_status: UserProfileStatus.DEACTIVATED });
    }

    async list({ status = null, limit = 50, offset = 0 } = {}) {
        const query = {};
        if (status) query.profile_status = status;

        const docs = await this._collection()
            .find(query)
            .sort({ created_at: -1 })
            .skip(offset)
            .limit(limit)
            .toArray();

        return docs.map(d => this._mapDoc(d));
    }

    async delete(userId) {
        await this._collection().deleteOne({ $or: [{ _id: userId }, { user_id: userId }] });
    }
}

module.exports = UserRepository;
