// simulator/src/api/controllers/BeneficiaryController.js

const BeneficiaryService = require("../../application/services/BeneficiaryService");

class BeneficiaryController {
    constructor(beneficiaryService = new BeneficiaryService()) {
        this.beneficiaryService = beneficiaryService;
    }

    list = async (req, res) => {
        const { user_id, status, limit, offset } = req.query;
        const list = await this.beneficiaryService.listBeneficiaries({
            userId: user_id,
            status,
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0
        });
        res.status(200).json({
            items: list.map(b => b.toJSON()),
            total: list.length
        });
    };

    create = async (req, res) => {
        const beneficiary = await this.beneficiaryService.addBeneficiary(req.body);
        res.status(201).json(beneficiary.toJSON());
    };

    getById = async (req, res) => {
        const { beneficiary_id } = req.params;
        const beneficiary = await this.beneficiaryService.getBeneficiary(beneficiary_id);
        res.status(200).json(beneficiary.toJSON());
    };

    update = async (req, res) => {
        const { beneficiary_id } = req.params;
        const updated = await this.beneficiaryService.updateBeneficiary(beneficiary_id, req.body);
        res.status(200).json(updated.toJSON());
    };

    disable = async (req, res) => {
        const { beneficiary_id } = req.params;
        await this.beneficiaryService.disableBeneficiary(beneficiary_id);
        res.status(204).send();
    };
}

module.exports = BeneficiaryController;
