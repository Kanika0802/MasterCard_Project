// simulator/src/application/services/UserService.js

const crypto = require("crypto");
const User = require("../../domain/entities/User");
const UserRepository = require("../../infrastructure/mongodb/repositories/UserRepository");
const OutboxRepository = require("../../infrastructure/postgres/repositories/OutboxRepository");
const EventFactory = require("../../events/EventFactory");
const { EventType, UserProfileStatus } = require("../../domain/constants");
const { NotFoundError, ConflictError, ValidationError } = require("../../domain/errors");

class UserService {
    constructor(userRepo = new UserRepository(), outboxRepo = new OutboxRepository()) {
        this.userRepo = userRepo;
        this.outboxRepo = outboxRepo;
    }

    async createUser({
        user_id = crypto.randomUUID(),
        first_name,
        last_name,
        email,
        phone,
        date_of_birth,
        address = {},
        occupation = null,
        profile_status = UserProfileStatus.ACTIVE,
        simulation_id = "default_sim",
        experiment_id = "default_exp"
    }) {
        const existing = await this.userRepo.findByEmail(email);
        if (existing) {
            throw new ConflictError(`User with email '${email}' already exists.`);
        }

        const user = new User({
            user_id,
            first_name,
            last_name,
            email,
            phone,
            date_of_birth,
            address,
            occupation,
            profile_status
        });

        const createdUser = await this.userRepo.create(user);

        // Emit USER_CREATED event to outbox
        const event = EventFactory.create({
            event_type: EventType.USER_CREATED,
            entity_type: "user",
            entity_id: createdUser.user_id,
            simulation_id,
            experiment_id,
            payload: createdUser.toJSON()
        });

        await this.outboxRepo.insert({
            event_id: event.event_id,
            event_type: event.event_type,
            topic: EventFactory.getTopicForEventType(event.event_type),
            partition_key: createdUser.user_id,
            payload: event.toJSON()
        });

        return createdUser;
    }

    async getUser(userId) {
        const user = await this.userRepo.findById(userId);
        if (!user) {
            throw new NotFoundError("User", userId);
        }
        return user;
    }

    async updateUser(userId, updates, { simulation_id = "default_sim", experiment_id = "default_exp" } = {}) {
        await this.getUser(userId);

        const updatedUser = await this.userRepo.update(userId, updates);

        const event = EventFactory.create({
            event_type: EventType.USER_UPDATED,
            entity_type: "user",
            entity_id: userId,
            simulation_id,
            experiment_id,
            payload: updatedUser.toJSON()
        });

        await this.outboxRepo.insert({
            event_id: event.event_id,
            event_type: event.event_type,
            topic: EventFactory.getTopicForEventType(event.event_type),
            partition_key: userId,
            payload: event.toJSON()
        });

        return updatedUser;
    }

    async deactivateUser(userId, { simulation_id = "default_sim", experiment_id = "default_exp" } = {}) {
        await this.getUser(userId);

        const deactivatedUser = await this.userRepo.deactivate(userId);

        const event = EventFactory.create({
            event_type: EventType.USER_DEACTIVATED,
            entity_type: "user",
            entity_id: userId,
            simulation_id,
            experiment_id,
            payload: { user_id: userId, profile_status: UserProfileStatus.DEACTIVATED }
        });

        await this.outboxRepo.insert({
            event_id: event.event_id,
            event_type: event.event_type,
            topic: EventFactory.getTopicForEventType(event.event_type),
            partition_key: userId,
            payload: event.toJSON()
        });

        return deactivatedUser;
    }

    async listUsers(options = {}) {
        return this.userRepo.list(options);
    }
}

module.exports = UserService;
