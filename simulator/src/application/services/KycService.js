// simulator/src/application/services/KycService.js

const crypto = require("crypto");
const KycRecord = require("../../domain/entities/KycRecord");
const KycRepository = require("../../infrastructure/mongodb/repositories/KycRepository");
const UserRepository = require("../../infrastructure/mongodb/repositories/UserRepository");
const OutboxRepository = require("../../infrastructure/postgres/repositories/OutboxRepository");
const EventFactory = require("../../events/EventFactory");
const { KycVerificationStatus, EventType } = require("../../domain/constants");
const { NotFoundError, ValidationError } = require("../../domain/errors");

class KycService {
    constructor(
        kycRepo = new KycRepository(),
        userRepo = new UserRepository(),
        outboxRepo = new OutboxRepository()
    ) {
        this.kycRepo = kycRepo;
        this.userRepo = userRepo;
        this.outboxRepo = outboxRepo;
    }

    async createKyc({
        kyc_id = crypto.randomUUID(),
        user_id,
        document_type = "SYNTHETIC_PASSPORT",
        document_reference = "DOC_REF_001",
        verification_status = KycVerificationStatus.PENDING,
        liveness_status = "PENDING",
        risk_profile = "STANDARD",
        simulation_id = "default_sim",
        experiment_id = "default_exp"
    }) {
        const user = await this.userRepo.findById(user_id);
        if (!user) {
            throw new NotFoundError("User", user_id);
        }

        const kyc = new KycRecord({
            kyc_id,
            user_id,
            document_type,
            document_reference,
            verification_status,
            liveness_status,
            risk_profile
        });

        const created = await this.kycRepo.create(kyc);

        const event = EventFactory.create({
            event_type: EventType.KYC_CREATED,
            entity_type: "kyc",
            entity_id: created.kyc_id,
            actor_id: user_id,
            simulation_id,
            experiment_id,
            payload: created.toJSON()
        });

        await this.outboxRepo.insert({
            event_id: event.event_id,
            event_type: event.event_type,
            topic: EventFactory.getTopicForEventType(event.event_type),
            partition_key: created.kyc_id,
            payload: event.toJSON()
        });

        return created;
    }

    async getKyc(kycId) {
        const kyc = await this.kycRepo.findById(kycId);
        if (!kyc) {
            throw new NotFoundError("KYC Record", kycId);
        }
        return kyc;
    }

    async listKyc(filterOptions = {}) {
        return this.kycRepo.list(filterOptions);
    }

    async updateKyc(kycId, updates = {}, { simulation_id = "default_sim", experiment_id = "default_exp" } = {}) {
        await this.getKyc(kycId);

        const updated = await this.kycRepo.update(kycId, updates);

        const event = EventFactory.create({
            event_type: EventType.KYC_UPDATED,
            entity_type: "kyc",
            entity_id: kycId,
            actor_id: updated.user_id,
            simulation_id,
            experiment_id,
            payload: updated.toJSON()
        });

        await this.outboxRepo.insert({
            event_id: event.event_id,
            event_type: event.event_type,
            topic: EventFactory.getTopicForEventType(event.event_type),
            partition_key: kycId,
            payload: event.toJSON()
        });

        return updated;
    }

    async deleteTestKyc(kycId, { simulation_id = "default_sim", experiment_id = "default_exp" } = {}) {
        const kyc = await this.getKyc(kycId);
        await this.kycRepo.delete(kycId);

        const event = EventFactory.create({
            event_type: EventType.KYC_DELETED,
            entity_type: "kyc",
            entity_id: kycId,
            actor_id: kyc.user_id,
            simulation_id,
            experiment_id,
            payload: { kyc_id: kycId, user_id: kyc.user_id }
        });

        await this.outboxRepo.insert({
            event_id: event.event_id,
            event_type: event.event_type,
            topic: EventFactory.getTopicForEventType(event.event_type),
            partition_key: kycId,
            payload: event.toJSON()
        });
    }
}

module.exports = KycService;
