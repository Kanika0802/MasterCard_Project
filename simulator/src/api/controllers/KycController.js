// simulator/src/api/controllers/KycController.js

const KycService = require("../../application/services/KycService");

class KycController {
    constructor(kycService = new KycService()) {
        this.kycService = kycService;
    }

    list = async (req, res) => {
        const { user_id, verification_status, limit, offset } = req.query;
        const records = await this.kycService.listKyc({
            userId: user_id,
            verificationStatus: verification_status,
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0
        });
        res.status(200).json({
            items: records.map(r => r.toJSON()),
            total: records.length
        });
    };

    create = async (req, res) => {
        const kyc = await this.kycService.createKyc(req.body);
        res.status(201).json(kyc.toJSON());
    };

    getById = async (req, res) => {
        const { kyc_id } = req.params;
        const kyc = await this.kycService.getKyc(kyc_id);
        res.status(200).json(kyc.toJSON());
    };

    update = async (req, res) => {
        const { kyc_id } = req.params;
        const updated = await this.kycService.updateKyc(kyc_id, req.body);
        res.status(200).json(updated.toJSON());
    };

    delete = async (req, res) => {
        const { kyc_id } = req.params;
        await this.kycService.deleteTestKyc(kyc_id);
        res.status(204).send();
    };
}

module.exports = KycController;
