// simulator/tests/integration/transactionAtomicity.test.js

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../../src/config/postgres");
const { connectMongoDB, client } = require("../../src/config/mongodb");

const UserService = require("../../src/application/services/UserService");
const AccountService = require("../../src/application/services/AccountService");
const TransactionService = require("../../src/application/services/TransactionService");
const LedgerService = require("../../src/application/services/LedgerService");
const { InsufficientFundsError } = require("../../src/domain/errors");

describe("Transaction Atomicity, Concurrency & Idempotency Integration Tests", () => {
    let userService;
    let accountService;
    let transactionService;
    let ledgerService;

    before(async () => {
        await connectMongoDB();
        userService = new UserService();
        accountService = new AccountService();
        transactionService = new TransactionService();
        ledgerService = new LedgerService();
    });

    after(async () => {
        await pool.end();
        await client.close();
    });

    it("should execute an atomic transfer and maintain financial invariants and ledger records", async () => {
        // Setup two users and accounts
        const userA = await userService.createUser({
            first_name: "Sender",
            last_name: "A",
            email: `sendera_${Date.now()}@example.test`,
            phone: "+12025550901",
            date_of_birth: "1990-01-01"
        });
        const userB = await userService.createUser({
            first_name: "Receiver",
            last_name: "B",
            email: `receiverb_${Date.now()}@example.test`,
            phone: "+12025550902",
            date_of_birth: "1992-02-02"
        });

        const accA = await accountService.createAccount({
            user_id: userA.user_id,
            initial_balance: 1000.00
        });
        const accB = await accountService.createAccount({
            user_id: userB.user_id,
            initial_balance: 500.00
        });

        const transferAmount = 250.00;

        // Perform Transfer
        const { transaction } = await transactionService.createAndProcessTransaction({
            sender_account_id: accA.account_id,
            receiver_account_id: accB.account_id,
            initiator_user_id: userA.user_id,
            amount: transferAmount,
            currency: "USD"
        });

        assert.equal(transaction.status, "COMPLETED");

        // Verify updated account balances
        const updatedAccA = await accountService.getAccount(accA.account_id);
        const updatedAccB = await accountService.getAccount(accB.account_id);

        assert.equal(updatedAccA.balance, 750.00);
        assert.equal(updatedAccB.balance, 750.00);

        // Verify invariant: sender_after + amount == sender_before
        assert.equal(updatedAccA.balance + transferAmount, 1000.00);
        // receiver_after - amount == receiver_before
        assert.equal(updatedAccB.balance - transferAmount, 500.00);

        // Verify Ledger Entries
        const ledgerEntries = await ledgerService.getTransactionEntries(transaction.transaction_id);
        assert.equal(ledgerEntries.length, 2);

        const debitEntry = ledgerEntries.find(e => e.entry_type === "DEBIT");
        const creditEntry = ledgerEntries.find(e => e.entry_type === "CREDIT");

        assert.ok(debitEntry);
        assert.equal(debitEntry.account_id, accA.account_id);
        assert.equal(debitEntry.amount, 250.00);
        assert.equal(debitEntry.balance_before, 1000.00);
        assert.equal(debitEntry.balance_after, 750.00);

        assert.ok(creditEntry);
        assert.equal(creditEntry.account_id, accB.account_id);
        assert.equal(creditEntry.amount, 250.00);
        assert.equal(creditEntry.balance_before, 500.00);
        assert.equal(creditEntry.balance_after, 750.00);
    });

    it("should rollback completely when sender has insufficient balance", async () => {
        const user = await userService.createUser({
            first_name: "LowBalance",
            last_name: "User",
            email: `lowbal_${Date.now()}@example.test`,
            phone: "+12025550903",
            date_of_birth: "1994-04-04"
        });
        const accSender = await accountService.createAccount({
            user_id: user.user_id,
            initial_balance: 50.00
        });
        const accReceiver = await accountService.createAccount({
            user_id: user.user_id,
            initial_balance: 100.00
        });

        await assert.rejects(async () => {
            await transactionService.createAndProcessTransaction({
                sender_account_id: accSender.account_id,
                receiver_account_id: accReceiver.account_id,
                initiator_user_id: user.user_id,
                amount: 500.00, // exceeds 50.00 balance
                currency: "USD"
            });
        }, InsufficientFundsError);

        // Verify balances remain unchanged
        const checkSender = await accountService.getAccount(accSender.account_id);
        const checkReceiver = await accountService.getAccount(accReceiver.account_id);
        assert.equal(checkSender.balance, 50.00);
        assert.equal(checkReceiver.balance, 100.00);
    });

    it("should handle idempotency keys safely without duplicate debit", async () => {
        const user = await userService.createUser({
            first_name: "IdempUser",
            last_name: "Test",
            email: `idemp_${Date.now()}@example.test`,
            phone: "+12025550904",
            date_of_birth: "1995-05-05"
        });
        const acc1 = await accountService.createAccount({
            user_id: user.user_id,
            initial_balance: 1000.00
        });
        const acc2 = await accountService.createAccount({
            user_id: user.user_id,
            initial_balance: 100.00
        });

        const idempKey = `test_key_${Date.now()}`;

        // First attempt
        const result1 = await transactionService.createAndProcessTransaction({
            sender_account_id: acc1.account_id,
            receiver_account_id: acc2.account_id,
            initiator_user_id: user.user_id,
            amount: 200.00,
            idempotency_key: idempKey
        });
        assert.equal(result1.is_idempotent_replay, false);

        // Second attempt with same idempotency key
        const result2 = await transactionService.createAndProcessTransaction({
            sender_account_id: acc1.account_id,
            receiver_account_id: acc2.account_id,
            initiator_user_id: user.user_id,
            amount: 200.00,
            idempotency_key: idempKey
        });
        assert.equal(result2.is_idempotent_replay, true);
        assert.equal(result2.transaction.transaction_id, result1.transaction.transaction_id);

        // Verify balance was debited ONLY ONCE
        const finalAcc1 = await accountService.getAccount(acc1.account_id);
        assert.equal(finalAcc1.balance, 800.00);
    });

    it("should prevent race-condition overdrafts under concurrent transfers", async () => {
        const user = await userService.createUser({
            first_name: "ConcUser",
            last_name: "Test",
            email: `conc_${Date.now()}@example.test`,
            phone: "+12025550905",
            date_of_birth: "1996-06-06"
        });

        // Account with 1000 balance
        const sourceAcc = await accountService.createAccount({
            user_id: user.user_id,
            initial_balance: 1000.00
        });
        const destAcc = await accountService.createAccount({
            user_id: user.user_id,
            initial_balance: 0.00
        });

        // Two simultaneous transactions of 700 each (700 + 700 = 1400 > 1000)
        // Exactly ONE must succeed and ONE must fail with InsufficientFunds
        const p1 = transactionService.createAndProcessTransaction({
            sender_account_id: sourceAcc.account_id,
            receiver_account_id: destAcc.account_id,
            initiator_user_id: user.user_id,
            amount: 700.00
        });

        const p2 = transactionService.createAndProcessTransaction({
            sender_account_id: sourceAcc.account_id,
            receiver_account_id: destAcc.account_id,
            initiator_user_id: user.user_id,
            amount: 700.00
        });

        const results = await Promise.allSettled([p1, p2]);
        const fulfilled = results.filter(r => r.status === "fulfilled");
        const rejected = results.filter(r => r.status === "rejected");

        assert.equal(fulfilled.length, 1, "Exactly one concurrent transaction should succeed");
        assert.equal(rejected.length, 1, "Exactly one concurrent transaction should be rejected");

        // Verify final balance is 300 (1000 - 700)
        const finalSource = await accountService.getAccount(sourceAcc.account_id);
        assert.equal(finalSource.balance, 300.00);
    });
});
