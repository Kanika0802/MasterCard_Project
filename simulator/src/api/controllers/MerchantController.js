// simulator/src/api/controllers/MerchantController.js

const MerchantService = require("../../application/services/MerchantService");

class MerchantController {
    constructor(merchantService = new MerchantService()) {
        this.merchantService = merchantService;
    }

    list = async (req, res) => {
        const { status, limit, offset } = req.query;
        const merchants = await this.merchantService.listMerchants({
            status,
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0
        });
        res.status(200).json({
            items: merchants.map(m => m.toJSON()),
            total: merchants.length
        });
    };

    create = async (req, res) => {
        const merchant = await this.merchantService.createMerchant(req.body);
        res.status(201).json(merchant.toJSON());
    };

    getById = async (req, res) => {
        const { merchant_id } = req.params;
        const merchant = await this.merchantService.getMerchant(merchant_id);
        res.status(200).json(merchant.toJSON());
    };

    updateStatus = async (req, res) => {
        const { merchant_id } = req.params;
        const { status } = req.body;
        const updated = await this.merchantService.updateStatus(merchant_id, status);
        res.status(200).json(updated.toJSON());
    };
}

module.exports = MerchantController;
