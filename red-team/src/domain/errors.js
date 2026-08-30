// red-team/src/domain/errors.js

class RedTeamDomainError extends Error {
    constructor(message, errorCode = "RED_TEAM_DOMAIN_ERROR") {
        super(message);
        this.name = this.constructor.name;
        this.errorCode = errorCode;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ScenarioValidationError extends RedTeamDomainError {
    constructor(message, details = null) {
        super(message, "SCENARIO_VALIDATION_ERROR");
        this.details = details;
    }
}

class StepValidationError extends RedTeamDomainError {
    constructor(message, details = null) {
        super(message, "STEP_VALIDATION_ERROR");
        this.details = details;
    }
}

class ExecutionStateError extends RedTeamDomainError {
    constructor(message) {
        super(message, "EXECUTION_STATE_ERROR");
    }
}

module.exports = {
    RedTeamDomainError,
    ScenarioValidationError,
    StepValidationError,
    ExecutionStateError
};
