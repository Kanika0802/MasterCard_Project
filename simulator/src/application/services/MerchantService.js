// simulator/src/application/services/MerchantService.js

const crypto = require("crypto");
const Merchant = require("../../domain/entities/Merchant");
const MerchantRepository = require("../../infrastructure/postgres/repositories/MerchantRepository");
const AccountRepository = require("../../infrastructure/postgres/repositories/AccountRepository");
const { MerchantStatus } = require("../../domain/constants");
const { NotFoundError, ValidationError } = require("../../domain/errors");

class MerchantService {
    constructor(
        merchantRepo = new MerchantRepository(),
        accountRepo = new AccountRepository()
    ) {
        this.merchantRepo = merchantRepo;
        this.accountRepo = accountRepo;
    }

    async createMerchant({
        merchant_id = crypto.randomUUID(),
        merchant_name,
        merchant_category,
        settlement_account_id = null,
        status = MerchantStatus.ACTIVE
    }) {
        if (settlement_account_id) {
            const acc = await this.accountRepo.findById(settlement_account_id);
            if (!acc) {
                throw new NotFoundError("Settlement Account", settlement_account_id);
            }
        }

        const merchant = new Merchant({
            merchant_id,
            merchant_name,
            merchant_category,
            settlement_account_id,
            status
        });

        return this.merchantRepo.create(merchant);
    }

    async getMerchant(merchantId) {
        const merchant = await this.merchantRepo.findById(merchantId);
        if (!merchant) {
            throw new NotFoundError("Merchant", merchantId);
        }
        return merchant;
    }

    async listMerchants(options = {}) {
        return this.merchantRepo.list(options);
    }

    async updateStatus(merchantId, newStatus) {
        await this.getMerchant(merchantId);
        return this.merchantRepo.updateStatus(merchantId, newStatus);
    }
}

module.exports = MerchantService;
