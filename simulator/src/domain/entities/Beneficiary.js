// simulator/src/domain/entities/Beneficiary.js

const { ValidationError } = require("../errors");
const { BeneficiaryStatus } = require("../constants");

class Beneficiary {
    constructor({
        beneficiary_id,
        user_id,
        target_account_id,
        nickname = null,
        status = BeneficiaryStatus.ACTIVE,
        created_at = new Date(),
        updated_at = new Date()
    }) {
        this.beneficiary_id = beneficiary_id;
        this.user_id = user_id;
        this.target_account_id = target_account_id;
        this.nickname = nickname;
        this.status = status;
        this.created_at = created_at;
        this.updated_at = updated_at;

        this.validate();
    }

    validate() {
        if (!this.beneficiary_id) throw new ValidationError("beneficiary_id is required.");
        if (!this.user_id) throw new ValidationError("user_id is required.");
        if (!this.target_account_id) throw new ValidationError("target_account_id is required.");
        if (!Object.values(BeneficiaryStatus).includes(this.status)) {
            throw new ValidationError(`Invalid beneficiary status: ${this.status}`);
        }
    }

    isActive() {
        return this.status === BeneficiaryStatus.ACTIVE;
    }

    disable() {
        this.status = BeneficiaryStatus.DISABLED;
        this.updated_at = new Date();
    }

    toJSON() {
        return {
            beneficiary_id: this.beneficiary_id,
            user_id: this.user_id,
            target_account_id: this.target_account_id,
            nickname: this.nickname,
            status: this.status,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = Beneficiary;
