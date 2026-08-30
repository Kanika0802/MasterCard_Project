// simulator/src/api/controllers/TransactionController.js

const TransactionService = require("../../application/services/TransactionService");

class TransactionController {
    constructor(transactionService = new TransactionService()) {
        this.transactionService = transactionService;
    }

    list = async (req, res) => {
        const { account_id, status, experiment_id, limit, offset } = req.query;
        const txs = await this.transactionService.listTransactions({
            accountId: account_id,
            status,
            experimentId: experiment_id,
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0
        });
        res.status(200).json({
            items: txs.map(t => t.toJSON()),
            total: txs.length
        });
    };

    create = async (req, res) => {
        const idempotencyKey = req.headers["idempotency-key"] || req.headers["Idempotency-Key"] || null;
        const result = await this.transactionService.createAndProcessTransaction({
            ...req.body,
            idempotency_key: idempotencyKey
        });

        const statusCode = result.is_idempotent_replay ? 200 : 201;
        res.status(statusCode).json(result.transaction.toJSON());
    };

    getById = async (req, res) => {
        const { transaction_id } = req.params;
        const tx = await this.transactionService.getTransaction(transaction_id);
        res.status(200).json(tx.toJSON());
    };

    updateState = async (req, res) => {
        const { transaction_id } = req.params;
        const { status, failure_reason } = req.body;
        const updated = await this.transactionService.updateTransactionState(transaction_id, status, failure_reason);
        res.status(200).json(updated.toJSON());
    };

    delete = async (req, res) => {
        const { transaction_id } = req.params;
        await this.transactionService.deleteTestTransaction(transaction_id);
        res.status(204).send();
    };
}

module.exports = TransactionController;
