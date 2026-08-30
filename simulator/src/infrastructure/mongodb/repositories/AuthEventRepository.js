// simulator/src/infrastructure/mongodb/repositories/AuthEventRepository.js

const { getDatabase } = require("../../../config/mongodb");
const AuthEvent = require("../../../domain/entities/AuthEvent");

class AuthEventRepository {
    _collection() {
        return getDatabase().collection("auth_events");
    }

    _mapDoc(doc) {
        if (!doc) return null;
        return new AuthEvent({
            event_id: doc.event_id || doc._id,
            user_id: doc.user_id,
            device_id: doc.device_id,
            event_type: doc.event_type,
            timestamp: doc.timestamp,
            simulation_id: doc.simulation_id,
            experiment_id: doc.experiment_id,
            metadata: doc.metadata
        });
    }

    async create(authEvent) {
        const doc = authEvent.toJSON();
        await this._collection().insertOne(doc);
        return this._mapDoc(doc);
    }

    async findById(eventId) {
        const doc = await this._collection().findOne({ $or: [{ _id: eventId }, { event_id: eventId }] });
        return this._mapDoc(doc);
    }

    async list({ userId = null, deviceId = null, limit = 50, offset = 0 } = {}) {
        const query = {};
        if (userId) query.user_id = userId;
        if (deviceId) query.device_id = deviceId;

        const docs = await this._collection()
            .find(query)
            .sort({ timestamp: -1 })
            .skip(offset)
            .limit(limit)
            .toArray();

        return docs.map(d => this._mapDoc(d));
    }

    async delete(eventId) {
        await this._collection().deleteOne({ $or: [{ _id: eventId }, { event_id: eventId }] });
    }
}

module.exports = AuthEventRepository;
