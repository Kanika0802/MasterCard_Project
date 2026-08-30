// simulator/src/domain/entities/KycRecord.js

const { ValidationError } = require("../errors");
const { KycVerificationStatus } = require("../constants");

class KycRecord {
    constructor({
        kyc_id,
        user_id,
        document_type = "SYNTHETIC_PASSPORT",
        document_reference = "DOC_REF_001",
        verification_status = KycVerificationStatus.PENDING,
        liveness_status = "PENDING",
        risk_profile = "STANDARD",
        created_at = new Date(),
        updated_at = new Date()
    }) {
        this.kyc_id = kyc_id;
        this.user_id = user_id;
        this.document_type = document_type;
        this.document_reference = document_reference;
        this.verification_status = verification_status;
        this.liveness_status = liveness_status;
        this.risk_profile = risk_profile;
        this.created_at = created_at instanceof Date ? created_at.toISOString() : created_at;
        this.updated_at = updated_at instanceof Date ? updated_at.toISOString() : updated_at;

        this.validate();
    }

    validate() {
        if (!this.kyc_id) throw new ValidationError("kyc_id is required.");
        if (!this.user_id) throw new ValidationError("user_id is required.");
        if (!this.document_type) throw new ValidationError("document_type is required.");
        if (!Object.values(KycVerificationStatus).includes(this.verification_status)) {
            throw new ValidationError(`Invalid verification status: ${this.verification_status}`);
        }
    }

    verify() {
        this.verification_status = KycVerificationStatus.VERIFIED;
        this.liveness_status = "VERIFIED";
        this.updated_at = new Date().toISOString();
    }

    reject(reason = null) {
        this.verification_status = KycVerificationStatus.REJECTED;
        this.updated_at = new Date().toISOString();
    }

    toJSON() {
        return {
            _id: this.kyc_id,
            kyc_id: this.kyc_id,
            user_id: this.user_id,
            document_type: this.document_type,
            document_reference: this.document_reference,
            verification_status: this.verification_status,
            liveness_status: this.liveness_status,
            risk_profile: this.risk_profile,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = KycRecord;
