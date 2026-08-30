// simulator/src/application/services/DeviceService.js

const crypto = require("crypto");
const Device = require("../../domain/entities/Device");
const DeviceRepository = require("../../infrastructure/mongodb/repositories/DeviceRepository");
const UserRepository = require("../../infrastructure/mongodb/repositories/UserRepository");
const OutboxRepository = require("../../infrastructure/postgres/repositories/OutboxRepository");
const EventFactory = require("../../events/EventFactory");
const { DeviceStatus, EventType } = require("../../domain/constants");
const { NotFoundError, ValidationError } = require("../../domain/errors");

class DeviceService {
    constructor(
        deviceRepo = new DeviceRepository(),
        userRepo = new UserRepository(),
        outboxRepo = new OutboxRepository()
    ) {
        this.deviceRepo = deviceRepo;
        this.userRepo = userRepo;
        this.outboxRepo = outboxRepo;
    }

    async registerDevice({
        device_id = crypto.randomUUID(),
        user_id,
        device_type = "MOBILE",
        operating_system = "SYNTHETIC_OS",
        browser = "SYNTHETIC_BROWSER",
        ip_address = "192.0.2.1",
        geo_location = { country: "US", city: "New York" },
        device_fingerprint = null,
        status = DeviceStatus.ACTIVE,
        simulation_id = "default_sim",
        experiment_id = "default_exp"
    }) {
        const user = await this.userRepo.findById(user_id);
        if (!user) {
            throw new NotFoundError("User", user_id);
        }

        const device = new Device({
            device_id,
            user_id,
            device_type,
            operating_system,
            browser,
            ip_address,
            geo_location,
            device_fingerprint,
            status
        });

        const created = await this.deviceRepo.create(device);

        const event = EventFactory.create({
            event_type: EventType.DEVICE_REGISTERED,
            entity_type: "device",
            entity_id: created.device_id,
            actor_id: user_id,
            device_id: created.device_id,
            simulation_id,
            experiment_id,
            payload: created.toJSON()
        });

        await this.outboxRepo.insert({
            event_id: event.event_id,
            event_type: event.event_type,
            topic: EventFactory.getTopicForEventType(event.event_type),
            partition_key: created.device_id,
            payload: event.toJSON()
        });

        return created;
    }

    async getDevice(deviceId) {
        const device = await this.deviceRepo.findById(deviceId);
        if (!device) {
            throw new NotFoundError("Device", deviceId);
        }
        return device;
    }

    async listDevices(filterOptions = {}) {
        return this.deviceRepo.list(filterOptions);
    }

    async updateDevice(deviceId, updates = {}, { simulation_id = "default_sim", experiment_id = "default_exp" } = {}) {
        await this.getDevice(deviceId);

        const updated = await this.deviceRepo.update(deviceId, updates);

        const event = EventFactory.create({
            event_type: EventType.DEVICE_UPDATED,
            entity_type: "device",
            entity_id: deviceId,
            actor_id: updated.user_id,
            device_id: deviceId,
            simulation_id,
            experiment_id,
            payload: updated.toJSON()
        });

        await this.outboxRepo.insert({
            event_id: event.event_id,
            event_type: event.event_type,
            topic: EventFactory.getTopicForEventType(event.event_type),
            partition_key: deviceId,
            payload: event.toJSON()
        });

        return updated;
    }

    async retireDevice(deviceId, { simulation_id = "default_sim", experiment_id = "default_exp" } = {}) {
        const device = await this.getDevice(deviceId);
        const retired = await this.deviceRepo.retire(deviceId);

        const event = EventFactory.create({
            event_type: EventType.DEVICE_RETIRED,
            entity_type: "device",
            entity_id: deviceId,
            actor_id: device.user_id,
            device_id: deviceId,
            simulation_id,
            experiment_id,
            payload: { device_id: deviceId, status: DeviceStatus.RETIRED }
        });

        await this.outboxRepo.insert({
            event_id: event.event_id,
            event_type: event.event_type,
            topic: EventFactory.getTopicForEventType(event.event_type),
            partition_key: deviceId,
            payload: event.toJSON()
        });

        return retired;
    }
}

module.exports = DeviceService;
