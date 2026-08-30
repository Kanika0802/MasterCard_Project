// simulator/src/domain/constants.js

const AccountStatus = Object.freeze({
    ACTIVE: "ACTIVE",
    SUSPENDED: "SUSPENDED",
    FROZEN: "FROZEN",
    CLOSED: "CLOSED"
});

const AccountType = Object.freeze({
    SAVINGS: "SAVINGS",
    CHECKING: "CHECKING",
    CURRENT: "CURRENT",
    MERCHANT_SETTLEMENT: "MERCHANT_SETTLEMENT"
});

const MerchantStatus = Object.freeze({
    ACTIVE: "ACTIVE",
    SUSPENDED: "SUSPENDED",
    CLOSED: "CLOSED"
});

const BeneficiaryStatus = Object.freeze({
    PENDING: "PENDING",
    ACTIVE: "ACTIVE",
    DISABLED: "DISABLED"
});

const TransactionStatus = Object.freeze({
    INITIATED: "INITIATED",
    AUTHORIZED: "AUTHORIZED",
    PROCESSING: "PROCESSING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    REVERSED: "REVERSED"
});

const TransactionType = Object.freeze({
    P2P_TRANSFER: "P2P_TRANSFER",
    MERCHANT_PAYMENT: "MERCHANT_PAYMENT",
    BILL_PAYMENT: "BILL_PAYMENT",
    ATM_WITHDRAWAL: "ATM_WITHDRAWAL",
    DEPOSIT: "DEPOSIT",
    REFUND: "REFUND"
});

const TransactionChannel = Object.freeze({
    MOBILE_APP: "MOBILE_APP",
    WEB_PORTAL: "WEB_PORTAL",
    POS_TERMINAL: "POS_TERMINAL",
    API: "API",
    ATM: "ATM"
});

const LedgerEntryType = Object.freeze({
    DEBIT: "DEBIT",
    CREDIT: "CREDIT"
});

const KycVerificationStatus = Object.freeze({
    PENDING: "PENDING",
    VERIFIED: "VERIFIED",
    REJECTED: "REJECTED",
    EXPIRED: "EXPIRED"
});

const DeviceStatus = Object.freeze({
    ACTIVE: "ACTIVE",
    BLOCKED: "BLOCKED",
    RETIRED: "RETIRED"
});

const UserProfileStatus = Object.freeze({
    ACTIVE: "ACTIVE",
    DEACTIVATED: "DEACTIVATED",
    SUSPENDED: "SUSPENDED"
});

const SimulationStatus = Object.freeze({
    CREATED: "CREATED",
    INITIALIZING: "INITIALIZING",
    READY: "READY",
    RUNNING: "RUNNING",
    PAUSED: "PAUSED",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED"
});

const EventType = Object.freeze({
    // User Events
    USER_CREATED: "USER_CREATED",
    USER_UPDATED: "USER_UPDATED",
    USER_DEACTIVATED: "USER_DEACTIVATED",

    // Account Events
    ACCOUNT_CREATED: "ACCOUNT_CREATED",
    ACCOUNT_STATUS_CHANGED: "ACCOUNT_STATUS_CHANGED",
    ACCOUNT_CLOSED: "ACCOUNT_CLOSED",

    // Beneficiary Events
    BENEFICIARY_ADDED: "BENEFICIARY_ADDED",
    BENEFICIARY_UPDATED: "BENEFICIARY_UPDATED",
    BENEFICIARY_DISABLED: "BENEFICIARY_DISABLED",

    // Device Events
    DEVICE_REGISTERED: "DEVICE_REGISTERED",
    DEVICE_UPDATED: "DEVICE_UPDATED",
    DEVICE_RETIRED: "DEVICE_RETIRED",

    // KYC Events
    KYC_CREATED: "KYC_CREATED",
    KYC_UPDATED: "KYC_UPDATED",
    KYC_DELETED: "KYC_DELETED",

    // Auth Events
    AUTH_LOGIN_REQUESTED: "AUTH_LOGIN_REQUESTED",
    AUTH_LOGIN_SUCCESS: "AUTH_LOGIN_SUCCESS",
    AUTH_LOGIN_FAILED: "AUTH_LOGIN_FAILED",
    AUTH_OTP_REQUESTED: "AUTH_OTP_REQUESTED",
    AUTH_OTP_VERIFIED: "AUTH_OTP_VERIFIED",
    AUTH_OTP_FAILED: "AUTH_OTP_FAILED",
    AUTH_PASSWORD_RESET: "AUTH_PASSWORD_RESET",
    AUTH_SESSION_CREATED: "AUTH_SESSION_CREATED",
    AUTH_SESSION_EXPIRED: "AUTH_SESSION_EXPIRED",
    AUTH_LOGOUT: "AUTH_LOGOUT",

    // Transaction Events
    TRANSACTION_INITIATED: "TRANSACTION_INITIATED",
    TRANSACTION_AUTHORIZED: "TRANSACTION_AUTHORIZED",
    TRANSACTION_PROCESSING: "TRANSACTION_PROCESSING",
    TRANSACTION_COMPLETED: "TRANSACTION_COMPLETED",
    TRANSACTION_FAILED: "TRANSACTION_FAILED",
    TRANSACTION_REVERSED: "TRANSACTION_REVERSED",

    // Ledger Events
    LEDGER_ENTRY_CREATED: "LEDGER_ENTRY_CREATED",

    // Simulation Events
    SIMULATION_STARTED: "SIMULATION_STARTED",
    SIMULATION_COMPLETED: "SIMULATION_COMPLETED",
    SIMULATION_FAILED: "SIMULATION_FAILED"
});

const KafkaTopics = Object.freeze({
    USERS: "simulator.users.v1",
    ACCOUNTS: "simulator.accounts.v1",
    TRANSACTIONS: "simulator.transactions.v1",
    DEVICES: "simulator.devices.v1",
    KYC: "simulator.kyc.v1",
    BENEFICIARIES: "simulator.beneficiaries.v1",
    AUTH: "simulator.auth.v1",
    SIMULATIONS: "simulator.simulations.v1"
});

module.exports = {
    AccountStatus,
    AccountType,
    MerchantStatus,
    BeneficiaryStatus,
    TransactionStatus,
    TransactionType,
    TransactionChannel,
    LedgerEntryType,
    KycVerificationStatus,
    DeviceStatus,
    UserProfileStatus,
    SimulationStatus,
    EventType,
    KafkaTopics
};
