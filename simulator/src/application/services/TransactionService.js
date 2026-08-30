// simulator/src/application/services/TransactionService.js

const crypto = require("crypto");
const { pool } = require("../../config/postgres");
const Transaction = require("../../domain/entities/Transaction");
const TransactionRepository = require("../../infrastructure/postgres/repositories/TransactionRepository");
const AccountRepository = require("../../infrastructure/postgres/repositories/AccountRepository");
const MerchantRepository = require("../../infrastructure/postgres/repositories/MerchantRepository");
const LedgerService = require("./LedgerService");
const OutboxRepository = require("../../infrastructure/postgres/repositories/OutboxRepository");
const EventFactory = require("../../events/EventFactory");
const { TransactionStatus, TransactionType, TransactionChannel, EventType } = require("../../domain/constants");
const {
    NotFoundError,
    ValidationError,
    InsufficientFundsError,
    AccountInactiveError,
    ConflictError
} = require("../../domain/errors");

class TransactionService {
    constructor(
        transactionRepo = new TransactionRepository(),
        accountRepo = new AccountRepository(),
        merchantRepo = new MerchantRepository(),
        ledgerService = new LedgerService(),
        outboxRepo = new OutboxRepository(),
        dbPool = pool
    ) {
        this.transactionRepo = transactionRepo;
        this.accountRepo = accountRepo;
        this.merchantRepo = merchantRepo;
        this.ledgerService = ledgerService;
        this.outboxRepo = outboxRepo;
        this.pool = dbPool;
    }

    _generateReference() {
        const rand = Math.floor(100000000 + Math.random() * 900000000);
        return `TXN_${Date.now()}_${rand}`;
    }

    async createAndProcessTransaction({
        transaction_id = crypto.randomUUID(),
        transaction_reference = null,
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
        simulation_id = "default_sim",
        experiment_id = "default_exp",
        idempotency_key = null,
        adversarial_metadata = null
    }) {
        const numAmount = typeof amount === "string" ? parseFloat(amount) : Number(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            throw new ValidationError("Transaction amount must be strictly greater than zero.");
        }

        const ref = transaction_reference || (idempotency_key ? `IDEMP_${idempotency_key}` : this._generateReference());

        // Idempotency check: if already processed, return existing completed transaction
        const existingTx = await this.transactionRepo.findByReference(ref);
        if (existingTx) {
            return {
                transaction: existingTx,
                is_idempotent_replay: true
            };
        }

        // Validate destinations
        let effectiveReceiverAccountId = receiver_account_id;
        if (merchant_id) {
            const merchant = await this.merchantRepo.findById(merchant_id);
            if (!merchant) {
                throw new NotFoundError("Merchant", merchant_id);
            }
            if (!merchant.isActive()) {
                throw new ValidationError(`Merchant '${merchant_id}' is not ACTIVE (status: ${merchant.status}).`);
            }
            if (merchant.settlement_account_id) {
                effectiveReceiverAccountId = merchant.settlement_account_id;
            }
        }

        if (!sender_account_id && !effectiveReceiverAccountId) {
            throw new ValidationError("Transaction must specify at least a sender or a receiver/merchant.");
        }

        const client = await this.pool.connect();

        try {
            await client.query("BEGIN");

            // Row-level locking to prevent race conditions and balance inconsistencies.
            // Lock accounts in consistent ascending order to prevent deadlocks under high concurrency.
            const accountsToLock = [sender_account_id, effectiveReceiverAccountId]
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b));

            const lockedAccounts = new Map();
            for (const accId of accountsToLock) {
                const acc = await this.accountRepo.findByIdForUpdate(accId, client);
                if (!acc) {
                    throw new NotFoundError("Account", accId);
                }
                lockedAccounts.set(accId, acc);
            }

            const ledgerRecords = [];

