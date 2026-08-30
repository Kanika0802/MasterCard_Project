// simulator/tests/unit/entities.test.js

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const Account = require("../../src/domain/entities/Account");
const LedgerEntry = require("../../src/domain/entities/LedgerEntry");
const Transaction = require("../../src/domain/entities/Transaction");
const Beneficiary = require("../../src/domain/entities/Beneficiary");
const { ValidationError, InsufficientFundsError, AccountInactiveError } = require("../../src/domain/errors");
const { AccountStatus, LedgerEntryType, TransactionStatus, TransactionType } = require("../../src/domain/constants");

describe("Domain Entities Unit Tests", () => {
    describe("Account Entity", () => {
        it("should initialize with valid parameters", () => {
            const acc = new Account({
                account_id: "acc_001",
                user_id: "usr_001",
                account_number: "ACC12345",
                balance: 1000.50,
                status: AccountStatus.ACTIVE
            });
            assert.equal(acc.balance, 1000.50);
            assert.equal(acc.isActive(), true);
        });

        it("should reject negative balance initialization", () => {
            assert.throws(() => {
                new Account({
                    account_id: "acc_001",
                    user_id: "usr_001",
                    account_number: "ACC12345",
                    balance: -50.00
                });
            }, ValidationError);
        });

        it("should correctly debit funds and update balance", () => {
            const acc = new Account({
                account_id: "acc_001",
                user_id: "usr_001",
                account_number: "ACC12345",
                balance: 500.00
            });
            const result = acc.debit(150.25);
            assert.equal(result.balanceBefore, 500.00);
            assert.equal(result.balanceAfter, 349.75);
            assert.equal(acc.balance, 349.75);
        });

        it("should throw InsufficientFundsError when debit exceeds balance", () => {
            const acc = new Account({
                account_id: "acc_001",
                user_id: "usr_001",
                account_number: "ACC12345",
                balance: 100.00
            });
            assert.throws(() => {
                acc.debit(150.00);
            }, InsufficientFundsError);
        });

        it("should throw AccountInactiveError when debiting non-active account", () => {
            const acc = new Account({
                account_id: "acc_001",
                user_id: "usr_001",
                account_number: "ACC12345",
                balance: 500.00,
                status: AccountStatus.FROZEN
            });
            assert.throws(() => {
                acc.debit(50.00);
            }, AccountInactiveError);
        });

        it("should correctly credit funds and update balance", () => {
            const acc = new Account({
                account_id: "acc_001",
                user_id: "usr_001",
                account_number: "ACC12345",
                balance: 200.00
            });
            const result = acc.credit(300.50);
            assert.equal(result.balanceBefore, 200.00);
            assert.equal(result.balanceAfter, 500.50);
            assert.equal(acc.balance, 500.50);
        });
    });

    describe("LedgerEntry Entity", () => {
        it("should validate correct DEBIT arithmetic invariant", () => {
            const entry = new LedgerEntry({
                ledger_entry_id: "led_001",
                transaction_id: "tx_001",
                account_id: "acc_001",
                entry_type: LedgerEntryType.DEBIT,
                amount: 100.00,
                balance_before: 500.00,
                balance_after: 400.00
            });
            assert.equal(entry.amount, 100.00);
        });

        it("should validate correct CREDIT arithmetic invariant", () => {
            const entry = new LedgerEntry({
                ledger_entry_id: "led_002",
                transaction_id: "tx_001",
                account_id: "acc_002",
                entry_type: LedgerEntryType.CREDIT,
                amount: 100.00,
                balance_before: 200.00,
                balance_after: 300.00
            });
            assert.equal(entry.amount, 100.00);
        });

        it("should reject mismatched ledger arithmetic", () => {
            assert.throws(() => {
                new LedgerEntry({
                    ledger_entry_id: "led_003",
                    transaction_id: "tx_001",
                    account_id: "acc_001",
                    entry_type: LedgerEntryType.DEBIT,
                    amount: 100.00,
                    balance_before: 500.00,
                    balance_after: 450.00 // invalid! 500 - 100 != 450
                });
            }, ValidationError);
        });
    });

    describe("Transaction Entity", () => {
        it("should initialize and transition lifecycle states", () => {
            const tx = new Transaction({
                transaction_id: "tx_001",
                transaction_reference: "REF123",
                initiator_user_id: "usr_001",
                sender_account_id: "acc_001",
                receiver_account_id: "acc_002",
                amount: 250.00,
                currency: "USD",
                transaction_type: TransactionType.P2P_TRANSFER
            });

            assert.equal(tx.status, TransactionStatus.INITIATED);
            tx.authorize();
            assert.equal(tx.status, TransactionStatus.AUTHORIZED);
            assert.ok(tx.authorized_at);
            tx.startProcessing();
            assert.equal(tx.status, TransactionStatus.PROCESSING);
            tx.complete();
            assert.equal(tx.status, TransactionStatus.COMPLETED);
            assert.ok(tx.completed_at);
        });

        it("should reject non-positive amount", () => {
            assert.throws(() => {
                new Transaction({
                    transaction_id: "tx_001",
                    transaction_reference: "REF123",
                    initiator_user_id: "usr_001",
                    amount: -10.00
                });
            }, ValidationError);
        });
    });
});
