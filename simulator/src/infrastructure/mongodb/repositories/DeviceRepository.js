// simulator/src/infrastructure/mongodb/repositories/DeviceRepository.js

const { getDatabase } = require("../../../config/mongodb");
const Device = require("../../../domain/entities/Device");
const { DeviceStatus } = require("../../../domain/constants");

class DeviceRepository {
    _collection() {
        return getDatabase().collection("devices");
    }

    _mapDoc(doc) {
        if (!doc) return null;
        return new Device({
            device_id: doc.device_id || doc._id,
            user_id: doc.user_id,
            device_type: doc.device_type,
            operating_system: doc.operating_system,
            browser: doc.browser,
            ip_address: doc.ip_address,
            geo_location: doc.geo_location,
            device_fingerprint: doc.device_fingerprint,
            status: doc.status,
            first_seen: doc.first_seen,
            last_seen: doc.last_seen
        });
    }

    async create(device) {
        const doc = device.toJSON();
        await this._collection().insertOne(doc);
        return this._mapDoc(doc);
    }

    async findById(deviceId) {
        const doc = await this._collection().findOne({ $or: [{ _id: deviceId }, { device_id: deviceId }] });
        return this._mapDoc(doc);
    }

    async findByFingerprint(fingerprint) {
        const doc = await this._collection().findOne({ device_fingerprint: fingerprint });
        return this._mapDoc(doc);
    }

    async findByUserId(userId) {
        const docs = await this._collection().find({ user_id: userId }).toArray();
        return docs.map(d => this._mapDoc(d));
    }

    async update(deviceId, updates = {}) {
        const payload = { ...updates, last_seen: new Date().toISOString() };
        delete payload._id;
        delete payload.device_id;

        const res = await this._collection().findOneAndUpdate(
            { $or: [{ _id: deviceId }, { device_id: deviceId }] },
            { $set: payload },
            { returnDocument: "after" }
        );
        return this._mapDoc(res);
    }

    async retire(deviceId) {
        return this.update(deviceId, { status: DeviceStatus.RETIRED });
    }

    async list({ userId = null, status = null, limit = 50, offset = 0 } = {}) {
        const query = {};
        if (userId) query.user_id = userId;
        if (status) query.status = status;

        const docs = await this._collection()
            .find(query)
            .sort({ last_seen: -1 })
            .skip(offset)
            .limit(limit)
            .toArray();

        return docs.map(d => this._mapDoc(d));
    }

    async delete(deviceId) {
        await this._collection().deleteOne({ $or: [{ _id: deviceId }, { device_id: deviceId }] });
    }
}

module.exports = DeviceRepository;
