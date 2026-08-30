// simulator/src/domain/entities/LedgerEntry.js

const { ValidationError } = require("../errors");
const { LedgerEntryType } = require("../constants");

class LedgerEntry {
    constructor({
        ledger_entry_id,
        transaction_id,
        account_id,
        entry_type,
        amount,
        balance_before,
        balance_after,
        created_at = new Date()
    }) {
        this.ledger_entry_id = ledger_entry_id;
        this.transaction_id = transaction_id;
        this.account_id = account_id;
        this.entry_type = entry_type;
        this.amount = typeof amount === "string" ? parseFloat(amount) : Number(amount);
        this.balance_before = typeof balance_before === "string" ? parseFloat(balance_before) : Number(balance_before);
        this.balance_after = typeof balance_after === "string" ? parseFloat(balance_after) : Number(balance_after);
        this.created_at = created_at;

        this.validate();
    }

    validate() {
        if (!this.ledger_entry_id) throw new ValidationError("ledger_entry_id is required.");
        if (!this.transaction_id) throw new ValidationError("transaction_id is required.");
        if (!this.account_id) throw new ValidationError("account_id is required.");
        if (!Object.values(LedgerEntryType).includes(this.entry_type)) {
            throw new ValidationError(`Invalid entry_type: ${this.entry_type}`);
        }
        if (isNaN(this.amount) || this.amount <= 0) {
            throw new ValidationError(`Ledger amount must be strictly greater than zero. Value: ${this.amount}`);
        }
        if (isNaN(this.balance_before) || this.balance_before < 0) {
            throw new ValidationError(`balance_before cannot be negative. Value: ${this.balance_before}`);
        }
        if (isNaN(this.balance_after) || this.balance_after < 0) {
            throw new ValidationError(`balance_after cannot be negative. Value: ${this.balance_after}`);
        }

        // Verify balance arithmetic
        if (this.entry_type === LedgerEntryType.DEBIT) {
            const expectedAfter = parseFloat((this.balance_before - this.amount).toFixed(4));
            if (Math.abs(this.balance_after - expectedAfter) > 0.0001) {
                throw new ValidationError(
                    `DEBIT ledger arithmetic mismatch: balance_before (${this.balance_before}) - amount (${this.amount}) !== balance_after (${this.balance_after})`
                );
            }
        } else if (this.entry_type === LedgerEntryType.CREDIT) {
            const expectedAfter = parseFloat((this.balance_before + this.amount).toFixed(4));
            if (Math.abs(this.balance_after - expectedAfter) > 0.0001) {
                throw new ValidationError(
                    `CREDIT ledger arithmetic mismatch: balance_before (${this.balance_before}) + amount (${this.amount}) !== balance_after (${this.balance_after})`
                );
            }
        }
    }

    toJSON() {
        return {
            ledger_entry_id: this.ledger_entry_id,
            transaction_id: this.transaction_id,
            account_id: this.account_id,
            entry_type: this.entry_type,
            amount: this.amount,
            balance_before: this.balance_before,
            balance_after: this.balance_after,
            created_at: this.created_at
        };
    }
}

module.exports = LedgerEntry;
