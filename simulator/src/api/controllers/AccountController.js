// simulator/src/api/controllers/AccountController.js

const AccountService = require("../../application/services/AccountService");

class AccountController {
    constructor(accountService = new AccountService()) {
        this.accountService = accountService;
    }

    list = async (req, res) => {
        const { user_id, status, limit, offset } = req.query;
        const accounts = await this.accountService.listAccounts({
            userId: user_id,
            status,
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0
        });
        res.status(200).json({
            items: accounts.map(a => a.toJSON()),
            total: accounts.length
        });
    };

    create = async (req, res) => {
        const account = await this.accountService.createAccount(req.body);
        res.status(201).json(account.toJSON());
    };

    getById = async (req, res) => {
        const { account_id } = req.params;
        const account = await this.accountService.getAccount(account_id);
        res.status(200).json(account.toJSON());
    };

    updateStatus = async (req, res) => {
        const { account_id } = req.params;
        const { status } = req.body;
        const updated = await this.accountService.changeAccountStatus(account_id, status);
        res.status(200).json(updated.toJSON());
    };

    close = async (req, res) => {
        const { account_id } = req.params;
        await this.accountService.closeAccount(account_id);
        res.status(204).send();
    };
}

module.exports = AccountController;