            // 1. Debit Sender
            let senderBefore = null;
            let senderAfter = null;
            if (sender_account_id) {
                const senderAcc = lockedAccounts.get(sender_account_id);
                senderAcc.assertEligibleForDebit(numAmount);
                const debitResult = senderAcc.debit(numAmount);
                senderBefore = debitResult.balanceBefore;
                senderAfter = debitResult.balanceAfter;

                await this.accountRepo.updateBalance(sender_account_id, senderAfter, client);

                ledgerRecords.push({
                    account_id: sender_account_id,
                    entry_type: "DEBIT",
                    amount: numAmount,
                    balance_before: senderBefore,
                    balance_after: senderAfter
                });
            }

            // 2. Credit Receiver
            let receiverBefore = null;
            let receiverAfter = null;
            if (effectiveReceiverAccountId) {
                const receiverAcc = lockedAccounts.get(effectiveReceiverAccountId);
                receiverAcc.assertEligibleForCredit(numAmount);
                const creditResult = receiverAcc.credit(numAmount);
                receiverBefore = creditResult.balanceBefore;
                receiverAfter = creditResult.balanceAfter;

                await this.accountRepo.updateBalance(effectiveReceiverAccountId, receiverAfter, client);

                ledgerRecords.push({
                    account_id: effectiveReceiverAccountId,
                    entry_type: "CREDIT",
                    amount: numAmount,
                    balance_before: receiverBefore,
                    balance_after: receiverAfter
                });
            }

            // 3. Create Transaction Record
            const transaction = new Transaction({
                transaction_id,
                transaction_reference: ref,
                sender_account_id,
                receiver_account_id: effectiveReceiverAccountId,
                merchant_id,
                initiator_user_id,
                amount: numAmount,
                currency,
                transaction_type,
                channel,
                device_id,
                location,
                status: TransactionStatus.COMPLETED,
                created_at: new Date(),
                authorized_at: new Date(),
                completed_at: new Date(),
                experiment_id
            });

            const createdTx = await this.transactionRepo.create(transaction, client);

            // 4. Create Ledger Entries
            for (const record of ledgerRecords) {
                if (record.entry_type === "DEBIT") {
                    await this.ledgerService.recordDebit({
                        transaction_id: createdTx.transaction_id,
                        account_id: record.account_id,
                        amount: record.amount,
                        balance_before: record.balance_before,
                        balance_after: record.balance_after
                    }, client);
                } else if (record.entry_type === "CREDIT") {
                    await this.ledgerService.recordCredit({
                        transaction_id: createdTx.transaction_id,
                        account_id: record.account_id,
                        amount: record.amount,
                        balance_before: record.balance_before,
                        balance_after: record.balance_after
                    }, client);
                }
            }

            // 5. Create Transaction Completed Outbox Event
            const envelope = EventFactory.create({
                event_type: EventType.TRANSACTION_COMPLETED,
                entity_type: "transaction",
                entity_id: createdTx.transaction_id,
                actor_id: initiator_user_id,
                device_id,
                idempotency_key,
                simulation_id,
                experiment_id,
                adversarial_metadata,
                payload: createdTx.toJSON()
            });

            await this.outboxRepo.insert({
                event_id: envelope.event_id,
                event_type: envelope.event_type,
                topic: EventFactory.getTopicForEventType(envelope.event_type),
                partition_key: sender_account_id || effectiveReceiverAccountId,
                payload: envelope.toJSON()
            }, client);

            await client.query("COMMIT");

            return {
                transaction: createdTx,
                is_idempotent_replay: false
            };
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    async getTransaction(transactionId) {
        const tx = await this.transactionRepo.findById(transactionId);
        if (!tx) {
            throw new NotFoundError("Transaction", transactionId);
        }
        return tx;
    }

    async listTransactions(filterOptions = {}) {
        return this.transactionRepo.list(filterOptions);
    }

    async updateTransactionState(transactionId, status, failureReason = null) {
        await this.getTransaction(transactionId);
        return this.transactionRepo.updateStatus(transactionId, status, failureReason);
    }

    async deleteTestTransaction(transactionId) {
        await this.getTransaction(transactionId);
        await this.transactionRepo.delete(transactionId);
    }
}

module.exports = TransactionService;
