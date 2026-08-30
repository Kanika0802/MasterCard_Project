// simulator/src/application/services/LedgerService.js

const crypto = require("crypto");
const LedgerEntry = require("../../domain/entities/LedgerEntry");
const LedgerRepository = require("../../infrastructure/postgres/repositories/LedgerRepository");
const { LedgerEntryType } = require("../../domain/constants");

class LedgerService {
    constructor(ledgerRepo = new LedgerRepository()) {
        this.ledgerRepo = ledgerRepo;
    }

    async recordDebit({
        ledger_entry_id = crypto.randomUUID(),
        transaction_id,
        account_id,
        amount,
        balance_before,
        balance_after
    }, client = null) {
        const entry = new LedgerEntry({
            ledger_entry_id,
            transaction_id,
            account_id,
            entry_type: LedgerEntryType.DEBIT,
            amount,
            balance_before,
            balance_after
        });

        return this.ledgerRepo.create(entry, client);
    }

    async recordCredit({
        ledger_entry_id = crypto.randomUUID(),
        transaction_id,
        account_id,
        amount,
        balance_before,
        balance_after
    }, client = null) {
        const entry = new LedgerEntry({
            ledger_entry_id,
            transaction_id,
            account_id,
            entry_type: LedgerEntryType.CREDIT,
            amount,
            balance_before,
            balance_after
        });

        return this.ledgerRepo.create(entry, client);
    }

    async getTransactionEntries(transactionId, client = null) {
        return this.ledgerRepo.findByTransactionId(transactionId, client);
    }

    async getAccountStatement(accountId, options = {}, client = null) {
        return this.ledgerRepo.findByAccountId(accountId, options, client);
    }
}

module.exports = LedgerService;
