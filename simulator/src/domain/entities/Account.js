// simulator/src/domain/entities/Account.js

const { ValidationError, InsufficientFundsError, AccountInactiveError } = require("../errors");
const { AccountStatus, AccountType } = require("../constants");

class Account {
    constructor({
        account_id,
        user_id,
        account_number,
        account_type = AccountType.SAVINGS,
        currency = "USD",
        balance = 0,
        status = AccountStatus.ACTIVE,
        created_at = new Date(),
        updated_at = new Date()
    }) {
        this.account_id = account_id;
        this.user_id = user_id;
        this.account_number = account_number;
        this.account_type = account_type;
        this.currency = currency;
        this.balance = typeof balance === "string" ? parseFloat(balance) : Number(balance);
        this.status = status;
        this.created_at = created_at;
        this.updated_at = updated_at;

        this.validate();
    }

    validate() {
        if (!this.account_id) throw new ValidationError("account_id is required.");
        if (!this.user_id) throw new ValidationError("user_id is required.");
        if (!this.account_number) throw new ValidationError("account_number is required.");
        if (!Object.values(AccountStatus).includes(this.status)) {
            throw new ValidationError(`Invalid account status: ${this.status}`);
        }
        if (isNaN(this.balance) || this.balance < 0) {
            throw new ValidationError(`Account balance cannot be negative. Value: ${this.balance}`);
        }
    }

    isActive() {
        return this.status === AccountStatus.ACTIVE;
    }

    assertEligibleForDebit(amount) {
        if (!this.isActive()) {
            throw new AccountInactiveError(this.account_id, this.status);
        }
        if (amount <= 0) {
            throw new ValidationError("Debit amount must be strictly greater than zero.");
        }
        if (this.balance < amount) {
            throw new InsufficientFundsError(this.account_id, amount, this.balance);
        }
    }

    assertEligibleForCredit(amount) {
        if (!this.isActive()) {
            throw new AccountInactiveError(this.account_id, this.status);
        }
        if (amount <= 0) {
            throw new ValidationError("Credit amount must be strictly greater than zero.");
        }
    }

    debit(amount) {
        this.assertEligibleForDebit(amount);
        const previousBalance = this.balance;
        this.balance = parseFloat((this.balance - amount).toFixed(4));
        this.updated_at = new Date();
        return { balanceBefore: previousBalance, balanceAfter: this.balance };
    }

    credit(amount) {
        this.assertEligibleForCredit(amount);
        const previousBalance = this.balance;
        this.balance = parseFloat((this.balance + amount).toFixed(4));
        this.updated_at = new Date();
        return { balanceBefore: previousBalance, balanceAfter: this.balance };
    }

    changeStatus(newStatus) {
        if (!Object.values(AccountStatus).includes(newStatus)) {
            throw new ValidationError(`Invalid account status: ${newStatus}`);
        }
        this.status = newStatus;
        this.updated_at = new Date();
    }

    toJSON() {
        return {
            account_id: this.account_id,
            user_id: this.user_id,
            account_number: this.account_number,
            account_type: this.account_type,
            currency: this.currency,
            balance: this.balance,
            status: this.status,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = Account;
