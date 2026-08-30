// simulator/src/application/services/AuthenticationService.js

const crypto = require("crypto");
const AuthEvent = require("../../domain/entities/AuthEvent");
const AuthEventRepository = require("../../infrastructure/mongodb/repositories/AuthEventRepository");
const UserRepository = require("../../infrastructure/mongodb/repositories/UserRepository");
const DeviceRepository = require("../../infrastructure/mongodb/repositories/DeviceRepository");
const OutboxRepository = require("../../infrastructure/postgres/repositories/OutboxRepository");
const EventFactory = require("../../events/EventFactory");
const { EventType } = require("../../domain/constants");
const { NotFoundError, ValidationError } = require("../../domain/errors");

class AuthenticationService {
    constructor(
        authEventRepo = new AuthEventRepository(),
        userRepo = new UserRepository(),
        deviceRepo = new DeviceRepository(),
        outboxRepo = new OutboxRepository()
    ) {
        this.authEventRepo = authEventRepo;
        this.userRepo = userRepo;
        this.deviceRepo = deviceRepo;
        this.outboxRepo = outboxRepo;
        this._activeOtps = new Map(); // simulated in-memory OTP cache for testing
    }

    async recordAuthEvent({
        event_id = crypto.randomUUID(),
        user_id,
        device_id = null,
        event_type,
        timestamp = new Date(),
        simulation_id = "default_sim",
        experiment_id = "default_exp",
        metadata = {},
        adversarial_metadata = null
    }) {
        const authEvent = new AuthEvent({
            event_id,
            user_id,
            device_id,
            event_type,
            timestamp,
            simulation_id,
            experiment_id,
            metadata
        });

        const created = await this.authEventRepo.create(authEvent);

        // Record outbox event
        const envelope = EventFactory.create({
            event_type,
            entity_type: "auth_event",
            entity_id: created.event_id,
            actor_id: user_id,
            device_id,
            simulation_id,
            experiment_id,
            adversarial_metadata,
            payload: created.toJSON()
        });

        await this.outboxRepo.insert({
            event_id: envelope.event_id,
            event_type: envelope.event_type,
            topic: EventFactory.getTopicForEventType(envelope.event_type),
            partition_key: user_id,
            payload: envelope.toJSON()
        });

        return created;
    }

    async simulateLogin({
        user_id,
        device_id = null,
        success = true,
        simulation_id = "default_sim",
        experiment_id = "default_exp",
        metadata = {},
        adversarial_metadata = null
    }) {
        const eventType = success ? EventType.AUTH_LOGIN_SUCCESS : EventType.AUTH_LOGIN_FAILED;
        return this.recordAuthEvent({
            user_id,
            device_id,
            event_type: eventType,
            simulation_id,
            experiment_id,
            metadata,
            adversarial_metadata
        });
    }

    async simulateOtpRequest({
        user_id,
        device_id = null,
        simulation_id = "default_sim",
        experiment_id = "default_exp",
        metadata = {},
        adversarial_metadata = null
    }) {
        const otpCode = "123456"; // Deterministic simulated OTP
        const challengeId = crypto.randomUUID();
        this._activeOtps.set(challengeId, { otpCode, userId: user_id, createdAt: Date.now() });

        const recordedEvent = await this.recordAuthEvent({
            user_id,
            device_id,
            event_type: EventType.AUTH_OTP_REQUESTED,
            simulation_id,
            experiment_id,
            metadata: { ...metadata, challenge_id: challengeId },
            adversarial_metadata
        });

        return {
            event: recordedEvent,
            challenge_id: challengeId,
            simulated_otp: otpCode
        };
    }

    async simulateOtpVerification({
        user_id,
        challenge_id,
        entered_otp,
        device_id = null,
        simulation_id = "default_sim",
        experiment_id = "default_exp",
        metadata = {},
        adversarial_metadata = null
    }) {
        const challenge = this._activeOtps.get(challenge_id);
        const isValid = challenge && challenge.otpCode === entered_otp;

        const eventType = isValid ? EventType.AUTH_OTP_VERIFIED : EventType.AUTH_OTP_FAILED;

        if (challenge) {
            this._activeOtps.delete(challenge_id);
        }

        return this.recordAuthEvent({
            user_id,
            device_id,
            event_type: eventType,
            simulation_id,
            experiment_id,
            metadata: { ...metadata, challenge_id, verified: isValid },
            adversarial_metadata
        });
    }

    async getAuthEvent(eventId) {
        const event = await this.authEventRepo.findById(eventId);
        if (!event) {
            throw new NotFoundError("AuthEvent", eventId);
        }
        return event;
    }

    async listAuthEvents(filterOptions = {}) {
        return this.authEventRepo.list(filterOptions);
    }

    async deleteAuthEvent(eventId) {
        await this.getAuthEvent(eventId);
        await this.authEventRepo.delete(eventId);
    }
}

module.exports = AuthenticationService;
