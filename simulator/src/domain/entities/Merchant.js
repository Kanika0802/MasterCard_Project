// simulator/src/domain/entities/Merchant.js

const { ValidationError } = require("../errors");
const { MerchantStatus } = require("../constants");

class Merchant {
    constructor({
        merchant_id,
        merchant_name,
        merchant_category,
        settlement_account_id = null,
        status = MerchantStatus.ACTIVE,
        created_at = new Date(),
        updated_at = new Date()
    }) {
        this.merchant_id = merchant_id;
        this.merchant_name = merchant_name;
        this.merchant_category = merchant_category;
        this.settlement_account_id = settlement_account_id;
        this.status = status;
        this.created_at = created_at;
        this.updated_at = updated_at;

        this.validate();
    }

    validate() {
        if (!this.merchant_id) throw new ValidationError("merchant_id is required.");
        if (!this.merchant_name) throw new ValidationError("merchant_name is required.");
        if (!this.merchant_category) throw new ValidationError("merchant_category is required.");
        if (!Object.values(MerchantStatus).includes(this.status)) {
            throw new ValidationError(`Invalid merchant status: ${this.status}`);
        }
    }

    isActive() {
        return this.status === MerchantStatus.ACTIVE;
    }

    toJSON() {
        return {
            merchant_id: this.merchant_id,
            merchant_name: this.merchant_name,
            merchant_category: this.merchant_category,
            settlement_account_id: this.settlement_account_id,
            status: this.status,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = Merchant;
