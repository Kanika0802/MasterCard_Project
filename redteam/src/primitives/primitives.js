// redteam/src/primitives/primitives.js
//
// The Attack Primitive Library.
// Each entry maps 1:1 to an M1 simulator action (verified from ActionController.js).
//
// M1 Actions verified (simulator/src/api/controllers/ActionController.js):
//   ADD_BENEFICIARY, PERFORM_TRANSACTION, SIMULATE_LOGIN,
//   REGISTER_DEVICE, UPDATE_KYC, CHANGE_ACCOUNT_STATUS
//
// Primitives with no M1 backing are marked is_abstract: true and simulator_action: null.
// Abstract primitives cannot be executed by Person 1's orchestrator.

"use strict";

const PRIMITIVES = [
    // =========================================================================
    // CONCRETE PRIMITIVES (backed by M1 Action Interface)
    // =========================================================================

    {
        primitive_id: "PRIM_ADD_MULE_BENEFICIARY",
        name: "Add Mule Beneficiary",
        description:
            "Register a mule-controlled account as a beneficiary for a target user, " +
            "enabling subsequent fund transfers to the mule account. " +
            "Core step in MULE_NETWORK and ACCOUNT_TAKEOVER attack patterns.",
        simulator_action: "ADD_BENEFICIARY",
        category: "TRANSACTION",
        attack_family: "MULE_NETWORK",
        required_parameters: [
            {
                name: "user_id",
                type: "string",
                description: "ID of the target user whose beneficiary list will be modified"
            },
            {
                name: "target_account_id",
                type: "string",
                description: "ID of the mule-controlled account to register as a beneficiary"
            }
        ],
        optional_parameters: [
            {
                name: "nickname",
                type: "string",
                description: "Display name for the beneficiary to appear legitimate",
                default: null
            }
        ],
        expected_success_events: ["BENEFICIARY_ADDED"],
        expected_failure_events: ["VALIDATION_ERROR", "CONFLICT"],
        preconditions: [
            "Target user must exist in the simulator",
            "Mule account must exist in the simulator",
            "No duplicate active beneficiary for the same target_account_id"
        ],
        postconditions: [
            "Beneficiary is created with ACTIVE status",
            "Fund transfers from user_id to target_account_id are now possible via PERFORM_TRANSACTION"
        ],
        is_abstract: false,
        version: "1.0.0",
        tags: ["mule", "beneficiary", "fund-siphoning", "mule-network"]
    },

    {
        primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
        name: "Execute Fraudulent Transfer",
        description:
            "Transfer funds from a victim account to a mule or attacker-controlled account. " +
            "Used after a mule beneficiary has been established. " +
            "Supports MULE_NETWORK, ACCOUNT_TAKEOVER, and VELOCITY_ABUSE patterns.",
        simulator_action: "PERFORM_TRANSACTION",
        category: "TRANSACTION",
        attack_family: "MULE_NETWORK",
        required_parameters: [
            {
                name: "sender_account_id",
                type: "string",
                description: "ID of the victim/source account to debit"
            },
            {
                name: "receiver_account_id",
                type: "string",
                description: "ID of the mule/destination account to credit"
            },
            {
                name: "initiator_user_id",
                type: "string",
                description: "ID of the user initiating the transaction (typically the victim in ATO scenarios)"
            },
            {
                name: "amount",
                type: "number",
                description: "Transaction amount (must be positive)"
            }
        ],
        optional_parameters: [
            {
                name: "currency",
                type: "string",
                description: "3-character ISO currency code",
                default: "USD"
            },
            {
                name: "transaction_type",
                type: "string",
                description: "One of: P2P_TRANSFER, MERCHANT_PAYMENT, BILL_PAYMENT, ATM_WITHDRAWAL, DEPOSIT, REFUND",
                default: "P2P_TRANSFER"
            },
            {
                name: "channel",
                type: "string",
                description: "One of: MOBILE_APP, WEB_PORTAL, POS_TERMINAL, API, ATM",
                default: "MOBILE_APP"
            },
            {
                name: "device_id",
                type: "string",
                description: "Device ID associated with the transaction",
                default: null
            }
        ],
        expected_success_events: ["TRANSACTION_COMPLETED"],
        expected_failure_events: ["TRANSACTION_FAILED"],
        preconditions: [
            "Sender account must exist and be ACTIVE",
            "Receiver account must exist and be ACTIVE",
            "Sender must have sufficient balance",
            "Initiator user must exist"
        ],
        postconditions: [
            "Funds debited from sender_account_id",
            "Funds credited to receiver_account_id",
            "LEDGER_ENTRY_CREATED events generated"
        ],
        is_abstract: false,
        version: "1.0.0",
        tags: ["transaction", "fund-transfer", "mule", "velocity-abuse"]
    },

    {
        primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
        name: "Simulate Account Takeover Login",
        description:
            "Simulate a successful login event for a target user, representing an attacker " +
            "who has gained credentials. Use success=true for successful ATO login, " +
            "success=false to simulate a failed brute-force attempt.",
        simulator_action: "SIMULATE_LOGIN",
        category: "AUTHENTICATION",
        attack_family: "ACCOUNT_TAKEOVER",
        required_parameters: [
            {
                name: "user_id",
                type: "string",
                description: "ID of the target user whose account is being taken over"
            },
            {
                name: "success",
                type: "boolean",
                description: "true = login succeeded (ATO); false = login failed (brute-force attempt)"
            }
        ],
        optional_parameters: [
            {
                name: "device_id",
                type: "string",
                description: "ID of the device used for the login (use a new/spoofed device ID for ATO realism)",
                default: null
            }
        ],
        expected_success_events: ["AUTH_LOGIN_SUCCESS", "AUTH_LOGIN_FAILED"],
        expected_failure_events: ["VALIDATION_ERROR"],
        preconditions: [
            "Target user must exist in the simulator"
        ],
        postconditions: [
            "AUTH_LOGIN_SUCCESS or AUTH_LOGIN_FAILED event recorded",
            "Authentication event persisted in MongoDB"
        ],
        is_abstract: false,
        version: "1.0.0",
        tags: ["authentication", "ato", "login", "brute-force"]
    },

    {
        primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
        name: "Register Spoofed Device",
        description:
            "Register a new device associated with a target user, simulating device spoofing " +
            "or an attacker introducing an unknown device. New device registration on an " +
            "account is a key ATO signal.",
        simulator_action: "REGISTER_DEVICE",
        category: "DEVICE",
        attack_family: "ACCOUNT_TAKEOVER",
        required_parameters: [
            {
                name: "user_id",
                type: "string",
                description: "ID of the target user to register the spoofed device under"
            },
            {
                name: "device_type",
                type: "string",
                description: "Device type: MOBILE, DESKTOP, or TABLET"
            }
        ],
        optional_parameters: [
            {
                name: "operating_system",
                type: "string",
                description: "OS string to use for the spoofed device",
                default: "SYNTHETIC_OS"
            },
            {
                name: "ip_address",
                type: "string",
                description: "IP address associated with the spoofed device",
                default: "192.0.2.99"
            },
            {
                name: "device_fingerprint",
                type: "string",
                description: "Custom device fingerprint to spoof a specific identity",
                default: null
            },
            {
                name: "geo_location",
                type: "object",
                description: "Location object: { city, country }",
                default: null
            }
        ],
        expected_success_events: ["DEVICE_REGISTERED"],
        expected_failure_events: ["VALIDATION_ERROR"],
        preconditions: [
            "Target user must exist in the simulator"
        ],
        postconditions: [
            "New device registered and associated with target user",
            "DEVICE_REGISTERED event generated"
        ],
        is_abstract: false,
        version: "1.0.0",
        tags: ["device", "spoofing", "ato", "new-device"]
    },

    {
        primitive_id: "PRIM_TAMPER_KYC_VERIFICATION",
        name: "Tamper with KYC Verification Status",
        description:
            "Update the KYC verification status of a target user's KYC record. " +
            "Can be used to simulate bypass of identity verification controls " +
            "(e.g., setting status to VERIFIED for a synthetic identity) " +
            "or to simulate KYC degradation attacks (setting to REJECTED/EXPIRED).",
        simulator_action: "UPDATE_KYC",
        category: "KYC",
        attack_family: "IDENTITY_FRAUD",
        required_parameters: [
            {
                name: "kyc_id",
                type: "string",
                description: "ID of the KYC record to modify"
            },
            {
                name: "verification_status",
                type: "string",
                description: "New KYC status: PENDING, VERIFIED, REJECTED, or EXPIRED"
            }
        ],
        optional_parameters: [
            {
                name: "risk_profile",
                type: "string",
                description: "Risk profile to set: STANDARD, HIGH_RISK, etc.",
                default: null
            },
            {
                name: "liveness_status",
                type: "string",
                description: "Liveness check status override",
                default: null
            }
        ],
        expected_success_events: ["KYC_UPDATED"],
        expected_failure_events: ["VALIDATION_ERROR", "NOT_FOUND"],
        preconditions: [
            "KYC record must exist in the simulator"
        ],
        postconditions: [
            "KYC verification_status updated to specified value",
            "KYC_UPDATED event generated"
        ],
        is_abstract: false,
        version: "1.0.0",
        tags: ["kyc", "identity-fraud", "verification-bypass"]
    },

    {
        primitive_id: "PRIM_MANIPULATE_ACCOUNT_STATUS",
        name: "Manipulate Account Status",
        description:
            "Change the status of a target account. Use to simulate " +
            "unfreezing a previously frozen/suspended account before draining funds, " +
            "or freezing a victim account to prevent defensive actions.",
        simulator_action: "CHANGE_ACCOUNT_STATUS",
        category: "ACCOUNT",
        attack_family: "ACCOUNT_TAKEOVER",
        required_parameters: [
            {
                name: "account_id",
                type: "string",
                description: "ID of the account whose status will be changed"
            },
            {
                name: "status",
                type: "string",
                description: "New account status: ACTIVE, SUSPENDED, FROZEN, or CLOSED"
            }
        ],
        optional_parameters: [],
        expected_success_events: ["ACCOUNT_STATUS_CHANGED"],
        expected_failure_events: ["VALIDATION_ERROR", "NOT_FOUND"],
        preconditions: [
            "Account must exist in the simulator"
        ],
        postconditions: [
            "Account status updated to the specified value",
            "ACCOUNT_STATUS_CHANGED event generated"
        ],
        is_abstract: false,
        version: "1.0.0",
        tags: ["account", "status", "ato", "freeze", "unfreeze"]
    },

    // =========================================================================
    // ABSTRACT PRIMITIVES (no M1 backing — documented for future extension)
    // =========================================================================

    {
        primitive_id: "PRIM_OTP_INTERCEPT",
        name: "OTP Interception (Abstract)",
        description:
            "Simulate interception of an OTP sent to the victim's phone. " +
            "NOT YET BACKED by M1: M1's simulateOtpRequest always generates '123456' but " +
            "does not expose an OTP interception action in the Action Controller. " +
            "Mark is_abstract=true; cannot be executed until M1 exposes an OTP action.",
        simulator_action: null,
        category: "AUTHENTICATION",
        attack_family: "ACCOUNT_TAKEOVER",
        required_parameters: [
            {
                name: "user_id",
                type: "string",
                description: "Target user whose OTP will be intercepted"
            }
        ],
        optional_parameters: [],
        expected_success_events: ["AUTH_OTP_VERIFIED"],
        expected_failure_events: ["AUTH_OTP_FAILED"],
        preconditions: [
            "An OTP challenge must be active for the target user",
            "M1 Action Controller must expose OTP-related actions (not yet implemented)"
        ],
        postconditions: [
            "OTP verification event recorded as if attacker entered the correct code"
        ],
        is_abstract: true,
        version: "1.0.0",
        tags: ["otp", "interception", "ato", "abstract", "future"]
    },

    {
        primitive_id: "PRIM_SESSION_HIJACK",
        name: "Session Hijacking (Abstract)",
        description:
            "Simulate session token theft and reuse. " +
            "NOT YET BACKED by M1: M1 does not expose session management actions. " +
            "Cannot be executed until M1 adds session hijacking support.",
        simulator_action: null,
        category: "AUTHENTICATION",
        attack_family: "ACCOUNT_TAKEOVER",
        required_parameters: [
            {
                name: "user_id",
                type: "string",
                description: "Target user whose session will be hijacked"
            }
        ],
        optional_parameters: [],
        expected_success_events: ["AUTH_SESSION_CREATED"],
        expected_failure_events: ["AUTH_SESSION_EXPIRED"],
        preconditions: [
            "M1 Action Controller must expose session manipulation actions (not yet implemented)"
        ],
        postconditions: [
            "Session appears active for attacker"
        ],
        is_abstract: true,
        version: "1.0.0",
        tags: ["session", "hijacking", "ato", "abstract", "future"]
    },

    {
        primitive_id: "PRIM_SYNTHETIC_IDENTITY_CREATE",
        name: "Create Synthetic Identity (Abstract)",
        description:
            "Create a fully synthetic user identity for use as a mule or cover account. " +
            "NOT YET BACKED via Action Controller: M1 supports user creation via " +
            "POST /api/v1/simulator/users but does not expose it through the Action Interface. " +
            "Cannot be executed via Person 1's orchestrator until Action Controller is extended.",
        simulator_action: null,
        category: "IDENTITY",
        attack_family: "IDENTITY_FRAUD",
        required_parameters: [
            {
                name: "first_name",
                type: "string",
                description: "Synthetic first name"
            },
            {
                name: "last_name",
                type: "string",
                description: "Synthetic last name"
            },
            {
                name: "email",
                type: "string",
                description: "Synthetic email address"
            }
        ],
        optional_parameters: [],
        expected_success_events: ["USER_CREATED"],
        expected_failure_events: ["VALIDATION_ERROR"],
        preconditions: [
            "M1 Action Controller must expose CREATE_USER action (not yet implemented)"
        ],
        postconditions: [
            "New synthetic user created"
        ],
        is_abstract: true,
        version: "1.0.0",
        tags: ["identity", "synthetic", "mule", "abstract", "future"]
    }
];

module.exports = PRIMITIVES;
