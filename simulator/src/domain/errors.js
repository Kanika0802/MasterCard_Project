// simulator/src/domain/errors.js

class DomainError extends Error {
    constructor(message, statusCode = 400, errorCode = "DOMAIN_ERROR") {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends DomainError {
    constructor(message, details = null) {
        super(message, 400, "VALIDATION_ERROR");
        this.details = details;
    }
}

class NotFoundError extends DomainError {
    constructor(entityName, id) {
        super(`${entityName} with id '${id}' not found.`, 404, "NOT_FOUND");
        this.entityName = entityName;
        this.entityId = id;
    }
}

class ConflictError extends DomainError {
    constructor(message, errorCode = "CONFLICT") {
        super(message, 409, errorCode);
    }
}

class InsufficientFundsError extends DomainError {
    constructor(accountId, requestedAmount, availableBalance) {
        super(
            `Insufficient funds in account '${accountId}'. Requested: ${requestedAmount}, Available: ${availableBalance}`,
            400,
            "INSUFFICIENT_FUNDS"
        );
        this.accountId = accountId;
        this.requestedAmount = requestedAmount;
        this.availableBalance = availableBalance;
    }
}

class AccountInactiveError extends DomainError {
    constructor(accountId, status) {
        super(`Account '${accountId}' is not ACTIVE (current status: ${status}).`, 400, "ACCOUNT_INACTIVE");
        this.accountId = accountId;
        this.status = status;
    }
}

class ConcurrencyError extends DomainError {
    constructor(message = "Concurrent modification detected. Please retry.") {
        super(message, 409, "CONCURRENCY_CONFLICT");
    }
}

class IdempotencyConflictError extends DomainError {
    constructor(idempotencyKey) {
        super(`A transaction with idempotency key '${idempotencyKey}' has already been processed.`, 409, "IDEMPOTENCY_CONFLICT");
        this.idempotencyKey = idempotencyKey;
    }
}

module.exports = {
    DomainError,
    ValidationError,
    NotFoundError,
    ConflictError,
    InsufficientFundsError,
    AccountInactiveError,
    ConcurrencyError,
    IdempotencyConflictError
};
