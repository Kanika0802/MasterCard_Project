// simulator/src/application/services/AccountService.js

const crypto = require("crypto");
const Account = require("../../domain/entities/Account");
const AccountRepository = require("../../infrastructure/postgres/repositories/AccountRepository");
const UserRepository = require("../../infrastructure/mongodb/repositories/UserRepository");
const OutboxRepository = require("../../infrastructure/postgres/repositories/OutboxRepository");
const EventFactory = require("../../events/EventFactory");
const { AccountStatus, AccountType, EventType } = require("../../domain/constants");
const { NotFoundError, ConflictError, ValidationError } = require("../../domain/errors");

class AccountService {
    constructor(
        accountRepo = new AccountRepository(),
        userRepo = new UserRepository(),
        outboxRepo = new OutboxRepository()
    ) {
        this.accountRepo = accountRepo;
        this.userRepo = userRepo;
        this.outboxRepo = outboxRepo;
    }

    _generateSyntheticAccountNumber() {
        const rand = Math.floor(1000000000 + Math.random() * 9000000000);
        return `SYN_ACC_${rand}`;
    }

    async createAccount({
        account_id = crypto.randomUUID(),
        user_id,
        account_number = null,
        account_type = AccountType.SAVINGS,
        currency = "USD",
        initial_balance = 0,
        status = AccountStatus.ACTIVE,
        simulation_id = "default_sim",
        experiment_id = "default_exp"
    }) {
        // Cross-database validation: Ensure user exists in MongoDB
        const user = await this.userRepo.findById(user_id);
        if (!user) {
            throw new NotFoundError("User", user_id);
        }

        const accNumber = account_number || this._generateSyntheticAccountNumber();

        const existingAcc = await this.accountRepo.findByAccountNumber(accNumber);
        if (existingAcc) {
            throw new ConflictError(`Account with number '${accNumber}' already exists.`);
        }

        const account = new Account({
            account_id,
            user_id,
            account_number: accNumber,
            account_type,
            currency,
            balance: initial_balance,
            status
        });

        const createdAccount = await this.accountRepo.create(account);

        // Record outbox event
        const event = EventFactory.create({
            event_type: EventType.ACCOUNT_CREATED,
            entity_type: "account",
            entity_id: createdAccount.account_id,
            actor_id: user_id,
            simulation_id,
            experiment_id,
            payload: createdAccount.toJSON()
        });

        await this.outboxRepo.insert({
            event_id: event.event_id,
            event_type: event.event_type,
            topic: EventFactory.getTopicForEventType(event.event_type),
            partition_key: createdAccount.account_id,
            payload: event.toJSON()
        });

        return createdAccount;
    }

    async getAccount(accountId) {
        const account = await this.accountRepo.findById(accountId);
        if (!account) {
            throw new NotFoundError("Account", accountId);
        }
        return account;
    }

    async listAccounts(filterOptions = {}) {
        return this.accountRepo.list(filterOptions);
    }

    async changeAccountStatus(accountId, newStatus, { simulation_id = "default_sim", experiment_id = "default_exp" } = {}) {
        const account = await this.getAccount(accountId);
        account.changeStatus(newStatus);

        const updated = await this.accountRepo.updateStatus(accountId, newStatus);

        const event = EventFactory.create({
            event_type: EventType.ACCOUNT_STATUS_CHANGED,
            entity_type: "account",
            entity_id: accountId,
            actor_id: updated.user_id,
            simulation_id,
            experiment_id,
            payload: {
                account_id: accountId,
                status: newStatus,
                previous_status: account.status
            }
        });

        await this.outboxRepo.insert({
            event_id: event.event_id,
            event_type: event.event_type,
            topic: EventFactory.getTopicForEventType(event.event_type),
            partition_key: accountId,
            payload: event.toJSON()
        });

        return updated;
    }

    async closeAccount(accountId, options = {}) {
        return this.changeAccountStatus(accountId, AccountStatus.CLOSED, options);
    }
}

module.exports = AccountService;
