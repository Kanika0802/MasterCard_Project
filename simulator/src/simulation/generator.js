// simulator/src/simulation/generator.js

const crypto = require("crypto");
const UserService = require("../application/services/UserService");
const AccountService = require("../application/services/AccountService");
const MerchantService = require("../application/services/MerchantService");
const DeviceService = require("../application/services/DeviceService");
const KycService = require("../application/services/KycService");
const BeneficiaryService = require("../application/services/BeneficiaryService");
const { KycVerificationStatus, AccountType } = require("../domain/constants");

class SyntheticDataGenerator {
    constructor(seed = 12345) {
        this.seed = seed;
        this.userService = new UserService();
        this.accountService = new AccountService();
        this.merchantService = new MerchantService();
        this.deviceService = new DeviceService();
        this.kycService = new KycService();
        this.beneficiaryService = new BeneficiaryService();
    }

    _seededRandom() {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }

    _choice(arr) {
        return arr[Math.floor(this._seededRandom() * arr.length)];
    }

    async seedScenario({
        userCount = 5,
        merchantCount = 2,
        simulationId = "sim_synth_01",
        experimentId = "exp_synth_01"
    } = {}) {
        console.log(`[DataGenerator] Seeding ${userCount} users and ${merchantCount} merchants...`);

        const firstNames = ["Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Sneha", "Kabir", "Neha"];
        const lastNames = ["Sharma", "Verma", "Patel", "Mehta", "Deshmukh", "Nair", "Reddy", "Gupta"];
        const cities = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Pune", "Chennai"];
        const deviceTypes = ["MOBILE", "DESKTOP", "TABLET"];
        const osList = ["Android 14", "iOS 17.5", "Windows 11", "macOS Sonoma"];

        const createdUsers = [];
        const createdAccounts = [];
        const createdMerchants = [];

        // 1. Create Users, Devices, KYC, and Accounts
        for (let i = 0; i < userCount; i++) {
            const firstName = this._choice(firstNames);
            const lastName = this._choice(lastNames);
            const uniqueSuffix = `${Date.now()}_${i}_${Math.floor(this._seededRandom() * 1000)}`;
            const email = `synth_${firstName.toLowerCase()}.${lastName.toLowerCase()}_${uniqueSuffix}@example.test`;
            const phone = `+9198${Math.floor(10000000 + this._seededRandom() * 90000000)}`;

            const user = await this.userService.createUser({
                first_name: firstName,
                last_name: lastName,
                email,
                phone,
                date_of_birth: "1995-05-15",
                address: { city: this._choice(cities), country: "IN" },
                occupation: "Professional",
                simulation_id: simulationId,
                experiment_id: experimentId
            });
            createdUsers.push(user);

            // Create KYC
            await this.kycService.createKyc({
                user_id: user.user_id,
                document_type: "SYNTHETIC_NATIONAL_ID",
                document_reference: `SYN_ID_${user.user_id.substring(0, 8).toUpperCase()}`,
                verification_status: KycVerificationStatus.VERIFIED,
                simulation_id: simulationId,
                experiment_id: experimentId
            });

            // Create Primary Device
            await this.deviceService.registerDevice({
                user_id: user.user_id,
                device_type: this._choice(deviceTypes),
                operating_system: this._choice(osList),
                browser: "Chrome/128.0.0",
                ip_address: `192.0.2.${10 + i}`,
                geo_location: { city: user.address.city, country: "IN" },
                device_fingerprint: `fp_synth_${user.user_id}`,
                simulation_id: simulationId,
                experiment_id: experimentId
            });

            // Create Primary Account with Initial Balance
            const initialBalance = parseFloat((5000 + this._seededRandom() * 20000).toFixed(2));
            const account = await this.accountService.createAccount({
                user_id: user.user_id,
                account_type: AccountType.SAVINGS,
                currency: "USD",
                initial_balance: initialBalance,
                simulation_id: simulationId,
                experiment_id: experimentId
            });
            createdAccounts.push(account);
        }

        // 2. Create Merchants and Settlement Accounts
        const merchantCategories = ["E-Commerce", "Groceries", "Dining", "Electronics", "Utilities"];
        for (let m = 0; m < merchantCount; m++) {
            // Create a merchant owner user
            const merchantUser = await this.userService.createUser({
                first_name: `MerchantOwner`,
                last_name: `${m + 1}`,
                email: `merchant_${m + 1}_${Date.now()}@merchant.test`,
                phone: `+9199${Math.floor(10000000 + this._seededRandom() * 90000000)}`,
                date_of_birth: "1988-08-08",
                address: { city: "Bengaluru", country: "IN" },
                occupation: "Merchant",
                simulation_id: simulationId,
                experiment_id: experimentId
            });

            // Create merchant settlement account
            const settlementAcc = await this.accountService.createAccount({
                user_id: merchantUser.user_id,
                account_type: AccountType.MERCHANT_SETTLEMENT,
                currency: "USD",
                initial_balance: 10000.00,
                simulation_id: simulationId,
                experiment_id: experimentId
            });

            const merchant = await this.merchantService.createMerchant({
                merchant_name: `Synthetic Store ${m + 1}`,
                merchant_category: this._choice(merchantCategories),
                settlement_account_id: settlementAcc.account_id
            });
            createdMerchants.push(merchant);
        }

        // 3. Register Beneficiaries between users
        if (createdAccounts.length >= 2) {
            for (let i = 0; i < createdAccounts.length - 1; i++) {
                const user = createdUsers[i];
                const nextAccount = createdAccounts[i + 1];
                await this.beneficiaryService.addBeneficiary({
                    user_id: user.user_id,
                    target_account_id: nextAccount.account_id,
                    nickname: `Friend ${i + 2}`,
                    simulation_id: simulationId,
                    experiment_id: experimentId
                });
            }
        }

        console.log(`[DataGenerator] Seeding completed successfully. Generated ${createdUsers.length} users, ${createdAccounts.length} accounts, ${createdMerchants.length} merchants.`);

        return {
            users: createdUsers,
            accounts: createdAccounts,
            merchants: createdMerchants
        };
    }
}

module.exports = SyntheticDataGenerator;
