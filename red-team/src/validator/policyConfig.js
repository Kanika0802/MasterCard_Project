// red-team/src/validator/policyConfig.js

const ALLOWED_SIMULATOR_ACTIONS = Object.freeze([
    "ADD_BENEFICIARY",
    "PERFORM_TRANSACTION",
    "SIMULATE_LOGIN",
    "REGISTER_DEVICE",
    "UPDATE_KYC",
    "CHANGE_ACCOUNT_STATUS"
]);

const ALLOWED_TARGET_ENTITY_TYPES = Object.freeze([
    "user",
    "account",
    "device",
    "kyc",
    "beneficiary",
    "merchant",
    "system"
]);

const DEFAULT_PRIMITIVE_CATALOG = Object.freeze({
    "AUTH_OTP_INTERCEPT_9": {
        name: "OTP Interception",
        allowed_actions: ["SIMULATE_LOGIN"]
    },
    "AUTH_CREDENTIAL_STUFF_9": {
        name: "Credential Stuffing",
        allowed_actions: ["SIMULATE_LOGIN"]
    },
    "DOC_SYNTHETIC_ID_9": {
        name: "Synthetic ID Tampering",
        allowed_actions: ["UPDATE_KYC"]
    },
    "NETWORK_MULE_ADD_9": {
        name: "Mule Beneficiary Registration",
        allowed_actions: ["ADD_BENEFICIARY"]
    },
    "TXN_SPLIT_VELOCITY_9": {
        name: "Split Velocity Transaction",
        allowed_actions: ["PERFORM_TRANSACTION"]
    },
    "TXN_DRAIN_BALANCE_9": {
        name: "Balance Drain Transfer",
        allowed_actions: ["PERFORM_TRANSACTION"]
    },
    "DEVICE_SPOOF_9": {
        name: "Device Fingerprint Spoofing",
        allowed_actions: ["REGISTER_DEVICE"]
    },
    "ACCOUNT_TAKEOVER_9": {
        name: "Multi-Step Account Takeover",
        allowed_actions: [
            "SIMULATE_LOGIN",
            "REGISTER_DEVICE",
            "UPDATE_KYC",
            "ADD_BENEFICIARY",
            "PERFORM_TRANSACTION",
            "CHANGE_ACCOUNT_STATUS"
        ]
    },
    "MERCHANT_INFILTRATE_9": {
        name: "Merchant Settlement Hijack",
        allowed_actions: ["PERFORM_TRANSACTION", "CHANGE_ACCOUNT_STATUS"]
    }
});

const ACTION_PARAMETER_REQUIREMENTS = Object.freeze({
    "ADD_BENEFICIARY": {
        required: ["user_id", "target_account_id"],
        types: {
            user_id: "string",
            target_account_id: "string",
            nickname: "string"
        }
    },
    "PERFORM_TRANSACTION": {
        required: ["sender_account_id", "amount"],
        types: {
            sender_account_id: "string",
            receiver_account_id: "string",
            initiator_user_id: "string",
            merchant_id: "string",
            device_id: "string",
            amount: "number",
            currency: "string",
            transaction_type: "string",
            idempotency_key: "string"
        },
        customValidators: [
            (params, path) => {
                if (typeof params.amount === "number" && params.amount <= 0) {
                    return {
                        code: "INVALID_PARAMETER_VALUE",
                        message: "Transaction amount must be greater than 0.",
                        path: `${path}.amount`
                    };
                }
                return null;
            }
        ]
    },
    "SIMULATE_LOGIN": {
        required: ["user_id"],
        types: {
            user_id: "string",
            device_id: "string",
            success: "boolean",
            ip_address: "string"
        }
    },
    "REGISTER_DEVICE": {
        required: ["user_id"],
        types: {
            user_id: "string",
            device_type: "string",
            operating_system: "string",
            browser: "string",
            ip_address: "string",
            device_fingerprint: "string"
        }
    },
    "UPDATE_KYC": {
        required: ["kyc_id"],
        types: {
            kyc_id: "string",
            verification_status: "string",
            document_type: "string",
            document_reference: "string"
        }
    },
    "CHANGE_ACCOUNT_STATUS": {
        required: ["account_id", "status"],
        types: {
            account_id: "string",
            status: "string"
        }
    }
});

const DEFAULT_RESOURCE_LIMITS = Object.freeze({
    maxSteps: 50,
    maxTimeoutMs: 60000,
    minTimeoutMs: 100,
    maxScenarioBytes: 100000
});

// Patterns indicating external real-world systems, shell commands, or path traversal
const DANGEROUS_PATTERNS = Object.freeze([
    /^(https?|ftp|ssh|ws|wss):\/\//i, // external URLs
    /(\/etc\/|\/var\/|\/usr\/|\/bin\/|C:\\|Windows\\|\.\.\/|\.\.\\)/i, // file paths & traversal
    /(;\s*(rm|del|cat|echo|bash|sh|cmd|powershell|curl|wget|nc)\b)/i, // shell execution
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i, // XSS tags
    /(aws|gcp|azure|production|prod-db|internal-corp)/i // target strings referencing real infra
]);

module.exports = {
    ALLOWED_SIMULATOR_ACTIONS,
    ALLOWED_TARGET_ENTITY_TYPES,
    DEFAULT_PRIMITIVE_CATALOG,
    ACTION_PARAMETER_REQUIREMENTS,
    DEFAULT_RESOURCE_LIMITS,
    DANGEROUS_PATTERNS
};
