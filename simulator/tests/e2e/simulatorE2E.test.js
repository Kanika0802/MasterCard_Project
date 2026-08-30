// simulator/tests/e2e/simulatorE2E.test.js

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../../src/config/postgres");
const { connectMongoDB, client } = require("../../src/config/mongodb");

const UserService = require("../../src/application/services/UserService");
const AccountService = require("../../src/application/services/AccountService");
const BeneficiaryService = require("../../src/application/services/BeneficiaryService");
const DeviceService = require("../../src/application/services/DeviceService");
const KycService = require("../../src/application/services/KycService");
const AuthenticationService = require("../../src/application/services/AuthenticationService");
const TransactionService = require("../../src/application/services/TransactionService");
const LedgerService = require("../../src/application/services/LedgerService");
const OutboxRepository = require("../../src/infrastructure/postgres/repositories/OutboxRepository");
const { KycVerificationStatus, AccountStatus } = require("../../src/domain/constants");

describe("M1 Simulator End-to-End Workflow Tests", () => {
    let userService;
    let accountService;
    let beneficiaryService;
    let deviceService;
    let kycService;
    let authService;
    let transactionService;
    let ledgerService;
    let outboxRepo;

    before(async () => {
        await connectMongoDB();
        userService = new UserService();
        accountService = new AccountService();
        beneficiaryService = new BeneficiaryService();
        deviceService = new DeviceService();
        kycService = new KycService();
        authService = new AuthenticationService();
        transactionService = new TransactionService();
        ledgerService = new LedgerService();
        outboxRepo = new OutboxRepository();
    });

    after(async () => {
        await pool.end();
        await client.close();
    });

    it("should execute the complete minimum synthetic banking workflow", async () => {
        console.log("Starting E2E workflow test...");

        // 1. Create Synthetic User 1 (Sender) and User 2 (Receiver)
        const user1 = await userService.createUser({
            first_name: "Rahul",
            last_name: "Kapoor",
            email: `rahul_${Date.now()}@example.test`,
            phone: "+919876543210",
            date_of_birth: "1994-08-20",
            address: { city: "Mumbai", country: "IN" },
            simulation_id: "sim_e2e",
            experiment_id: "exp_e2e"
        });
        assert.ok(user1.user_id);

        const user2 = await userService.createUser({
            first_name: "Simran",
            last_name: "Singh",
            email: `simran_${Date.now()}@example.test`,
            phone: "+919876543211",
            date_of_birth: "1995-10-12",
            address: { city: "Delhi", country: "IN" },
            simulation_id: "sim_e2e",
            experiment_id: "exp_e2e"
        });
        assert.ok(user2.user_id);

        // 2. Create KYC
        const kyc1 = await kycService.createKyc({
            user_id: user1.user_id,
            document_type: "PASSPORT",
            document_reference: "P98765432",
            verification_status: KycVerificationStatus.VERIFIED,
            simulation_id: "sim_e2e",
            experiment_id: "exp_e2e"
        });
        assert.equal(kyc1.verification_status, "VERIFIED");

        // 3. Register Device
        const device1 = await deviceService.registerDevice({
            user_id: user1.user_id,
            device_type: "MOBILE",
            operating_system: "Android 14",
            browser: "Chrome Mobile",
            ip_address: "192.0.2.100",
            simulation_id: "sim_e2e",
            experiment_id: "exp_e2e"
        });
        assert.ok(device1.device_id);

        // 4. Create Accounts
        const acc1 = await accountService.createAccount({
            user_id: user1.user_id,
            initial_balance: 10000.00,
            simulation_id: "sim_e2e",
            experiment_id: "exp_e2e"
        });
        const acc2 = await accountService.createAccount({
            user_id: user2.user_id,
            initial_balance: 2000.00,
            simulation_id: "sim_e2e",
            experiment_id: "exp_e2e"
        });
        assert.equal(acc1.balance, 10000.00);
        assert.equal(acc2.balance, 2000.00);

        // 5. Create Beneficiary
        const beneficiary = await beneficiaryService.addBeneficiary({
            user_id: user1.user_id,
            target_account_id: acc2.account_id,
            nickname: "Simran Savings",
            simulation_id: "sim_e2e",
            experiment_id: "exp_e2e"
        });
        assert.equal(beneficiary.status, "ACTIVE");

        // 6. Authenticate User
        const login = await authService.simulateLogin({
            user_id: user1.user_id,
            device_id: device1.device_id,
            success: true,
            simulation_id: "sim_e2e",
            experiment_id: "exp_e2e"
        });
        assert.equal(login.event_type, "AUTH_LOGIN_SUCCESS");

        // 7. Execute Transaction
        const transferAmount = 1500.00;
        const { transaction } = await transactionService.createAndProcessTransaction({
            sender_account_id: acc1.account_id,
            receiver_account_id: acc2.account_id,
            initiator_user_id: user1.user_id,
            device_id: device1.device_id,
            amount: transferAmount,
            currency: "USD",
            simulation_id: "sim_e2e",
            experiment_id: "exp_e2e"
        });
        assert.equal(transaction.status, "COMPLETED");

        // 8. Verify Balances
        const finalAcc1 = await accountService.getAccount(acc1.account_id);
        const finalAcc2 = await accountService.getAccount(acc2.account_id);

        assert.equal(finalAcc1.balance, 8500.00);
        assert.equal(finalAcc2.balance, 3500.00);

        // 9. Verify Ledger Entries
        const ledger = await ledgerService.getTransactionEntries(transaction.transaction_id);
        assert.equal(ledger.length, 2);

        const debit = ledger.find(l => l.entry_type === "DEBIT");
        const credit = ledger.find(l => l.entry_type === "CREDIT");
        assert.equal(debit.amount, 1500.00);
        assert.equal(debit.balance_before, 10000.00);
        assert.equal(debit.balance_after, 8500.00);

        assert.equal(credit.amount, 1500.00);
        assert.equal(credit.balance_before, 2000.00);
        assert.equal(credit.balance_after, 3500.00);

        // 10. Verify Emitted Events in Outbox
        const outboxEvents = await pool.query(
            "SELECT * FROM event_outbox WHERE payload->>'simulation_id' = 'sim_e2e' ORDER BY created_at ASC"
        );
        assert.ok(outboxEvents.rows.length >= 6); // USER_CREATED, KYC_CREATED, DEVICE_REGISTERED, ACCOUNT_CREATED, BENEFICIARY_ADDED, AUTH_LOGIN_SUCCESS, TRANSACTION_COMPLETED

        console.log(`[E2E] Workflow passed! Verified ${outboxEvents.rows.length} domain events recorded in outbox.`);
    });
});
