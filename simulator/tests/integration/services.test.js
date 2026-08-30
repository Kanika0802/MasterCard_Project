// simulator/tests/integration/services.test.js

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const { pool } = require("../../src/config/postgres");
const { connectMongoDB, client } = require("../../src/config/mongodb");

const UserService = require("../../src/application/services/UserService");
const AccountService = require("../../src/application/services/AccountService");
const BeneficiaryService = require("../../src/application/services/BeneficiaryService");
const DeviceService = require("../../src/application/services/DeviceService");
const KycService = require("../../src/application/services/KycService");
const AuthenticationService = require("../../src/application/services/AuthenticationService");
const { NotFoundError, ConflictError } = require("../../src/domain/errors");
const { KycVerificationStatus, AccountStatus } = require("../../src/domain/constants");

describe("M1 Services Integration Tests", () => {
    let userService;
    let accountService;
    let beneficiaryService;
    let deviceService;
    let kycService;
    let authService;

    before(async () => {
        await connectMongoDB();
        userService = new UserService();
        accountService = new AccountService();
        beneficiaryService = new BeneficiaryService();
        deviceService = new DeviceService();
        kycService = new KycService();
        authService = new AuthenticationService();
    });

    after(async () => {
        await pool.end();
        await client.close();
    });

    it("should create, read, and update a synthetic user in MongoDB", async () => {
        const uniqueEmail = `test_user_${Date.now()}_${Math.random()}@example.test`;
        const user = await userService.createUser({
            first_name: "Alice",
            last_name: "Smith",
            email: uniqueEmail,
            phone: "+12025550199",
            date_of_birth: "1990-01-01"
        });

        assert.ok(user.user_id);
        assert.equal(user.email, uniqueEmail);

        // Fetch user
        const fetched = await userService.getUser(user.user_id);
        assert.equal(fetched.first_name, "Alice");

        // Update user
        const updated = await userService.updateUser(user.user_id, { occupation: "Engineer" });
        assert.equal(updated.occupation, "Engineer");
    });

    it("should reject duplicate user email registration", async () => {
        const email = `dup_${Date.now()}@example.test`;
        await userService.createUser({
            first_name: "Bob",
            last_name: "Jones",
            email,
            phone: "+12025550188",
            date_of_birth: "1992-02-02"
        });

        await assert.rejects(async () => {
            await userService.createUser({
                first_name: "Bobby",
                last_name: "Jones",
                email,
                phone: "+12025550187",
                date_of_birth: "1992-02-02"
            });
        }, ConflictError);
    });

    it("should create KYC and Device records associated with user", async () => {
        const user = await userService.createUser({
            first_name: "Charlie",
            last_name: "Brown",
            email: `charlie_${Date.now()}@example.test`,
            phone: "+12025550177",
            date_of_birth: "1985-03-03"
        });

        const kyc = await kycService.createKyc({
            user_id: user.user_id,
            document_type: "PASSPORT",
            document_reference: "PASS_12345",
            verification_status: KycVerificationStatus.VERIFIED
        });
        assert.equal(kyc.user_id, user.user_id);
        assert.equal(kyc.verification_status, KycVerificationStatus.VERIFIED);

        const device = await deviceService.registerDevice({
            user_id: user.user_id,
            device_type: "MOBILE",
            operating_system: "iOS 17",
            ip_address: "192.0.2.55"
        });
        assert.equal(device.user_id, user.user_id);
    });

    it("should create accounts in PostgreSQL for MongoDB users and prevent non-existent users", async () => {
        const user = await userService.createUser({
            first_name: "Diana",
            last_name: "Prince",
            email: `diana_${Date.now()}@example.test`,
            phone: "+12025550166",
            date_of_birth: "1988-04-04"
        });

        const account = await accountService.createAccount({
            user_id: user.user_id,
            initial_balance: 5000.00
        });
        assert.ok(account.account_id);
        assert.equal(account.balance, 5000.00);

        // Reject non-existent user
        const fakeUserId = crypto.randomUUID();
        await assert.rejects(async () => {
            await accountService.createAccount({
                user_id: fakeUserId,
                initial_balance: 100.00
            });
        }, NotFoundError);
    });

    it("should register beneficiary and prevent duplicate active registration", async () => {
        const user1 = await userService.createUser({
            first_name: "User1",
            last_name: "Test",
            email: `u1_${Date.now()}@example.test`,
            phone: "+12025550155",
            date_of_birth: "1991-01-01"
        });
        const user2 = await userService.createUser({
            first_name: "User2",
            last_name: "Test",
            email: `u2_${Date.now()}@example.test`,
            phone: "+12025550144",
            date_of_birth: "1991-02-02"
        });

        const acc2 = await accountService.createAccount({
            user_id: user2.user_id,
            initial_balance: 1000.00
        });

        const ben = await beneficiaryService.addBeneficiary({
            user_id: user1.user_id,
            target_account_id: acc2.account_id,
            nickname: "User2 Account"
        });
        assert.equal(ben.target_account_id, acc2.account_id);

        // Duplicate registration should be rejected
        await assert.rejects(async () => {
            await beneficiaryService.addBeneficiary({
                user_id: user1.user_id,
                target_account_id: acc2.account_id
            });
        }, ConflictError);
    });

    it("should simulate authentication workflows and record events", async () => {
        const user = await userService.createUser({
            first_name: "AuthUser",
            last_name: "Test",
            email: `auth_${Date.now()}@example.test`,
            phone: "+12025550133",
            date_of_birth: "1993-05-05"
        });

        const loginSuccess = await authService.simulateLogin({ user_id: user.user_id, success: true });
        assert.equal(loginSuccess.event_type, "AUTH_LOGIN_SUCCESS");

        const otpReq = await authService.simulateOtpRequest({ user_id: user.user_id });
        assert.ok(otpReq.challenge_id);
        assert.equal(otpReq.simulated_otp, "123456");

        const otpVer = await authService.simulateOtpVerification({
            user_id: user.user_id,
            challenge_id: otpReq.challenge_id,
            entered_otp: "123456"
        });
        assert.equal(otpVer.event_type, "AUTH_OTP_VERIFIED");
    });
});
