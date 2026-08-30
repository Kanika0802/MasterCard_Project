// redteam/src/strategies/strategies.js
//
// The Attack Strategy Library.
// Each strategy is a reusable template that the AttackComposer uses to build
// concrete AttackScenarios by binding real entity IDs to placeholder variables.
//
// Placeholder variables in parameter_bindings use the $variable_name convention.
// The Composer resolves these against the caller-supplied context.
//
// All primitive_ids reference concrete (non-abstract) primitives from the
// primitive library so that the strategy can be immediately executed.

"use strict";

const STRATEGIES = [
    // =========================================================================
    // STRATEGY: Account Takeover via New Device + Fund Drain
    // =========================================================================
    {
        strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
        name: "Account Takeover via New Device and Fund Drain",
        description:
            "Multi-step account takeover: attacker introduces a new device onto the victim account, " +
            "simulates a successful login from that device, registers a mule beneficiary, " +
            "then drains funds to the mule account. " +
            "Tests device-change detection, ATO login signals, and fund-transfer anomalies.",
        attack_family: "ACCOUNT_TAKEOVER",
        severity: "HIGH",
        step_templates: [
            {
                template_step_id: "tmpl_01_register_device",
                primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                parameter_bindings: {
                    user_id: "$victim_user_id",
                    device_type: "MOBILE",
                    operating_system: "Android 14",
                    ip_address: "$attacker_ip"
                },
                delay_ms: null,
                depends_on: null,
                on_failure: "ABORT",
                description: "Register attacker-controlled device on victim's account"
            },
            {
                template_step_id: "tmpl_02_ato_login",
                primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                parameter_bindings: {
                    user_id: "$victim_user_id",
                    success: true
                },
                delay_ms: 500,
                depends_on: ["tmpl_01_register_device"],
                on_failure: "ABORT",
                description: "Simulate successful ATO login from the new device"
            },
            {
                template_step_id: "tmpl_03_add_beneficiary",
                primitive_id: "PRIM_ADD_MULE_BENEFICIARY",
                parameter_bindings: {
                    user_id: "$victim_user_id",
                    target_account_id: "$mule_account_id",
                    nickname: "Friend"
                },
                delay_ms: 1000,
                depends_on: ["tmpl_02_ato_login"],
                on_failure: "ABORT",
                description: "Register mule account as a beneficiary of the victim"
            },
            {
                template_step_id: "tmpl_04_drain_funds",
                primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                parameter_bindings: {
                    sender_account_id: "$victim_account_id",
                    receiver_account_id: "$mule_account_id",
                    initiator_user_id: "$victim_user_id",
                    amount: "$drain_amount",
                    channel: "MOBILE_APP"
                },
                delay_ms: 500,
                depends_on: ["tmpl_03_add_beneficiary"],
                on_failure: "ABORT",
                description: "Transfer funds from victim to mule account"
            }
        ],
        required_context: {
            entities: [
                "victim_user_id",
                "victim_account_id",
                "mule_account_id",
                "attacker_ip",
                "drain_amount"
            ],
            simulation_id: true,
            experiment_id: true
        },
        version: "1.0.0",
        tags: ["ato", "device-spoofing", "fund-drain", "mule-network"],
        planner_prompt_hint:
            "Simulate an attacker who has stolen a victim's credentials and wants to " +
            "take over their account and drain funds. Start with device registration."
    },

    // =========================================================================
    // STRATEGY: Velocity Transaction Abuse
    // =========================================================================
    {
        strategy_id: "STRAT_VELOCITY_FUND_DRAIN",
        name: "High-Velocity Transaction Abuse",
        description:
            "Multiple rapid fund transfers from the same source account to a mule account. " +
            "Tests transaction velocity detection, split-amount controls, and rate limiting. " +
            "Requires a mule beneficiary to already be registered.",
        attack_family: "VELOCITY_ABUSE",
        severity: "HIGH",
        step_templates: [
            {
                template_step_id: "tmpl_01_add_beneficiary",
                primitive_id: "PRIM_ADD_MULE_BENEFICIARY",
                parameter_bindings: {
                    user_id: "$victim_user_id",
                    target_account_id: "$mule_account_id"
                },
                delay_ms: null,
                depends_on: null,
                on_failure: "ABORT",
                description: "Register mule beneficiary"
            },
            {
                template_step_id: "tmpl_02_transfer_1",
                primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                parameter_bindings: {
                    sender_account_id: "$victim_account_id",
                    receiver_account_id: "$mule_account_id",
                    initiator_user_id: "$victim_user_id",
                    amount: "$split_amount",
                    channel: "MOBILE_APP"
                },
                delay_ms: null,
                depends_on: ["tmpl_01_add_beneficiary"],
                on_failure: "CONTINUE",
                description: "First rapid transfer"
            },
            {
                template_step_id: "tmpl_03_transfer_2",
                primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                parameter_bindings: {
                    sender_account_id: "$victim_account_id",
                    receiver_account_id: "$mule_account_id",
                    initiator_user_id: "$victim_user_id",
                    amount: "$split_amount",
                    channel: "MOBILE_APP"
                },
                delay_ms: 200,
                depends_on: ["tmpl_02_transfer_1"],
                on_failure: "CONTINUE",
                description: "Second rapid transfer (velocity test)"
            },
            {
                template_step_id: "tmpl_04_transfer_3",
                primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                parameter_bindings: {
                    sender_account_id: "$victim_account_id",
                    receiver_account_id: "$mule_account_id",
                    initiator_user_id: "$victim_user_id",
                    amount: "$split_amount",
                    channel: "MOBILE_APP"
                },
                delay_ms: 200,
                depends_on: ["tmpl_03_transfer_2"],
                on_failure: "CONTINUE",
                description: "Third rapid transfer (velocity test)"
            }
        ],
        required_context: {
            entities: [
                "victim_user_id",
                "victim_account_id",
                "mule_account_id",
                "split_amount"
            ],
            simulation_id: true,
            experiment_id: true
        },
        version: "1.0.0",
        tags: ["velocity", "split-transactions", "fund-drain", "mule-network"],
        planner_prompt_hint:
            "Simulate an attacker splitting a large withdrawal into multiple rapid smaller " +
            "transactions to evade velocity controls and amount thresholds."
    },

    // =========================================================================
    // STRATEGY: KYC Bypass + Identity Fraud
    // =========================================================================
    {
        strategy_id: "STRAT_KYC_BYPASS_FUND_TRANSFER",
        name: "KYC Bypass and Fund Transfer",
        description:
            "Simulate tampering with a user's KYC status to VERIFIED, then exploiting the " +
            "resulting trust level to register a mule beneficiary and transfer funds. " +
            "Tests KYC status change detection and post-KYC-change transaction monitoring.",
        attack_family: "IDENTITY_FRAUD",
        severity: "MEDIUM",
        step_templates: [
            {
                template_step_id: "tmpl_01_tamper_kyc",
                primitive_id: "PRIM_TAMPER_KYC_VERIFICATION",
                parameter_bindings: {
                    kyc_id: "$target_kyc_id",
                    verification_status: "VERIFIED"
                },
                delay_ms: null,
                depends_on: null,
                on_failure: "ABORT",
                description: "Force-verify KYC for a synthetic identity"
            },
            {
                template_step_id: "tmpl_02_add_beneficiary",
                primitive_id: "PRIM_ADD_MULE_BENEFICIARY",
                parameter_bindings: {
                    user_id: "$target_user_id",
                    target_account_id: "$mule_account_id"
                },
                delay_ms: null,
                depends_on: ["tmpl_01_tamper_kyc"],
                on_failure: "ABORT",
                description: "Register mule as beneficiary after KYC verification"
            },
            {
                template_step_id: "tmpl_03_transfer",
                primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                parameter_bindings: {
                    sender_account_id: "$target_account_id",
                    receiver_account_id: "$mule_account_id",
                    initiator_user_id: "$target_user_id",
                    amount: "$transfer_amount"
                },
                delay_ms: null,
                depends_on: ["tmpl_02_add_beneficiary"],
                on_failure: "ABORT",
                description: "Transfer funds after KYC bypass"
            }
        ],
        required_context: {
            entities: [
                "target_user_id",
                "target_kyc_id",
                "target_account_id",
                "mule_account_id",
                "transfer_amount"
            ],
            simulation_id: true,
            experiment_id: true
        },
        version: "1.0.0",
        tags: ["kyc", "identity-fraud", "verification-bypass", "mule-network"],
        planner_prompt_hint:
            "Simulate an attacker who manipulates KYC status to bypass identity controls " +
            "and then exploits the resulting trust to transfer funds."
    },

    // =========================================================================
    // STRATEGY: Brute Force Login + Account Freeze
    // =========================================================================
    {
        strategy_id: "STRAT_BRUTE_FORCE_THEN_FREEZE",
        name: "Brute Force Login Followed by Account Freeze",
        description:
            "Simulate repeated failed login attempts (brute force) followed by a " +
            "successful account takeover and then freezing the victim's account to " +
            "prevent the legitimate user from recovering access. " +
            "Tests failed login detection and post-ATO account manipulation signals.",
        attack_family: "ACCOUNT_TAKEOVER",
        severity: "CRITICAL",
        step_templates: [
            {
                template_step_id: "tmpl_01_fail_login_1",
                primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                parameter_bindings: {
                    user_id: "$victim_user_id",
                    success: false
                },
                delay_ms: null,
                depends_on: null,
                on_failure: "CONTINUE",
                description: "First failed brute-force login attempt"
            },
            {
                template_step_id: "tmpl_02_fail_login_2",
                primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                parameter_bindings: {
                    user_id: "$victim_user_id",
                    success: false
                },
                delay_ms: 300,
                depends_on: ["tmpl_01_fail_login_1"],
                on_failure: "CONTINUE",
                description: "Second failed brute-force login attempt"
            },
            {
                template_step_id: "tmpl_03_success_login",
                primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                parameter_bindings: {
                    user_id: "$victim_user_id",
                    success: true
                },
                delay_ms: 300,
                depends_on: ["tmpl_02_fail_login_2"],
                on_failure: "ABORT",
                description: "Successful ATO login after brute-force"
            },
            {
                template_step_id: "tmpl_04_freeze_account",
                primitive_id: "PRIM_MANIPULATE_ACCOUNT_STATUS",
                parameter_bindings: {
                    account_id: "$victim_account_id",
                    status: "FROZEN"
                },
                delay_ms: 500,
                depends_on: ["tmpl_03_success_login"],
                on_failure: "CONTINUE",
                description: "Freeze victim account to prevent recovery"
            }
        ],
        required_context: {
            entities: [
                "victim_user_id",
                "victim_account_id"
            ],
            simulation_id: true,
            experiment_id: true
        },
        version: "1.0.0",
        tags: ["brute-force", "ato", "account-freeze", "critical"],
        planner_prompt_hint:
            "Simulate an attacker trying multiple passwords before succeeding, then " +
            "freezing the victim's account to prevent them from recovering access."
    }
];

module.exports = STRATEGIES;
