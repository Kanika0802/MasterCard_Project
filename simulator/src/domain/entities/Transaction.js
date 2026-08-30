// simulator/src/domain/entities/Transaction.js

const { ValidationError } = require("../errors");
const { TransactionStatus, TransactionType, TransactionChannel } = require("../constants");

class Transaction {
    constructor({
        transaction_id,
        transaction_reference,
        sender_account_id = null,
        receiver_account_id = null,
        merchant_id = null,
        initiator_user_id,
        amount,
        currency = "USD",
        transaction_type = TransactionType.P2P_TRANSFER,
        channel = TransactionChannel.MOBILE_APP,
        device_id = null,
        location = null,
        status = TransactionStatus.INITIATED,
        created_at = new Date(),
        authorized_at = null,
        completed_at = null,
        failure_reason = null,
        experiment_id = null
    }) {
        this.transaction_id = transaction_id;
        this.transaction_reference = transaction_reference;
        this.sender_account_id = sender_account_id;
        this.receiver_account_id = receiver_account_id;
        this.merchant_id = merchant_id;
        this.initiator_user_id = initiator_user_id;
        this.amount = typeof amount === "string" ? parseFloat(amount) : Number(amount);
        this.currency = currency;
        this.transaction_type = transaction_type;
        this.channel = channel;
        this.device_id = device_id;
        this.location = location;
        this.status = status;
        this.created_at = created_at;
        this.authorized_at = authorized_at;
        this.completed_at = completed_at;
        this.failure_reason = failure_reason;
        this.experiment_id = experiment_id;

        this.validate();
    }

    validate() {
        if (!this.transaction_id) throw new ValidationError("transaction_id is required.");
        if (!this.transaction_reference) throw new ValidationError("transaction_reference is required.");
        if (!this.initiator_user_id) throw new ValidationError("initiator_user_id is required.");
        if (isNaN(this.amount) || this.amount <= 0) {
            throw new ValidationError(`Transaction amount must be strictly greater than zero. Value: ${this.amount}`);
        }
        if (!this.currency || this.currency.length !== 3) {
            throw new ValidationError("currency must be a 3-character ISO code.");
        }
        if (!Object.values(TransactionStatus).includes(this.status)) {
            throw new ValidationError(`Invalid transaction status: ${this.status}`);
        }
        if (!Object.values(TransactionType).includes(this.transaction_type)) {
            throw new ValidationError(`Invalid transaction type: ${this.transaction_type}`);
        }
    }

    authorize() {
        this.status = TransactionStatus.AUTHORIZED;
        this.authorized_at = new Date();
    }

    startProcessing() {
        this.status = TransactionStatus.PROCESSING;
    }

    complete() {
        this.status = TransactionStatus.COMPLETED;
        this.completed_at = new Date();
    }

    fail(reason) {
        this.status = TransactionStatus.FAILED;
        this.failure_reason = reason;
        this.completed_at = new Date();
    }

    reverse(reason = "Reversal requested") {
        this.status = TransactionStatus.REVERSED;
        this.failure_reason = reason;
        this.completed_at = new Date();
    }

    toJSON() {
        return {
            transaction_id: this.transaction_id,
            transaction_reference: this.transaction_reference,
            sender_account_id: this.sender_account_id,
            receiver_account_id: this.receiver_account_id,
            merchant_id: this.merchant_id,
            initiator_user_id: this.initiator_user_id,
            amount: this.amount,
            currency: this.currency,
            transaction_type: this.transaction_type,
            channel: this.channel,
            device_id: this.device_id,
            location: this.location,
            status: this.status,
            created_at: this.created_at,
            authorized_at: this.authorized_at,
            completed_at: this.completed_at,
            failure_reason: this.failure_reason,
            experiment_id: this.experiment_id
        };
    }
}

module.exports = Transaction;
