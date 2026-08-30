// simulator/src/application/services/BeneficiaryService.js

const crypto = require("crypto");
const Beneficiary = require("../../domain/entities/Beneficiary");
const BeneficiaryRepository = require("../../infrastructure/postgres/repositories/BeneficiaryRepository");
const AccountRepository = require("../../infrastructure/postgres/repositories/AccountRepository");
const UserRepository = require("../../infrastructure/mongodb/repositories/UserRepository");
const OutboxRepository = require("../../infrastructure/postgres/repositories/OutboxRepository");
const EventFactory = require("../../events/EventFactory");
const { BeneficiaryStatus, EventType } = require("../../domain/constants");
const { NotFoundError, ConflictError, ValidationError } = require("../../domain/errors");

class BeneficiaryService {
    constructor(
        beneficiaryRepo = new BeneficiaryRepository(),
        accountRepo = new AccountRepository(),
        userRepo = new UserRepository(),
        outboxRepo = new OutboxRepository()
    ) {
        this.beneficiaryRepo = beneficiaryRepo;
        this.accountRepo = accountRepo;
        this.userRepo = userRepo;
        this.outboxRepo = outboxRepo;
    }

    async addBeneficiary({
        beneficiary_id = crypto.randomUUID(),
        user_id,
        target_account_id,
        nickname = null,
        status = BeneficiaryStatus.ACTIVE,
        simulation_id = "default_sim",
        experiment_id = "default_exp"
    }) {
        // Cross-database validation: Ensure user exists in MongoDB
        const user = await this.userRepo.findById(user_id);
        if (!user) {
            throw new NotFoundError("User", user_id);
        }

        // Validate target account exists in PostgreSQL
        const targetAccount = await this.accountRepo.findById(target_account_id);
        if (!targetAccount) {
            throw new NotFoundError("Target Account", target_account_id);
        }

        // Prevent duplicate active beneficiary registration
        const existing = await this.beneficiaryRepo.findByUserAndTarget(user_id, target_account_id);
        if (existing) {
            throw new ConflictError(`Active beneficiary for target account '${target_account_id}' already exists for this user.`);
        }

        const beneficiary = new Beneficiary({
            beneficiary_id,
            user_id,
            target_account_id,
            nickname,
            status
        });

        const created = await this.beneficiaryRepo.create(beneficiary);

        // Record outbox event
        const event = EventFactory.create({
            event_type: EventType.BENEFICIARY_ADDED,
            entity_type: "beneficiary",
            entity_id: created.beneficiary_id,
            actor_id: user_id,
            simulation_id,
            experiment_id,
            payload: created.toJSON()
        });

        await this.outboxRepo.insert({
            event_id: event.event_id,
            event_type: event.event_type,
            topic: EventFactory.getTopicForEventType(event.event_type),
            partition_key: created.beneficiary_id,
            payload: event.toJSON()
        });

        return created;
    }

    async getBeneficiary(beneficiaryId) {
        const beneficiary = await this.beneficiaryRepo.findById(beneficiaryId);
        if (!beneficiary) {
            throw new NotFoundError("Beneficiary", beneficiaryId);
        }
        return beneficiary;
    }

    async listBeneficiaries(filterOptions = {}) {
        return this.beneficiaryRepo.list(filterOptions);
    }

    async updateBeneficiary(beneficiaryId, updates = {}, { simulation_id = "default_sim", experiment_id = "default_exp" } = {}) {
        await this.getBeneficiary(beneficiaryId);

        const updated = await this.beneficiaryRepo.update(beneficiaryId, updates);

        const event = EventFactory.create({
            event_type: EventType.BENEFICIARY_UPDATED,
            entity_type: "beneficiary",
            entity_id: beneficiaryId,
            actor_id: updated.user_id,
            simulation_id,
            experiment_id,
            payload: updated.toJSON()
        });

        await this.outboxRepo.insert({
            event_id: event.event_id,
            event_type: event.event_type,
            topic: EventFactory.getTopicForEventType(event.event_type),
            partition_key: beneficiaryId,
            payload: event.toJSON()
        });

        return updated;
    }

    async disableBeneficiary(beneficiaryId, { simulation_id = "default_sim", experiment_id = "default_exp" } = {}) {
        const beneficiary = await this.getBeneficiary(beneficiaryId);
        const updated = await this.beneficiaryRepo.updateStatus(beneficiaryId, BeneficiaryStatus.DISABLED);

        const event = EventFactory.create({
            event_type: EventType.BENEFICIARY_DISABLED,
            entity_type: "beneficiary",
            entity_id: beneficiaryId,
            actor_id: beneficiary.user_id,
            simulation_id,
            experiment_id,
            payload: { beneficiary_id: beneficiaryId, status: BeneficiaryStatus.DISABLED }
        });

        await this.outboxRepo.insert({
            event_id: event.event_id,
            event_type: event.event_type,
            topic: EventFactory.getTopicForEventType(event.event_type),
            partition_key: beneficiaryId,
            payload: event.toJSON()
        });

        return updated;
    }
}

module.exports = BeneficiaryService;
