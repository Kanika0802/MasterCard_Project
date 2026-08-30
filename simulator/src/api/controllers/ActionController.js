// simulator/src/api/controllers/ActionController.js

const crypto = require("crypto");
const UserService = require("../../application/services/UserService");
const AccountService = require("../../application/services/AccountService");
const BeneficiaryService = require("../../application/services/BeneficiaryService");
const TransactionService = require("../../application/services/TransactionService");
const AuthenticationService = require("../../application/services/AuthenticationService");
const DeviceService = require("../../application/services/DeviceService");
const KycService = require("../../application/services/KycService");
const { ValidationError } = require("../../domain/errors");

class ActionController {
    constructor() {
        this.userService = new UserService();
        this.accountService = new AccountService();
        this.beneficiaryService = new BeneficiaryService();
        this.transactionService = new TransactionService();
        this.authService = new AuthenticationService();
        this.deviceService = new DeviceService();
        this.kycService = new KycService();
    }

    executeAction = async (req, res) => {
        const actionId = crypto.randomUUID();
        const {
            action,
            simulation_id = "default_sim",
            experiment_id = "default_exp",
            adversarial_metadata = null,
            parameters = {}
        } = req.body;

        if (!action) {
            throw new ValidationError("action is required in Action request.");
        }

        const stateChanges = [];
        const emittedEvents = [];

        try {
            switch (action) {
                case "ADD_BENEFICIARY": {
                    const beneficiary = await this.beneficiaryService.addBeneficiary({
                        ...parameters,
                        simulation_id,
                        experiment_id
                    });
                    stateChanges.push({
                        entity_type: "beneficiary",
                        entity_id: beneficiary.beneficiary_id,
                        change: "CREATED",
                        data: beneficiary.toJSON()
                    });
                    break;
                }

                case "PERFORM_TRANSACTION": {
                    const result = await this.transactionService.createAndProcessTransaction({
                        ...parameters,
                        simulation_id,
                        experiment_id,
                        adversarial_metadata
                    });
                    stateChanges.push({
                        entity_type: "transaction",
                        entity_id: result.transaction.transaction_id,
                        change: "COMPLETED",
                        data: result.transaction.toJSON()
                    });
                    break;
                }

                case "SIMULATE_LOGIN": {
                    const authEvent = await this.authService.simulateLogin({
                        ...parameters,
                        simulation_id,
                        experiment_id,
                        adversarial_metadata
                    });
                    stateChanges.push({
                        entity_type: "auth_event",
                        entity_id: authEvent.event_id,
                        change: "RECORDED",
                        data: authEvent.toJSON()
                    });
                    break;
                }

                case "REGISTER_DEVICE": {
                    const device = await this.deviceService.registerDevice({
                        ...parameters,
                        simulation_id,
                        experiment_id
                    });
                    stateChanges.push({
                        entity_type: "device",
                        entity_id: device.device_id,
                        change: "REGISTERED",
                        data: device.toJSON()
                    });
                    break;
                }

                case "UPDATE_KYC": {
                    const { kyc_id, ...updates } = parameters;
                    const kyc = await this.kycService.updateKyc(kyc_id, updates, { simulation_id, experiment_id });
                    stateChanges.push({
                        entity_type: "kyc",
                        entity_id: kyc.kyc_id,
                        change: "UPDATED",
                        data: kyc.toJSON()
                    });
                    break;
                }

                case "CHANGE_ACCOUNT_STATUS": {
                    const { account_id, status } = parameters;
                    const account = await this.accountService.changeAccountStatus(account_id, status, { simulation_id, experiment_id });
                    stateChanges.push({
                        entity_type: "account",
                        entity_id: account.account_id,
                        change: "STATUS_CHANGED",
                        data: account.toJSON()
                    });
                    break;
                }

                default:
                    throw new ValidationError(`Unsupported simulator action: ${action}`);
            }

            return res.status(200).json({
                success: true,
                action_id: actionId,
                action_type: action,
                simulation_id,
                experiment_id,
                state_changes: stateChanges,
                adversarial_metadata,
                error: null
            });
        } catch (err) {
            return res.status(err.statusCode || 400).json({
                success: false,
                action_id: actionId,
                action_type: action,
                simulation_id,
                experiment_id,
                state_changes: [],
                adversarial_metadata,
                error: {
                    code: err.errorCode || "ACTION_EXECUTION_FAILED",
                    message: err.message
                }
            });
        }
    };
}

module.exports = ActionController;
